# EP-09 — Base do frontend: organização, segurança e TypeScript

Spec escrita em 2026-10-27 (Guilherme). Épico em `docs/roadmap.md`. Branch: `feat/EP-09-base-do-frontend`.

Decisões que moldam esta spec (todas de 2026-10-27, registradas no `backend/docs/requisitos.md`): acessibilidade como requisito fulcral (D-23), React Aria (D-10), monorepo (D-17), TypeScript strict, React Router (D-21), Zod (D-22), cena 3D do hero mantida e `Diamond.jsx` removido (D-24), fontes hospedadas (D-25), Playwright (D-26) e página inicial como landing page (D-27, construída no TK-10.01; o EP-09 só prepara as rotas).

## Objetivo

Deixar o frontend pronto para receber as telas do massoterapeuta (EP-11) e do RH (EP-12) sem dívida:

1. **TypeScript strict**, sem `any`, com os contratos da API tipados e validados.
2. **Organização por funcionalidade** (`app/`, `features/`, `shared/`), seguindo o `AGENTS.md`.
3. **Segurança**: CSP, cabeçalhos, nada de script inline, nada de recurso de terceiros em tempo de execução, identificação do protótipo isolada.
4. **Fundação de acessibilidade visual impecável** (`docs/acessibilidade.md`): componentes de foco e anúncio compartilhados, tokens com contraste 7:1, `forced-colors`, reflow a 400%, testes em navegador real.

Tudo **sem mudar o comportamento** visto pelo colaborador: os testes que passam hoje continuam passando (convertidos para TypeScript).

## Fora de escopo

- Telas novas (massoterapeuta, RH, lista de espera): EP-10, EP-11, EP-12.
- Login Google e sessão por cookie.
- PWA e Web Push.
- Mudanças no backend. O que faltar na API é registrado no `CONTEXT.md` ("O que a API ainda não permite").

## Diagnóstico do código atual

| Área | Achado | Ticket |
| --- | --- | --- |
| Linguagem | JavaScript sem tipos; respostas da API usadas sem validação | TK-09.01, TK-09.03 |
| Estrutura | 17 arquivos soltos em `src/`; `ui.jsx` mistura acessibilidade, animação e componentes; `App.jsx` concentra sessão, rota e tela do colaborador | TK-09.02, TK-09.05 |
| Rotas | `window.location.pathname` com regex; troca de usuário recarrega o estado na mão | TK-09.04 |
| Segurança | Script inline no `index.html` (impede CSP estrita); `vercel.json` sem cabeçalhos; fontes do Google Fonts; token da sala na URL sem `Referrer-Policy` | TK-09.07 |
| Contraste | Tokens pensados para AA (3:1 no foco, 4,5:1 no texto); `letter-spacing: -0.01em` no `body` | TK-09.06 |
| Preferências | `prefers-contrast` e `prefers-reduced-motion` tratados; **`forced-colors` não** | TK-09.06 |
| Testes | axe no jsdom sem a regra de contraste; nada de zoom, tema ou `forced-colors` em navegador real | TK-09.08 |
| Qualidade | Comentários no código; `Diamond.jsx` guardado sem uso; sem Prettier, sem `typecheck` | TK-09.09 |
| O que já está bom | Skip link, landmarks, `h1` por tela com foco, região viva com `spokenText`, React Aria nos seletores e no diálogo, foco em "Voltar" no diálogo, temas com alto contraste, `MotionConfig reducedMotion="user"`, `jsx-a11y` strict, axe em todas as telas | Preservar |

## Arquitetura alvo

Ver `AGENTS.md`, seção "Estrutura do projeto". Mapeamento dos arquivos atuais:

