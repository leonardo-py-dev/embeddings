'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  ScanFace,
  Play,
  Square,
  UserCheck,
  UserX,
  History,
  RefreshCw,
  CheckCircle2,
  Users,
} from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';
import ThresholdSlider from '@/components/ThresholdSlider';
import RemoteWebcamDialog from '@/components/RemoteWebcamDialog';
import EmbeddingsExportPanel from '@/components/EmbeddingsExportPanel';
import { useCamera } from '@/hooks/useCamera';
import { useFaceEngine } from '@/hooks/useFaceEngine';
import { checkFaceQuality, analyzeImageMetrics, type QualityAssessment } from '@/lib/quality';
import { cosineDistance, l2Normalize, DEFAULT_THRESHOLD } from '@/lib/matching';
import { getAllProfiles, type FaceProfile } from '@/lib/storage';
import type { DetectionResult } from '@/lib/faceEngine';

interface FaceMatch {
  faceIndex: number;
  profile: FaceProfile | null;
  distance: number;
}

interface RecognitionEvent {
  id: string;
  at: string;
  kind: 'IDENTIFIED' | 'UNKNOWN' | 'CLEAR';
  label: string;
  distance: number | null;
}

/** Frames consecutivos com o mesmo vencedor para travar a identidade exibida. */
const LOCK_STREAK = 3;

