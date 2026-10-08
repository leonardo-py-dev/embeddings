'use client';

import React, { useState } from 'react';
import { Eye, Hash, Binary, Sparkles, Layers } from 'lucide-react';

interface EmbeddingInspectorProps {
  embedding: number[] | null;
  secondaryEmbedding?: number[] | null;
  title?: string;
  subtitle?: string;
}

export default function EmbeddingInspector({
  embedding,
  secondaryEmbedding,
  title = 'Assinatura Biométrica (Embedding 512-D)',
  subtitle = 'Vetor numérico de ponto flutuante normalizado L2 gerado pela rede neural.',
}: EmbeddingInspectorProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!embedding || embedding.length === 0) {
    return (
      <div className="w-full p-6 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
        <Binary className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-400">Nenhum embedding facial carregado.</p>
        <p className="text-xs text-slate-500 mt-1">
          Posicione-se em frente à câmera para extrair o vetor de 512 dimensões.
        </p>
      </div>
    );
  }

  // Calcula a norma L2 para demonstração matemática
  const normL2 = Math.sqrt(embedding.reduce((acc, v) => acc + v * v, 0));

  // Função para mapear valor [-0.2, 0.2] para cor no heatmap
  const getHeatmapColor = (val: number) => {
    // Valores de embedding L2 normalizado de 512-d geralmente ficam entre -0.15 e +0.15
    const clamped = Math.max(-0.15, Math.min(0.15, val));
    const normalized = (clamped + 0.15) / 0.3; // 0 a 1

    if (val > 0) {
      // Tom ciano/esmeralda
      const alpha = Math.min(1, Math.max(0.15, Math.abs(val) * 7));
      return `rgba(6, 182, 212, ${alpha})`;
    } else {
      // Tom violeta/índigo
      const alpha = Math.min(1, Math.max(0.15, Math.abs(val) * 7));
      return `rgba(168, 85, 247, ${alpha})`;
    }
  };

  return (
    <div className="w-full space-y-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-cyan-300 border border-slate-700">
            {embedding.length} dimensões
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-700">
            ||v||₂ = {normL2.toFixed(3)}
          </span>
        </div>
      </div>

      {/* Heatmap Grid Interativo (512 células) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-medium">Mapa de Calor Vetorial (Heatmap 512-D):</span>
          {hoveredIndex !== null ? (
            <span className="font-mono text-cyan-400 font-semibold">
              Dim #{hoveredIndex}: {embedding[hoveredIndex]?.toFixed(5)}
              {secondaryEmbedding && (
                <span className="text-purple-400 ml-2">
                  (B: {secondaryEmbedding[hoveredIndex]?.toFixed(5)})
                </span>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Passe o mouse nas células para inspecionar</span>
          )}
        </div>

        {/* Grade de 32 colunas x 16 linhas = 512 células */}
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
          <div className="grid grid-cols-16 sm:grid-cols-32 gap-1 max-h-40 overflow-y-auto sm:max-h-none">
            {embedding.slice(0, 512).map((val, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{ backgroundColor: getHeatmapColor(val) }}
                className={`w-full aspect-square rounded-[2px] cursor-pointer transition-transform duration-100 hover:scale-150 hover:z-20 hover:ring-2 hover:ring-white ${
                  hoveredIndex === idx ? 'scale-150 ring-2 ring-white z-20' : ''
                }`}
                title={`Dimensão ${idx}: ${val.toFixed(5)}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-purple-500 inline-block" />
              Valores Negativos (&lt; 0)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-slate-800 inline-block" />
              Neutro (~0.0)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-[2px] bg-cyan-400 inline-block" />
              Valores Positivos (&gt; 0)
            </span>
          </div>
        </div>
      </div>

      {/* Amostra numérica das primeiras 16 dimensões */}
      <div className="space-y-1.5">
        <p className="text-xs text-slate-400 font-medium">Primeiras 16 Dimensões (Amostra Float32):</p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {embedding.slice(0, 16).map((val, i) => (
            <div
              key={i}
              className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono"
            >
              <div className="text-[10px] text-slate-500">d[{i}]</div>
              <div
                className={`text-xs font-semibold ${
                  val >= 0 ? 'text-cyan-400' : 'text-purple-400'
                }`}
              >
                {val.toFixed(3)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
