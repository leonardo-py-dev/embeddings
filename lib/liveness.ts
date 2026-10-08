/**
 * Mecanismo de Prova de Vida (Liveness) básico.
 * Atende ao requisito RF08 do PRD:
 * 1. Exige N frames consecutivos válidos de correspondência facial dentro de uma janela de tempo.
 * 2. Suporte a desafios interativos opcionais (ex: piscar de olhos ou leve rotação da cabeça).
 */

export type LivenessChallengeType = 'CONSECUTIVE_FRAMES' | 'BLINK' | 'TURN_HEAD';

export interface LivenessStatus {
  challengeType: LivenessChallengeType;
  prompt: string;
  isCompleted: boolean;
  progress: number; // 0.0 a 1.0
  consecutiveMatches: number;
  requiredMatches: number;
}

export class LivenessDetector {
  private challengeType: LivenessChallengeType;
  private consecutiveMatches: number = 0;
  private requiredMatches: number = 3;
  private isCompleted: boolean = false;
  private blinkDetected: boolean = false;
  private headTurnDetected: boolean = false;
  private initialYaw: number | null = null;
  private lastMatchTime: number = 0;

  constructor(challengeType: LivenessChallengeType = 'CONSECUTIVE_FRAMES', requiredMatches: number = 3) {
    this.challengeType = challengeType;
    this.requiredMatches = requiredMatches;
  }

  public setChallenge(type: LivenessChallengeType): void {
    this.challengeType = type;
    this.reset();
  }

  public reset(): void {
    this.consecutiveMatches = 0;
    this.isCompleted = false;
    this.blinkDetected = false;
    this.headTurnDetected = false;
    this.initialYaw = null;
    this.lastMatchTime = 0;
  }

  /**
   * Atualiza o estado com dados do frame atual
   * @param isMatchSeemly Se o embedding bate com o perfil alvo
   * @param faceData Dados opcionais de rotação (yaw, pitch, roll) ou gestos da lib Human
   * @param now Timestamp atual
   */
  public update(
    isMatchSeemly: boolean,
    faceData?: {
      rotation?: { yaw: number; pitch: number; roll: number };
      gestos?: string[];
      eyeDistanceRatio?: number;
    },
    now: number = performance.now()
  ): LivenessStatus {
    if (this.isCompleted) {
      return this.getStatus();
    }

    // Se passou mais de 1200ms desde o último match, reinicia contagem de frames consecutivos
    if (this.lastMatchTime > 0 && now - this.lastMatchTime > 1200) {
      this.consecutiveMatches = 0;
    }

    if (isMatchSeemly) {
      this.consecutiveMatches++;
      this.lastMatchTime = now;
    } else {
      this.consecutiveMatches = Math.max(0, this.consecutiveMatches - 1);
    }

    if (this.challengeType === 'CONSECUTIVE_FRAMES') {
      if (this.consecutiveMatches >= this.requiredMatches) {
        this.isCompleted = true;
      }
    } else if (this.challengeType === 'TURN_HEAD') {
      const yaw = faceData?.rotation?.yaw ?? 0;
      if (this.initialYaw === null && Math.abs(yaw) < 0.15) {
        this.initialYaw = yaw;
      } else if (this.initialYaw !== null) {
        const diff = Math.abs(yaw - this.initialYaw);
        if (diff > 0.25) {
          this.headTurnDetected = true;
        }
      }

      if (this.headTurnDetected && this.consecutiveMatches >= 2) {
        this.isCompleted = true;
      }
    } else if (this.challengeType === 'BLINK') {
      const gestos = faceData?.gestos || [];
      const hasBlinkGesture = gestos.some((g) => g.toLowerCase().includes('blink') || g.toLowerCase().includes('eye'));

      if (hasBlinkGesture) {
        this.blinkDetected = true;
      }

      if (this.blinkDetected && this.consecutiveMatches >= 2) {
        this.isCompleted = true;
      }
    }

    return this.getStatus();
  }

  public getStatus(): LivenessStatus {
    let prompt = '';
    let progress = 0;

    switch (this.challengeType) {
      case 'CONSECUTIVE_FRAMES':
        prompt = this.isCompleted
          ? 'Identidade confirmada e estável!'
          : `Mantenha o olhar fixo (${this.consecutiveMatches}/${this.requiredMatches} frames)...`;
        progress = Math.min(1, this.consecutiveMatches / this.requiredMatches);
        break;

      case 'TURN_HEAD':
        if (this.isCompleted) {
          prompt = 'Movimento natural confirmado!';
          progress = 1;
        } else if (!this.headTurnDetected) {
          prompt = 'Vire a cabeça suavemente para um dos lados';
          progress = 0.5;
        } else {
          prompt = 'Excelente! Olhe para a câmera novamente...';
          progress = 0.85;
        }
        break;

      case 'BLINK':
        if (this.isCompleted) {
          prompt = 'Piscada detectada e identidade confirmada!';
          progress = 1;
        } else if (!this.blinkDetected) {
          prompt = 'Pisque os olhos uma vez para autenticar';
          progress = 0.5;
        } else {
          prompt = 'Piscada registrada! Finalizando...';
          progress = 0.9;
        }
        break;
    }

    return {
      challengeType: this.challengeType,
      prompt,
      isCompleted: this.isCompleted,
      progress,
      consecutiveMatches: this.consecutiveMatches,
      requiredMatches: this.requiredMatches,
    };
  }
}
