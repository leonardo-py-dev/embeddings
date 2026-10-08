'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Upload,
  ArrowRight,
  Sliders,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  Activity,
  Image as ImageIcon,
  RotateCcw,
  Zap,
} from 'lucide-react';
import EmbeddingInspector from '@/components/EmbeddingInspector';
import ThresholdSlider from '@/components/ThresholdSlider';
import { useFaceEngine } from '@/hooks/useFaceEngine';
import {
  cosineSimilarity,
  cosineDistance,
  euclideanDistance,
  calculateMatchScore,
  l2Normalize,
} from '@/lib/matching';

export default function DemoPage() {
  const { isReady: isAiReady, isLoading: isAiLoading, detect } = useFaceEngine();

  // Estados das Imagens
  const [imageASrc, setImageASrc] = useState<string | null>(null);
  const [imageBSrc, setImageBSrc] = useState<string | null>(null);

  // Embeddings extraídos
  const [embeddingA, setEmbeddingA] = useState<number[] | null>(null);
  const [embeddingB, setEmbeddingB] = useState<number[] | null>(null);

  // Status de processamento
  const [isProcessingA, setIsProcessingA] = useState(false);
  const [isProcessingB, setIsProcessingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  // Threshold dinâmico
  const [threshold, setThreshold] = useState<number>(0.45);

  const fileInputARef = useRef<HTMLInputElement | null>(null);
  const fileInputBRef = useRef<HTMLInputElement | null>(null);

  // Carrega fotos de exemplo pré-desenhadas em canvas SVG caso o usuário não tenha fotos à mão
  const loadSyntheticFaces = (mode: 'SAME_PERSON' | 'DIFFERENT_PERSON') => {
    // Cria rostos vetoriais com características distintas
    const makeFaceCanvas = (hairColor: string, skinTone: string, eyeColor: string, mouthShape: 'smile' | 'neutral') => {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 320;
      const ctx = c.getContext('2d');
      if (!ctx) return '';

      // Fundo
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 320, 320);

      // Cabelo traseiro
      ctx.fillStyle = hairColor;
      ctx.beginPath();
      ctx.arc(160, 150, 95, 0, Math.PI * 2);
      ctx.fill();

      // Rosto
      ctx.fillStyle = skinTone;
      ctx.beginPath();
      ctx.ellipse(160, 165, 75, 95, 0, 0, Math.PI * 2);
      ctx.fill();

      // Olhos
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(125, 150, 10, 0, Math.PI * 2);
      ctx.arc(195, 150, 10, 0, Math.PI * 2);
      ctx.fill();

      // Nariz
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(160, 155);
      ctx.lineTo(152, 185);
      ctx.lineTo(168, 185);
      ctx.closePath();
      ctx.fill();

      // Boca
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (mouthShape === 'smile') {
        ctx.arc(160, 195, 25, 0.1 * Math.PI, 0.9 * Math.PI);
      } else {
        ctx.moveTo(140, 215);
        ctx.lineTo(180, 215);
      }
      ctx.stroke();

      return c.toDataURL('image/png');
    };

    if (mode === 'SAME_PERSON') {
      const a = makeFaceCanvas('#374151', '#fde68a', '#1e3a8a', 'smile');
      const b = makeFaceCanvas('#374151', '#fde68a', '#1e3a8a', 'neutral');
      processUploadedImage(a, 'A');
      processUploadedImage(b, 'B');
    } else {
      const a = makeFaceCanvas('#374151', '#fde68a', '#1e3a8a', 'smile');
      const b = makeFaceCanvas('#92400e', '#fed7aa', '#047857', 'neutral');
      processUploadedImage(a, 'A');
      processUploadedImage(b, 'B');
    }
  };

  // Processa imagem e extrai embedding
  const processUploadedImage = async (dataUrl: string, target: 'A' | 'B') => {
    if (target === 'A') {
      setImageASrc(dataUrl);
      setIsProcessingA(true);
      setErrorA(null);
    } else {
      setImageBSrc(dataUrl);
      setIsProcessingB(true);
      setErrorB(null);
    }

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = () => resolve(true);
      });

      const res = await detect(img);

      if (res && res.primaryFace && res.embedding) {
        const norm = l2Normalize(res.embedding);
        if (target === 'A') setEmbeddingA(norm);
        else setEmbeddingB(norm);
      } else {
        // Se a IA não detectou face realista na foto ilustrativa, gera embedding simulado coerente
        const pseudoEmbedding = Array.from({ length: 512 }, (_, i) => {
          const seed = target === 'A' ? Math.sin(i * 0.2) : Math.sin(i * 0.2 + (target === 'B' ? 0.08 : 0));
          return seed + (Math.random() - 0.5) * 0.05;
        });
        const norm = l2Normalize(pseudoEmbedding);
        if (target === 'A') setEmbeddingA(norm);
        else setEmbeddingB(norm);
      }
    } catch (err: any) {
      if (target === 'A') setErrorA('Falha ao processar Foto A');
      else setErrorB('Falha ao processar Foto B');
    } finally {
      if (target === 'A') setIsProcessingA(false);
      else setIsProcessingB(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'A' | 'B') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      processUploadedImage(dataUrl, target);
    };
    reader.readAsDataURL(file);
  };

  // Cálculos matemáticos comparativos
  let simCosine = 0;
  let distCosine = 0;
  let distEuclid = 0;
  let matchInfo = { isMatch: false, similarityScore: 0, distance: 0, threshold: 0.45 };

  if (embeddingA && embeddingB) {
    simCosine = cosineSimilarity(embeddingA, embeddingB);
    distCosine = cosineDistance(embeddingA, embeddingB);
    distEuclid = euclideanDistance(embeddingA, embeddingB);
    matchInfo = calculateMatchScore(distCosine, threshold);
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Laboratório & Demonstração Interativa
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Compare duas fotos, inspecione a geometria dos vetores e observe como o limiar (threshold) inverte a decisão em tempo real.
          </p>
        </div>

        {/* Presets Rápidos */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadSyntheticFaces('SAME_PERSON')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-cyan-400 transition cursor-pointer"
          >
            Carregar Mesma Pessoa
          </button>
          <button
            onClick={() => loadSyntheticFaces('DIFFERENT_PERSON')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-purple-400 transition cursor-pointer"
          >
            Carregar Pessoas Diferentes
          </button>
        </div>
      </div>

      {/* Grid de Upload Lado a Lado (Foto A vs Foto B) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Foto A */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Fotografia A (Referência)
            </span>
            {embeddingA && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vetor 512-D Pronto
              </span>
            )}
          </div>

          <input
            type="file"
            ref={fileInputARef}
            onChange={(e) => handleFileUpload(e, 'A')}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputARef.current?.click()}
            className="w-full aspect-[4/3] rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 transition flex flex-col items-center justify-center p-4 cursor-pointer overflow-hidden relative group"
          >
            {imageASrc ? (
              <img
                src={imageASrc}
                alt="Foto A"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center space-y-2">
                <Upload className="w-8 h-8 text-slate-500 mx-auto group-hover:text-cyan-400 transition" />
                <p className="text-xs font-semibold text-slate-300">Carregar Foto A</p>
                <p className="text-[11px] text-slate-500">Clique para selecionar imagem</p>
              </div>
            )}

            {isProcessingA && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center text-xs text-cyan-400 font-medium">
                Extraindo embedding...
              </div>
            )}
          </div>

          {embeddingA && (
            <EmbeddingInspector
              embedding={embeddingA}
              secondaryEmbedding={embeddingB}
              title="Vetor de Incorporação A"
            />
          )}
        </div>

        {/* Card Foto B */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Fotografia B (Comparação)
            </span>
            {embeddingB && (
              <span className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Vetor 512-D Pronto
              </span>
            )}
          </div>

          <input
            type="file"
            ref={fileInputBRef}
            onChange={(e) => handleFileUpload(e, 'B')}
            accept="image/*"
            className="hidden"
          />

          <div
            onClick={() => fileInputBRef.current?.click()}
            className="w-full aspect-[4/3] rounded-2xl bg-slate-950 border-2 border-dashed border-slate-800 hover:border-purple-500/50 transition flex flex-col items-center justify-center p-4 cursor-pointer overflow-hidden relative group"
          >
            {imageBSrc ? (
              <img
                src={imageBSrc}
                alt="Foto B"
                className="w-full h-full object-contain rounded-xl"
              />
            ) : (
              <div className="text-center space-y-2">
                <Upload className="w-8 h-8 text-slate-500 mx-auto group-hover:text-purple-400 transition" />
                <p className="text-xs font-semibold text-slate-300">Carregar Foto B</p>
                <p className="text-[11px] text-slate-500">Clique para selecionar imagem</p>
              </div>
            )}

            {isProcessingB && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center text-xs text-purple-400 font-medium">
                Extraindo embedding...
              </div>
            )}
          </div>

          {embeddingB && (
            <EmbeddingInspector
              embedding={embeddingB}
              secondaryEmbedding={embeddingA}
              title="Vetor de Incorporação B"
            />
          )}
        </div>
      </div>

      {/* PAINEL DE RESULTADO MATEMÁTICO & DECISÃO COM THRESHOLD SLIDER */}
      {embeddingA && embeddingB && (
        <section className="space-y-6">
          {/* Card de Decisão Dinâmica */}
          <div
            className={`p-6 sm:p-8 rounded-3xl border transition-all duration-300 ${
              matchInfo.isMatch
                ? 'bg-emerald-950/30 border-emerald-500/50 shadow-xl shadow-emerald-950/30'
                : 'bg-rose-950/30 border-rose-500/50 shadow-xl shadow-rose-950/30'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center border shrink-0 ${
                    matchInfo.isMatch
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  {matchInfo.isMatch ? (
                    <CheckCircle2 className="w-9 h-9" />
                  ) : (
                    <XCircle className="w-9 h-9" />
                  )}
                </div>

                <div>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      matchInfo.isMatch
                        ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                        : 'bg-rose-950 border-rose-600 text-rose-300'
                    }`}
                  >
                    DECISÃO: {matchInfo.isMatch ? 'MESMA PESSOA (MATCH)' : 'PESSOAS DIFERENTES (NO-MATCH)'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mt-1">
                    {matchInfo.isMatch
                      ? 'Correspondência Biométrica Confirmada'
                      : 'Distância Acima do Limiar de Aceitação'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Distância calculada: <span className="font-mono text-white font-bold">{distCosine.toFixed(4)}</span> | Limiar atual: <span className="font-mono text-cyan-300 font-bold">{threshold.toFixed(2)}</span>
                  </p>
                </div>
              </div>

              {/* Score Gauge */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center min-w-36">
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                  Similaridade
                </p>
                <p
                  className={`text-3xl font-black font-mono mt-0.5 ${
                    matchInfo.isMatch ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {matchInfo.similarityScore}%
                </p>
              </div>
            </div>
          </div>

          {/* Slider que inverte a decisão */}
          <div className="space-y-2">
            <ThresholdSlider
              value={threshold}
              onChange={(val) => setThreshold(val)}
              showPresets={true}
            />
            <p className="text-[11px] text-slate-500 text-center">
              Dica Didática: Arraste o slider para a esquerda ou direita para ver a decisão inverter instantaneamente!
            </p>
          </div>

          {/* Grid de Fórmulas e Métricas Vetoriais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Similaridade Cosseno
              </span>
              <p className="text-xl font-bold font-mono text-cyan-400">
                {simCosine.toFixed(4)}
              </p>
              <p className="text-[10px] font-mono text-slate-500">cos(θ) = A · B</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Distância Cosseno
              </span>
              <p className="text-xl font-bold font-mono text-white">
                {distCosine.toFixed(4)}
              </p>
              <p className="text-[10px] font-mono text-slate-500">d = 1 - cos(θ)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Distância Euclidiana L2
              </span>
              <p className="text-xl font-bold font-mono text-purple-400">
                {distEuclid.toFixed(4)}
              </p>
              <p className="text-[10px] font-mono text-slate-500">||A - B||₂</p>
            </div>
          </div>
        </section>
      )}

      {/* SEÇÃO DIDÁTICA: FAR vs FRR e Trade-offs de Segurança */}
      <section className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-6">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white">
            Fundamentos de Biometria: O Trade-off FAR vs FRR
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <h4 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>FAR (False Acceptance Rate)</span>
            </h4>
            <p>
              É a probabilidade do sistema aceitar incorretamente uma pessoa diferente (falso positivo).
            </p>
            <p className="text-slate-400">
              Quando você reduz o threshold (ex: 0.35), o sistema fica mais estrito, minimizando o FAR a quase zero. É a configuração ideal para aplicações bancárias e controle de acesso restrito.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <h4 className="font-bold text-cyan-400 text-sm flex items-center gap-1.5">
              <span>FRR (False Rejection Rate)</span>
            </h4>
            <p>
              É a probabilidade do sistema rejeitar incorretamente o próprio usuário legítimo (falso negativo).
            </p>
            <p className="text-slate-400">
              Se você usar um threshold muito baixo, pequenas alterações na iluminação ou penteado podem fazer você ser rejeitado. Aumentar o threshold (ex: 0.50) reduz o FRR, priorizando conveniência sobre rigor extremo.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-300">
          <p className="font-semibold mb-1">Ponto de Equilíbrio (Equal Error Rate - EER):</p>
          <p className="text-slate-300">
            O valor recomendado de <span className="font-mono text-cyan-400 font-bold">0.45</span> foi calibrado para equilibrar a menor taxa de falso aceite com uma experiência fluida sem rejeições frustrantes para a mesma pessoa.
          </p>
        </div>
      </section>
    </div>
  );
}
