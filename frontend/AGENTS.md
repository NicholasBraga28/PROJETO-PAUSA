# AGENTS.md

Frontend web (React) do sistema de agenda acessível para massoterapeutas com deficiência visual, desenvolvido no Desafio de Inovação do Programa de Estágio Semantix 2026. Atende o colaborador, o massoterapeuta, o RH e o suporte, consumindo a API do `backend/`.

Antes de qualquer tarefa, leia:

- `CONTEXT.md`: para quem é este frontend, decisões tomadas, segurança e o estado atual do código.
- `docs/acessibilidade.md`: **padrão de acessibilidade visual obrigatório**. Não é opcional nem revisão de fim de tarefa.
- `docs/roadmap.md`: épicos, tickets, dependências e decisões pendentes do frontend.
- `../backend/docs/requisitos.md`: requisitos com IDs (RF, RN, RNF). É o contrato do projeto inteiro.
- `../backend/CONTEXT.md`: domínio, problema e regras de negócio.

Se este arquivo, o `CONTEXT.md` e o `requisitos.md` divergirem, o `requisitos.md` vence. Aponte a divergência em vez de escolher sozinho. O RN-04 (acessibilidade) aponta para o `docs/acessibilidade.md`, que detalha a meta.

## Acessibilidade visual: requisito número um

**Acessibilidade é o requisito fulcral deste frontend** (D-23, 2026-10-27). Em conflito com estética, prazo ou funcionalidade, **a acessibilidade vence**.

**O usuário principal do sistema é o massoterapeuta com deficiência visual.** Este frontend precisa ter uma camada de acessibilidade visual **impecável**, seguindo todas as normas documentadas para pessoas com deficiência visual em sistemas web:

- **WCAG 2.2 nível AA em todas as telas, sem exceção**, mais os critérios **AAA** listados no `docs/acessibilidade.md` (contraste 7:1, aparência do foco, foco não obscurecido, alvos de 44 × 44 px, prevenção de erros em todas as ações, entre outros);
- **ABNT NBR 17225:2025**, **eMAG 3.1** e a **Lei Brasileira de Inclusão** (Lei 13.146/2015, art. 63);
- **WAI-ARIA 1.2**, os padrões do **ARIA Authoring Practices Guide (APG)**, **AccName** e **HTML-AAM**;
- **W3C COGA** para linguagem e previsibilidade; **EN 301 549** e **Section 508** como referência de verificação.

Cobre todos os perfis de deficiência visual: **cegueira** (leitor de tela), **baixa visão** (zoom até 400%, ampliadores de tela), **baixa sensibilidade ao contraste**, **daltonismo**, **fotofobia**, **campo visual reduzido** e **modo de cores forçadas** do Windows.

Regras que não se negociam (o detalhe de cada uma está no `docs/acessibilidade.md`):

1. **Funciona só com leitor de tela e só com teclado**, sem olhar a tela. Toda tela do massoterapeuta é testada com a tela desligada.
2. **HTML semântico antes de ARIA.** Landmarks, um `h1` por tela, cabeçalhos sem pular nível, listas como listas, botão é `<button>`, link é `<a href>`.
3. **Todo controle tem nome acessível**, que contém o texto visível. Ícones decorativos com `aria-hidden="true"`.
4. **Foco visível sempre** (2 px ou mais, contraste 3:1, em todos os temas e em `forced-colors`), **nunca escondido** pela barra fixa e **gerenciado** em toda troca de tela, diálogo, erro e remoção de item.
5. **Mudanças anunciadas** na região viva única (`aria-live="polite"`), com o `spokenText` que o backend devolve. `role="alert"` só para erro que impede a tarefa.
6. **Contraste 7:1 no texto e 3:1 nos componentes**, em todos os temas, verificado por script e por axe em navegador real.
7. **Nenhuma informação só por cor.** Status sempre em texto.
8. **Zoom de 400% / 320 px sem rolagem horizontal**, espaçamento de texto ajustável, tamanhos em `rem`.
9. **Respeita as preferências do sistema:** `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme`, `forced-colors`.
10. **Ações que alteram dados pedem confirmação** num diálogo modal com o foco em "Voltar", e o resultado é anunciado.
11. **Datas e horas como se fala** ("hoje às 14h"), no fuso `America/Sao_Paulo`, com a informação principal nas primeiras palavras.
12. **Componentes interativos do React Aria** (padrões APG prontos). Não recrie à mão diálogo, grupo de rádio, menu, abas ou listbox.
13. **Testado:** `jsx-a11y` strict no lint, axe em todo teste de tela, testes por papel e nome (`getByRole`), testes de foco, de anúncio e de teclado, mais o roteiro manual com NVDA registrado no PR.

