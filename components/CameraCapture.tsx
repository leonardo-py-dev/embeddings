'use client';

import React from 'react';
import { Camera, RefreshCw, FlipHorizontal, AlertTriangle, VideoOff } from 'lucide-react';
import FaceOverlay from './FaceOverlay';
import QualityIndicator from './QualityIndicator';
import type { DetectionResult } from '@/lib/faceEngine';
import type { QualityAssessment } from '@/lib/quality';

interface CameraCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  isMirrored: boolean;
  onStartCamera: () => void;
  onToggleMirror: () => void;
  onSwitchCamera?: () => void;
  hasMultipleCameras?: boolean;
  detectionResult?: DetectionResult | null;
  qualityAssessment?: QualityAssessment | null;
  showQualityPanel?: boolean;
  showGuideOval?: boolean;
  scannerActive?: boolean;
  customOverlay?: React.ReactNode;
  aspectRatioClass?: string;
}

export default function CameraCapture({
  videoRef,
  isStreaming,
  isLoading,
  error,
  isMirrored,
  onStartCamera,
  onToggleMirror,
  onSwitchCamera,
  hasMultipleCameras = false,
  detectionResult = null,
  qualityAssessment = null,
  showQualityPanel = true,
  showGuideOval = true,
  scannerActive = false,
  customOverlay,
  aspectRatioClass = 'aspect-[4/3] sm:aspect-[16/10]',
}: CameraCaptureProps) {
  return (
    <div className="w-full flex flex-col gap-3">
      {/* Container do Vídeo com bordas e efeitos cibernéticos */}
      <div
        className={`relative w-full ${aspectRatioClass} bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-cyan-950/20 group`}
      >
        {/* Vídeo Nativo */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-200 ${
            isMirrored ? '-scale-x-100' : 'scale-x-100'
          } ${isStreaming ? 'opacity-100' : 'opacity-0'}`}
        />

        {/* Efeito de Scanner Cibernético (durante verificação) */}
        {scannerActive && <div className="scanner-beam" />}

        {/* Overlay com caixas de detecção e guia oval */}
        {isStreaming && (
          <FaceOverlay
            detectionResult={detectionResult}
            videoWidth={videoRef.current?.videoWidth || 640}
            videoHeight={videoRef.current?.videoHeight || 480}
            mirrored={isMirrored}
            showGuideOval={showGuideOval}
            showMesh={false}
            boxColor={
              qualityAssessment?.isValid
                ? '#10b981' // emerald-500
                : detectionResult?.primaryFace
                ? '#f59e0b' // amber-500
                : '#06b6d4' // cyan-500
            }
            label={detectionResult?.primaryFace ? 'Face Reconhecida' : ''}
          />
        )}

        {/* Custom Overlay (Ex: Flashes de captura, contagem regressiva) */}
        {customOverlay}

        {/* Estado: Câmera Desligada ou Solicitando Permissão */}
        {!isStreaming && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-20">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4 text-cyan-400">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
              Câmera Desconectada
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mb-5">
              Para prosseguir com o reconhecimento facial, habilite o acesso à sua webcam. Todo processamento ocorre no seu navegador.
            </p>
            <button
              onClick={onStartCamera}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-semibold text-sm transition-all duration-200 shadow-lg shadow-cyan-500/25 cursor-pointer flex items-center gap-2"
            >
              <Camera className="w-4 h-4" />
              <span>Habilitar Webcam</span>
            </button>
          </div>
        )}

        {/* Estado: Carregando Câmera */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm z-20">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-200">Iniciando feed de vídeo...</p>
          </div>
        )}

        {/* Estado: Erro de Permissão ou Hardware */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-rose-950/80 backdrop-blur-sm z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-3 text-rose-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-semibold text-rose-200 mb-1">Acesso à Câmera Negado</h4>
            <p className="text-xs text-rose-300/90 max-w-sm mb-4">{error}</p>
            <button
              onClick={onStartCamera}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Controles Flutuantes no canto inferior direito do vídeo */}
        {isStreaming && (
          <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/70 backdrop-blur-md border border-slate-800/80 opacity-90 hover:opacity-100 transition-opacity">
            <button
              onClick={onToggleMirror}
              title={isMirrored ? 'Desativar espelho' : 'Ativar espelho'}
              className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>

            {hasMultipleCameras && onSwitchCamera && (
              <button
                onClick={onSwitchCamera}
                title="Trocar câmera"
                className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Badge ao vivo */}
        {isStreaming && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/70 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>AO VIVO</span>
          </div>
        )}
      </div>

      {/* Painel de Qualidade e Instruções */}
      {showQualityPanel && isStreaming && qualityAssessment && (
        <QualityIndicator assessment={qualityAssessment} />
      )}
    </div>
  );
}
