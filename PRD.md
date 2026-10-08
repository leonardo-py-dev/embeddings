# PRD - Página Web de Login Facial por Embeddings

> **Status:** Draft v1.0 | **Data:** 2026-10-08 | **Diretório:** `C:\Users\25011959\embeddings-P.C`
> **Decisões travadas:** Login facial demo (verificação 1:1) + 100% no navegador + React/Next.js + LocalStorage

## 1. Visão Geral

### 1.1 Problema
Demonstrar de forma simples e privada como funciona reconhecimento facial moderno por embeddings, sem precisar de servidor, banco ou envio de imagens para nuvem.

### 1.2 Objetivo
Construir uma página web onde o usuário:
1. Cadastra seu rosto (3-5 amostras via webcam) gerando um embedding médio.
2. Depois faz login facial (verificação 1:1: "esse rosto é do usuário X?").
3. Entende visualmente o que é um embedding, similaridade cosseno e threshold.

### 1.3 Público-alvo
- Estudantes e desenvolvedores aprendendo visão computacional.
- Uso como demo / portfólio, não como controle de acesso real.

### 1.4 Escopo (In)
- Captura webcam, detecção + embeddings 100% client-side.
- Páginas Home, Cadastro, Login, Demo educacional.
- Armazenamento local dos embeddings.
- Explicação visual de similaridade e threshold.

### 1.5 Fora de escopo (Out)
- Identificação 1:N em larga escala, vigilância.
- Backend, banco multiusuário, autenticação real / JWT / sessão segura.
- Anti-spoof avançado (profundidade, IR, liveness 3D).
- App mobile nativo.

## 2. Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de aceite |
|----|-----------|------------|--------------------|
| RF01 | Captura webcam via `getUserMedia` com preview espelhado + overlay canvas (bounding box + score) | P0 | Vídeo <1s após permissão, erro amigável se negado/sem câmera |
| RF02 | Cadastro com 3-5 amostras: só captura frame estável (1 rosto, score>0.7, parado 500ms) | P0 | Barra de progresso 0/3..5, rejeita 0 ou 2+ rostos |
| RF03 | Extração de embedding + normalização L2 + média renormalizada | P0 | `meanEmbedding` = média L2-norm das amostras |
| RF04 | Login 1:1: seleciona usuário, captura live, calcula similaridade cosseno vs `meanEmbedding` | P0 | Exibe % similaridade, distância, threshold, MATCH / NO-MATCH |
| RF05 | Threshold configurável por perfil (default 0.45 distância, range 0.30-0.70) + slider global na demo | P0 | Mudança reflete imediatamente no resultado |
| RF06 | Gestão de perfis em LocalStorage: listar, selecionar, apagar, exportar/importar JSON | P0 | Persistência após reload; import valida schema |
| RF07 | Controle de qualidade: mensagens "sem rosto", "múltiplos rostos", "muito escuro", "aproxime/afaste", detecção de blur | P1 | Nenhuma captura com qualidade baixa é aceita silenciosamente |
| RF08 | Liveness básico: exigir 3 frames positivos consecutivos + desafio simples (piscada / virar cabeça) | P1 | Foto estática impressa não loga no teste manual |
| RF09 | Página Demo educacional: upload 2 fotos, ver vetores (primeiros N dims + heatmap), distância, teste de threshold | P1 | Usuário entende tradeoff FAR/FRR movendo slider |
| RF10 | Log de tentativas (hora, usuário, score, resultado) só em memória + contador sessão | P2 | Limpado ao recarregar |

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
Webcam (getUserMedia, 720p)
  -> human.js: BlazeFace/MobileNet detecção + landmark + embedding 512-d
  -> Pré-process: crop/alinhamento, L2-normalize
  -> Matching: cosineSimilarity(live, meanEmbedding) / euclideanDistance
  -> Decisão: dist < threshold + 3 frames seguidos => LOGIN OK
  -> Persistência: localStorage key `face-login-db-v1`
```

### 4.1 Estrutura de pastas (Next.js)

```
app/
  page.tsx              # /
  register/page.tsx     # /register
  login/page.tsx        # /login
  demo/page.tsx         # /demo
  layout.tsx + globals.css
components/
  CameraCapture.tsx
  FaceOverlay.tsx
  EnrollmentWizard.tsx
  VerificationResult.tsx
  EmbeddingInspector.tsx
  ThresholdSlider.tsx
  ProfileManager.tsx
lib/
  faceEngine.ts         # load model, detect, embed, warmup
  matching.ts           # cosine, euclidean, mean, normalize
  storage.ts            # CRUD localStorage + export/import + schema version
  quality.ts            # blur, brightness, stability checks
  liveness.ts           # desafio simples
hooks/
  useCamera.ts
  useFaceEngine.ts
