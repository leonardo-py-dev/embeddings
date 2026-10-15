/**
 * Sessão de webcam remota (celular -> PC) via WebRTC PeerJS.
 * O processamento de IA continua 100% no PC; o celular envia só vídeo.
 */

export function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function peerIds(sessionId: string) {
  const clean = sessionId.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || 'sessao';
  return {
    pc: `pc-${clean}`,
    phone: `phone-${clean}`,
  };
}

export function makeRemoteUrl(sessionId: string, originOverride?: string): string {
  const origin =
    originOverride ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}/remote/${encodeURIComponent(sessionId)}`;
}

/**
 * Considera "local" quando roda em dev ou em hostname de LAN/localhost.
 * Usado para decidir: salvar JSON em disco (./exports) vs preview + download.
 */
export function isLocalEnv(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV !== 'production';
  }
  const host = window.location.hostname;
  const isLocalHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.local');
  return isLocalHost || process.env.NODE_ENV === 'development';
}

export function isSecureForCamera(): boolean {
  if (typeof window === 'undefined') return true;
  return window.isSecureContext;
}

/**
 * `localhost`/`127.0.0.1` no QR nunca funciona no celular
 * (o aparelho resolve para ele mesmo). Precisa ser o IP de LAN do PC.
 */
export function isLocalhostOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return /localhost|127\.0\.0\.1/.test(origin);
  }
}
