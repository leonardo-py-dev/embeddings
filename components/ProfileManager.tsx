'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Trash2,
  Download,
  Upload,
  UserCheck,
  AlertTriangle,
  FileJson,
  Check,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';
import {
  getAllProfiles,
  deleteProfile,
  clearAllProfiles,
  exportProfilesJSON,
  importProfilesJSON,
  type FaceProfile,
} from '@/lib/storage';

interface ProfileManagerProps {
  onSelectProfile?: (profile: FaceProfile) => void;
  selectedUserId?: string | null;
  compact?: boolean;
}

export default function ProfileManager({
  onSelectProfile,
  selectedUserId,
  compact = false,
}: ProfileManagerProps) {
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadProfiles = () => {
    const list = getAllProfiles();
    setProfiles(list);
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleDelete = (userId: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o perfil biométrico de "${name}"?`)) {
      deleteProfile(userId);
      loadProfiles();
      setFeedback({ message: `Perfil "${name}" removido com sucesso.`, type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleClearAll = () => {
    if (
      window.confirm(
        'ATENÇÃO: Isso apagará TODOS os perfis biométricos e embeddings salvos localmente. Deseja prosseguir?'
      )
    ) {
      clearAllProfiles();
      loadProfiles();
      setFeedback({ message: 'Todos os perfis foram removidos do armazenamento local.', type: 'success' });
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  const handleExport = () => {
    if (profiles.length === 0) {
      alert('Nenhum perfil cadastrado para exportar.');
      return;
    }
    const jsonStr = exportProfilesJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `face-profiles-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const res = importProfilesJSON(text);
      if (res.success) {
        loadProfiles();
        setFeedback({ message: res.message, type: 'success' });
      } else {
        setFeedback({ message: res.message, type: 'error' });
      }
      setTimeout(() => setFeedback(null), 5000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  if (compact) {
    return (
      <div className="w-full space-y-3">
        <label className="block text-xs font-semibold text-slate-300">
          Selecione o Usuário para Verificação 1:1:
        </label>
        {profiles.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400 mb-2">Nenhum rosto cadastrado no sistema.</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Cadastrar Agora
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto">
            {profiles.map((p) => {
              const isSelected = selectedUserId === p.userId;
              return (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => onSelectProfile && onSelectProfile(p)}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {p.nome.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate text-white">{p.nome}</p>
                      <p className="text-[10px] text-slate-400 font-mono">@{p.userId}</p>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 p-5 sm:p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Gerenciador de Perfis (LocalStorage)</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {profiles.length} perfil(is) armazenados localmente na chave <code className="text-cyan-300">face-login-db-v1</code>.
          </p>
        </div>

        {/* Botões de Exportar / Importar */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,application/json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            title="Importar perfis via arquivo JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar JSON</span>
          </button>

          <button
            onClick={handleExport}
            disabled={profiles.length === 0}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/70 border border-cyan-800/60 text-xs font-medium text-cyan-300 flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
            title="Exportar base local como backup JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Backup</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Lista de Perfis */}
      {profiles.length === 0 ? (
        <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-300">Nenhum perfil cadastrado</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Cadastre seu rosto gravando 3 a 5 amostras biométricas para gerar seu primeiro embedding.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            Cadastrar Primeiro Rosto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {profiles.map((p) => (
            <div
              key={p.userId}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-emerald-500 flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {p.nome.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{p.nome}</h4>
                    <p className="text-xs text-cyan-400 font-mono">@{p.userId}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(p.userId, p.nome)}
                  className="p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                  title="Excluir perfil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                <div className="flex justify-between">
                  <span>Amostras biométricas:</span>
                  <span className="font-semibold text-slate-200">{p.samples?.length || 0} capturas</span>
                </div>
                <div className="flex justify-between">
                  <span>Threshold individual:</span>
                  <span className="font-mono text-cyan-300">{p.threshold?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dimensões do vetor:</span>
                  <span className="font-mono text-slate-200">{p.embeddingDim} floats</span>
                </div>
                <div className="flex justify-between">
                  <span>Criado em:</span>
                  <span className="text-slate-500">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rodapé com Ação Destrutiva */}
      {profiles.length > 0 && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleClearAll}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar todos os dados locais
          </button>
        </div>
      )}
    </div>
  );
}
