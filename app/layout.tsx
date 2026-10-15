import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'FaceEmbed | Login Facial por Embeddings 100% Client-Side',
  description:
    'Demonstração interativa de reconhecimento facial 1:1, extração de vetores de embedding de 512 dimensões, similaridade cosseno e prova de vida diretamente no navegador.',
  keywords: [
    'Reconhecimento Facial',
    'Embeddings',
    'Similaridade Cosseno',
    'Visão Computacional',
    'Next.js',
    'Client-Side IA',
    'Webcam',
    'Biometria',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} dark antialiased`}>
      <body className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
        <Suspense fallback={null}>
          <Navbar />
        </Suspense>
        <main className="flex-1 w-full">{children}</main>
        <footer className="w-full border-t border-slate-900 bg-slate-950/70 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>
              FaceEmbed • Sistema Educacional de Embeddings Faciais • 100% no navegador (Client-Side)
            </p>
            <p className="text-slate-400">
              Nenhuma imagem ou vetor sai da sua máquina. Em conformidade com princípios da LGPD.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