| Hoje | Alvo |
| --- | --- |
| `main.jsx` | `src/main.tsx` |
| `App.jsx` (App, `useSession`, `EmployeeHome`, `OtherRole`) | `app/App.tsx`, `app/routes.tsx`, `features/auth/hooks/use-session.ts`, `features/booking/components/EmployeeHome.tsx`, `features/auth/components/RolePending.tsx` |
| `SignIn.jsx` | `features/auth/components/SignIn.tsx` |
| `Booking.jsx` | `features/booking/components/*` |
| `Sessions.jsx` | `features/appointments/components/*` |
| `CheckIn.jsx` | `features/check-in/components/CheckIn.tsx` |
| `api.js` | `shared/api/client.ts`, `shared/api/schemas.ts` (Zod), `api.ts` de cada feature; descoberta da duração em `features/booking/session-duration.ts` |
| `agenda.js`, `agenda.check.js` | `shared/time/*.ts` com testes Vitest (o `check` vira teste) |
| `ui.jsx` | `shared/a11y/*` (Announcer, foco, título) e `shared/ui/*` (ConfirmDialog, Chip, Step, Swap) |
| `ThemeSwitch.jsx` | `shared/theme/ThemeSwitch.tsx` |
| `Hero.jsx`, `LogoWire.jsx`, `three-canvas.js` | `features/booking/components/Hero.tsx`, `shared/ui/Navbar.tsx`, `shared/visuals/*` |
| `Diamond.jsx` | Removido (D-24) |
| `index.css`, `styles.css` | `styles/` |
| `test/` | `test/` (setup) e testes ao lado de cada arquivo |

## Contratos da API usados

Esquemas Zod em `shared/api/schemas.ts` (D-22), com os nomes do glossário, espelhando os DTOs do backend; os tipos saem dos esquemas com `z.infer`. Toda resposta é validada antes de chegar à tela.

| Rota | Tipo da resposta |
| --- | --- |
| `GET /auth/demo-users` | `DemoUser[]` (`id`, `name`, `firstName`, `role`, `roleLabel`) |
| `GET /me` | `Profile` (`id`, `name`, `firstName`, `role`, `spokenText`) |
| `GET /booking/availability` | `Availability` (`therapists`, `slots: AvailableSlot[]`, `spokenText`) |
| `POST /booking/appointments` | `BookingResult` (com `spokenText`) |
| `GET /booking/appointments` | `MyAppointments` (`upcoming`, `past`, `spokenText`) |
| `GET /booking/appointments/next` | `NextAppointment` (`appointment \| null`, `spokenText`) |
| `DELETE /booking/appointments/:id` | `CancellationResult` (com `spokenText`) |
| `POST /booking/check-in/:token` | `CheckInResult` (com `spokenText`) |

Erros: `ApiError` com `status` e `message` (texto do catálogo do backend, juntando arrays de validação). Sem rede: "Servidor indisponível. Verifique se o backend está rodando." Resposta fora do contrato: mensagem genérica ao usuário ("Não foi possível ler a resposta do servidor. Tente de novo.") e nenhum dado mostrado.

## Segurança

Cabeçalhos no `vercel.json`, para todas as rotas:

| Cabeçalho | Valor |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' <origem de VITE_API_URL>; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests` |
| `Referrer-Policy` | `no-referrer` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |

`style-src 'unsafe-inline'` fica enquanto o Motion e o React Aria aplicarem estilo inline; não há script inline permitido. A origem da API em `connect-src` é `[CONFIRMAR]` quando o backend for publicado (TK-13.03).

Demais controles: `react/no-danger` no lint; token do check-in validado por formato antes de chamar a API; `build.sourcemap: false`; política de `localStorage` do `CONTEXT.md`.

## Acessibilidade

O EP-09 não cria telas, mas cria **a base que todas vão usar**. Por isso os critérios abaixo valem para os componentes compartilhados e para as telas que já existem:

- toda troca de rota leva o foco ao `h1` e atualiza o `document.title`;
- a região viva única continua anunciando o `spokenText`, agora tipada e testada;
- `ConfirmDialog` segue o padrão APG de diálogo modal (`alertdialog`), foco em "Voltar", Esc fecha, foco volta ao gatilho;
- links de pulo configuráveis por tela (`SkipLinks`), prontos para as regiões do EP-11;
- tokens com contraste 7:1 no texto e 3:1 nos componentes, em Claro, Escuro e Alto contraste;
- foco com 2 px ou mais e contraste de 3:1 em todos os temas e em `forced-colors`;
- reflow sem rolagem horizontal a 320 px e espaçamento de texto ajustável;
- alvos de pelo menos 44 × 44 px;
- testes por papel e nome em todas as telas, axe no jsdom e axe com contraste AAA em navegador real.