public/models/          # opcional se self-host dos pesos
```

### 4.2 Dependências principais
- `next`, `react`, `tailwindcss`, `typescript`
- `human` (IA), `react-webcam` opcional (ou video nativo)

## 5. UX / Fluxos

### 5.1 Home `/`
Hero curto: "O que é um embedding?" (vetor que resume seu rosto) + cards [Cadastrar rosto] [Fazer login] [Ver demo] + badge privacidade + status câmera/modelo.

### 5.2 Cadastro `/register`
1. Input nome/userId (slug único, validação).
2. Preview webcam + guia oval + overlay box.
3. Botão "Capturar amostra" habilitado só com frame estável. Contador 1/5...5/5 com thumbnails de qualidade (não foto, só check).
4. Ao concluir: mostra embedding médio resumido + botão Salvar. Toast + redireciona para /login.

### 5.3 Login `/login`
1. Select usuário cadastrado.
2. Webcam + botão "Verificar".
3. Resultado: grande MATCH verde / NO-MATCH vermelho, similaridade %, distância, threshold usado, mini-log de frames.
4. Botão "Tentar novamente" + link "Ajustar threshold na Demo".

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
  threshold: number;    // default 0.45
  thumbnail?: string;   // dataURL opcional, opt-in
}

type AttemptLog = {
  at: string; userId: string;
  score: number; distance: number;
  threshold: number; success: boolean;
}
```

Validação import: checar `version`, `dim` consistente, `samples.length >=3`, valores finitos.

## 7. Regras de Matching

- Normalização: `emb /= ||emb||2` sempre antes de salvar/comparar.
- Similaridade: `cosSim(a,b) = dot(a,b)` (já normalizados). Distância: `1 - cosSim` ou euclidiana.
- Enroll: `mean = normalize(mean(samples))`.
- Verify: `match = distance < threshold`. Exigir 3 frames consecutivos `match=true` em janela de 2s.
- Default: `threshold = 0.45` (distância). Range UI 0.30 (estrito) a 0.70 (permissivo).
- Calibração sugerida nos testes manuais: ajustar até mesma pessoa ~0.15-0.35 e pessoa diferente ~0.55-0.9.

## 8. Privacidade e Segurança

- Aviso explícito: demo educacional, não usar como única autenticação.
- Nenhum upload; CSP restritiva; sem analytics com imagem.
- Botão "Apagar tudo" + export só pelo usuário.
- Se thumbnail habilitada, borrar por padrão e pedir consentimento.

## 9. Critérios de Aceite (Definition of Done)

- [ ] `npm run dev` abre Home, câmera pede permissão corretamente.
- [ ] Cadastra novo usuário com 5 amostras em <30s em luz normal.
- [ ] Após reload, perfil persiste e login funciona.
- [ ] Mesma pessoa loga >90% (10 tentativas luz normal, threshold default).
- [ ] Pessoa diferente é rejeitada (5/5 testes).
- [ ] Foto impressa / celular não loga com liveness básico ligado.
- [ ] Slider threshold inverte decisão de forma previsível na /demo.
- [ ] `npm run build` passa, funciona em HTTPS (Vercel preview).
- [ ] Sem erros no console em fluxo feliz.

## 10. Plano de Testes Manuais

1. Luz boa vs luz baixa vs contraluz (mesma pessoa).
2. Óculos / máscara / boné.
3. Pessoa A vs B, A vs foto de A.
4. Threshold 0.35 / 0.45 / 0.60 — anotar FAR/FRR informal.
5. Mobile Chrome + desktop Chrome.
6. Sem WebGL (desabilitar aceleração) — deve exibir fallback.

## 11. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Peso do modelo / primeira carga lenta | Alto | Progress bar + cache + lazy load só nas rotas com câmera |
| Precisão menor que ArcFace Python | Médio | Comunicar limitação; múltiplas amostras + threshold ajustável |
| Navegador sem WebGL / iOS antigo | Médio | Fallback CPU + mensagem |
| Falso aceite com foto/vídeo | Alto | Liveness simples + disclaimer "não é segurança real" |
| Limite 5MB LocalStorage | Baixo | Só vetores (~512 floats ~2KB/amostra); migrar para IndexedDB se crescer |

## 12. Roadmap Sugerido

- **M1 Setup:** `create-next-app` + Tailwind + layout + Home + `useCamera`.
- **M2 Core IA:** `faceEngine.ts` + `matching.ts` + overlay tempo real.
- **M3 Register:** wizard 5 amostras + `storage.ts` + export/import.
- **M4 Login:** verificação 1:1 + threshold + liveness + logs.
- **M5 Demo + Polish:** `/demo`, qualidade/blur, acessibilidade, README, deploy Vercel.

## 13. Perguntas Abertas

- [ ] Manter lib `human` ou trocar por `face-api.js` mais didático?
- [ ] Habilitar thumbnail opt-in por padrão ou 100% sem foto?
- [ ] Quer PWA/offline total após primeiro load?

---
*Gerado a partir do planejamento aprovado em 2026-10-08. Próximo passo: M1 Setup.*
