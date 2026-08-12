// src/lib/types.ts

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Detection = {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: BoundingBox;
};

export type DetectionResult = {
  status: string;
  image_dimensions: { width: number; height: number };
  count: number;
  detections: Detection[];
};

export type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "analyzing" }
  | { status: "success"; result: DetectionResult; imageDataUrl: string }
  | { status: "streaming"; isConnected: boolean; result?: DetectionResult }
  | { status: "error"; message: string };