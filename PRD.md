# PRD - Reconhecimento Facial em Tempo Real por Embeddings

> **Status:** v2.0 | **Data:** 2026-10-15 | **Diretório:** `C:\Users\25011959\embeddings-P.C`
> **Decisões travadas:** Identificação 1:N em tempo real + 100% no navegador + React/Next.js + LocalStorage (camada de persistência isolada em `lib/storage.ts` para futura troca por banco de dados)
> **Histórico:** v1.0 era login 1:1 (removido — falhava em diferenciar usuários; ver §7).

## 1. Visão Geral

### 1.1 Problema
Demonstrar de forma simples e privada como funciona reconhecimento facial moderno por embeddings, sem precisar de servidor, banco ou envio de imagens para nuvem.

### 1.2 Objetivo
Construir uma página web onde o usuário:
1. Cadastra seu rosto (olhar fixo de 5s na webcam) gerando um embedding médio.
2. Depois é **reconhecido em tempo real** (identificação 1:N: "quem é esse rosto?").
3. Entende visualmente o que é um embedding, similaridade cosseno e threshold.

### 1.3 Público-alvo
- Estudantes e desenvolvedores aprendendo visão computacional.
- Uso como demo / portfólio, não como controle de acesso real.

### 1.4 Escopo (In)
- Captura webcam, detecção + embeddings 100% client-side.
- Páginas Home, Cadastro, Reconhecimento em tempo real, Demo educacional.
- Armazenamento local dos embeddings (LocalStorage; migração para banco de dados prevista sem mudar o motor).
- Explicação visual de similaridade e threshold.

### 1.5 Fora de escopo (Out)
- ~~Identificação 1:N em larga escala,~~ vigilância.
- Login/autenticação real / JWT / sessão segura (o fluxo de login 1:1 foi removido).
- Anti-spoof avançado (profundidade, IR, liveness 3D).
- App mobile nativo.

## 2. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de aceite |
|----|-----------|------------|--------------------|
| RF01 | Captura webcam via `getUserMedia` com preview espelhado + overlay canvas (bounding box + score) | P0 | Vídeo <1s após permissão, erro amigável se negado/sem câmera |
| RF02 | Cadastro por olhar sustentado: 5s cumulativos olhando para a câmera (1 rosto, score>0.7, de frente, estável) com 1 amostra automática por segundo (5 total) | P0 | Barra de progresso 0-100%, rejeita 0 ou 2+ rostos e olhar desviado |
| RF03 | Extração de embedding + normalização L2 + média renormalizada | P0 | `meanEmbedding` = média L2-norm das amostras |
| RF04 | Reconhecimento 1:N em tempo real: cada frame com rosto é comparado contra TODOS os `meanEmbedding`; o perfil mais próximo vence se `dist <= threshold`; identidade exibida após 3 frames seguidos com o mesmo vencedor | P0 | Exibe nome, distância, CosSim real e limiar ao vivo; desconhecido sinalizado |
| RF05 | Threshold global configurável na tela de reconhecimento (default 0.35 distância, range 0.30-0.70) + slider na demo | P0 | Mudança reflete imediatamente no resultado |
| RF06 | Gestão de perfis em LocalStorage: listar, selecionar, apagar, exportar/importar JSON | P0 | Persistência após reload; import valida schema |
| RF07 | Controle de qualidade: mensagens "sem rosto", "múltiplos rostos", "muito escuro", "aproxime/afaste", detecção de blur | P1 | Nenhuma captura com qualidade baixa é aceita silenciosamente |
| RF08 | Estabilidade temporal: identidade exibida só após 3 frames consecutivos com o mesmo vencedor (anti-tremor) | P1 | Troca de identidade não pisca a cada frame |
| RF09 | Página Demo educacional: upload 2 fotos, ver vetores (primeiros N dims + heatmap), distância, teste de threshold | P1 | Usuário entende tradeoff FAR/FRR movendo slider |
| RF10 | Log de identificações da sessão (hora, identidade/evento, distância) só em memória | P2 | Limpado ao recarregar |

