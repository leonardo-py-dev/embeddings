'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  LogIn,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  History,
  Camera,
  Play,
  UserCheck,
  AlertCircle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';
import ThresholdSlider from '@/components/ThresholdSlider';
import VerificationResult, { type VerificationResultData } from '@/components/VerificationResult';
import ProfileManager from '@/components/ProfileManager';
import RemoteWebcamDialog from '@/components/RemoteWebcamDialog';
import EmbeddingsExportPanel from '@/components/EmbeddingsExportPanel';
import { useCamera } from '@/hooks/useCamera';
import { useFaceEngine } from '@/hooks/useFaceEngine';
import { checkFaceQuality, analyzeImageMetrics, StabilityTracker, type QualityAssessment } from '@/lib/quality';
import { cosineSimilarity, cosineDistance, calculateMatchScore, l2Normalize, DEFAULT_THRESHOLD } from '@/lib/matching';
import { getAllProfiles, type FaceProfile, type AttemptLog } from '@/lib/storage';
import { LivenessDetector, type LivenessChallengeType, type LivenessStatus } from '@/lib/liveness';
import type { DetectionResult } from '@/lib/faceEngine';

export default function LoginPage() {
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<FaceProfile | null>(null);

  // Configuração da verificação
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [challengeType, setChallengeType] = useState<LivenessChallengeType>('CONSECUTIVE_FRAMES');

  // Estados de execução
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResultData | null>(null);
  const [livenessStatus, setLivenessStatus] = useState<LivenessStatus | null>(null);
  const [currentScore, setCurrentScore] = useState<{ similarity: number; distance: number } | null>(null);

  // Log de tentativas em memória (RF10)
  const [attemptLogs, setAttemptLogs] = useState<AttemptLog[]>([]);

  // IA e Câmera
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

  const { isReady: isAiReady, isLoading: isAiLoading, detect } = useFaceEngine();

  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [quality, setQuality] = useState<QualityAssessment | null>(null);

  const livenessDetectorRef = useRef<LivenessDetector>(new LivenessDetector('CONSECUTIVE_FRAMES', 3));
  const stabilityTrackerRef = useRef(new StabilityTracker(300, 20));
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const verifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detecção de rosto desconhecido: N frames consecutivos com rosto válido
  // porém distância acima do limiar => nega na hora (sem esperar o timeout).
  const UNKNOWN_STREAK_LIMIT = 10;
  const UNKNOWN_MARGIN = 0.05;
  const unknownStreakRef = useRef(0);
  const unknownDistSumRef = useRef(0);
  const lastMeasuredDistRef = useRef<number | null>(null);

  const resetUnknownTracking = () => {
    unknownStreakRef.current = 0;
    unknownDistSumRef.current = 0;
    lastMeasuredDistRef.current = null;
  };

  // Webcam remota (celular via QR). Quando ativa, substitui a webcam local.
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const usingRemote = remoteStream !== null;

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

  // Exibe o stream do celular no mesmo <video> do CameraCapture
  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream, videoRef]);

  // Carrega perfis ao montar
  useEffect(() => {
    const list = getAllProfiles();
    setProfiles(list);
    if (list.length > 0) {
      setSelectedProfile(list[0]);
      setThreshold(list[0].threshold ?? DEFAULT_THRESHOLD);
    }
  }, []);

  // Quando o usuário selecionado muda, atualiza o threshold default dele
  const handleSelectProfile = (profile: FaceProfile) => {
    setSelectedProfile(profile);
    setThreshold(profile.threshold ?? DEFAULT_THRESHOLD);
    setVerificationResult(null);
    setCurrentScore(null);
  };

  // Inicia sessão de verificação
  const handleStartVerification = async () => {
    if (!selectedProfile) return;

    setVerificationResult(null);
    setCurrentScore(null);
    setIsVerifying(true);
    resetUnknownTracking();

    livenessDetectorRef.current.setChallenge(challengeType);
    setLivenessStatus(livenessDetectorRef.current.getStatus());

    if (!isStreaming && !remoteStream) {
      await startCamera();
    }

    // Timeout de segurança para evitar loop infinito se ninguém estiver na câmera (15 segundos)
    if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
    verifyTimeoutRef.current = setTimeout(() => {
      if (isVerifying) {
        // Usa a última distância medida de verdade; 0.99 só se nenhum rosto apareceu
        const lastDist = lastMeasuredDistRef.current ?? 0.99;
        const reason =
          lastMeasuredDistRef.current === null
            ? 'Tempo limite excedido sem detectar nenhum rosto.'
            : 'Tempo limite excedido sem correspondência.';
        finishVerification(false, lastDist, reason, 0, false, 'TIMEOUT');
      }
    }, 15000);
  };

  // Finaliza a verificação e salva log
  const finishVerification = useCallback(
    (
      isMatch: boolean,
      finalDist: number,
      reason?: string,
      consecutiveCount: number = 0,
      livenessPassed: boolean = false,
      denyReason?: 'UNKNOWN_FACE' | 'TIMEOUT'
    ) => {
      if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
      setIsVerifying(false);

      if (!selectedProfile) return;

      const calc = calculateMatchScore(finalDist, threshold);

      const resultData: VerificationResultData = {
        isMatch,
        userName: selectedProfile.nome,
        userId: selectedProfile.userId,
        similarityScore: calc.similarityScore,
        // Similaridade cosseno real (1 - distância), sem o mapeamento didático do score
        cosineSimilarity: Number((1 - finalDist).toFixed(4)),
        distance: calc.distance,
        threshold,
        livenessPassed,
        consecutiveMatches: consecutiveCount,
        denyReason,
        reasonText: reason,
        at: new Date().toLocaleTimeString('pt-BR'),
      };

      setVerificationResult(resultData);

      // Adiciona ao log de tentativas em memória (RF10)
      const newLog: AttemptLog = {
        id: `att-${Date.now().toString(36)}`,
        at: new Date().toLocaleTimeString('pt-BR'),
        userId: selectedProfile.userId,
        nome: selectedProfile.nome,
        distance: calc.distance,
        threshold,
        similarityScore: calc.similarityScore,
        success: isMatch,
        livenessPassed,
        reason,
      };

      setAttemptLogs((prev) => [newLog, ...prev.slice(0, 19)]);
    },
    [selectedProfile, threshold]
  );

  // Loop de Verificação Facial (webcam local OU celular remoto)
  useEffect(() => {
    const cameraActive = isStreaming || usingRemote;
    if (!isVerifying || !cameraActive || !isAiReady || !selectedProfile) return;

    let animationFrameId: number;
    let isProcessing = false;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const verifyLoop = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isProcessing) {
        animationFrameId = requestAnimationFrame(verifyLoop);
        return;
      }

      isProcessing = true;

      try {
        const res = await detect(video);
        setDetectionResult(res);

        if (res && res.primaryFace && res.embedding) {
          const face = res.primaryFace;
          const [x, y, w, h] = face.box;

          // Qualidade e estabilidade
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

          const isStable = stabilityTrackerRef.current.update({ x, y, width: w, height: h });
          const assessment = checkFaceQuality(
            res.faceCount,
            { x, y, width: w, height: h },
            video.videoWidth,
            video.videoHeight,
            metrics,
            isStable
          );
          setQuality(assessment);

          // Cálculo do Matching 1:1
          const liveEmb = l2Normalize(res.embedding);
          const dist = cosineDistance(liveEmb, selectedProfile.meanEmbedding);
          const scoreCalc = calculateMatchScore(dist, threshold);

          setCurrentScore({
            similarity: scoreCalc.similarityScore,
            distance: dist,
          });

          // Atualiza Prova de Vida
          const isCurrentMatch = dist <= threshold && assessment.isValid;

          // Guarda a última distância medida (para o timeout usar valor real)
          lastMeasuredDistRef.current = dist;

          // Rosto desconhecido? Rosto válido + qualidade OK, mas distância acima
          // do limiar por N frames seguidos => nega imediatamente (ACESSO NEGADO).
          // A margem evita negar o usuário real em frames limítrofes (ex: virando
          // o rosto); casos na margem aguardam o timeout normal.
          if (!isCurrentMatch && assessment.isValid) {
            unknownStreakRef.current += 1;
            unknownDistSumRef.current += dist;
            const avgUnknownDist = unknownDistSumRef.current / unknownStreakRef.current;
            if (
              unknownStreakRef.current >= UNKNOWN_STREAK_LIMIT &&
              avgUnknownDist > threshold + UNKNOWN_MARGIN
            ) {
              finishVerification(
                false,
                avgUnknownDist,
                `Rosto desconhecido detectado (${unknownStreakRef.current} frames consecutivos acima do limiar).`,
                unknownStreakRef.current,
                false,
                'UNKNOWN_FACE'
              );
              return;
            }
          } else {
            // Match parcial ou sem qualidade: zera a contagem de desconhecido
            unknownStreakRef.current = 0;
            unknownDistSumRef.current = 0;
          }

          // Dados de rotação e gestos para liveness avançado
          const rotation = face.rotation?.angle
            ? { yaw: face.rotation.angle.yaw, pitch: face.rotation.angle.pitch, roll: face.rotation.angle.roll }
            : undefined;

          const gestures = (res.rawResult.gesture || []).map((g) => g.gesture);

          const liveness = livenessDetectorRef.current.update(
            isCurrentMatch,
            { rotation, gestos: gestures },
            performance.now()
          );

          setLivenessStatus(liveness);

          // Se a prova de vida completou com correspondência contínua, sucesso!
          if (liveness.isCompleted && isCurrentMatch) {
            finishVerification(true, dist, 'Autenticado com sucesso', liveness.consecutiveMatches, true);
            return;
          }
        } else {
          // Sem rosto no frame: não conta como desconhecido, apenas zera a sequência
          unknownStreakRef.current = 0;
          unknownDistSumRef.current = 0;
          setQuality(
            checkFaceQuality(0, null, video.videoWidth, video.videoHeight, { brightness: 0, sharpness: 0 }, false)
          );
        }
      } catch (err) {
        console.warn('Erro durante loop de verificação:', err);
      } finally {
        isProcessing = false;
        if (isVerifying) {
          animationFrameId = requestAnimationFrame(verifyLoop);
        }
      }
    };

    animationFrameId = requestAnimationFrame(verifyLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVerifying, isStreaming, usingRemote, isAiReady, selectedProfile, threshold, detect, finishVerification, videoRef]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <LogIn className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Login Facial (Verificação 1:1)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Compare o rosto ao vivo na webcam contra o vetor médio cadastrado em tempo real.
          </p>
        </div>

        <Link
          href="/register"
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition"
        >
          + Cadastrar Novo Rosto
        </Link>
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna da Esquerda: Configuração e Seleção de Perfil (5 colunas) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Selecionador de Usuário */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-4">
            <ProfileManager
              compact={true}
              selectedUserId={selectedProfile?.userId || null}
              onSelectProfile={handleSelectProfile}
            />

            {selectedProfile && (
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Usuário selecionado:</span>
                  <span className="font-semibold text-white">{selectedProfile.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amostras biométricas:</span>
                  <span className="font-mono text-cyan-400">{selectedProfile.samples.length} capturas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimensões do embedding:</span>
                  <span className="font-mono text-slate-300">{selectedProfile.embeddingDim} floats</span>
                </div>
              </div>
            )}
          </div>

          {/* Ajuste de Threshold */}
          <ThresholdSlider
            value={threshold}
            onChange={(val) => setThreshold(val)}
            disabled={isVerifying}
          />

          {/* Migração do limiar antigo: perfis cadastrados com default 0.45 */}
          {selectedProfile && selectedProfile.threshold === 0.45 && threshold === 0.45 && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-2">
              <p>
                Este perfil usa o limiar antigo (<span className="font-mono font-bold">0.45</span>),
                que pode aceitar outras pessoas. Recomendamos{' '}
                <span className="font-mono font-bold">0.35</span>.
              </p>
              <button
                type="button"
                disabled={isVerifying}
                onClick={() => setThreshold(DEFAULT_THRESHOLD)}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 font-semibold transition cursor-pointer disabled:opacity-50"
              >
                Aplicar 0.35 nesta sessão
              </button>
            </div>
          )}

          {/* Modo de Prova de Vida (Liveness) */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <label className="text-xs font-semibold text-slate-200">
                Desafio de Prova de Vida (Anti-Spoofing):
              </label>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {[
                { id: 'CONSECUTIVE_FRAMES', label: '3 Frames Contínuos' },
                { id: 'BLINK', label: 'Piscar Olhos' },
                { id: 'TURN_HEAD', label: 'Mover Cabeça' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => setChallengeType(c.id as LivenessChallengeType)}
                  className={`p-2 rounded-xl border text-center transition font-medium cursor-pointer ${
                    challengeType === c.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Câmera, Live Scores e Resultado (7 colunas) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Se já tiver resultado final, exibe o cartão de resultado */}
          {verificationResult ? (
            <VerificationResult
              data={verificationResult}
              onRetry={handleStartVerification}
            />
          ) : (
            <div className="space-y-4">
              {/* Webcam (local ou celular remoto) */}
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
                scannerActive={isVerifying}
              />

              {usingRemote && (
                <p className="text-[11px] font-semibold text-emerald-400">
                  Fonte ativa: celular remoto (resultados calculados neste PC).
                </p>
              )}

              {/* Alternativa: celular como webcam via QR */}
              <RemoteWebcamDialog onStreamChange={handleRemoteStream} />

              {/* Barra de Status de Liveness em tempo real */}
              {isVerifying && livenessStatus && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {livenessStatus.prompt}
                    </span>
                    <span className="font-mono text-slate-400">
                      {Math.round(livenessStatus.progress * 100)}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${Math.round(livenessStatus.progress * 100)}%` }}
                    />
                  </div>

                  {currentScore && (
                    <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 font-mono">
                      <span>Similaridade ao vivo: {currentScore.similarity}%</span>
                      <span>Distância: {currentScore.distance.toFixed(4)}</span>
                      <span>Threshold: {threshold.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Ação de Verificação */}
              <div className="flex items-center justify-center">
                {!isVerifying ? (
                  <button
                    onClick={handleStartVerification}
                    disabled={!selectedProfile}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-extrabold text-base transition shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>Iniciar Verificação Facial 1:1</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (verifyTimeoutRef.current) clearTimeout(verifyTimeoutRef.current);
                      setIsVerifying(false);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Cancelar Verificação</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE TENTATIVAS DA SESSÃO (RF10) */}
      {attemptLogs.length > 0 && (
        <section className="space-y-3 p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">
                Log de Tentativas da Sessão ({attemptLogs.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Mantido apenas em memória</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase text-slate-400 border-b border-slate-800/80">
                <tr>
                  <th className="py-2 px-3">Horário</th>
                  <th className="py-2 px-3">Usuário</th>
                  <th className="py-2 px-3">Similaridade</th>
                  <th className="py-2 px-3">Distância</th>
                  <th className="py-2 px-3">Threshold</th>
                  <th className="py-2 px-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {attemptLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{log.at}</td>
                    <td className="py-2.5 px-3 font-medium text-white">{log.nome}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300 font-semibold">
                      {log.similarityScore}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{log.distance.toFixed(4)}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{log.threshold.toFixed(2)}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.success
                            ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400'
                            : 'bg-rose-950/60 border border-rose-500/40 text-rose-400'
                        }`}
                      >
                        {log.success ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> MATCH
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" /> NO-MATCH
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Export JSON dos embeddings: local salva em ./exports, prod preview + download */}
      <EmbeddingsExportPanel title="Exportar embeddings cadastrados (JSON)" />
    </div>
  );
}
