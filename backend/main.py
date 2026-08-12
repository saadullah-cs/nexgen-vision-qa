# defect-detection-web/main.py

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from inference import PCBInferenceEngine

MODEL_PATH = os.getenv("MODEL_PATH", "models/pcb_yolov8n.onnx")
engine: PCBInferenceEngine = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global engine
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"ONNX model file not found at path: {MODEL_PATH}")
    
    # Initialize session into RAM on boot
    engine = PCBInferenceEngine(model_path=MODEL_PATH)
    yield

app = FastAPI(title="NexGen QA V2 Engine", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/predict")
async def predict_static_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid file type. Image required.")
    
    image_bytes = await file.read()
    results = engine.detect(image_bytes)
    return results

@app.websocket("/ws/stream")
async def stream_detection(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Receive raw binary image frame from Next.js browser stream
            frame_bytes = await websocket.receive_bytes()
            results = engine.detect(frame_bytes)
            await websocket.send_json(results)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"status": "error", "message": str(e)})
        await websocket.close()