'use client';

import React, { useState } from 'react';
import { FileJson, Download, Save, Copy, Check, Eye, Loader2 } from 'lucide-react';
import { exportProfilesJSON } from '@/lib/storage';
import { isLocalEnv } from '@/lib/remoteSession';

interface EmbeddingsExportPanelProps {
  /** Se fornecido, exporta esse objeto; senão exporta a base completa do LocalStorage. */
  payload?: object | null;
  filename?: string;
  title?: string;
}

export default function EmbeddingsExportPanel({
  payload,
  filename = 'embeddings',
  title = 'Exportar embeddings (JSON)',
}: EmbeddingsExportPanelProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const isLocal = isLocalEnv();

  const buildJson = (): string => {
    if (payload) return JSON.stringify(payload, null, 2);
    return exportProfilesJSON();
  };

  const handlePreview = () => {
    const json = buildJson();
    setPreview(json);
    setShowPreview((v) => !v || preview === null);
    if (preview === null) setShowPreview(true);
  };

  const handleDownload = () => {
    const json = preview ?? buildJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Arquivo JSON baixado.');
  };

  const handleCopy = async () => {
    const json = preview ?? buildJson();
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setStatus('Não foi possível copiar.');
    }
  };

  const handleSaveLocal = async () => {
    setIsSaving(true);
    setStatus(null);
    try {
      const raw = buildJson();
      const data = JSON.parse(raw);
      const res = await fetch('/api/embeddings/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || 'Falha ao salvar no servidor local.');
      }
      setPreview(raw);
      setShowPreview(true);
      setStatus(`Salvo localmente em ${result.path}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setStatus(
        `Não foi possível salvar em disco (${message}). Use o download — ambiente de produção não permite escrita.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3">
      <div className="flex items-center gap-2">
        <FileJson className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <p className="text-xs text-slate-400">
        {isLocal
          ? 'Rodando localmente: você pode salvar o JSON em arquivo na pasta ./exports do projeto.'
          : 'Ambiente de produção (sem escrita em disco): pré-visualize o JSON e baixe o arquivo.'}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePreview}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" />
          {showPreview ? 'Ocultar preview' : 'Ver preview JSON'}
        </button>

        {isLocal && (
          <button
            type="button"
            onClick={handleSaveLocal}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Salvando...' : 'Salvar em ./exports'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDownload}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar .json
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>

      {status && <p className="text-[11px] text-slate-300">{status}</p>}

      {showPreview && preview && (
        <pre className="max-h-64 overflow-auto p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] leading-relaxed font-mono text-cyan-200 whitespace-pre-wrap break-all">
          {preview}
        </pre>
      )}
    </div>
  );
}