## 3. Requisitos Não-Funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | 100% client-side. Nenhuma imagem ou embedding sai do navegador. |
| RNF02 | Stack: Next.js 14 App Router + TypeScript + Tailwind CSS. Lib IA: `human` (@vladmandic, WASM/WebGL). Fallback documentado: `face-api.js`. |
| RNF03 | Performance: primeiro load modelo 10-30MB com progresso + Cache Storage; inferência <500ms em notebook médio; UI não trava (inferência em `requestAnimationFrame` / Web Worker se necessário). |
| RNF04 | Privacidade: salvar por padrão só vetores, não foto bruta. Thumbnail opt-in com aviso. Botão "Apagar todos os dados". Aviso LGPD na Home. |
| RNF05 | Compatibilidade: Chrome/Edge/Firefox recentes, desktop + mobile. HTTPS obrigatório (exigência de `getUserMedia`). Mensagem clara em `http://` ou iframe sem permissão. |
| RNF06 | UX em PT-BR, responsivo, acessível (labels, foco, contraste, teclado). |
| RNF07 | Código tipado, `npm run build` sem erro, deploy estático (Vercel). |

## 4. Arquitetura Proposta

```
Webcam (getUserMedia, 720p) ou celular remoto via QR (WebRTC)
  -> human.js: BlazeFace/MobileNet detecção + landmark + embedding 512-d
  -> Pré-process: crop/alinhamento, L2-normalize
  -> Matching 1:N: min cosineDistance(live, meanEmbedding_i) por perfil
  -> Decisão: vencedor com dist <= threshold + 3 frames seguidos => IDENTIFICADO
  -> Persistência: localStorage key `face-login-db-v1` (via `lib/storage.ts`; futura troca por DB)
```

### 4.1 Estrutura de pastas (Next.js)

```
app/
  page.tsx              # /
  register/page.tsx     # /register (olhar 5s)
  reconhecer/page.tsx   # /reconhecer (identificação 1:N tempo real)
  remote/[sessionId]/   # página do celular (webcam remota via QR)
  api/embeddings/export # salva JSON em ./exports (local)
  api/network-info      # IPs de LAN para o QR
  demo/page.tsx         # /demo
  layout.tsx + globals.css
components/
  CameraCapture.tsx
  FaceOverlay.tsx
  EnrollmentWizard.tsx
  EmbeddingInspector.tsx
  ThresholdSlider.tsx
  ProfileManager.tsx
  RemoteWebcamDialog.tsx  # QR + status da webcam remota
  EmbeddingsExportPanel.tsx # preview/download local-vs-prod
lib/
  faceEngine.ts         # load model, detect, embed, warmup
  matching.ts           # cosine, euclidean, mean, normalize, DEFAULT_THRESHOLD
  storage.ts            # CRUD localStorage + export/import (seam p/ futuro DB)
  quality.ts            # blur, brightness, stability checks
  remoteSession.ts      # sessão QR remota
hooks/
  useCamera.ts
  useFaceEngine.ts
  useRemoteCamera.ts    # lado PC da webcam remota (PeerJS)
public/models/          # opcional se self-host dos pesos
```

### 4.2 Dependências principais
- `next`, `react`, `tailwindcss`, `typescript`
- `human` (IA), `react-webcam` opcional (ou video nativo)

## 5. UX / Fluxos

### 5.1 Home `/`
Hero curto: "O que é um embedding?" (vetor que resume seu rosto) + cards [Cadastrar rosto] [Reconhecer] [Ver demo] + badge privacidade + status câmera/modelo.

### 5.2 Cadastro `/register`
1. Input nome/userId (slug único, validação).
2. Preview webcam + guia oval + overlay box.
3. Olhar fixo na câmera por 5 segundos (cronômetro pausa se desviar o olhar): 1 amostra automática por segundo, só com frame válido e frontal. Contador 1/5...5/5 automático.
4. Ao concluir: mostra embedding médio resumido + botão Salvar. Toast + redireciona para /reconhecer.

### 5.3 Reconhecimento `/reconhecer`
1. Botão "Iniciar Reconhecimento em Tempo Real" (câmera local ou celular via QR).
2. Cada frame com rosto é comparado contra todos os perfis; painel ao vivo mostra o melhor candidato por rosto.
3. Identidade exibida após 3 frames seguidos com o mesmo vencedor; desconhecido sinalizado em âmbar com a distância do mais próximo.
4. Log de identificações da sessão + slider de limiar global com efeito imediato.

### 5.4 Demo `/demo`
Upload foto A vs B, exibe vetores truncados, heatmap, distância, slider threshold 0.30-0.70 mostrando inversão da decisão. Texto educacional FAR/FRR.

## 6. Modelo de Dados

```ts
// localStorage: `face-login-db-v1`
type FaceDB = {
  version: 1;
  profiles: FaceProfile[];
}

type FaceProfile = {
  userId: string;       // slug único, ex "ana-silva"
  nome: string;         // display
  createdAt: string;    // ISO
  embeddingDim: number; // ex 512
  samples: number[][];  // 3-5 x dim, L2-norm
  meanEmbedding: number[]; // média renormalizada
  threshold: number;    // default 0.35
  thumbnail?: string;   // dataURL opcional, opt-in
}

type RecognitionEvent = {
  at: string; kind: 'IDENTIFIED' | 'UNKNOWN' | 'CLEAR';
  label: string; distance: number | null;
}
```

