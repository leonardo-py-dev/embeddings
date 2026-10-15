/**
 * Gerenciamento de persistência local (LocalStorage) e validação de esquemas.
 * Em conformidade com a Seção 6 do PRD (chave `face-login-db-v1`).
 */

export interface FaceProfile {
  userId: string;          // slug único ex: "ana-silva"
  nome: string;            // nome legível
  createdAt: string;       // ISO date
  embeddingDim: number;    // ex: 512
  samples: number[][];     // 3 a 5 amostras normalizadas
  meanEmbedding: number[]; // média L2 renormalizada
  threshold: number;       // default 0.35 (distância cosseno)
  thumbnail?: string;      // dataURL opcional se consentido
}

export interface FaceDB {
  version: 1;
  profiles: FaceProfile[];
}

export interface AttemptLog {
  id: string;
  at: string;
  userId: string;
  nome: string;
  distance: number;
  threshold: number;
  similarityScore: number;
  success: boolean;
  livenessPassed: boolean;
  reason?: string;
}

const STORAGE_KEY = 'face-login-db-v1';

/**
 * Cria ou recupera o banco de dados do LocalStorage
 */
export function getStoredDB(): FaceDB {
  if (typeof window === 'undefined') {
    return { version: 1, profiles: [] };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial: FaceDB = { version: 1, profiles: [] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && Array.isArray(parsed.profiles)) {
      return parsed as FaceDB;
    }
  } catch (err) {
    console.error('Falha ao ler dados de perfis do LocalStorage:', err);
  }

  return { version: 1, profiles: [] };
}

/**
 * Salva a base completa no LocalStorage
 */
export function saveDB(db: FaceDB): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Falha ao salvar perfis no LocalStorage:', err);
    throw new Error('Falha ao salvar no armazenamento local. O limite de espaço pode ter sido atingido.');
  }
}

/**
 * Lista todos os perfis cadastrados
 */
export function getAllProfiles(): FaceProfile[] {
  return getStoredDB().profiles;
}

/**
 * Busca perfil por userId
 */
export function getProfileById(userId: string): FaceProfile | null {
  const db = getStoredDB();
  return db.profiles.find((p) => p.userId === userId) || null;
}

/**
 * Salva ou atualiza um perfil
 */
export function upsertProfile(profile: FaceProfile): void {
  const db = getStoredDB();
  const existingIndex = db.profiles.findIndex((p) => p.userId === profile.userId);
  if (existingIndex >= 0) {
    db.profiles[existingIndex] = profile;
  } else {
    db.profiles.push(profile);
  }
  saveDB(db);
}

/**
 * Remove um perfil pelo userId
 */
export function deleteProfile(userId: string): boolean {
  const db = getStoredDB();
  const initialLength = db.profiles.length;
  db.profiles = db.profiles.filter((p) => p.userId !== userId);
  if (db.profiles.length !== initialLength) {
    saveDB(db);
    return true;
  }
  return false;
}

/**
 * Limpa todos os perfis do LocalStorage
 */
export function clearAllProfiles(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Validação de integridade do perfil
 */
export function validateProfile(p: any): p is FaceProfile {
  if (!p || typeof p !== 'object') return false;
  if (typeof p.userId !== 'string' || p.userId.trim().length === 0) return false;
  if (typeof p.nome !== 'string' || p.nome.trim().length === 0) return false;
  if (typeof p.embeddingDim !== 'number' || p.embeddingDim <= 0) return false;
  if (!Array.isArray(p.samples) || p.samples.length < 1) return false;
  if (!Array.isArray(p.meanEmbedding) || p.meanEmbedding.length !== p.embeddingDim) return false;

  // Verifica que todos os valores de meanEmbedding são números finitos
  for (const val of p.meanEmbedding) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return false;
  }

  // Verifica amostras
  for (const sample of p.samples) {
    if (!Array.isArray(sample) || sample.length !== p.embeddingDim) return false;
  }

  return true;
}

/**
 * Exporta os dados para arquivo JSON
 */
export function exportProfilesJSON(): string {
  const db = getStoredDB();
  return JSON.stringify(db, null, 2);
}

/**
 * Importa dados de arquivo JSON com validação de esquema
 */
export function importProfilesJSON(rawJson: string): {
  success: boolean;
  message: string;
  importedCount?: number;
} {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
      return {
        success: false,
        message: 'Arquivo inválido. É esperado formato JSON com versão 1 e lista de perfis.',
      };
    }

    const validProfiles: FaceProfile[] = [];
    for (const item of parsed.profiles) {
      if (validateProfile(item)) {
        validProfiles.push(item);
      } else {
        return {
          success: false,
          message: `Perfil "${item?.nome || item?.userId || 'Desconhecido'}" contém dados ou dimensões inválidas.`,
        };
      }
    }

    const currentDB = getStoredDB();
    // Mescla ou substitui por userId
    const map = new Map<string, FaceProfile>();
    currentDB.profiles.forEach((p) => map.set(p.userId, p));
    validProfiles.forEach((p) => map.set(p.userId, p));

    const mergedDB: FaceDB = {
      version: 1,
      profiles: Array.from(map.values()),
    };

    saveDB(mergedDB);
    return {
      success: true,
      message: `${validProfiles.length} perfil(is) importado(s) com sucesso!`,
      importedCount: validProfiles.length,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erro ao processar JSON: ${err.message || 'JSON inválido'}`,
    };
  }
}

/**
 * Converte nome para slug de userId único
 */
export function generateUserId(name: string): string {
  const clean = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean || `user-${Date.now().toString(36)}`;
}
