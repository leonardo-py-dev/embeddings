'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Camera, Video, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import type { Peer, MediaConnection } from 'peerjs';
import { peerIds, isSecureForCamera } from '@/lib/remoteSession';

type PhoneStatus = 'idle' | 'requesting-camera' | 'connecting' | 'streaming' | 'error';

function RemoteCaptureInner() {
  const params = useParams();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';

  const { videoRef, isStreaming, isLoading, error: camError, stream, startCamera } = useCamera({
    autoStart: false,
    idealWidth: 1280,
    idealHeight: 720,
  });

  const [status, setStatus] = useState<PhoneStatus>('idle');
  const [peerError, setPeerError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const cleanup = () => {
    try {
      callRef.current?.close?.();
    } catch { /* noop */ }
    try {
      peerRef.current?.destroy?.();
    } catch { /* noop */ }
    callRef.current = null;
    peerRef.current = null;
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const handleStart = async () => {
    if (!sessionId) {
      setPeerError('Sessão inválida. Escaneie o QR novamente.');
      setStatus('error');
      return;
    }
    setPeerError(null);
    setStatus('requesting-camera');
    await startCamera();

    // Aguarda o stream estar disponível via videoRef após startCamera
    // startCamera já anexa ao videoRef; capturamos via video.srcObject
    setStatus('connecting');

    try {
      const { Peer } = await import('peerjs');
      const { pc, phone } = peerIds(sessionId);
      const peer = new Peer(phone);
      peerRef.current = peer;

      peer.on('open', () => {
        const video = videoRef.current;
        const mediaStream: MediaStream | null =
          (video?.srcObject as MediaStream | null) || stream || null;

        if (!mediaStream) {
          setPeerError('Câmera não liberada. Toque em permitir e tente de novo.');
          setStatus('error');
          return;
        }

        const call = peer.call(pc, mediaStream);
        callRef.current = call;
        call.on('close', () => {
          setStatus('idle');
        });
        call.on('error', () => {
          setPeerError('Conexão com o PC foi perdida.');
          setStatus('error');
        });
        setStatus('streaming');
      });

      peer.on('error', (err: Error & { type?: string }) => {
        console.warn('Erro PeerJS (celular):', err);
        setPeerError(
          err?.type === 'peer-unavailable'
            ? 'PC não encontrado. Deixe a página do PC aberta no QR e tente de novo.'
            : 'Falha ao conectar. Verifique a internet e tente de novo.'
        );
        setStatus('error');
      });
    } catch (err) {
      console.error(err);
      setPeerError('Não foi possível iniciar a transmissão.');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    cleanup();
    setStatus('idle');
    setPeerError(null);
    handleStart();
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/60 border border-cyan-800/50 text-cyan-300 text-xs font-semibold">
            <Video className="w-3.5 h-3.5" />
            Webcam remota do PC
          </div>
          <h1 className="text-xl font-extrabold text-white">Transmitindo para o PC</h1>
          <p className="text-xs text-slate-400 font-mono">Sessão: {sessionId || '(inválida)'}</p>
          <p className="text-xs text-slate-400">
            O processamento facial acontece no PC. Este celular envia apenas o vídeo.
          </p>
        </div>

        {!isSecureForCamera() && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>Abra esta página em HTTPS, senão o navegador bloqueia a câmera.</p>
          </div>
        )}

        <div className="relative w-full aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="w-full h-full object-cover"
          />
          {!isStreaming && status !== 'requesting-camera' && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-3 text-cyan-400">
                <Camera className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">Câmera desligada</p>
              <p className="text-xs text-slate-400 mb-4">
                Toque abaixo para permitir a câmera e iniciar a transmissão.
              </p>
            </div>
          )}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 text-sm text-cyan-300">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Iniciando câmera...
            </div>
          )}
          {status === 'streaming' && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              TRANSMITINDO
            </div>
          )}
        </div>

        {(camError || peerError) && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-300">
            {camError || peerError}
          </div>
        )}

        {status === 'streaming' ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p>Conectado! Mantenha esta tela aberta. Os resultados aparecem no PC.</p>
          </div>
        ) : (
          <button
            onClick={status === 'error' ? handleRetry : handleStart}
            disabled={isLoading || status === 'requesting-camera' || status === 'connecting'}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-extrabold text-sm transition shadow-xl shadow-cyan-500/25 disabled:opacity-40 cursor-pointer"
          >
            {status === 'error'
              ? 'Tentar novamente'
              : status === 'connecting'
              ? 'Conectando ao PC...'
              : status === 'requesting-camera'
              ? 'Solicitando câmera...'
              : 'Permitir câmera e transmitir'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RemoteCapturePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-sm text-slate-400">Carregando sessão remota...</div>}>
      <RemoteCaptureInner />
    </Suspense>
  );
}
