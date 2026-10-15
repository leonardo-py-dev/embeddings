'use client';

import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Copy, Check, RefreshCw, X, Wifi, AlertTriangle, MonitorSmartphone } from 'lucide-react';
import { makeSessionId, makeRemoteUrl, isSecureForCamera, isLocalhostOrigin } from '@/lib/remoteSession';
import { useRemoteCamera } from '@/hooks/useRemoteCamera';

interface RemoteWebcamDialogProps {
  onStreamChange: (stream: MediaStream | null) => void;
}

export default function RemoteWebcamDialog({ onStreamChange }: RemoteWebcamDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [originOverride, setOriginOverride] = useState<string>(
    () => (typeof window !== 'undefined' ? window.location.origin : '')
  );
  const [copied, setCopied] = useState(false);
  const [lanAdapters, setLanAdapters] = useState<{ name: string; address: string; physical: boolean }[]>([]);
  const [lanPort, setLanPort] = useState<string>('3000');
  const previewRef = useRef<HTMLVideoElement | null>(null);

  const { status, remoteStream, error, startWaiting, stopWaiting } = useRemoteCamera();

  // Descobre os IPs de LAN do PC para montar um QR que o celular alcance.
  // Sem isso o QR sai com localhost e o celular recusa a conexão.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/network-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        // Formato novo: [{ name, address, physical }]; legado: [strings]
        if (Array.isArray(data.adapters)) {
          setLanAdapters(data.adapters);
        } else if (Array.isArray(data.ips)) {
          setLanAdapters(data.ips.map((address: string) => ({ name: 'rede', address, physical: true })));
        }
        if (typeof data.port === 'string') setLanPort(data.port);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const usingLocalhost = isLocalhostOrigin(originOverride || (typeof window !== 'undefined' ? window.location.origin : ''));

  // URL base: permite editar o IP da LAN (ex: http://192.168.0.10:3000)
  const remoteUrl = sessionId ? makeRemoteUrl(sessionId, originOverride || undefined) : '';

  // Propaga o stream para o componente pai (Enrollment / Login)
  useEffect(() => {
    onStreamChange(remoteStream);
  }, [remoteStream, onStreamChange]);

  // Preview local do stream remoto dentro do diálogo
  useEffect(() => {
    if (previewRef.current && remoteStream) {
      previewRef.current.srcObject = remoteStream;
      previewRef.current.play().catch(() => {});
    }
  }, [remoteStream, isOpen]);

  const handleOpen = () => {
    const id = makeSessionId();
    setSessionId(id);
    setIsOpen(true);
    startWaiting(id);
  };

  const handleRegenerate = () => {
    const id = makeSessionId();
    setSessionId(id);
    startWaiting(id);
  };

  const handleClose = () => {
    stopWaiting();
    setIsOpen(false);
    onStreamChange(null);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(remoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: seleciona o texto
      setCopied(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-800/40 text-cyan-300 text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
      >
        <Smartphone className="w-4 h-4" />
        <span>Usar celular como webcam (QR)</span>
      </button>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900/80 border border-cyan-800/40 backdrop-blur-md space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Celular como webcam</h3>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          title="Fechar e voltar para webcam do PC"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isSecureForCamera() && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Contexto inseguro detectado. A câmera do celular exige HTTPS (ou localhost).
            Em dev na LAN, use <code className="font-mono">next dev --experimental-https</code> ou um túnel HTTPS.
          </p>
        </div>
      )}

      {usingLocalhost && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 space-y-2 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <MonitorSmartphone className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              <b>Este QR usa localhost</b> — o celular vai recusar a conexão, pois localhost
              aponta para o próprio aparelho. Troque para o IP do PC na mesma Wi-Fi:
            </p>
          </div>
          {lanAdapters.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {lanAdapters.map((adapter) => (
                <button
                  key={`${adapter.name}-${adapter.address}`}
                  type="button"
                  onClick={() => setOriginOverride(`http://${adapter.address}:${lanPort}`)}
                  title={adapter.physical ? `Adaptador ${adapter.name}` : `Adaptador virtual/VPN ${adapter.name} — prefira Wi-Fi`}
                  className={`px-2.5 py-1.5 rounded-lg border font-mono text-[11px] transition cursor-pointer ${
                    adapter.physical
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40'
                      : 'bg-slate-800/60 hover:bg-slate-700/60 border-slate-700/60 opacity-70'
                  }`}
                >
                  Usar {adapter.address} ({adapter.name})
                </button>
              ))}
            </div>
          ) : (
            <p className="text-amber-300/90">
              Descubra o IP do PC com <code className="font-mono">ipconfig</code> (IPv4, ex:
              192.168.0.10) e digite abaixo como <code className="font-mono">http://SEU-IP:3000</code>.
            </p>
          )}
          <p className="text-amber-300/80 text-[11px]">
            PC e celular precisam estar na mesma Wi-Fi, e o dev server precisa aceitar a rede
            (rode com <code className="font-mono">npm run dev</code>). Se der{' '}
            <code className="font-mono">ERR_TIMED_OUT</code> no celular, é quase sempre o{' '}
            <b>Firewall do Windows</b> bloqueando a porta: Firewall do Windows Defender →
            Permitir um aplicativo → libere o <b>Node.js</b> (redes privadas).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* QR Code */}
        <div className="flex flex-col items-center gap-2">
          <div className="p-3 rounded-2xl bg-white border border-slate-700">
            {remoteUrl ? (
              <QRCodeSVG value={remoteUrl} size={160} />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-500">
                Gerando...
              </div>
            )}
          </div>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
              status === 'connected'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : status === 'error'
                ? 'bg-rose-950/60 border-rose-500/40 text-rose-400'
                : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Wifi className="w-3 h-3" />
            {status === 'waiting' && 'Aguardando leitura do QR...'}
            {status === 'connected' && 'Celular conectado!'}
            {status === 'error' && 'Erro de conexão'}
            {status === 'idle' && 'Inativo'}
          </div>
        </div>

        {/* Instruções + link */}
        <div className="space-y-3 text-xs">
          <ol className="text-slate-300 space-y-1.5 list-decimal list-inside">
            <li>Escaneie o QR com a câmera do celular.</li>
            <li>Na página aberta, toque em <b>Permitir</b> câmera.</li>
            <li>O vídeo aparece aqui e os <b>resultados saem no PC</b>.</li>
          </ol>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              URL (edite p/ IP da LAN se preciso):
            </label>
            <input
              type="text"
              value={originOverride}
              onChange={(e) => setOriginOverride(e.target.value)}
              placeholder="http://192.168.0.10:3000"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
            />
            <p className="font-mono text-[10px] text-slate-500 mt-1 break-all">{remoteUrl}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Gerar novo QR"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Novo QR
            </button>
          </div>

          {error && <p className="text-rose-400 text-[11px]">{error}</p>}
        </div>
      </div>

      {/* Preview do stream remoto */}
      {remoteStream && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
            Preview do celular (processamento no PC):
          </p>
          <video
            ref={previewRef}
            playsInline
            muted
            autoPlay
            className="w-full aspect-video rounded-xl bg-slate-950 border border-emerald-500/30 object-cover"
          />
        </div>
      )}
    </div>
  );
}