## Critérios de aceite por ticket

### TK-09.01 — TypeScript strict

- **Dado** o projeto migrado, **quando** rodo `npm run typecheck`, **então** não há erros, com `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` e `verbatimModuleSyntax` ligados.
- **Dado** o código-fonte, **quando** procuro `any` explícito, `as unknown as` ou `!` de non-null, **então** não encontro nenhum (o lint bloqueia `@typescript-eslint/no-explicit-any` e `no-non-null-assertion`).
- **Dado** os testes atuais, **quando** rodo `npm test`, **então** todos passam, agora em `.test.tsx`, sem perder nenhum caso.
- **Dado** a aplicação no navegador, **quando** faço reserva, cancelamento e check-in, **então** o comportamento e os anúncios são os mesmos de antes.

### TK-09.02 — Estrutura por funcionalidade

- **Dado** o `src/`, **quando** listo as pastas, **então** só existem `app/`, `features/`, `shared/`, `styles/` e `test/`, conforme o mapeamento acima.
- **Dado** um arquivo de uma feature, **quando** ele importa de outra feature, **então** o lint acusa erro (regra de fronteira, por exemplo `import/no-restricted-paths`).
- **Dado** um import entre pastas, **quando** leio o código, **então** ele usa o alias `@/` e não caminhos relativos longos.

### TK-09.03 — Cliente da API tipado

- **Dado** uma resposta válida, **quando** a tela a recebe, **então** o dado tem o tipo do contrato e veio validado.
- **Dado** uma resposta fora do contrato, **quando** o cliente valida, **então** lança `ApiError` com a mensagem genérica, a tela anuncia o erro com `role="alert"` e nenhum dado parcial aparece.
- **Dado** um erro 4xx com mensagem do catálogo, **quando** a tela mostra o erro, **então** aparece o texto do backend, nunca o corpo bruto ou o código HTTP sozinho.
- **Dado** o código-fonte, **quando** procuro `x-user-id` ou `localStorage` com a chave `userId`, **então** só aparecem em `features/auth` e `shared/api`.

### TK-09.04 — Roteamento por papel

- **Dado** um usuário `EMPLOYEE`, **quando** entra, **então** vê a área de reservas; **dado** outro papel, **então** vê a tela do papel (ou o aviso de que ela ainda não existe).
- **Dado** `/check-in/<token>` com um token fora do formato esperado, **quando** a página abre, **então** a API não é chamada e a tela explica, em uma frase, que o QR Code é inválido.
- **Dado** qualquer troca de rota, **quando** a nova tela aparece, **então** o foco está no `h1` e o `document.title` é `"<Tela> · Pausa"`.
- **Dado** um leitor de tela, **quando** a rota muda, **então** o título novo é lido uma única vez.

### TK-09.05 — Fundação de acessibilidade

- **Dado** `announce(texto)`, **quando** chamado duas vezes com o mesmo texto, **então** a região viva anuncia as duas vezes.
- **Dado** o `ConfirmDialog` aberto, **quando** abre, **então** o foco está em "Voltar"; **quando** aperto Esc, **então** fecha e o foco volta ao botão que o abriu; **quando** está ocupado, **então** não fecha.
- **Dado** uma tela com `SkipLinks`, **quando** aperto Tab na carga da página, **então** o primeiro foco é "Pular para o conteúdo" e cada link leva o foco à região certa.
- **Dado** um item removido de uma lista, **quando** a lista atualiza, **então** o foco vai ao próximo item ou ao título da lista vazia.
- **Dado** cada componente de `shared/a11y` e `shared/ui`, **quando** rodo o axe nos testes, **então** não há violações.

### TK-09.06 — Tokens visuais acessíveis

