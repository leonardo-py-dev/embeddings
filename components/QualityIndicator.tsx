'use client';

import { Sun, Focus, UserCheck, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { QualityAssessment } from '@/lib/quality';

interface QualityIndicatorProps {
  assessment: QualityAssessment | null;
  compact?: boolean;
}

export default function QualityIndicator({ assessment, compact = false }: QualityIndicatorProps) {
  if (!assessment) return null;

  const getStatusColor = (valid: boolean, warn = false) => {
    if (valid) return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40';
    if (warn) return 'text-amber-400 bg-amber-950/40 border-amber-800/40';
    return 'text-rose-400 bg-rose-950/40 border-rose-800/40';
  };

  const isLightOk = assessment.brightness >= 45 && assessment.brightness <= 220;
  const isSharpOk = assessment.sharpness >= 8;
  const isPositionOk = assessment.code !== 'TOO_FAR' && assessment.code !== 'TOO_CLOSE' && assessment.code !== 'NOT_CENTERED';
  const isStable = assessment.isStable;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg border bg-slate-900/80 backdrop-blur-md border-slate-800">
        {assessment.isValid ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span className={assessment.isValid ? 'text-emerald-300 font-medium' : 'text-amber-300 font-medium'}>
          {assessment.message}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2.5">
      {/* Banner Principal com Mensagem */}
      <div
        className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-300 ${
          assessment.isValid
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
        }`}
      >
        {assessment.isValid ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
        )}
        <p className="text-xs sm:text-sm font-medium tracking-wide">{assessment.message}</p>
      </div>

      {/* Grid de 4 Métricas de Qualidade */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Iluminação */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${getStatusColor(isLightOk)}`}>
          <Sun className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Luz</p>
            <p className="text-xs font-semibold truncate">
              {isLightOk ? 'Adequada' : assessment.brightness < 45 ? 'Muito Escuro' : 'Excesso de Luz'}
            </p>
          </div>
        </div>

        {/* Nitidez */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${getStatusColor(isSharpOk)}`}>
          <Focus className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Nitidez</p>
            <p className="text-xs font-semibold truncate">{isSharpOk ? 'Foco Nítido' : 'Embaçado'}</p>
          </div>
        </div>

        {/* Enquadramento */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${getStatusColor(isPositionOk)}`}>
          <UserCheck className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Posição</p>
            <p className="text-xs font-semibold truncate">{isPositionOk ? 'Enquadrado' : 'Ajustar Posição'}</p>
          </div>
        </div>

        {/* Estabilidade */}
        <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 ${getStatusColor(isStable)}`}>
          <Activity className="w-4 h-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Postura</p>
            <p className="text-xs font-semibold truncate">{isStable ? 'Estável' : 'Mantenha Firme'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
