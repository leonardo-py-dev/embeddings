'use client';

import React from 'react';
import { Sliders, ShieldAlert, ShieldCheck, Info } from 'lucide-react';

interface ThresholdSliderProps {
  value: number; // 0.30 a 0.70
  onChange: (newValue: number) => void;
  disabled?: boolean;
  showPresets?: boolean;
}

export default function ThresholdSlider({
  value,
  onChange,
  disabled = false,
  showPresets = true,
}: ThresholdSliderProps) {
  const getSecurityDescriptor = (val: number) => {
    if (val < 0.33) {
      return {
        label: 'Alta Segurança (Estrito)',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border-amber-800/40',
        desc: 'Menor risco de invasor (baixo FAR), mas pode exigir iluminação perfeita.',
      };
    }
    if (val <= 0.52) {
      return {
        label: 'Equilibrado (Recomendado)',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/40 border-emerald-800/40',
        desc: 'Ideal para o dia a dia. Tolerância balanceada a variações de expressão.',
      };
    }
    return {
      label: 'Permissivo (Alta Conveniência)',
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-800/40',
      desc: 'Fácil aceitação (baixo FRR), porém com maior tolerância a rostos parecidos.',
    };
  };

  const security = getSecurityDescriptor(value);

  return (
    <div className="w-full space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-slate-200">Limiar de Distância (Threshold)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Distância Máxima:</span>
          <span className="px-2.5 py-0.5 rounded-lg bg-cyan-950 border border-cyan-800/60 text-cyan-300 font-mono font-bold text-sm">
            {value.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Slider estilizado */}
      <div className="space-y-1.5">
        <input
          type="range"
          min="0.30"
          max="0.70"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50"
        />
        <div className="flex justify-between text-[11px] font-mono text-slate-500 px-0.5">
          <span>0.30 (Mais Rígido)</span>
          <span className="text-emerald-400 font-semibold">0.35 (Padrão)</span>
          <span>0.70 (Mais Flexível)</span>
        </div>
      </div>

      {/* Presets Rápidos */}
      {showPresets && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-medium">Ajustes:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { val: 0.30, label: 'Estrito (0.30)' },
              { val: 0.35, label: 'Padrão (0.35)' },
              { val: 0.55, label: 'Flexível (0.55)' },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                disabled={disabled}
                onClick={() => onChange(p.val)}
                className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition cursor-pointer ${
                  Math.abs(value - p.val) < 0.005
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-700/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Box explicativo do estado selecionado */}
      <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${security.bg}`}>
        <Info className={`w-4 h-4 shrink-0 mt-0.5 ${security.color}`} />
        <div className="text-xs">
          <span className={`font-semibold ${security.color}`}>{security.label}: </span>
          <span className="text-slate-300">{security.desc}</span>
        </div>
      </div>
    </div>
  );
}