Validação import: checar `version`, `dim` consistente, `samples.length >=3`, valores finitos.

## 7. Regras de Matching

- Normalização: `emb /= ||emb||2` sempre antes de salvar/comparar.
- Similaridade: `cosSim(a,b) = dot(a,b)` (já normalizados). Distância: `1 - cosSim` ou euclidiana.
- Enroll: `mean = normalize(mean(samples))`.
- Identify (1:N): para cada rosto, `vencedor = argmin_i distance(live, mean_i)`; `identificado = dist(vencedor) <= threshold`. Exigir 3 frames consecutivos com o mesmo vencedor antes de exibir (anti-tremor).
- Default: `threshold = 0.35` (distância). Range UI 0.30 (estrito) a 0.70 (permissivo).
- Histórico v1: o login 1:1 com default 0.45 apresentou falso aceite com pessoa diferente em teste manual; na v2 o fluxo virou identificação 1:N com default 0.35, que prioriza baixo FAR.
- Calibração sugerida nos testes manuais: ajustar até mesma pessoa ~0.15-0.35 e pessoa diferente ~0.55-0.9.

## 8. Privacidade e Segurança

- Aviso explícito: demo educacional, não usar como única autenticação.
- Nenhum upload; CSP restritiva; sem analytics com imagem.
- Botão "Apagar tudo" + export só pelo usuário.
- Se thumbnail habilitada, borrar por padrão e pedir consentimento.

## 9. Critérios de Aceite (Definition of Done)

- [ ] `npm run dev` abre Home, câmera pede permissão corretamente.
- [ ] Cadastra novo usuário com olhar de 5s em luz normal.
- [ ] Após reload, perfis persistem e o reconhecimento identifica a pessoa certa.
- [ ] Mesma pessoa é identificada de forma estável (10 tentativas luz normal, threshold default).
- [ ] Pessoa diferente aparece como desconhecida (5/5 testes).
- [ ] Slider threshold inverte decisão de forma previsível na /demo.
- [ ] `npm run build` passa, funciona em HTTPS (Vercel preview).
- [ ] Sem erros no console em fluxo feliz.

## 10. Plano de Testes Manuais

1. Luz boa vs luz baixa vs contraluz (mesma pessoa).
2. Óculos / máscara / boné.
3. Pessoa A vs B, A vs foto de A.
4. Threshold 0.30 / 0.35 / 0.45 — anotar FAR/FRR informal.
4b. Teste de impostor obrigatório: cadastrar pessoa A e apontar a câmera para pessoa B deve exibir "desconhecido" no default.
5. Mobile Chrome + desktop Chrome.
6. Sem WebGL (desabilitar aceleração) — deve exibir fallback.

## 11. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Peso do modelo / primeira carga lenta | Alto | Progress bar + cache + lazy load só nas rotas com câmera |
| Precisão menor que ArcFace Python | Médio | Comunicar limitação; múltiplas amostras + threshold ajustável |
| Navegador sem WebGL / iOS antigo | Médio | Fallback CPU + mensagem |
| Falso aceite com outra pessoa | Alto | Threshold default 0.35 + identificação 1:N (todos competem) + disclaimer "não é segurança real" |
| Limite 5MB LocalStorage | Baixo | Só vetores (~512 floats ~2KB/amostra); camada `lib/storage.ts` isolada para migração a banco de dados |

## 12. Roadmap Sugerido

- **M1 Setup:** `create-next-app` + Tailwind + layout + Home + `useCamera`.
- **M2 Core IA:** `faceEngine.ts` + `matching.ts` + overlay tempo real.
- **M3 Register:** wizard 5 amostras + `storage.ts` + export/import.
- **M4 Reconhecimento:** identificação 1:N em tempo real + threshold global + log de sessão.
- **M5 Demo + Polish:** `/demo`, qualidade/blur, acessibilidade, README, deploy Vercel.

## 13. Perguntas Abertas

- [ ] Manter lib `human` ou trocar por `face-api.js` mais didático?
- [ ] Habilitar thumbnail opt-in por padrão ou 100% sem foto?
- [ ] Quer PWA/offline total após primeiro load?

---
*Gerado a partir do planejamento aprovado em 2026-10-08. Próximo passo: M1 Setup.*
