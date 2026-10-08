'use client';

/**
 * Motor de Inteligência Artificial usando @vladmandic/human.
 * Configurado para execução 100% client-side (WebGL / WASM) com modelos locais em /models/.
 * Atende aos requisitos RNF01, RNF02 e RNF03 do PRD.
 */

import type { Human, Config, Result, FaceResult } from '@vladmandic/human';

export interface DetectionResult {
  faces: FaceResult[];
  faceCount: number;
  primaryFace: FaceResult | null;
  embedding: number[] | null;
  rawResult: Result;
  timestamp: number;
}

let humanInstance: Human | null = null;
let initPromise: Promise<Human> | null = null;

export const defaultHumanConfig: Partial<Config> = {
  backend: 'webgl',
  modelBasePath: '/models/',
  cacheModels: true,
  warmup: 'face',
  debug: false,
  async: true,
  filter: {
    enabled: true,
    width: 0,
    height: 0,
    flip: false,
  },
  gesture: {
    enabled: true,
  },
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,
      maxDetected: 2,
      minConfidence: 0.5,
      scale: 1.2,
      square: true,
    },
    mesh: {
      enabled: true,
    },
    iris: {
      enabled: false,
    },
    description: {
      enabled: true,
      minConfidence: 0.5,
    },
    emotion: {
      enabled: false,
    },
    antispoof: {
      enabled: false,
    },
    liveness: {
      enabled: false,
    },
  },
  body: {
    enabled: false,
  },
  hand: {
    enabled: false,
  },
  object: {
    enabled: false,
  },
  segmentation: {
    enabled: false,
  },
};

/**
 * Inicializa a instância Singleton do Human no navegador
 */
export async function getHuman(
  onProgress?: (percent: number, status: string) => void
): Promise<Human> {
  if (typeof window === 'undefined') {
    throw new Error('A IA Human só pode ser executada no navegador (client-side).');
  }

  if (humanInstance) {
    if (onProgress) onProgress(100, 'Motor IA pronto');
    return humanInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      if (onProgress) onProgress(10, 'Carregando biblioteca IA...');
      const humanModule = await import('@vladmandic/human');
      const HumanConstructor = humanModule.Human || humanModule.default;

      if (onProgress) onProgress(25, 'Configurando acelerador WebGL...');
      const human = new HumanConstructor(defaultHumanConfig);

      // Registrar callbacks de eventos se suportado
      human.events?.addEventListener('load', () => {
        if (onProgress) onProgress(60, 'Modelos neurais carregados...');
      });

      human.events?.addEventListener('warmup', () => {
        if (onProgress) onProgress(90, 'Aquecendo pipeline de inferência...');
      });

      if (onProgress) onProgress(40, 'Carregando modelos faciais...');
      await human.load();

      if (onProgress) onProgress(75, 'Otimizando tensores de reconhecimento...');
      await human.warmup();

      if (onProgress) onProgress(100, 'Motor IA pronto!');
      humanInstance = human;
      return human;
    } catch (err) {
      initPromise = null;
      console.error('Falha ao inicializar o motor de reconhecimento facial:', err);
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Executa detecção e extração de embedding em um elemento (video, canvas ou imagem)
 */
export async function detectFaces(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<DetectionResult> {
  const human = await getHuman();
  const rawResult = await human.detect(input);

  const faces = rawResult.face || [];
  const primaryFace = faces.length > 0 ? faces[0] : null;
  const embedding = primaryFace?.embedding ? Array.from(primaryFace.embedding) : null;

  return {
    faces,
    faceCount: faces.length,
    primaryFace,
    embedding,
    rawResult,
    timestamp: performance.now(),
  };
}

/**
 * Desenha overlay sofisticado com bounding box, pontos chave e rótulos
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  result: DetectionResult | null,
  options: {
    mirrored?: boolean;
    boxColor?: string;
    label?: string;
    showMesh?: boolean;
    statusText?: string;
  } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!result || !result.primaryFace) return;

  const {
    mirrored = false,
    boxColor = '#10b981', // emerald-500
    label = 'Rosto Detectado',
    showMesh = false,
    statusText,
  } = options;

  const face = result.primaryFace;
  const [bx, by, bw, bh] = face.box;

  ctx.save();

  // Ajuste se o vídeo estiver espelhado no preview
  let drawX = bx;
  if (mirrored) {
    drawX = canvas.width - (bx + bw);
  }

  // Bounding box arredondado com efeito de foco cibernético/moderno
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = boxColor;
  ctx.fillStyle = boxColor;

  // Cantoneiras modernas (Corner brackets)
  const cornerLen = Math.min(24, bw * 0.2, bh * 0.2);
  const pad = 4;
  const x = drawX - pad;
  const y = by - pad;
  const w = bw + pad * 2;
  const h = bh + pad * 2;

  ctx.shadowColor = boxColor;
  ctx.shadowBlur = 10;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  // Mesh simplificado se solicitado
  if (showMesh && face.mesh && face.mesh.length > 0) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'; // cyan-400
    for (let i = 0; i < face.mesh.length; i += 4) {
      const pt = face.mesh[i];
      const px = mirrored ? canvas.width - pt[0] : pt[0];
      const py = pt[1];
      ctx.beginPath();
      ctx.arc(px, py, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Label tag
  ctx.shadowBlur = 6;
  const confidence = Math.round((face.score || 0) * 100);
  const tagText = `${label} (${confidence}%)`;
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  const textMetrics = ctx.measureText(tagText);
  const tagHeight = 22;
  const tagWidth = textMetrics.width + 16;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // slate-900 / dark glass
  ctx.beginPath();
  ctx.roundRect(x, Math.max(4, y - tagHeight - 6), tagWidth, tagHeight, 6);
  ctx.fill();
  ctx.strokeStyle = boxColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillText(tagText, x + 8, Math.max(4, y - tagHeight - 6) + 15);

  if (statusText) {
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(statusText, x, y + h + 18);
  }

  ctx.restore();
}
