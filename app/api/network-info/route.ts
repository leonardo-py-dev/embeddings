import { NextResponse } from 'next/server';
import os from 'os';

export interface LanAdapter {
  name: string;
  address: string;
  /** true para adaptadores físicos (Wi-Fi/Ethernet); false para virtuais (VPN, VM, Docker). */
  physical: boolean;
}

const VIRTUAL_PATTERNS = /virtual|vethernet|vbox|vmware|vpn|tailscale|hamachi|docker|wsl|loopback|teredo|isatap|host-only/i;
const PHYSICAL_PATTERNS = /wi-?fi|wlan|ethernet|lan/i;
/** Sub-redes sabidamente virtuais (host-only do VirtualBox) — o celular nunca alcança. */
const VIRTUAL_SUBNETS = [/^192\.168\.56\./];

/**
 * Retorna os IPs de LAN (IPv4) do servidor para que o diálogo de
 * webcam remota possa montar um QR alcançável pelo celular.
 * `localhost` no QR nunca funciona no celular (aponta para o próprio aparelho).
 */
export async function GET(req: Request) {
  const nets = os.networkInterfaces();
  const adapters: LanAdapter[] = [];

  for (const [name, list] of Object.entries(nets)) {
    for (const info of list || []) {
      if (info.family === 'IPv4' && !info.internal) {
        const looksVirtual =
          VIRTUAL_PATTERNS.test(name) || VIRTUAL_SUBNETS.some((re) => re.test(info.address));
        adapters.push({
          name,
          address: info.address,
          physical: PHYSICAL_PATTERNS.test(name) && !looksVirtual,
        });
      }
    }
  }

  // Físicos primeiro (Wi-Fi/Ethernet), virtuais (VPN/VM) por último
  adapters.sort((a, b) => Number(b.physical) - Number(a.physical));

  // Preserva a porta/protocolo que o PC está usando
  let port = '3000';
  try {
    const host = req.headers.get('host') || '';
    const parts = host.split(':');
    if (parts.length > 1 && parts[1]) port = parts[1];
  } catch {
    // mantém default
  }

  return NextResponse.json({ adapters, port });
}
