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
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            width: { ideal: idealWidth },
            height: { ideal: idealHeight },
            facingMode: 'user',
            ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
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
      } catch (err: any) {
        console.error('Erro ao acessar webcam:', err);
        let msg = 'Não foi possível acessar a câmera.';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          msg = 'Permissão de acesso à câmera negada. Habilite nas configurações do seu navegador.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = 'Nenhum dispositivo de câmera foi encontrado no sistema.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          msg = 'A câmera está sendo utilizada por outro aplicativo ou processo.';
        } else if (err.name === 'OverconstrainedError') {
          msg = 'Resolução ou restrição de câmera não suportada pelo hardware.';
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
  };
}
