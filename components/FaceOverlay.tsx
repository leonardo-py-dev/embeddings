'use client';

import { useEffect, useRef } from 'react';
import { drawOverlay, type DetectionResult } from '@/lib/faceEngine';

interface FaceOverlayProps {
  detectionResult: DetectionResult | null;
  videoWidth: number;
  videoHeight: number;
  mirrored?: boolean;
  boxColor?: string;
  label?: string;
  statusText?: string;
  showMesh?: boolean;
  showGuideOval?: boolean;
}

export default function FaceOverlay({
  detectionResult,
  videoWidth,
  videoHeight,
  mirrored = true,
  boxColor = '#10b981',
  label = 'Rosto Detectado',
  statusText,
  showMesh = false,
  showGuideOval = true,
}: FaceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || videoWidth === 0 || videoHeight === 0) return;

    if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
      canvas.width = videoWidth;
      canvas.height = videoHeight;
    }

    drawOverlay(canvas, detectionResult, {
      mirrored,
      boxColor,
      label,
      statusText,
      showMesh,
    });
  }, [detectionResult, videoWidth, videoHeight, mirrored, boxColor, label, statusText, showMesh]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
      {/* Guia Oval central para enquadramento perfeito */}
      {showGuideOval && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[48%] h-[68%] rounded-[50%/60%] border-2 border-dashed border-cyan-400/30 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.15)] flex flex-col items-center justify-between py-4">
            <span className="text-[11px] font-medium text-cyan-300/60 uppercase tracking-widest bg-slate-950/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              Topo da Cabeça
            </span>
            <span className="text-[11px] font-medium text-cyan-300/60 uppercase tracking-widest bg-slate-950/60 px-2 py-0.5 rounded-full backdrop-blur-sm">
              Queixo
            </span>
          </div>
        </div>
      )}

      {/* Canvas com os dados de inferência da IA */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
