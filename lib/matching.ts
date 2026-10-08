/**
 * Regras matemáticas e vetoriais para comparação de embeddings faciais.
 * Em conformidade com a Seção 7 do PRD.
 */

/**
 * Normaliza um vetor usando norma L2 (magnitude Euclidiana = 1).
 */
export function l2Normalize(vector: number[]): number[] {
  if (!vector || vector.length === 0) return [];
  const sumSquares = vector.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSquares);
  if (norm === 0 || !Number.isFinite(norm)) {
    return new Array(vector.length).fill(0);
  }
  return vector.map((val) => val / norm);
}

/**
 * Produto escalar (dot product) entre dois vetores de mesma dimensão.
 */
export function dotProduct(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    throw new Error(`Dimensões incompatíveis no produto escalar: ${a?.length} vs ${b?.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Similaridade Cosseno entre dois vetores: cos(theta) = (A . B) / (||A|| * ||B||).
 * Se já normalizados L2, simplifica para o produto escalar A . B.
 * Retorna valor entre -1.0 e 1.0 (geralmente entre 0.0 e 1.0 para embeddings faciais).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  const normA = l2Normalize(a);
  const normB = l2Normalize(b);
  const dot = dotProduct(normA, normB);
  // Clampa para evitar imprecisões de ponto flutuante
  return Math.max(-1, Math.min(1, dot));
}

/**
 * Distância Cosseno: 1 - cosineSimilarity.
 * 0.0 = idênticos
 * 1.0 = ortogonais (totalmente diferentes)
 * 2.0 = opostos
 */
export function cosineDistance(a: number[], b: number[]): number {
  const sim = cosineSimilarity(a, b);
  return 1 - sim;
}

/**
 * Distância Euclidiana L2: sqrt(sum((a_i - b_i)^2))
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) {
    throw new Error(`Dimensões incompatíveis para distância euclidiana: ${a?.length} vs ${b?.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Calcula o embedding médio renormalizado a partir de 3 a 5 amostras.
 * mean = normalize(mean(samples))
 */
export function computeMeanEmbedding(samples: number[][]): number[] {
  if (!samples || samples.length === 0) {
    throw new Error('Nenhuma amostra fornecida para cálculo da média.');
  }
  const dim = samples[0].length;
  const sumVector = new Array(dim).fill(0);

  for (const sample of samples) {
    if (sample.length !== dim) {
      throw new Error(`Amostra com dimensão divergente: esperava ${dim}, obteve ${sample.length}`);
    }
    const normalized = l2Normalize(sample);
    for (let i = 0; i < dim; i++) {
      sumVector[i] += normalized[i];
    }
  }

  const avgVector = sumVector.map((val) => val / samples.length);
  return l2Normalize(avgVector);
}

/**
 * Converte a distância e threshold em uma porcentagem amigável de correspondência (0 a 100%).
 */
export function calculateMatchScore(distance: number, threshold: number): {
  isMatch: boolean;
  similarityScore: number; // 0 a 100%
  distance: number;
  threshold: number;
} {
  const isMatch = distance <= threshold;
  // Mapeamento não-linear intuitivo: se distance == 0 -> 100%, se distance == threshold -> 75%, se distance >= 1.0 -> 0%
  let scorePercent: number;
  if (distance <= threshold) {
    // 75% a 100%
    scorePercent = 75 + ((threshold - distance) / Math.max(threshold, 0.001)) * 25;
  } else {
    // 0% a 74%
    const remaining = Math.max(0, 1.0 - threshold);
    const over = distance - threshold;
    scorePercent = Math.max(0, 75 - (over / Math.max(remaining, 0.001)) * 75);
  }

  return {
    isMatch,
    similarityScore: Math.round(Math.min(100, Math.max(0, scorePercent))),
    distance: Number(distance.toFixed(4)),
    threshold: Number(threshold.toFixed(4)),
  };
}
