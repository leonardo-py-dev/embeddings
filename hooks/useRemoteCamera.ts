'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Peer, MediaConnection } from 'peerjs';
import { peerIds } from '@/lib/remoteSession';

export type RemotePcStatus = 'idle' | 'waiting' | 'connected' | 'error';

interface UseRemoteCameraResult {
  status: RemotePcStatus;
  remoteStream: MediaStream | null;
  error: string | null;
  startWaiting: (sessionId: string) => void;
  stopWaiting: () => void;
}

export function useRemoteCamera(): UseRemoteCameraResult {
  const [status, setStatus] = useState<RemotePcStatus>('idle');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const destroyPeer = useCallback(() => {
    try {
      callRef.current?.close?.();
    } catch { /* noop */ }
    try {
      peerRef.current?.destroy?.();
    } catch { /* noop */ }
    callRef.current = null;
    peerRef.current = null;
  }, []);

  const stopWaiting = useCallback(() => {
    destroyPeer();
    setRemoteStream((prev) => {
      prev?.getTracks().forEach((t) => t.stop());
      return null;
    });
    setStatus('idle');
    setError(null);
  }, [destroyPeer]);

  const startWaiting = useCallback(
    (sessionId: string) => {
      destroyPeer();
      setError(null);
      setRemoteStream(null);
      setStatus('waiting');

      // Import dinâmico para não quebrar SSR / build estático
      import('peerjs')
        .then(({ Peer }) => {
          const { pc } = peerIds(sessionId);
          const peer = new Peer(pc);
          peerRef.current = peer;

          peer.on('open', () => {
            setStatus('waiting');
          });

          // Celular liga para o PC enviando o stream de vídeo
          peer.on('call', (call: MediaConnection) => {
            callRef.current = call;
            // PC não envia mídia de volta, só recebe
            call.answer();
            call.on('stream', (stream: MediaStream) => {
              setRemoteStream(stream);
              setStatus('connected');
            });
            call.on('close', () => {
              setStatus('waiting');
              setRemoteStream(null);
            });
            call.on('error', () => {
              setError('Conexão com o celular foi interrompida.');
              setStatus('error');
            });
          });

          peer.on('error', (err: Error & { type?: string }) => {
            console.warn('Erro PeerJS (PC):', err);
            if (err?.type === 'unavailable-id' || err?.type === 'peer-unavailable') {
              setError('ID de sessão em uso. Gere um novo QR code.');
            } else {
              setError('Falha na sinalização. Verifique a internet e tente de novo.');
            }
            setStatus('error');
          });
        })
        .catch((err) => {
          console.error('Falha ao carregar PeerJS:', err);
          setError('Não foi possível iniciar a conexão remota.');
          setStatus('error');
        });
    },
    [destroyPeer]
  );

  useEffect(() => {
    return () => {
      destroyPeer();
    };
  }, [destroyPeer]);

  return { status, remoteStream, error, startWaiting, stopWaiting };
}
