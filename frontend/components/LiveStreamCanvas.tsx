// src/components/LiveStreamCanvas.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { DetectionResult, Detection } from "@/lib/types";
import { CameraOff, RotateCcw, AlertTriangle } from "lucide-react";

const TARGET_FPS = 8;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

const CLASS_COLORS: Record<string, string> = {
  missing_hole: "#eab308", // Premium Amber
  mouse_bite: "#f97316",   // Vibrant Orange
  open_circuit: "#ef4444", // Deep Red
  short_circuit: "#ec4899",// Hot Pink
  spur: "#8b5cf6",         // Neon Purple
  spurious_copper: "#06b6d4",// Cyan
};

// GLOBAL HARDWARE REGISTRY
// This prevents the OS driver from locking during rapid tab switching
if (typeof window !== "undefined") {
  (window as any)._nexgenHardwareStream = null;
}

interface LiveStreamCanvasProps {
  onTelemetryUpdate?: (result: DetectionResult) => void;
}

export function LiveStreamCanvas({ onTelemetryUpdate }: LiveStreamCanvasProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<string>("");
  
  const latestDetections = useRef<Detection[]>([]);
  const lastFrameTime = useRef<number>(0);
  const animationFrameId = useRef<number>(0);

  // Precision Chronometer
  useEffect(() => {
    const interval = setInterval(() => setTimestamp(new Date().toISOString().replace('T', ' ').slice(0, -5) + ' UTC'), 100);
    return () => clearInterval(interval);
  }, []);

  // CORE HARDWARE & NETWORK ENGINE
  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;
    let retryTimer: NodeJS.Timeout;

    const bootEngine = async (attempt = 1) => {
      try {
        // 1. Purge any existing ghost streams globally
        if ((window as any)._nexgenHardwareStream) {
          (window as any)._nexgenHardwareStream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          (window as any)._nexgenHardwareStream = null;
        }

        // 2. Enforce hardware breather to prevent OS driver lock
        await new Promise(resolve => setTimeout(resolve, 400));
        if (!isMounted) return;

        // 3. Acquire Hardware
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
        });

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        (window as any)._nexgenHardwareStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Dynamic WS URL: Uses Vercel's wss:// variable on the cloud, falls back to ws:// locally
        const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://127.0.0.1:8000";

        // 4. Ignite WebSocket ONLY after optics are secured
        ws = new WebSocket(`${WS_BASE_URL}/ws/stream`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) {
            setIsConnected(true);
            onTelemetryUpdate?.({
              status: "success", count: 0, detections: [], image_dimensions: { width: 1280, height: 720 }
            });
          }
        };
        ws.onclose = () => { if (isMounted) setIsConnected(false); };
        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const result: DetectionResult = JSON.parse(event.data);
            if (result.status === "success") {
              latestDetections.current = result.detections;
              onTelemetryUpdate?.(result);
            }
          } catch (e) {
            console.error("Payload execution error:", e);
          }
        };

      } catch (err: any) {
        if (!isMounted) return;
        
        if (attempt < 3 && (err.name === "AbortError" || err.name === "NotReadableError")) {
          retryTimer = setTimeout(() => bootEngine(attempt + 1), 800);
        } else {
          setCameraError(`Hardware Fault: ${err.message || err.name}.`);
        }
      }
    };

    bootEngine();

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      cancelAnimationFrame(animationFrameId.current);
      
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close(1000);
      }
      
      if ((window as any)._nexgenHardwareStream) {
        (window as any)._nexgenHardwareStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
        (window as any)._nexgenHardwareStream = null;
      }
      
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [onTelemetryUpdate]);

  // HIGH-FIDELITY RENDER PIPELINE
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!video || !canvas || !hiddenCanvas || cameraError) return;

    const ctx = canvas.getContext("2d");
    const hiddenCtx = hiddenCanvas.getContext("2d");
    if (!ctx || !hiddenCtx) return;

    const renderLoop = (time: number) => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const dpr = window.devicePixelRatio ?? 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr, dpr);

        const vW = video.videoWidth;
        const vH = video.videoHeight;
        const scale = Math.min(cssW / vW, cssH / vH);
        const drawW = vW * scale;
        const drawH = vH * scale;
        const offsetX = (cssW - drawW) / 2;
        const offsetY = (cssH - drawH) / 2;

        ctx.clearRect(0, 0, cssW, cssH);
        
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(offsetX, offsetY, drawW, drawH, 16);
        ctx.clip();
        ctx.drawImage(video, offsetX, offsetY, drawW, drawH);
        ctx.restore();

        if (time - lastFrameTime.current >= FRAME_INTERVAL && wsRef.current?.readyState === WebSocket.OPEN) {
          hiddenCanvas.width = vW;
          hiddenCanvas.height = vH;
          hiddenCtx.drawImage(video, 0, 0, vW, vH);
          hiddenCanvas.toBlob((blob) => {
            if (blob && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(blob);
          }, "image/jpeg", 0.7);
          lastFrameTime.current = time;
        }

        // Refined Bounding Boxes
        latestDetections.current.forEach((det) => {
          const color = CLASS_COLORS[det.class_name] || "#ffffff";
          const x = offsetX + det.bbox.x * scale;
          const y = offsetY + det.bbox.y * scale;
          const w = det.bbox.width * scale;
          const h = det.bbox.height * scale;

          ctx.fillStyle = `${color}1A`; // 10% opacity for ultra-clean look
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, 8);
          ctx.fill();
          
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Premium Labeling
          const label = `${det.class_name.replace("_", " ").toUpperCase()} ${(det.confidence * 100).toFixed(1)}%`;
          ctx.font = '900 11px "Inter", sans-serif';
          const textW = ctx.measureText(label).width;
          
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(x, y - 28, textW + 20, 22, 6);
          ctx.fill();

          ctx.fillStyle = "#000000";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x + 10, y - 16);
        });
      }
      animationFrameId.current = requestAnimationFrame(renderLoop);
    };

    video.addEventListener("play", () => {
      animationFrameId.current = requestAnimationFrame(renderLoop);
    });

    return () => cancelAnimationFrame(animationFrameId.current);
  }, [cameraError]);

  if (cameraError) {
    return (
      <div className="relative w-full h-full min-h-[400px] flex flex-col items-center justify-center bg-[#0a0a0a] rounded-[28px] border border-rose-500/20 p-8 text-center overflow-hidden">
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6 border border-rose-500/30">
          <CameraOff size={36} className="text-rose-500" />
        </div>
        <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">Optics Failure</h3>
        <p className="text-sm font-bold text-rose-300 max-w-sm leading-relaxed mb-8">{cameraError}</p>
        <button onClick={() => window.location.reload()} className="flex items-center gap-3 px-8 py-4 bg-white hover:bg-gray-200 text-black font-black uppercase tracking-widest rounded-xl transition-all duration-300 active:scale-95">
          <RotateCcw size={20} /> Force Reboot
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[500px] flex items-center justify-center bg-[#050505] rounded-[28px] overflow-hidden shadow-2xl">
      
      {/* INITIALIZATION PROTOCOL */}
      {!isConnected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-[#050505]/90 backdrop-blur-xl transition-opacity duration-700">
          <div className="relative flex items-center justify-center w-24 h-24 mb-6">
            <div className="absolute inset-0 border-2 border-indigo-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
            <div className="absolute inset-2 border-2 border-t-cyan-400 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_1s_linear_infinite]" />
            <AlertTriangle size={28} className="text-cyan-400" />
          </div>
          <h3 className="text-lg font-black text-white tracking-[0.2em] uppercase mb-2">Booting Array</h3>
          <p className="text-xs font-bold text-cyan-500/70 tracking-[0.1em]">ESTABLISHING ONNX PROTOCOL...</p>
        </div>
      )}

      {/* ULTRA-PREMIUM HUD */}
      <div className={`absolute inset-0 pointer-events-none z-20 flex flex-col justify-between transition-opacity duration-1000 ${isConnected ? "opacity-100" : "opacity-0"}`}>
        
        {/* Top Glassmorphic Bar */}
        <div className="w-full bg-gradient-to-b from-black/80 via-black/40 to-transparent pt-6 pb-12 px-8 flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 shadow-lg">
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse shadow-[0_0_12px_#e11d48]" />
              <span className="text-xs font-black text-rose-400 tracking-[0.2em]">REC</span>
            </div>
            <span className="text-[11px] font-bold text-white/60 tracking-wider drop-shadow-md ml-1">{timestamp || "SYNCING CLOCK..."}</span>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
              <span className="text-xs font-black text-cyan-400 tracking-[0.2em]">SYS: ONLINE</span>
            </div>
            <span className="text-[11px] font-bold text-white/60 tracking-wider drop-shadow-md mr-1">TGT: {TARGET_FPS}.0 FPS</span>
          </div>
        </div>

        {/* Bottom Glassmorphic Bar */}
        <div className="w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-6 px-8 flex justify-between items-end">
          <div className="flex flex-col gap-1.5">
             <span className="text-[10px] font-black text-white/40 tracking-[0.2em]">INFERENCE ENGINE</span>
             <span className="text-xs font-black text-white/90 tracking-widest drop-shadow-lg">YOLOv8_ONNX_NANO</span>
          </div>
          <div className="flex flex-col items-end gap-1.5">
             <span className="text-[10px] font-black text-white/40 tracking-[0.2em]">NMS THRESHOLD</span>
             <span className="text-xs font-black text-white/90 tracking-widest drop-shadow-lg">C:0.30 | IOU:0.45</span>
          </div>
        </div>
      </div>

      <video ref={videoRef} playsInline muted className="hidden" />
      <canvas ref={hiddenCanvasRef} className="hidden" />
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full object-cover" />
    </div>
  );
}