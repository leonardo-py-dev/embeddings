'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseCameraOptions {
  autoStart?: boolean;
  idealWidth?: number;
  idealHeight?: number;
  mirrored?: boolean;
}

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  devices: MediaDeviceInfo[];
  activeDeviceId: string | null;
  isMirrored: boolean;
  startCamera: (deviceId?: string) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  toggleMirror: () => void;
  clearError: () => void;
}

export function useCamera({
  autoStart = false,
  idealWidth = 1280,
  idealHeight = 720,
  mirrored = true,
}: UseCameraOptions = {}): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [isMirrored, setIsMirrored] = useState(mirrored);

  // Lista dispositivos de vídeo disponíveis
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
    } catch (e) {
      console.warn('Falha ao listar câmeras:', e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('Navegador não suporta acesso à câmera via getUserMedia ou contexto inseguro (HTTPS requerido).');
        return;
      }

      setIsLoading(true);
      setError(null);

      // Limpa stream anterior se existir
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      try {
        // Checagem prévia: se o sistema não expõe nenhum dispositivo de vídeo,
        // falha rápido com mensagem acionável em vez de estourar NotFoundError.
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = all.filter((d) => d.kind === 'videoinput');
          setDevices(videoInputs);
          if (videoInputs.length === 0) {
            setError(
              'Nenhuma câmera foi encontrada neste dispositivo. Se este PC não tem webcam, use a opção "celular como webcam (QR)" abaixo. No Windows, verifique também Configurações > Bluetooth e dispositivos > Câmeras e a chave de privacidade do navegador.'
            );
            setIsStreaming(false);
            return;
          }
          // Se um deviceId específico foi pedido mas não existe mais, ignora o filtro.
          if (deviceId && !videoInputs.some((d) => d.deviceId === deviceId)) {
            deviceId = undefined;
          }
        } catch {
          // Se enumerateDevices falhar, segue para o getUserMedia e trata o erro lá.
        }

        const fullConstraints: MediaStreamConstraints = {
          audio: false,
          video: {
            width: { ideal: idealWidth },
            height: { ideal: idealHeight },
            facingMode: 'user',
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
        };

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(fullConstraints);
        } catch (firstErr: unknown) {
          const name = firstErr instanceof DOMException ? firstErr.name : (firstErr as { name?: string })?.name;
          // Fallback: restrições ideais/exatas podem gerar Overconstrained/NotFound
          // em hardware simples. Tenta o modo mais permissivo antes de desistir.
          if (name === 'OverconstrainedError' || name === 'NotFoundError') {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          } else {
            throw firstErr;
          }
        }
        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.playsInline = true;
          videoRef.current.muted = true;

          // Espera metadata carregar e inicia reprodução
          await new Promise<void>((resolve) => {
            if (!videoRef.current) return resolve();
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => resolve()).catch(() => resolve());
            };
          });
        }

        setIsStreaming(true);

        const currentTrack = mediaStream.getVideoTracks()[0];
        if (currentTrack) {
          const settings = currentTrack.getSettings();
          if (settings.deviceId) {
            setActiveDeviceId(settings.deviceId);
          }
        }

        await refreshDevices();
      } catch (err: unknown) {
        const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name;
        console.error('Erro ao acessar webcam:', err);
        let msg = 'Não foi possível acessar a câmera.';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          msg = 'Permissão de câmera negada ou contexto inseguro. Permita o acesso no ícone de câmera da barra de endereço e use HTTPS (ou localhost).';
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          msg = 'Nenhum dispositivo de câmera foi encontrado no sistema. Se este PC não tem webcam, use a opção "celular como webcam (QR)" abaixo. Verifique também se a câmera não está desabilitada no Gerenciador de Dispositivos / Configurações do Windows.';
        } else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
          msg = 'A câmera está sendo utilizada por outro aplicativo (ex: Teams, Zoom, OBS) ou falhou ao iniciar. Feche o outro app e tente novamente.';
        } else if (name === 'OverconstrainedError') {
          msg = 'Resolução ou restrição de câmera não suportada pelo hardware. Tente outra câmera ou revise as restrições.';
        }
        setError(msg);
        setIsStreaming(false);
      } finally {
        setIsLoading(false);
      }
    },
    [idealWidth, idealHeight, refreshDevices]
  );

  const switchCamera = useCallback(async () => {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    await startCamera(devices[nextIndex].deviceId);
  }, [devices, activeDeviceId, startCamera]);

  const toggleMirror = useCallback(() => {
    setIsMirrored((prev) => !prev);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [autoStart, startCamera, stopCamera]);

  return {
    videoRef,
    stream,
    isStreaming,
    isLoading,
    error,
    devices,
    activeDeviceId,
    isMirrored,
    startCamera,
    stopCamera,
    switchCamera,
    toggleMirror,
    clearError,
  };
}
