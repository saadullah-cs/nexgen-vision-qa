# defect-detection-web/inference.py

import cv2
import numpy as np
import onnxruntime as ort
from typing import List, Dict, Any, Tuple

CLASS_NAMES = [
    "missing_hole",
    "mouse_bite",
    "open_circuit",
    "short_circuit",
    "spur",
    "spurious_copper"
]

class PCBInferenceEngine:
    def __init__(self, model_path: str, conf_threshold: float = 0.30, iou_threshold: float = 0.45):
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        
        # Initialize ONNX Runtime Session with fallback to CPU if CUDA provider unavailable
        self.session = ort.InferenceSession(
            model_path, 
            providers=['CUDAExecutionProvider', 'CPUExecutionProvider']
        )
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def preprocess(self, image_bytes: bytes) -> Tuple[np.ndarray, Tuple[int, int]]:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image bytes")
        
        orig_h, orig_w = img.shape[:2]
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        resized = cv2.resize(rgb_img, (640, 640), interpolation=cv2.INTER_LINEAR)
        
        # Normalize to [0.0, 1.0] and convert HWC -> NCHW
        input_tensor = resized.astype(np.float32) / 255.0
        input_tensor = np.transpose(input_tensor, (2, 0, 1))
        input_tensor = np.expand_dims(input_tensor, axis=0)
        
        return input_tensor, (orig_w, orig_h)

    def postprocess(self, outputs: np.ndarray, orig_size: Tuple[int, int]) -> List[Dict[str, Any]]:
        orig_w, orig_h = orig_size
        
        # Squeeze batch dimension and transpose [10, 8400] -> [8400, 10]
        predictions = np.squeeze(outputs[0])
        predictions = np.transpose(predictions)

        boxes = []
        confidences = []
        class_ids = []

        scale_x = orig_w / 640.0
        scale_y = orig_h / 640.0

        for pred in predictions:
            scores = pred[4:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]

            if confidence >= self.conf_threshold:
                x_center, y_center, width, height = pred[0:4]

                # Convert centered coordinates to top-left (x1, y1)
                x1 = int((x_center - width / 2) * scale_x)
                y1 = int((y_center - height / 2) * scale_y)
                w = int(width * scale_x)
                h = int(height * scale_y)

                boxes.append([x1, y1, w, h])
                confidences.append(float(confidence))
                class_ids.append(int(class_id))

        # Perform Non-Maximum Suppression
        indices = cv2.dnn.NMSBoxes(boxes, confidences, self.conf_threshold, self.iou_threshold)
        
        results = []
        if len(indices) > 0:
            for idx in indices.flatten():
                x, y, w, h = boxes[idx]
                results.append({
                    "class_id": class_ids[idx],
                    "class_name": CLASS_NAMES[class_ids[idx]],
                    "confidence": round(confidences[idx], 4),
                    "bbox": {
                        "x": max(0, x),
                        "y": max(0, y),
                        "width": max(1, w),
                        "height": max(1, h)
                    }
                })

        return results

    def detect(self, image_bytes: bytes) -> Dict[str, Any]:
        input_tensor, orig_size = self.preprocess(image_bytes)
        outputs = self.session.run([self.output_name], {self.input_name: input_tensor})
        detections = self.postprocess(outputs, orig_size)
        
        return {
            "status": "success",
            "image_dimensions": {"width": orig_size[0], "height": orig_size[1]},
            "count": len(detections),
            "detections": detections
        }