Se uma funcionalidade não puder ser tornada acessível, **pare e pergunte** antes de implementar.

## Idioma

- **Código 100% em inglês:** pastas, arquivos, componentes, hooks, tipos, variáveis, rotas do frontend, nomes de testes e mensagens de commit.
- **Exceções em português:** textos exibidos ao usuário (rótulos, títulos, mensagens, `aria-label`), descrições dos testes que citam o comportamento visto pelo usuário e a documentação.
- IDs de requisitos (RF-11, RN-07) e de tickets (TK-09.01) continuam como estão, inclusive em nomes de testes e commits.

## Glossário de domínio

Os nomes de tipos e variáveis seguem o glossário do `../backend/AGENTS.md` e os DTOs do backend. Não crie sinônimos.

| Português (tela) | Inglês (código) |
| --- | --- |
| Massoterapeuta | `Therapist` |
| Colaborador | `Employee` |
| RH / Suporte | papéis `HR` / `ADMIN` |
| Perfil de quem entrou (`GET /me`) | `Profile` |
| Sala / Unidade | `Room` / `Location` |
| Horário disponível | `AvailableSlot` |
| Período da agenda | `ScheduleSlot` |
| Bloqueio de horário | `ScheduleBlock` |
| Sessão / atendimento | `Appointment` |
| Status do atendimento | `AppointmentStatus` (`BOOKED`, `CONFIRMED`, `CHECKED_IN`, `POSSIBLE_NO_SHOW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `RELEASED`, `NO_SHOW`) |
| Lista de espera | `Waitlist` / `WaitlistEntry` |
| Check-in | `CheckIn` |
| Aviso | `Notification` |
| Texto pronto para leitura | `spokenText` |
| Região viva (anúncios) | `Announcer` / `announce()` |

## Stack

Monorepo (D-17): este frontend e o `backend/` vivem no mesmo repositório.

- React 19 + Vite
- **TypeScript** com `strict: true`, `noUncheckedIndexedAccess`, sem `any` (migração no TK-09.01)
- **React Aria Components** para todo componente interativo (D-10)
- **React Router** para rotas e roteamento por papel (D-21)
- **Zod** para validar toda resposta da API (D-22)
- Tailwind CSS 4 + tokens em CSS (`styles/tokens.css`, cores por tema em `styles/themes.css`, `styles/forced-colors.css`)
- Fontes hospedadas junto do site, via `@fontsource` (D-25)
- Motion (animações, sempre com `MotionConfig reducedMotion="user"`)
- `lucide-react` (ícones, sempre decorativos ou com nome acessível)
- three.js: cena decorativa do hero (D-24), `aria-hidden`, desligada com "reduzir movimento" e com botão de pausar
- Testes: Vitest + Testing Library + `user-event` + axe-core (jsdom); Playwright + `@axe-core/playwright` em navegador real (D-26)
- Lint: ESLint com `jsx-a11y` strict, `react-hooks`, `typescript-eslint`, `react/no-danger` e a regra local `no-comments`; Prettier na formatação
- Hospedagem: Vercel (D-09)

## Comandos

Rodar dentro de `frontend/`, com o backend no ar (`../backend/AGENTS.md`). Copie `.env.example` para `.env`.

```bash
npm install
npm run dev              # http://localhost:5173, com /api repassado ao backend
npm test                 # testes de tela com axe (Vitest + jsdom)
npm run lint             # ESLint com jsx-a11y strict, sem comentários
npm run format:check     # Prettier, sem alterar arquivos
npm run build            # versão de produção em dist/
npm run typecheck        # TypeScript strict, sem erros
npm run test:a11y        # axe e Tab em navegador real (Playwright), sem backend: a API é simulada
```

`npm run check:contrast` confere o contraste dos tokens de cada tema (pares em `scripts/theme-pairs.ts`). O `npm run test:a11y` gera o build, serve com `vite preview` na porta 4319 e roda `e2e/a11y.spec.ts`: cada tela × tema (claro, escuro, alto contraste) × modo (padrão, 320 px, `forced-colors`, movimento reduzido) passa pelo axe (WCAG A/AA, boas práticas e `color-contrast-enhanced`), mais a navegação só com Tab. Na primeira vez, rode `npx playwright install chromium`. Tela nova entra na lista `SCREENS` do spec, com as respostas da API em `e2e/fixtures/api.ts`. `npm run format` formata com o Prettier (mesma configuração do backend) e `npm run format:check` confere sem alterar.

## Estrutura do projeto (alvo)

Organização **por funcionalidade** (feature folders). O que é de uma tela fica junto; o que é compartilhado fica em `shared/`. Uma feature não importa de dentro de outra feature: o que for comum sobe para `shared/`.

```
src/
  main.tsx
  app/                      # App, providers (I18n, Motion, Announcer), rotas e roteamento por papel
  features/
    auth/                   # "Entrar como…" (D-12), sessão, Profile
    booking/                # horários disponíveis e reserva (colaborador)
    appointments/           # "Suas sessões" e cancelamento (colaborador)
    check-in/               # página do QR Code da sala
    waitlist/               # lista de espera (EP-10)
    therapist/              # tela do massoterapeuta (EP-11)
    hr/                     # telas do RH (EP-12)
  shared/
    api/                    # cliente HTTP, ApiError, tipos dos contratos do backend
    a11y/                   # Announcer, useFocusOnMount, usePageTitle, SkipLinks, VisuallyHidden
    ui/                     # ConfirmDialog, Chip, Step e outros componentes visuais reutilizados
    time/                   # fuso, datas e horas como se fala
    theme/                  # ThemeSwitch e preferências
    visuals/                # elementos decorativos (cena 3D, logotipo animado)
  styles/                   # tokens de tema e estilos globais
  test/                     # setup e utilitários de teste
e2e/                        # testes em navegador real (Playwright)
```

Dentro de uma feature:

```
booking/
  components/
    BookingSteps.tsx
    BookingSteps.test.tsx
  hooks/
    use-availability.ts
  api.ts                    # chamadas da feature, usando shared/api
  types.ts                  # tipos só desta feature
  slots.ts                  # funções puras da feature
  slots.test.ts
```

Pastas só quando houver arquivos para elas. Não crie pastas vazias.

### Responsabilidades

- **Componentes** mostram dados e repassam eventos. Sem `fetch` direto e sem regra de negócio.
- **Hooks** carregam dados e guardam estado de tela, chamando o `api.ts` da feature.
- **`shared/api`** é o único lugar que fala com o backend: monta a URL, envia a identificação, converte erro em `ApiError` com a mensagem do backend.
- **Funções puras** (datas, filtros de horários) ficam fora dos componentes e têm teste próprio.
- **O backend é a fonte da verdade.** Nenhuma regra de negócio (duração, expediente, limites, transições de status) é fixada ou recalculada no frontend; a tela mostra o que a API devolve.

### Convenções de nomes

| Elemento | Convenção | Exemplo |
| --- | --- | --- |
| Pastas | `kebab-case` | `check-in/`, `shared/a11y/` |
| Componentes | `PascalCase.tsx`, um componente exportado por arquivo | `ConfirmDialog.tsx` |
| Hooks | `use-kebab-case.ts`, função `useCamelCase` | `use-session.ts` → `useSession` |
| Outros módulos | `kebab-case.ts` | `api-client.ts`, `spoken-time.ts` |
| Testes | ao lado do arquivo, `*.test.ts(x)`; e2e em `e2e/*.spec.ts` | `ConfirmDialog.test.tsx` |
| Tipos e interfaces | `PascalCase`, sem prefixo `I` | `Appointment`, `ApiError` |
| Props | `<Componente>Props` | `ConfirmDialogProps` |
| Constantes | `UPPER_SNAKE_CASE` | `TIMEZONE`, `STATUS_LABEL` |
| Booleanos | prefixo `is`, `has`, `can`, `should` | `isCancellable` |
| Handlers | `on<Evento>` na prop, `handle<Evento>` na função | `onConfirm`, `handleConfirm` |
| Testes | `describe` pela tela ou função; `it` citando o ID | `it('RF-03: cancela a sessão depois de confirmar no diálogo')` |

## TypeScript

- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`. `npm run typecheck` sem erros.
- **Sem `any`.** Dado de fora (resposta da API, `localStorage`, parâmetros da URL) entra como `unknown` e é validado com um esquema Zod antes de usar (D-22). O tipo sai do esquema (`z.infer`), não é escrito duas vezes.
- Sem `as` para "calar" o compilador e sem `!` (non-null assertion). Se o tipo não fecha, o código está errado.
- Esquemas e tipos dos contratos da API em `shared/api/schemas.ts`, espelhando os DTOs do backend com os mesmos nomes do glossário.
- Uniões literais para valores fechados (`type Role = 'EMPLOYEE' | 'THERAPIST' | 'HR' | 'ADMIN'`), com `Record<Role, string>` para rótulos: esquecer um caso vira erro de compilação.
- Props tipadas com `type`/`interface` explícitos; nada de `React.FC`.

## React

- Componentes de função e hooks. Sem classes.
- Regras dos hooks seguidas (o lint bloqueia). `eslint-disable` de `exhaustive-deps` só com justificativa no PR, e preferindo corrigir a dependência.
- Efeitos que buscam dados tratam cancelamento (componente desmontado não recebe `setState`).
- Estado derivado é calculado, não guardado.
- Componentes pequenos: mais de ~150 linhas ou mais de uma responsabilidade é sinal para dividir.
- Estados de carregamento, vazio e erro **sempre** tratados e anunciados; nenhuma tela fica em branco.

## Clean Code

- Funções curtas, um nível de abstração. No máximo 3 parâmetros; acima disso, um objeto tipado.
- Nomes revelam intenção, sem abreviações (`appointment`, não `appt`; `availability`, não `data`).
- Sem números mágicos: constantes técnicas nomeadas; valores de negócio vêm da API.
- Guard clauses e retorno antecipado em vez de `if` aninhado.
- **Sem comentários no código**, como no backend: nada de `//`, `/* */` ou JSDoc, nem código comentado. Se um trecho precisa de explicação, extraia uma função, uma constante ou um tipo com nome que revele a intenção. O **porquê** vai para os testes, o `CONTEXT.md`, uma ADR em `docs/adr/` ou a mensagem de commit. Exceção: `.env.example` documenta as variáveis.
- Sem código morto nem componentes "guardados para o futuro".

## Segurança

O protótipo identifica o usuário só pelo cabeçalho `x-user-id` (D-12): **qualquer pessoa pode se passar por outra**. Isso é aceito apenas no protótipo e fica isolado em `features/auth` e `shared/api`, para o login Google entrar sem espalhar mudanças. Regras:

- **Nunca renderize HTML vindo de fora.** Proibido `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` e `href` montado com texto do usuário sem validar o esquema (`javascript:`). O lint bloqueia `react/no-danger`.
- **Parâmetros de URL** (como o token do check-in) são validados pelo formato esperado e codificados com `encodeURIComponent` antes de ir para a API.
- **Content Security Policy e cabeçalhos de segurança** no `vercel.json`: `default-src 'self'`, sem `unsafe-inline` em `script-src`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `Referrer-Policy: no-referrer` (a URL do check-in leva o token da sala), `X-Content-Type-Options: nosniff`, `Permissions-Policy` restritiva e `Strict-Transport-Security` (TK-09.07).
- **Nada de script inline** no `index.html`; o que precisar rodar antes do React vai para um arquivo próprio.
- **Variáveis `VITE_*` são públicas**: vão para o JavaScript entregue ao navegador. Nunca coloque segredo, token ou chave nelas.
- **`localStorage` só guarda preferências e a escolha do protótipo** (`userId` de demonstração, tema, duração descoberta). Nunca token de sessão, dado pessoal além do ID ou dado de saúde. Quando o login Google entrar, a sessão vai em cookie `HttpOnly`, `Secure`, `SameSite`, definido pelo backend.
- **Privacidade (RNF-04):** nada de dado pessoal em `console`, em mensagens de erro técnicas ou em ferramentas de terceiros. Telas do massoterapeuta mostram só o primeiro nome do colaborador.
- **Erros ao usuário** mostram a mensagem do catálogo do backend; nunca stack trace, corpo bruto da resposta ou código interno.
- **Dependências:** só com pedido explícito; `package-lock.json` versionado, `npm ci` na CI, `npm audit --audit-level=high` sem achados. Nenhum recurso de terceiros em tempo de execução: fontes, ícones e scripts são servidos pelo próprio site (D-25).
- **Build de produção** sem source maps públicos e sem rotas ou dados de demonstração quando o login real existir.

## Regras de trabalho

- **Branches.** Uma branch por épico, seguindo Conventional Commits: `<tipo>/<EP-xx-nome-da-feature>` (por exemplo, `feat/EP-09-base-do-frontend`). Antes de commitar um ticket, confira se a branch atual é a do épico dele; se não for, crie a partir da `main` ou troque para ela.
- **Trabalhe a partir de um ticket** do `docs/roadmap.md`, respeitando a coluna "Depende de". Ticket 🔒 não é implementado: a decisão vem antes.
- **TDD nas regras e no comportamento:** funções puras, hooks e fluxos de tela começam por um teste falhando. Estilo visual puro não exige TDD, mas exige o roteiro de acessibilidade.
- **Rastreabilidade.** Testes e commits citam o ticket e os IDs de requisito.
- **Commits** em [Conventional Commits](https://www.conventionalcommits.org/), em inglês: `<tipo>(<escopo>): <descrição>`, com o escopo igual à feature ou à pasta de `shared/`, citando ticket e requisitos: `refactor(booking): TK-09.01 migrate booking steps to TypeScript`. Commits e PRs **não** levam linha `Co-Authored-By: Claude` nem outra marca de autoria de IA.
- **Ao concluir um ticket**, atualize o status no arquivo do ticket e no `docs/roadmap.md`, no mesmo PR.
- **Não suponha.** Campo `[PREENCHER]`, `[VALIDAR]`, `[DECIDIR]` ou `[CONFIRMAR]` não é preenchido por conta própria: pare e pergunte.
- **Contrato com o backend.** Se a tela precisa de algo que a API não oferece, registre na seção "O que a API ainda não permite" do `CONTEXT.md` e proponha o ticket no backend. Não contorne no frontend com regra duplicada.
- **Escopo.** Não adicione dependências, telas ou funcionalidades fora do ticket atual sem perguntar.
- **Testes não chamam o backend real.** `fetch` é substituído por dublês; os e2e com Playwright usam respostas simuladas ou o backend de teste, nunca dados reais.

## Definição de pronto

- [ ] Critérios de aceite do ticket cobertos por testes passando
- [ ] **Definição de pronto de acessibilidade do `docs/acessibilidade.md` atendida**, com o roteiro manual (teclado, NVDA + Chrome, zoom 400%, alto contraste e `forced-colors`, daltonismo, movimento reduzido) registrado no PR
- [ ] `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` passando, mais `npm run test:a11y` e `npm run check:contrast`
- [ ] Regras de segurança respeitadas: nada de HTML vindo de fora, segredos ou dados pessoais expostos
- [ ] Nenhum comentário no código e nenhum `any`
- [ ] Estrutura e nomes seguindo as convenções e o glossário
- [ ] Nenhuma regra de negócio duplicada do backend
- [ ] Nenhum `[PREENCHER]` resolvido por suposição
- [ ] Status atualizado no ticket e no `docs/roadmap.md`

## Agent skills

### Issue tracker

Markdown local, como no backend: specs em `docs/specs/EP-NN-<nome>.md` e um arquivo por ticket em `docs/tickets/EP-NN/TK-NN.MM-<slug>.md`. Ver `docs/agents/issue-tracker.md`.

### Domain docs

`CONTEXT.md` e `docs/adr/` dentro de `frontend/`; o domínio de negócio continua no `backend/`. Ver `docs/agents/domain.md`.
