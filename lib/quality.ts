/**
 * Verificação de qualidade da imagem, iluminação, nitidez (blur) e estabilidade.
 * Atende ao requisito RF07 do PRD.
 */

export interface QualityAssessment {
  isValid: boolean;
  message: string;
  code:
    | 'OK'
    | 'NO_FACE'
    | 'MULTIPLE_FACES'
    | 'TOO_DARK'
    | 'TOO_BRIGHT'
    | 'TOO_FAR'
    | 'TOO_CLOSE'
    | 'NOT_CENTERED'
    | 'BLURRY'
    | 'UNSTABLE';
  brightness: number; // 0 a 255
  sharpness: number;  // Laplaciano / gradiente
  faceSizeRatio: number; // 0.0 a 1.0
  isStable: boolean;
}

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Avalia brilho médio e nitidez (variação de gradiente) de uma região em canvas.
 */
export function analyzeImageMetrics(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  box: FaceBox
): { brightness: number; sharpness: number } {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (!ctx) return { brightness: 128, sharpness: 50 };

    const sx = Math.max(0, Math.floor(box.x));
    const sy = Math.max(0, Math.floor(box.y));
    const sw = Math.min(canvas.width - sx, Math.floor(box.width));
    const sh = Math.min(canvas.height - sy, Math.floor(box.height));

    if (sw <= 10 || sh <= 10) return { brightness: 128, sharpness: 50 };

    const imgData = ctx.getImageData(sx, sy, sw, sh);
    const data = imgData.data;
    const len = data.length;

    let totalLuma = 0;
    const pixelCount = len / 4;
    const gray: number[] = new Array(pixelCount);

    for (let i = 0, g = 0; i < len; i += 4, g++) {
      // Perceived luminance (ITU-R BT.601)
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[g] = luma;
      totalLuma += luma;
    }

    const brightness = totalLuma / pixelCount;

    // Aproximação rápida de nitidez via variância de gradientes (Sobel horizontal/vertical simplificado)
    let sumGrad = 0;
    let sumGradSq = 0;
    let gradCount = 0;

    // Amostragem com salto de 2 para velocidade em tempo real
    const step = 2;
    for (let y = 1; y < sh - 1; y += step) {
      const row = y * sw;
      const prevRow = (y - 1) * sw;
      const nextRow = (y + 1) * sw;

      for (let x = 1; x < sw - 1; x += step) {
        const dx = gray[row + x + 1] - gray[row + x - 1];
        const dy = gray[nextRow + x] - gray[prevRow + x];
        const mag = Math.abs(dx) + Math.abs(dy);

        sumGrad += mag;
        sumGradSq += mag * mag;
        gradCount++;
      }
    }

    let sharpness = 30;
    if (gradCount > 0) {
      const meanGrad = sumGrad / gradCount;
      const variance = sumGradSq / gradCount - meanGrad * meanGrad;
      sharpness = Math.sqrt(Math.max(0, variance));
    }

    return {
      brightness: Math.round(brightness),
      sharpness: Math.round(sharpness),
    };
  } catch {
    return { brightness: 128, sharpness: 40 };
  }
}

/**
 * Avalia o enquadramento e estabilidade da detecção.
 */
