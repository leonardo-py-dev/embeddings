'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getHuman, detectFaces, type DetectionResult } from '@/lib/faceEngine';

export interface UseFaceEngineState {
  isReady: boolean;
  isLoading: boolean;
  progress: number;
  statusText: string;
  error: string | null;
}

export function useFaceEngine(autoInit = true) {
  const [state, setState] = useState<UseFaceEngineState>({
    isReady: false,
    isLoading: autoInit,
    progress: 0,
    statusText: 'Iniciando IA...',
    error: null,
  });

  const isDetectingRef = useRef(false);

  const init = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      await getHuman((percent, msg) => {
        setState((s) => ({
          ...s,
          progress: percent,
          statusText: msg,
        }));
      });
      setState({
        isReady: true,
        isLoading: false,
        progress: 100,
        statusText: 'Motor de IA pronto para inferência',
        error: null,
      });
    } catch (err: any) {
      console.error('Falha ao inicializar motor facial:', err);
      setState({
        isReady: false,
        isLoading: false,
        progress: 0,
        statusText: 'Erro ao carregar modelos neurais',
        error: err.message || 'Falha ao inicializar os modelos neurais WebGL.',
      });
    }
  }, []);

  const runDetection = useCallback(
    async (
      input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
    ): Promise<DetectionResult | null> => {
      if (!state.isReady || isDetectingRef.current) return null;
      isDetectingRef.current = true;
      try {
        const res = await detectFaces(input);
        return res;
      } catch (err) {
        console.warn('Erro durante detecção facial:', err);
        return null;
      } finally {
        isDetectingRef.current = false;
      }
    },
    [state.isReady]
  );

  useEffect(() => {
    if (autoInit) {
      init();
    }
  }, [autoInit, init]);

  return {
    ...state,
    init,
    detect: runDetection,
  };
}
