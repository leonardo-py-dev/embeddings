'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Shield,
  UserPlus,
  LogIn,
  Sliders,
  Cpu,
  Sparkles,
  Lock,
  ArrowRight,
  Database,
  Eye,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import ProfileManager from '@/components/ProfileManager';
import { getAllProfiles, type FaceProfile } from '@/lib/storage';
import { useFaceEngine } from '@/hooks/useFaceEngine';

export default function HomePage() {
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const { isReady: isAiReady, isLoading: isAiLoading, progress: aiProgress, statusText: aiStatus } = useFaceEngine();

  useEffect(() => {
    setProfiles(getAllProfiles());
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-16">
      {/* HERO SECTION */}
      <section className="relative flex flex-col items-center text-center max-w-3xl mx-auto space-y-6">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs text-slate-300 backdrop-blur-md shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isAiReady ? 'bg-emerald-400 animate-pulse' : 'bg-cyan-400 animate-ping'
            }`}
          />
          <span className="font-medium">
            {isAiReady ? 'Modelos de Visão WebGL Prontos' : aiStatus || 'Carregando Modelos...'}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-semibold">100% Client-Side</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          Login Facial por{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">
            Embeddings Vetoriais
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Autenticação biométrica 1:1 executada inteiramente na GPU do seu navegador. Sem servidores, sem envio de fotos e com privacidade matemática garantida.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto pt-2">
          <Link
            href="/register"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/20 transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-slate-950" />
            <span>Cadastrar Meu Rosto</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 text-white font-semibold text-sm transition-all duration-300 hover:scale-[1.02] flex items-center justify-center gap-2.5 shadow-lg shadow-black/40 cursor-pointer"
          >
            <LogIn className="w-4 h-4 text-cyan-400" />
            <span>Realizar Login 1:1</span>
          </Link>

          <Link
            href="/demo"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-950/60 hover:bg-slate-900/60 border border-cyan-800/40 text-cyan-300 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Laboratório Didático</span>
          </Link>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Em conformidade com a LGPD: fotos nunca são persistidas, apenas vetores numéricos locais.</span>
        </div>
      </section>

      {/* 3 STEPS HOW IT WORKS */}
      <section className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Como Funciona o Reconhecimento por Embeddings?
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Ao contrário da biometria tradicional que compara fotos brutas, redes neurais compactam a geometria facial em representações matemáticas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-slate-700 transition space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-lg">
              1
            </div>
            <h3 className="text-base font-bold text-white">Extração do Vetor (512-D)</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O modelo neural processa o crop alinhado da face e projeta seus traços anatômicos em um espaço vetorial de 512 dimensões.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-slate-700 transition space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
              2
            </div>
            <h3 className="text-base font-bold text-white">Normalização L2 & Média</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Durante o cadastro, coletamos 5 amostras e geramos um embedding médio renormalizado L2, garantindo invariância a variações suaves de luz.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-slate-700 transition space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-lg">
              3
            </div>
            <h3 className="text-base font-bold text-white">Similaridade Cosseno & Limiar</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No login, o ângulo entre os vetores é calculado via produto escalar. Se a distância for menor que o limiar (ex: 0.45), o acesso é autorizado.
            </p>
          </div>
        </div>
      </section>

      {/* GERENCIADOR DE PERFIS LOCAIS */}
      <section className="space-y-4">
        <ProfileManager />
      </section>

      {/* PRIVACIDADE E ARQUITETURA */}
      <section className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900/80 via-slate-900/40 to-slate-950 border border-slate-800 backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Privacidade por Design (Client-Side Only)</h3>
            <p className="text-xs text-slate-400">
              Arquitetura zero-conhecimento: nenhuma foto ou vetor sai da sua máquina.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <p className="font-semibold text-slate-200">Sem Backend ou API Externa</p>
            <p>Os modelos TensorFlow/WebGL rodam localmente usando recursos da GPU local.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <p className="font-semibold text-slate-200">Armazenamento em LocalStorage</p>
            <p>Seus perfis ficam sob a chave restrita face-login-db-v1 no domínio do seu navegador.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
            <p className="font-semibold text-slate-200">Inversão Impossível</p>
            <p>A partir do vetor de embedding não é possível reconstruir a fotografia original do rosto.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