export function checkFaceQuality(
  facesDetected: number,
  box: FaceBox | null,
  videoWidth: number,
  videoHeight: number,
  metrics: { brightness: number; sharpness: number },
  isPositionStable: boolean
): QualityAssessment {
  if (facesDetected === 0 || !box) {
    return {
      isValid: false,
      message: 'Nenhum rosto detectado no enquadramento.',
      code: 'NO_FACE',
      brightness: 0,
      sharpness: 0,
      faceSizeRatio: 0,
      isStable: false,
    };
  }

  if (facesDetected > 1) {
    return {
      isValid: false,
      message: 'Múltiplos rostos detectados! Deixe apenas uma pessoa no campo.',
      code: 'MULTIPLE_FACES',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio: box.width / Math.max(videoWidth, 1),
      isStable: false,
    };
  }

  const faceSizeRatio = box.width / Math.max(videoWidth, 1);

  // Distância / proporção
  if (faceSizeRatio < 0.18) {
    return {
      isValid: false,
      message: 'Aproxime-se mais da câmera para maior precisão.',
      code: 'TOO_FAR',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  if (faceSizeRatio > 0.75) {
    return {
      isValid: false,
      message: 'Afaste-se um pouco da câmera.',
      code: 'TOO_CLOSE',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  // Centralização
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const relX = centerX / Math.max(videoWidth, 1);
  const relY = centerY / Math.max(videoHeight, 1);

  if (relX < 0.25 || relX > 0.75 || relY < 0.2 || relY > 0.8) {
    return {
      isValid: false,
      message: 'Centralize seu rosto no círculo guia.',
      code: 'NOT_CENTERED',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  // Iluminação
  if (metrics.brightness < 45) {
    return {
      isValid: false,
      message: 'Ambiente muito escuro. Melhore a iluminação do local.',
      code: 'TOO_DARK',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  if (metrics.brightness > 225) {
    return {
      isValid: false,
      message: 'Iluminação excessiva ou luz de fundo forte (contraluz).',
      code: 'TOO_BRIGHT',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  // Nitidez / Blur
  if (metrics.sharpness < 8) {
    return {
      isValid: false,
      message: 'Imagem embaçada. Mantenha a câmera limpa e o rosto firme.',
      code: 'BLURRY',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  // Estabilidade do rosto
  if (!isPositionStable) {
    return {
      isValid: false,
      message: 'Mantenha a cabeça estável por um instante...',
      code: 'UNSTABLE',
      brightness: metrics.brightness,
      sharpness: metrics.sharpness,
      faceSizeRatio,
      isStable: false,
    };
  }

  return {
    isValid: true,
    message: 'Enquadramento e qualidade ideais!',
    code: 'OK',
    brightness: metrics.brightness,
    sharpness: metrics.sharpness,
    faceSizeRatio,
    isStable: true,
  };
}

/**
 * Rastreador de estabilidade temporal da posição da cabeça
 */
export class StabilityTracker {
  private lastBoxes: FaceBox[] = [];
  private lastTimestamp: number = 0;
  private stableStartTime: number = 0;
  private readonly requiredDurationMs: number;
  private readonly movementTolerancePx: number;

  constructor(requiredDurationMs: number = 400, movementTolerancePx: number = 18) {
    this.requiredDurationMs = requiredDurationMs;
    this.movementTolerancePx = movementTolerancePx;
  }

  public update(box: FaceBox | null, now: number = performance.now()): boolean {
    if (!box) {
      this.lastBoxes = [];
      this.stableStartTime = 0;
      return false;
    }

    if (this.lastBoxes.length > 0) {
      const prev = this.lastBoxes[this.lastBoxes.length - 1];
      const deltaX = Math.abs(box.x - prev.x);
      const deltaY = Math.abs(box.y - prev.y);
      const deltaW = Math.abs(box.width - prev.width);

      if (deltaX > this.movementTolerancePx || deltaY > this.movementTolerancePx || deltaW > 25) {
        // Movimentou muito, reseta cronômetro de estabilidade
        this.stableStartTime = now;
      } else if (this.stableStartTime === 0) {
        this.stableStartTime = now;
      }
    } else {
      this.stableStartTime = now;
    }

    this.lastBoxes.push(box);
    if (this.lastBoxes.length > 10) {
      this.lastBoxes.shift();
    }
    this.lastTimestamp = now;

    return this.stableStartTime > 0 && now - this.stableStartTime >= this.requiredDurationMs;
  }

  public reset(): void {
    this.lastBoxes = [];
    this.stableStartTime = 0;
  }
}
