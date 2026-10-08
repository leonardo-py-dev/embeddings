'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, UserPlus, Info } from 'lucide-react';
import EnrollmentWizard from '@/components/EnrollmentWizard';

export default function RegisterPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Botão Voltar */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Início</span>
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="max-w-4xl mx-auto space-y-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cadastrar Perfil Biométrico
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-slate-400">
          Gere um vetor de embedding mestre a partir de 5 capturas estáveis da sua webcam.
        </p>
      </div>

      {/* Componente Wizard de Cadastro */}
      <EnrollmentWizard />
    </div>
  );
}
