'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Camera,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCcw,
  Sliders,
  Check,
  Info,
} from 'lucide-react';
import CameraCapture from './CameraCapture';
import EmbeddingInspector from './EmbeddingInspector';
import RemoteWebcamDialog from './RemoteWebcamDialog';
import EmbeddingsExportPanel from './EmbeddingsExportPanel';
import { useCamera } from '@/hooks/useCamera';
import { useFaceEngine } from '@/hooks/useFaceEngine';
import { checkFaceQuality, analyzeImageMetrics, StabilityTracker, type QualityAssessment } from '@/lib/quality';
import { l2Normalize, computeMeanEmbedding, DEFAULT_THRESHOLD, isDegenerateEmbedding, maxPairwiseDistance } from '@/lib/matching';
import { upsertProfile, generateUserId, type FaceProfile } from '@/lib/storage';
import type { DetectionResult } from '@/lib/faceEngine';

const TOTAL_SAMPLES = 5;

export default function EnrollmentWizard() {
  const router = useRouter();

  // Etapas: 1 = Dados básicos, 2 = Captura de amostras, 3 = Sucesso / Salvar
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Dados do Usuário
  const [nome, setNome] = useState('');
  const [userId, setUserId] = useState('');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [includeThumbnail, setIncludeThumbnail] = useState(false);

  // Amostras Coletadas
  const [samples, setSamples] = useState<number[][]>([]);
  const [samplePreviews, setSamplePreviews] = useState<
    { id: number; score: number; sharpness: number; at: string }[]
  >([]);
  const [meanEmbedding, setMeanEmbedding] = useState<number[] | null>(null);
  // Diversidade entre as 5 amostras (maior distância par-a-par). Valores muito
  // baixos indicam capturas quase idênticas -> perfil frágil e super confiante.
  const [sampleDiversity, setSampleDiversity] = useState<number | null>(null);

  // Flash visual no momento da captura
  const [captureFlash, setCaptureFlash] = useState(false);

  // Webcam remota (celular via QR -> WebRTC). Quando ativa, substitui a webcam local.
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const usingRemote = remoteStream !== null;

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

  const { isReady: isAiReady, isLoading: isAiLoading, statusText: aiStatus, detect } = useFaceEngine();

  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [quality, setQuality] = useState<QualityAssessment | null>(null);

  const stabilityTrackerRef = useRef(new StabilityTracker(400, 18));
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isCapturingRef = useRef(false);

  // Atualiza userId automaticamente com slug ao digitar o nome
  const handleNameChange = (val: string) => {
    setNome(val);
    setUserId(generateUserId(val));
  };

  // Inicia câmera ao avançar para etapa 2
  const handleStartCaptureStep = async () => {
    if (!nome.trim()) return;
    setStep(2);
    setSamples([]);
    setSamplePreviews([]);
    setMeanEmbedding(null);
    setSampleDiversity(null);
    // Se o celular já estiver conectado via QR, não abre a webcam local
    if (!remoteStream) {
      await startCamera();
    }
  };

  // Recebe o stream remoto do diálogo QR; libera a webcam local para economizar recursos
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
  }, [remoteStream, videoRef, step]);

  // Processamento do Loop de Inferência (webcam local OU celular remoto)
  useEffect(() => {
    const cameraActive = isStreaming || usingRemote;
    if (step !== 2 || !cameraActive || !isAiReady) return;

    let animationFrameId: number;
    let isProcessing = false;

    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }

    const processFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || isProcessing) {
        animationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      isProcessing = true;

      try {
        const res = await detect(video);
        setDetectionResult(res);

        if (res && res.primaryFace) {
          const face = res.primaryFace;
          const [x, y, w, h] = face.box;

          // Desenha frame no canvas auxiliar para medição de brilho e blur
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

          // Checa estabilidade temporal
          const isStable = stabilityTrackerRef.current.update({ x, y, width: w, height: h });

          // Avalia qualidade completa
          const assessment = checkFaceQuality(
            res.faceCount,
            { x, y, width: w, height: h },
            video.videoWidth,
            video.videoHeight,
            metrics,
            isStable
          );

          setQuality(assessment);
        } else {
          stabilityTrackerRef.current.reset();
          setQuality(
            checkFaceQuality(0, null, video.videoWidth, video.videoHeight, { brightness: 0, sharpness: 0 }, false)
          );
        }
      } catch (err) {
        console.warn('Erro ao processar frame de cadastro:', err);
      } finally {
        isProcessing = false;
        animationFrameId = requestAnimationFrame(processFrame);
      }
    };

    animationFrameId = requestAnimationFrame(processFrame);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [step, isStreaming, usingRemote, isAiReady, detect, videoRef]);

  // Função para capturar uma amostra
  const captureCurrentSample = useCallback(() => {
    if (isCapturingRef.current) return;
    if (!detectionResult || !detectionResult.primaryFace || !detectionResult.embedding) return;
    if (!quality || !quality.isValid) return;

    const rawEmbedding = detectionResult.embedding;
    // Rejeita vetor degenerado (modelo falhou): ele casaria com qualquer pessoa.
    if (isDegenerateEmbedding(rawEmbedding)) {
      console.warn('Amostra rejeitada: embedding degenerado (variância ~0).');
      return;
    }

    isCapturingRef.current = true;

    // Dispara efeito visual de flash
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 200);

    const normalized = l2Normalize(rawEmbedding);

    const newSamples = [...samples, normalized];
    const previewItem = {
      id: newSamples.length,
      score: Math.round((detectionResult.primaryFace.score || 0.9) * 100),
      sharpness: quality.sharpness,
      at: new Date().toLocaleTimeString('pt-BR'),
    };

    setSamples(newSamples);
    setSamplePreviews((prev) => [...prev, previewItem]);

    // Se completou as 5 amostras, calcula o embedding médio e vai para a etapa 3
    if (newSamples.length >= TOTAL_SAMPLES) {
      stopCamera();
      const mean = computeMeanEmbedding(newSamples);
      setMeanEmbedding(mean);
      setSampleDiversity(maxPairwiseDistance(newSamples));
      setStep(3);
    }

    setTimeout(() => {
      isCapturingRef.current = false;
    }, 400);
  }, [detectionResult, quality, samples, stopCamera]);

  // Salvar no LocalStorage
  const handleSaveProfile = () => {
    if (!meanEmbedding || samples.length === 0) return;

    let thumbnail: string | undefined = undefined;
    if (includeThumbnail && offscreenCanvasRef.current) {
      try {
        thumbnail = offscreenCanvasRef.current.toDataURL('image/jpeg', 0.6);
      } catch (e) {
        console.warn('Erro ao gerar thumbnail:', e);
      }
    }

    const newProfile: FaceProfile = {
      userId,
      nome: nome.trim(),
      createdAt: new Date().toISOString(),
      embeddingDim: meanEmbedding.length,
      samples,
      meanEmbedding,
      threshold,
      thumbnail,
    };

    upsertProfile(newProfile);
    router.push('/login');
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Indicador de Passos */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        {[
          { num: 1, title: 'Identificação' },
          { num: 2, title: 'Captura Biométrica (5 Amostras)' },
          { num: 3, title: 'Embedding Médio & Salvar' },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ${
                step === s.num
                  ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-md shadow-cyan-500/25 ring-2 ring-cyan-400/40'
                  : step > s.num
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {step > s.num ? <Check className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-xs sm:text-sm font-medium hidden sm:inline ${
                step === s.num ? 'text-white' : 'text-slate-500'
              }`}
            >
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* ETAPA 1: Identificação */}
      {step === 1 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 backdrop-blur-xl shadow-xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Novo Cadastro Biométrico</h2>
            <p className="text-sm text-slate-400">
              Digite o seu nome para criar um perfil local. Na próxima etapa você registrará 5 amostras da sua webcam.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nome Completo / Apelido:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ex: Carlos Oliveira"
                  value={nome}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition text-sm"
                  autoFocus
                />
                <User className="w-5 h-5 text-slate-500 absolute right-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Identificador Único (Slug):
              </label>
              <input
                type="text"
                readOnly
                value={userId}
                className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-cyan-400 font-mono text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Gerado automaticamente para indexação local única.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/40 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300">
                <p className="font-semibold text-cyan-300">Garantia de Privacidade:</p>
                <p className="mt-0.5">
                  Nenhuma foto ou dado é enviado para a internet. As imagens da webcam são processadas em tempo real na GPU do seu navegador, gerando apenas vetores matemáticos (embeddings).
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleStartCaptureStep}
              disabled={!nome.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-cyan-500/25 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Avançar para Captura</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 2: Captura de Amostras */}
      {step === 2 && (
        <div className="space-y-5">
          {/* Barra de Progresso das Amostras */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Coletando Amostras ({samples.length}/{TOTAL_SAMPLES})
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralize o rosto no círculo e mantenha-se imóvel até o indicador ficar verde.
              </p>
            </div>

            {/* Marcadores 1 a 5 */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_SAMPLES }).map((_, i) => (
                <div
                  key={i}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all ${
                    i < samples.length
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : i === samples.length
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500 animate-pulse'
                      : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {i < samples.length ? <Check className="w-4 h-4" /> : i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Câmera com Flash de Captura */}
          <div className="relative">
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
              customOverlay={
                captureFlash && (
                  <div className="absolute inset-0 bg-white/70 z-40 pointer-events-none transition-opacity duration-200" />
                )
              }
            />
            {usingRemote && (
              <p className="mt-2 text-[11px] font-semibold text-emerald-400">
                Fonte ativa: celular remoto (resultados calculados neste PC).
              </p>
            )}
          </div>

          {/* Alternativa: celular como webcam via QR */}
          <RemoteWebcamDialog onStreamChange={handleRemoteStream} />

          {/* Botão de Captura Manual / Automática */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="text-xs text-slate-400">
              {quality?.isValid ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  Frame perfeitamente estabilizado! Pronto para capturar.
                </span>
              ) : (
                <span className="text-slate-400">
                  Aguardando enquadramento e estabilidade ideais...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={captureCurrentSample}
                disabled={!quality?.isValid || !detectionResult?.embedding}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Capturar Amostra #{samples.length + 1}</span>
              </button>
            </div>
          </div>

          {/* Amostras Coletadas com Detalhes */}
          {samplePreviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Amostras Coletadas nesta sessão:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {samplePreviews.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">Amostra #{p.id}</span>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 space-y-0.5">
                      <p>Confiança: {p.score}%</p>
                      <p>Nitidez: {p.sharpness}</p>
                      <p>{p.at}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ETAPA 3: Embedding Médio & Salvar */}
      {step === 3 && meanEmbedding && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">5 Amostras Coletadas com Sucesso!</h3>
                <p className="text-xs text-slate-400">
                  O vetor mestre (meanEmbedding) foi calculado através da média geométrica e renormalização L2.
                </p>
              </div>
            </div>

            {/* Alerta de diversidade: amostras quase idênticas geram perfil frágil */}
            {sampleDiversity !== null && sampleDiversity < 0.08 && (
              <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200 space-y-1">
                <p className="font-bold text-amber-300">
                  Amostras muito parecidas (diversidade {sampleDiversity.toFixed(4)})
                </p>
                <p className="text-amber-200/90">
                  As 5 capturas ficaram quase idênticas — o perfil pode ficar super confiante e
                  aceitar outras pessoas. Refaça variando levemente pose, expressão e distância
                  da câmera entre cada captura.
                </p>
              </div>
            )}

            {/* Inspecionar o Embedding Médio Calculado */}
            <EmbeddingInspector
              embedding={meanEmbedding}
              title={`Embedding Mestre de ${nome}`}
              subtitle="Vetor de 512 floats pronto para armazenar no LocalStorage"
            />

            {/* Export JSON: local salva em ./exports, prod exibe preview + download */}
            <EmbeddingsExportPanel
              payload={{
                userId,
                nome: nome.trim(),
                embeddingDim: meanEmbedding.length,
                samples,
                meanEmbedding,
                threshold,
              }}
              filename={`embedding-${userId || 'perfil'}`}
              title="Exportar embeddings desta sessão (JSON)"
            />

            {/* Opções de Privacidade / Thumbnail */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeThumbnail}
                  onChange={(e) => setIncludeThumbnail(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500/40 bg-slate-900 border-slate-700"
                />
                <span className="text-xs text-slate-300">
                  Salvar miniatura pequena (thumbnail opt-in) junto ao perfil para exibição visual
                </span>
              </label>
              <p className="text-[11px] text-slate-500 ml-7">
                Por padrão e sob princípios da LGPD, apenas os números do embedding são armazenados.
              </p>
            </div>

            {/* Ações */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={() => {
                  setStep(2);
                  setSamples([]);
                  setSamplePreviews([]);
                  setMeanEmbedding(null);
                  setSampleDiversity(null);
                  startCamera();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refazer Capturas
              </button>

              <button
                onClick={handleSaveProfile}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Perfil e Ir para Login</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
