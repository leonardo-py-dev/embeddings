import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

function sanitizeFilename(name: unknown): string {
  const base = typeof name === 'string' && name.trim().length > 0 ? name : 'embeddings';
  const clean = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return clean || 'embeddings';
}

/**
 * Salva o JSON de embeddings em ./exports (uso local).
 * Em produção serverless (ex: Vercel) a escrita falha -> o client usa download.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const filename = sanitizeFilename(body?.filename);
    const data = body?.data;

    if (data === undefined) {
      return NextResponse.json({ error: 'Campo "data" é obrigatório.' }, { status: 400 });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${filename}-${stamp}.json`;
    const dir = path.join(process.cwd(), 'exports');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fileName), JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ ok: true, path: `exports/${fileName}` });
  } catch (err: any) {
    // Filesystem somente-leitura (Vercel/prod) cai aqui
    return NextResponse.json(
      {
        error:
          'Não foi possível escrever em disco neste ambiente. Use a pré-visualização + download no navegador.',
        detail: err?.message,
      },
      { status: 500 }
    );
  }
}