- **Dado** cada tema (Claro, Escuro, Alto contraste e Automático nos dois modos do sistema), **quando** rodo `npm run check:contrast`, **então** todo par texto/fundo tem 7:1 (texto grande 4,5:1) e todo par componente/fundo e foco/fundo tem 3:1.
- **Dado** `forced-colors: active`, **quando** navego com Tab, **então** o foco, as bordas dos botões e campos, a opção selecionada e os status continuam visíveis.
- **Dado** zoom de 400% (ou janela de 320 px), **quando** percorro todas as telas, **então** não há rolagem horizontal nem conteúdo cortado.
- **Dado** o bookmarklet de espaçamento de texto do 1.4.12, **quando** aplicado, **então** nada se sobrepõe nem some.
- **Dado** qualquer controle interativo, **quando** meço, **então** o alvo tem pelo menos 44 × 44 px.
- **Dado** o `body`, **quando** inspeciono, **então** não há `letter-spacing` negativo em texto corrido e a fonte base é relativa (`rem`).
- **Dado** a cena 3D do hero (D-24) em movimento, **quando** ativo "Pausar animação" pelo teclado, **então** ela para, o botão anuncia o estado (`aria-pressed`) e a escolha fica lembrada; com "reduzir movimento" a cena já começa parada.

### TK-09.07 — Segurança

- **Dado** o deploy de pré-visualização, **quando** inspeciono as respostas, **então** todos os cabeçalhos da seção "Segurança" estão presentes.
- **Dado** a CSP ativa, **quando** uso todas as telas, **então** o console não mostra nenhuma violação.
- **Dado** o `index.html`, **quando** leio, **então** não há `<script>` inline; o tema salvo continua aplicado antes da primeira pintura (sem "piscar" no tema errado).
- **Dado** o build de produção, **quando** listo `dist/`, **então** não há arquivos `.map`.
- **Dado** a página de check-in, **quando** ela faz requisições, **então** nenhuma leva `Referer`.
- **Dado** as fontes hospedadas (D-25), **quando** a página carrega, **então** nenhuma requisição sai para `fonts.googleapis.com` ou `fonts.gstatic.com`, e a CSP usa `font-src 'self'`.

### TK-09.08 — Testes de acessibilidade em navegador real

- **Dado** `npm run test:a11y`, **quando** roda, **então** cada tela é verificada pelo axe com as tags WCAG 2.0/2.1/2.2 A e AA e a regra `color-contrast-enhanced`, em cada tema.
- **Dado** a mesma suíte, **quando** roda com viewport de 320 px, com `forcedColors: 'active'` e com `reducedMotion: 'reduce'`, **então** não há violações e não há rolagem horizontal.
- **Dado** um PR que muda tela, **quando** é aberto, **então** o modelo de PR traz o roteiro manual (teclado, NVDA + Chrome, zoom, contraste, daltonismo, movimento) para marcar.

### TK-09.09 — Qualidade

- **Dado** o projeto, **quando** rodo `npm run format:check`, `npm run lint` e `npm run typecheck`, **então** passam.
- **Dado** o código-fonte, **quando** procuro comentários, **então** só restam os do `.env.example`.
- **Dado** o código-fonte, **quando** procuro código sem uso, **então** ele foi removido, inclusive o `Diamond.jsx` (D-24).

### TK-09.10 — Página "Acessibilidade"

- **Dado** qualquer tela, **quando** procuro o link "Acessibilidade", **então** ele está no mesmo lugar em todas (3.2.6).
- **Dado** a página, **quando** leio, **então** ela descreve os recursos (temas, atalhos de região, reduzir movimento), as normas seguidas, os leitores de tela testados e como relatar um problema de acessibilidade.
- **Dado** a página, **quando** rodo o axe e o roteiro manual, **então** não há violações.

## Perguntas em aberto

- Origem pública da API para o `connect-src` da CSP `[CONFIRMAR]` (depende do TK-13.03).
- Contato para relatar problema de acessibilidade na página do TK-09.10 `[PREENCHER]`.