export default function ReconhecerPage() {
  const [profiles, setProfiles] = useState<FaceProfile[]>(() => getAllProfiles());
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [monitoring, setMonitoring] = useState(false);

  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [quality, setQuality] = useState<QualityAssessment | null>(null);
  const [liveMatches, setLiveMatches] = useState<FaceMatch[]>([]);
  const [lockedId, setLockedId] = useState<string | null>(null); // userId | 'unknown' | null
  const [lockedDist, setLockedDist] = useState<number | null>(null);
  const [events, setEvents] = useState<RecognitionEvent[]>([]);

  const {
    videoRef,
    isStreaming,
    isLoading: isCamLoading,
    error: camError,
    devices: camDevices,
    activeDeviceId: camDeviceId,
    isMirrored,
    startCamera,
    stopCamera,
    toggleMirror,
    clearError: clearCamError,
  } = useCamera({ autoStart: false });

  const { isReady: isAiReady, detect } = useFaceEngine();

  // Webcam remota (celular via QR). Quando ativa, substitui a webcam local.
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const usingRemote = remoteStream !== null;

  const winnerRef = useRef<string>('none');
  const streakRef = useRef(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadProfiles = useCallback(() => {
    setProfiles(getAllProfiles());
  }, []);

  const handleRemoteStream = useCallback(
    (stream: MediaStream | null) => {
      if (stream) {
        stopCamera();
        clearCamError();
      }
      setRemoteStream(stream);
    },
    [stopCamera, clearCamError]
  );

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream, videoRef]);

  const pushEvent = useCallback((kind: RecognitionEvent['kind'], label: string, distance: number | null) => {
    const ev: RecognitionEvent = {
      id: `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toLocaleTimeString('pt-BR'),
      kind,
      label,
      distance,
    };
    setEvents((prev) => [ev, ...prev.slice(0, 19)]);
  }, []);

  const handleStart = async () => {
    setLockedId(null);
    setLockedDist(null);
    setLiveMatches([]);
    winnerRef.current = 'none';
    streakRef.current = 0;
    setMonitoring(true);
    if (!isStreaming && !remoteStream) {
      await startCamera();
    }
  };

  const handleStop = () => {
    setMonitoring(false);
    setLockedId(null);
    setLiveMatches([]);
  };

  // Compara um embedding ao vivo contra todos os perfis (identificação 1:N)
  const identify = useCallback(
    (liveEmbedding: number[]): { profile: FaceProfile | null; distance: number } => {
      const live = l2Normalize(liveEmbedding);
      let best: FaceProfile | null = null;
      let bestDist = Infinity;
      for (const p of profiles) {
        const d = cosineDistance(live, p.meanEmbedding);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      if (best && bestDist <= threshold) {
        return { profile: best, distance: bestDist };
      }
      return { profile: null, distance: bestDist === Infinity ? 1 : bestDist };
    },
    [profiles, threshold]
  );

  // Loop de reconhecimento em tempo real
  useEffect(() => {
    const cameraActive = isStreaming || usingRemote;
    if (!monitoring || !cameraActive || !isAiReady) return;

    let animationFrameId: number;
    let isProcessing = false;
    let cancelled = false;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const recognizeLoop = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isProcessing) {
        animationFrameId = requestAnimationFrame(recognizeLoop);
        return;
      }

      isProcessing = true;

      try {
        const res = await detect(video);
        if (cancelled) return;
        setDetectionResult(res);

        if (res && res.faces.length > 0) {
          const matches: FaceMatch[] = [];
          res.faces.forEach((face, i) => {
            const raw = face.embedding ? Array.from(face.embedding as ArrayLike<number>) : null;
            if (!raw) return;
            const { profile, distance } = identify(raw);
            matches.push({ faceIndex: i, profile, distance });
          });
          setLiveMatches(matches);

          // Qualidade do rosto principal (painel de enquadramento)
          const [x, y, w, h] = res.faces[0].box;
          const offCanvas = offscreenCanvasRef.current!;
          if (offCanvas.width !== video.videoWidth || offCanvas.height !== video.videoHeight) {
            offCanvas.width = video.videoWidth;
            offCanvas.height = video.videoHeight;
          }
          const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
          let metrics = { brightness: 120, sharpness: 30 };
          if (offCtx) {
            offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
            metrics = analyzeImageMetrics(offCanvas, { x, y, width: w, height: h });
          }
          // No modo contínuo não exigimos estabilidade: só enquadramento/luz/foco
          setQuality(
            checkFaceQuality(res.faceCount, { x, y, width: w, height: h }, video.videoWidth, video.videoHeight, metrics, true)
          );

          // Vencedor do frame = identidade do rosto principal
          const main = matches[0];
          const winner = main?.profile ? main.profile.userId : 'unknown';
          if (winner === winnerRef.current) {
            streakRef.current += 1;
          } else {
            winnerRef.current = winner;
            streakRef.current = 1;
          }
          if (streakRef.current >= LOCK_STREAK) {
            setLockedId((prev) => {
              if (prev !== winner) {
                const label = main?.profile ? main.profile.nome : 'Desconhecido';
                pushEvent(main?.profile ? 'IDENTIFIED' : 'UNKNOWN', label, main?.distance ?? null);
              }
              return winner;
            });
            setLockedDist(main?.distance ?? null);
          }
        } else {
          setLiveMatches([]);
          setQuality(
            checkFaceQuality(0, null, video.videoWidth, video.videoHeight, { brightness: 0, sharpness: 0 }, false)
          );
          if (winnerRef.current !== 'none') {
            winnerRef.current = 'none';
            streakRef.current = 0;
            setLockedId((prev) => {
              if (prev !== null) pushEvent('CLEAR', 'Sem rosto na câmera', null);
              return null;
            });
            setLockedDist(null);
          }
        }
      } catch (err) {
        console.warn('Erro durante reconhecimento:', err);
      } finally {
        isProcessing = false;
        if (!cancelled) {
          animationFrameId = requestAnimationFrame(recognizeLoop);
        }
      }
    };

    animationFrameId = requestAnimationFrame(recognizeLoop);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [monitoring, isStreaming, usingRemote, isAiReady, detect, identify, pushEvent, videoRef]);

  const lockedProfile = lockedId && lockedId !== 'unknown' ? profiles.find((p) => p.userId === lockedId) : null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ScanFace className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Reconhecimento em Tempo Real
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Identificação 1:N contra todos os perfis cadastrados, direto da câmera.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadProfiles}
            title="Recarregar perfis cadastrados"
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {profiles.length} perfil(is)
          </button>
          <Link
            href="/register"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
          >
            + Cadastrar Rosto
          </Link>
        </div>
      </div>

      {profiles.length === 0 && (
        <div className="p-6 rounded-3xl bg-amber-950/30 border border-amber-500/30 text-center space-y-2">
          <Users className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm font-bold text-white">Nenhum perfil cadastrado</p>
          <p className="text-xs text-slate-400">
            Cadastre ao menos um rosto para o reconhecimento funcionar.
          </p>
          <Link
            href="/register"
            className="inline-block mt-1 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-bold text-sm"
          >
            Cadastrar primeiro rosto
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Esquerda: limiar */}
        <div className="lg:col-span-5 space-y-5">
          <ThresholdSlider value={threshold} onChange={setThreshold} disabled={false} />
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <p className="font-semibold text-slate-200">Como funciona a identificação:</p>
            <p>
              A cada frame, o rosto ao vivo é comparado com <b>todos</b> os perfis. O perfil
              mais próximo vence se a distância ficar abaixo do limiar — e a identidade só é
              exibida após {LOCK_STREAK} frames seguidos com o mesmo vencedor (anti-tremor).
            </p>
          </div>
        </div>

        {/* Direita: câmera + resultado ao vivo */}
        <div className="lg:col-span-7 space-y-5">
          <CameraCapture
            videoRef={videoRef}
            isStreaming={isStreaming || usingRemote}
            isLoading={isCamLoading}
            error={usingRemote ? null : camError}
            isMirrored={isMirrored}
            onStartCamera={startCamera}
            onToggleMirror={toggleMirror}
            devices={camDevices}
            activeDeviceId={camDeviceId}
            onSelectDevice={(id) => startCamera(id)}
            detectionResult={detectionResult}
            qualityAssessment={quality}
            showQualityPanel={true}
            showGuideOval={true}
            scannerActive={monitoring}
          />

          {usingRemote && (
            <p className="text-[11px] font-semibold text-emerald-400">
              Fonte ativa: celular remoto (reconhecimento calculado neste PC).
            </p>
          )}

          <RemoteWebcamDialog onStreamChange={handleRemoteStream} />

          {/* Identidade travada */}
          {monitoring && (
            <div
              className={`p-5 rounded-3xl border transition-all duration-300 ${
                lockedProfile
                  ? 'bg-emerald-950/30 border-emerald-500/50 shadow-xl shadow-emerald-950/30'
                  : lockedId === 'unknown'
                  ? 'bg-amber-950/30 border-amber-500/50 shadow-xl shadow-amber-950/30'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              {lockedProfile ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <UserCheck className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Identificado
                    </p>
                    <p className="text-xl font-extrabold text-white">{lockedProfile.nome}</p>
                    <p className="text-[11px] font-mono text-slate-400">
                      dist {lockedDist?.toFixed(4)} · cossim{' '}
                      {lockedDist !== null ? `${((1 - lockedDist) * 100).toFixed(1)}%` : '—'} ·
                      limiar {threshold.toFixed(2)}
                    </p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                </div>
              ) : lockedId === 'unknown' ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                    <UserX className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      Rosto desconhecido
                    </p>
                    <p className="text-lg font-extrabold text-white">Não cadastrado</p>
                    <p className="text-[11px] font-mono text-slate-400">
                      mais próximo: dist {lockedDist?.toFixed(4) ?? '—'} · limiar {threshold.toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center">
                  Aguardando rosto na câmera para identificar...
                </p>
              )}

              {/* Leitura instantânea por rosto */}
              {liveMatches.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {liveMatches.map((m) => (
                    <span
                      key={m.faceIndex}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${
                        m.profile
                          ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-950/60 border-slate-700 text-slate-400'
                      }`}
                    >
                      Rosto {m.faceIndex + 1}: {m.profile ? m.profile.nome : '?'} ({m.distance.toFixed(3)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Iniciar / Parar */}
          {!monitoring ? (
            <button
              onClick={handleStart}
              disabled={profiles.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-extrabold text-base transition shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              <span>Iniciar Reconhecimento em Tempo Real</span>
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Square className="w-4 h-4" />
              <span>Parar monitoramento</span>
            </button>
          )}
        </div>
      </div>

      {/* LOG DE IDENTIFICAÇÕES DA SESSÃO */}
      {events.length > 0 && (
        <section className="space-y-3 p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                Identificações da Sessão ({events.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Somente em memória</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800/80">
                <tr>
                  <th className="py-2 px-3">Horário</th>
                  <th className="py-2 px-3">Evento</th>
                  <th className="py-2 px-3">Identidade</th>
                  <th className="py-2 px-3">Distância</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{ev.at}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          ev.kind === 'IDENTIFIED'
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                            : ev.kind === 'UNKNOWN'
                            ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
                            : 'bg-slate-800/60 border-slate-700 text-slate-400'
                        }`}
                      >
                        {ev.kind === 'IDENTIFIED' ? 'IDENTIFICADO' : ev.kind === 'UNKNOWN' ? 'DESCONHECIDO' : 'SAIU DE CENA'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white">{ev.label}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {ev.distance !== null ? ev.distance.toFixed(4) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <EmbeddingsExportPanel title="Exportar embeddings cadastrados (JSON)" />
    </div>
  );
}
