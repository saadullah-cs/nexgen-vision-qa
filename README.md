# 🛡️ NexGen Vision QA (V2)

![Version](https://img.shields.io/badge/Version-2.0.0-blue.svg)
![Architecture](https://img.shields.io/badge/Architecture-Decoupled-success.svg)
![Model](https://img.shields.io/badge/Model-YOLOv8_ONNX-orange.svg)
![Status](https://img.shields.io/badge/Status-Production_Ready-success.svg)

**NexGen Vision QA** is a real time object detection pipeline engineered for Printed Circuit Board (PCB) manufacturing. 

Bypassing traditional supervised bottlenecks, this system leverages a highly optimized ONNX inference graph and an asynchronous WebRTC/WebSocket pipeline to deliver zero latency fault detection directly through a cinematic SCADA-inspired web dashboard.

---

## 🏗️ System Architecture

The infrastructure is strictly decoupled to ensure isolated scaling, utilizing a stateless API design.

### 1. The Inference Engine (Backend)
*   **Framework:** FastAPI (Python 3.12)
*   **Runtime:** ONNX Runtime (`CPUExecutionProvider` / `CUDAExecutionProvider`)
*   **Model Base:** YOLOv8 Nano (Supervised, trained on PKU-Market-PCB)
*   **Protocol:** Asynchronous ASGI WebSockets for stream injection; REST for static payload analysis.
*   **Logic:** Executes Non-Maximum Suppression (NMS) matrix math to parse `[1, 10, 8400]` prediction tensors into strict JSON telemetry payloads.

### 2. The Command Dashboard (Frontend)
*   **Framework:** Next.js 15 (App Router), React 19
*   **Styling:** Tailwind CSS v4 (Glassmorphism, Dark Mode, SCADA HUD)
*   **Stream Processing:** Implements a localized HTML5 `<canvas>` extraction loop, throttling raw hardware video feeds to an optimal 8 FPS before piping to the WebSocket, completely mitigating client-side thermal throttling.

---

## 💡 Key Capabilities

- **Live Optics Streaming:** Dynamic hardware allocation with recursive driver-lock backoff loops.
- **Cinematic HUD:** Real-time rendering of bounding boxes, confidence rings, and multi-class Z-order collision logic over the live video element.
- **Hardware Agnostic:** Compiles down to a static `.onnx` graph, removing heavy PyTorch dependencies for hyper-lightweight containerization.
- **6-Class Defect Topology:** Precisely identifies Missing Holes, Mouse Bites, Open Circuits, Short Circuits, Spurs, and Spurious Copper.

---

## 💻 Local Ignition (Development)

### Prerequisites
*   Node.js 20+
*   Python 3.12+

### 1. Ignite the API Node (FastAPI)
Navigate to the backend directory and initialize the server.
```bash
cd defect-detection-web
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Ignite the Client Interface (Next.js)
In a separate terminal, start the UI layer.
```bash
cd dashboard
npm install
npm run dev
```
Navigate to http://localhost:3000  
The system will automatically establish the WebSocket handshake.

---

## ☁️ Deployment Topography
This architecture is optimized for distributed edge deployment:

- **Frontend**: Deployed globally via the Vercel Edge Network.  
- **Backend**: Containerized via Docker and deployed to Hugging Face Spaces to handle the WebSocket stream bandwidth flawlessly.

---

## 🛡️ License & Authorship
Designed and engineered by **Saad Ullah**.  
Proprietary technical architecture. All rights reserved.

> **🛑 PROPRIETARY SOFTWARE:** 
> This repository is public strictly for portfolio demonstration and technical evaluation. The code, UI/UX design (SCADA HUD), and backend architecture are the exclusive intellectual property of **NexGen Builds**. Copying, cloning, or utilizing this source code for personal or commercial projects is strictly prohibited. See the `LICENSE` file for details.