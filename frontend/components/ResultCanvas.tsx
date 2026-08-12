// src/components/ResultCanvas.tsx
"use client";

import { useEffect, useRef } from "react";
import type { DetectionResult } from "@/lib/types";

const CLASS_COLORS: Record<string, string> = {
  missing_hole: "rgb(234, 179, 8)",    // Amber
  mouse_bite: "rgb(249, 115, 22)",      // Orange
  open_circuit: "rgb(239, 68, 68)",     // Red
  short_circuit: "rgb(236, 72, 153)",   // Pink
  spur: "rgb(139, 92, 246)",            // Violet
  spurious_copper: "rgb(6, 182, 212)",  // Cyan
};

const LABEL_TEXT = "#ffffff";
const LABEL_FONT = 'bold 11px "Inter", system-ui, sans-serif';
const LABEL_PAD_H = 10;
const LABEL_PAD_V = 6;
const LABEL_RADIUS = 12;

interface ResultCanvasProps {
  imageDataUrl: string;
  result: DetectionResult;
}

export function ResultCanvas({ imageDataUrl, result }: ResultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<{ x: number; y: number }>({ x: -1, y: -1 });

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    cursorRef.current = {
      x: (e.clientX - rect.left) * dpr,
      y: (e.clientY - rect.top) * dpr
    };
  };

  const handleMouseLeave = () => {
    cursorRef.current = { x: -1, y: -1 };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let startTime: number | null = null;
    const ANIMATION_DURATION = 600;

    const img = new Image();
    img.src = imageDataUrl;
    img.onload = () => {
      const dpr = window.devicePixelRatio ?? 1;
      const cssW = container.clientWidth;
      const cssH = container.clientHeight;
      
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);

      const scale = Math.min(cssW / img.naturalWidth, cssH / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const offsetX = (cssW - drawW) / 2;
      const offsetY = (cssH - drawH) / 2;

      const drawFrame = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.scale(dpr, dpr);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(offsetX, offsetY, drawW, drawH, 20);
        ctx.clip();
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        ctx.restore();

        const { x: cursorX, y: cursorY } = cursorRef.current;
        const cx = cursorX / dpr;
        const cy = cursorY / dpr;

        const drawnLabels: { x: number, y: number, w: number, h: number }[] = [];
        const boxesToDraw: any[] = [];
        const linesToDraw: any[] = [];
        const pillsToDraw: any[] = [];

        if (result.detections && result.detections.length) {
          result.detections.forEach((det) => {
            const { x: xOrig, y: yOrig, width: wOrig, height: hOrig } = det.bbox;
            const colorStr = CLASS_COLORS[det.class_name] || "rgb(225, 29, 72)";

            const x = offsetX + xOrig * scale;
            const y = offsetY + yOrig * scale;
            const w = wOrig * scale;
            const h = hOrig * scale;

            const animW = w * easeProgress;
            const animH = h * easeProgress;
            const animX = x + (w - animW) / 2;
            const animY = y + (h - animH) / 2;

            const isHovered = (cx >= animX && cx <= animX + animW && cy >= animY && cy <= animY + animH);

            boxesToDraw.push({
              animX, animY, animW, animH,
              isHovered, easeProgress, colorStr
            });

            if (progress > 0.8) {
              const labelAlpha = (progress - 0.8) * 5;
              const label = `${det.class_name.replace("_", " ").toUpperCase()} ${(det.confidence * 100).toFixed(1)}%`;
              ctx.font = LABEL_FONT;
              
              const textW = ctx.measureText(label).width;
              const pillW = textW + LABEL_PAD_H * 2;
              const pillH = 14 + LABEL_PAD_V * 2;
              
              let pillX = x;
              let originalPillY = y - pillH - 8;
              let pillY = originalPillY;

              if (pillY < offsetY) {
                 pillY = y + h + 8;
                 originalPillY = pillY;
                 if (pillY + pillH > offsetY + drawH) {
                    pillY = y + 8;
                    originalPillY = pillY;
                 }
              }

              if (pillX + pillW > offsetX + drawW) pillX = offsetX + drawW - pillW - 8;
              if (pillX < offsetX) pillX = offsetX + 8;
              pillY = Math.max(offsetY + 4, Math.min(pillY, offsetY + drawH - pillH - 4));

              let collision = true;
              let attempts = 0;
              while (collision && attempts < 10) {
                collision = false;
                for (const existing of drawnLabels) {
                  if (
                    pillX < existing.x + existing.w &&
                    pillX + pillW > existing.x &&
                    pillY < existing.y + existing.h &&
                    pillY + pillH > existing.y
                  ) {
                    collision = true;
                    pillY += 28;
                    pillY = Math.max(offsetY + 4, Math.min(pillY, offsetY + drawH - pillH - 4));
                    break;
                  }
                }
                attempts++;
              }
              drawnLabels.push({ x: pillX, y: pillY, w: pillW, h: pillH });

              if (Math.abs(pillY - originalPillY) > 5) {
                linesToDraw.push({
                  startX: pillX + pillW / 2,
                  startY: pillY + pillH,
                  endX: animX + animW / 2,
                  endY: animY,
                  alpha: labelAlpha,
                  colorStr
                });
              }

              pillsToDraw.push({
                pillX, pillY, pillW, pillH, label, labelAlpha, isHovered, colorStr
              });
            }
          });
        }

        boxesToDraw.forEach(box => {
          const fillOpacity = box.isHovered ? 0.35 : 0.15;
          const borderW = box.isHovered ? 2.5 : 2;

          ctx.fillStyle = box.colorStr.replace('rgb', 'rgba').replace(')', `, ${fillOpacity * box.easeProgress})`);
          ctx.fillRect(box.animX, box.animY, box.animW, box.animH);

          ctx.strokeStyle = box.colorStr.replace('rgb', 'rgba').replace(')', `, ${box.easeProgress})`);
          ctx.lineWidth = borderW;
          ctx.setLineDash([]);
          ctx.strokeRect(box.animX, box.animY, box.animW, box.animH);
        });

        if (cursorX > -1 && cursorY > -1) {
          ctx.beginPath();
          ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.moveTo(0, cy);
          ctx.lineTo(cssW, cy);
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, cssH);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
          ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
          ctx.stroke();
        }

        linesToDraw.forEach(line => {
          ctx.beginPath();
          ctx.strokeStyle = line.colorStr.replace('rgb', 'rgba').replace(')', `, ${0.7 * line.alpha})`);
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.moveTo(line.startX, line.startY);
          ctx.lineTo(line.endX, line.endY);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        pillsToDraw.forEach(pill => {
          ctx.save();
          if (pill.isHovered) {
            ctx.translate(pill.pillX + pill.pillW / 2, pill.pillY + pill.pillH / 2);
            ctx.scale(1.15, 1.15);
            ctx.translate(-(pill.pillX + pill.pillW / 2), -(pill.pillY + pill.pillH / 2));
          }

          ctx.fillStyle = pill.colorStr.replace('rgb', 'rgba').replace(')', `, ${pill.labelAlpha})`);
          ctx.beginPath();
          ctx.roundRect(pill.pillX, pill.pillY, pill.pillW, pill.pillH, LABEL_RADIUS);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${pill.labelAlpha})`;
          ctx.textBaseline = "middle";
          ctx.fillText(pill.label, pill.pillX + LABEL_PAD_H, pill.pillY + pill.pillH / 2 + 1);
          ctx.restore();
        });

        animationFrameId = requestAnimationFrame(drawFrame);
      };

      animationFrameId = requestAnimationFrame(drawFrame);
    };
    
    const handleResize = () => {
       if(img.complete) {
           startTime = null;
           img.onload?.(new Event('load'));
       }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

  }, [imageDataUrl, result]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px] flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block drop-shadow-2xl transition-opacity duration-500 ease-in-out cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}