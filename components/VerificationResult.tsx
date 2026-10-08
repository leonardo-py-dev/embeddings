'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, XCircle, RotateCcw, Sliders, ShieldCheck, ShieldAlert, User } from 'lucide-react';
import Link from 'next/link';

export interface VerificationResultData {
  isMatch: boolean;
  userName: string;
  userId: string;
  similarityScore: number;
  distance: number;
  threshold: number;
  livenessPassed: boolean;
  consecutiveMatches: number;
  thumbnail?: string;
}

interface VerificationResultProps {
  data: VerificationResultData;
  onRetry: () => void;
}

export default function VerificationResult({ data, onRetry }: VerificationResultProps) {
  const {
    isMatch,
    userName,
    similarityScore,
    distance,
    threshold,
    livenessPassed,
    consecutiveMatches,
  } = data;

  useEffect(() => {
    if (isMatch) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#38bdf8', '#34d399'],
        });
      } catch (e) {
        // Ignora se canvas-confetti falhar em algum ambiente restrito
      }
    }
  }, [isMatch]);

  return (
    <div
      className={`w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-xl transition-all duration-500 shadow-2xl ${
        isMatch
          ? 'bg-gradient-to-b from-emerald-950/40 via-slate-900/80 to-slate-950 border-emerald-500/40 shadow-emerald-950/30'
          : 'bg-gradient-to-b from-rose-950/40 via-slate-900/80 to-slate-950 border-rose-500/40 shadow-rose-950/30'
      }`}
    >
      {/* Ícone e Título de Decisão */}
      <div className="flex flex-col items-center text-center mb-6">
        <div
          className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-4 border shadow-xl ${
            isMatch
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-emerald-500/20 animate-bounce'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-400 shadow-rose-500/20'
          }`}
        >
          {isMatch ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
        </div>

        <span
          className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border mb-2 ${
            isMatch
              ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/30 text-rose-300'
          }`}
        >
          {isMatch ? 'VERIFICAÇÃO BEM-SUCEDIDA' : 'ACESSO NÃO AUTORIZADO'}
        </span>

        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {isMatch ? `Bem-vindo(a), ${userName}!` : 'Rosto Não Reconhecido'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md">
          {isMatch
            ? 'Os embeddings biométricos correspondem ao perfil cadastrado dentro do limiar seguro.'
            : 'A similaridade entre o rosto ao vivo e as amostras do perfil ficou abaixo do limite configurado.'}
        </p>
      </div>

      {/* Grid de Métricas Técnicas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {/* Similaridade */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Similaridade</p>
          <p
            className={`text-xl sm:text-2xl font-mono font-bold mt-1 ${
              isMatch ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {similarityScore}%
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Pontuação 1:1</p>
        </div>

        {/* Distância Cosseno */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Distância</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-white mt-1">
            {distance.toFixed(4)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">1 - CosSim</p>
        </div>

        {/* Limiar Usado */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Threshold</p>
          <p className="text-xl sm:text-2xl font-mono font-bold text-cyan-400 mt-1">
            {threshold.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {distance <= threshold ? '<= Aceito' : '> Rejeitado'}
          </p>
        </div>

        {/* Prova de Vida */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Liveness</p>
          <div className="flex items-center justify-center gap-1 mt-1">
            {livenessPassed ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            )}
            <span
              className={`text-lg font-mono font-bold ${
                livenessPassed ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {consecutiveMatches} frames
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {livenessPassed ? 'Aprovado' : 'Instável'}
          </p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onRetry}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Nova Tentativa</span>
        </button>

        <Link
          href="/demo"
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-cyan-950/50 hover:bg-cyan-900/50 text-cyan-300 font-semibold text-sm transition flex items-center justify-center gap-2 border border-cyan-800/60"
        >
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Ajustar Threshold no Laboratório</span>
        </Link>
      </div>
    </div>
  );
}
