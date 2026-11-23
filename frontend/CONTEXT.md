# CONTEXT.md

Contexto do frontend: para quem ele existe, decisões tomadas, segurança e estado atual do código. Complementa o `AGENTS.md` (como trabalhar), o `docs/acessibilidade.md` (padrão de acessibilidade) e, no backend, o `CONTEXT.md` (domínio) e o `docs/requisitos.md` (o que construir).

## Por que este frontend existe

O Desafio de Inovação do Programa de Estágio Semantix 2026 pergunta como a tecnologia pode dar **inclusão profissional e autonomia a massoterapeutas com deficiência visual**. A causa raiz levantada nas entrevistas: toda a informação da agenda está concentrada numa pessoa e circula por canais visuais.

O frontend é um dos dois canais diretos até o massoterapeuta (o outro é a Alexa) e o canal único do colaborador e do RH. **Métrica principal do projeto:** o massoterapeuta passa um dia inteiro de trabalho sem pedir informação a ninguém. Para a tela, isso significa que ele precisa ler, entender e agir sobre a agenda **só com leitor de tela**, no celular ou no computador.

## Acessibilidade visual é o centro do produto

Não é um requisito entre outros: é a razão de existir do sistema. Por isso:

- **Este frontend tem uma camada de acessibilidade visual impecável**, seguindo todas as normas documentadas para pessoas com deficiência visual: **WCAG 2.2 AA em tudo + critérios AAA** selecionados, **ABNT NBR 17225:2025**, **eMAG 3.1**, **Lei Brasileira de Inclusão** (art. 63), **WAI-ARIA 1.2** e os padrões do **APG**, **AccName**, **HTML-AAM** e **W3C COGA**. O detalhe está no `docs/acessibilidade.md`.
- **Todos os perfis de deficiência visual** entram no desenho e nos testes: cegueira, baixa visão, baixa sensibilidade ao contraste, daltonismo, fotofobia, campo visual reduzido e modo de cores forçadas.
- **Vale para todas as telas**, não só a do massoterapeuta. Colaboradores, pessoas do RH e do suporte também podem ter deficiência visual ("resolver para um, estender para muitos").
- **Princípios herdados do backend:** modelo social da deficiência (a barreira está no processo, não na pessoa), paridade de informação, massoterapeuta protagonista e "nada sobre nós sem nós": decisões de interação são validadas com os próprios massoterapeutas (TK-11.04, TK-14.05).
- **Decisão de 2026-10-27 (D-23): acessibilidade é o requisito fulcral do frontend.** A meta é a do `docs/acessibilidade.md` (RN-04 atualizado no `backend/docs/requisitos.md`). Nenhuma tela é entregue sem ela, e em conflito com estética, prazo ou funcionalidade, **a acessibilidade vence**.

## Quem usa e como

| Ator | Papel | Tela | Como acessa |
| --- | --- | --- | --- |
| Massoterapeuta | `THERAPIST` | Tela dedicada com regiões fixas: Agora, Próximo, Agenda de hoje, Ações, Avisos (EP-11) | Leitor de tela no celular próprio (opcional) ou num computador da sala |
| Colaborador | `EMPLOYEE` | Reserva, suas sessões, lista de espera, check-in pelo QR Code (EP-10) | Navegador do computador ou do celular |
| RH | `HR` | Cadastros, agendas, bloqueios, parâmetros, pareamento da Alexa, KPIs e auditoria (EP-12) | Navegador do computador |
| Suporte | `ADMIN` | Tudo o que o RH vê | Navegador do computador |

O leitor de tela e o aparelho que os massoterapeutas usam ainda estão `[PREENCHER]` no perfil do usuário principal (`backend/docs/requisitos.md`, TK-14.01). Até lá, a matriz mínima do `docs/acessibilidade.md` vale para todo PR.

## Decisões tomadas

- **O backend é a fonte da verdade.** O frontend não fixa nem recalcula regra de negócio: duração da sessão, expediente, intervalos, limites e transições de status vêm da API.
- **Textos prontos do backend.** Erros e confirmações mostram a mensagem do catálogo do backend; o `spokenText` das respostas é anunciado na região viva (`aria-live`).
- **Monorepo** (D-17, 2026-10-27): frontend e backend no mesmo repositório, em `frontend/` e `backend/`, cada um com a própria documentação. O contrato da API e as telas evoluem no mesmo PR quando preciso.
- **React Aria Components** (D-10, 2026-10-27): implementa os padrões do APG (teclado, foco, papéis ARIA); é a escolha quando a acessibilidade é o critério principal. shadcn/ui com Radix foi descartado.
- **TypeScript strict** (2026-10-27): o código veio em JavaScript e foi migrado no TK-09.01.
- **React Router** (D-21, 2026-10-27) para as rotas e o roteamento por papel.
- **Zod** (D-22, 2026-10-27) para validar as respostas da API: é a biblioteca mais usada para isso no ecossistema TypeScript, e um esquema gera ao mesmo tempo o tipo e a validação. Nenhum dado do backend chega à tela sem passar por ele.
- **Cena 3D do hero fica** (D-24, 2026-10-27): o `LogoWire` (three.js) continua, decorativo (`aria-hidden`), desligado com "reduzir movimento" e com botão de pausar. O `Diamond.tsx`, outra cena guardada sem uso, é removido.
- **Página inicial como landing page** (D-27, 2026-10-27): `h1` claro, a cena 3D do hero como fundo decorativo e destinos como links reais (reservar, suas sessões, a tela do papel, acessibilidade). Cada destino é uma rota com título e foco próprios, em vez de uma página longa onde o leitor de tela precisa achar a seção certa.
- **Tela do massoterapeuta como PWA instalável** (D-28, 2026-10-27): manifesto e ícones, abre direto na agenda, sem a barra do navegador; sem Web Push no MVP.
- **Fontes hospedadas junto do site** (D-25, 2026-10-27): sem Google Fonts em tempo de execução.
- **Playwright + `@axe-core/playwright`** (D-26, 2026-10-27) para testar acessibilidade em navegador real.
- **Identificação do protótipo (D-12):** tela "Entrar como…" com `GET /auth/demo-users`; o ID escolhido fica no navegador e vai no cabeçalho `x-user-id`. O perfil vem de `GET /me` e decide a tela (roteamento por papel).
- **Avisos ao massoterapeuta por consulta periódica** (D-07): `GET /notifications` com `since`, `spokenText` e marcação de lido.
- **Fuso `America/Sao_Paulo`** em toda data e hora mostrada, igual às frases do backend; datas e horas como se fala.
- **Duração da sessão descoberta pela API:** só o RH lê as regras de negócio, então o frontend pergunta pelos horários de um intervalo curto até a API aceitar a duração, e guarda o valor no navegador. É um contorno: o ideal é o backend expor a duração vigente ao colaborador (ver "O que a API ainda não permite").
- **Hospedagem na Vercel** (D-09), com o `vercel.json` levando todas as rotas do React Router para o `index.html`.
- **Temas:** Automático, Claro, Escuro e Alto contraste. Identidade visual: Open Sans; paleta `#5A179A`, `#A07BF6`, `#CBBAFF`, `#DED6FF`, `#FFFFFF`. A paleta se curva ao contraste 7:1, nunca o contrário.

## Segurança

### Modelo de ameaça do protótipo

| Ameaça | Situação hoje | Controle |
| --- | --- | --- |
| Alguém se passa por outro usuário | **Aceito no protótipo:** o `x-user-id` vem do navegador e qualquer pessoa troca o valor | Isolar a identificação em `features/auth` e `shared/api`; login Google com cookie `HttpOnly` no roadmap; rota de demonstração só existe com `AUTH_MODE=header` no backend |
| Injeção de script (XSS) | O React escapa o texto; `react/no-danger` no lint; CSP com `script-src 'self'` no `vercel.json` (TK-09.07) | Proibir APIs que injetam HTML (lint); CSP sem `unsafe-inline` em scripts |
| Script inline no `index.html` (tema antes do React) | Resolvido: `public/theme-init.js` aplica o tema salvo e só aceita os temas conhecidos (TK-09.07) | Nada de `<script>` inline no `index.html` |
| Vazamento do token da sala pela URL do check-in | O token vai no caminho `/check-in/<token>`; `Referrer-Policy: no-referrer` no `vercel.json` e `<meta name="referrer">` no `index.html` (TK-09.07) | `Referrer-Policy: no-referrer`; validar o formato do token; nenhum recurso de terceiros na página |
| Clickjacking | `frame-ancestors 'none'` e `X-Frame-Options: DENY` no `vercel.json` (TK-09.07) | `frame-ancestors 'none'` e `X-Frame-Options: DENY` |
| Recursos de terceiros em tempo de execução | Fontes servidas pelo próprio site (`@fontsource` em `styles/fonts.css`), CSP com `font-src 'self'` (TK-09.07) | Fontes hospedadas junto do site (D-25, decidida; TK-09.07) |
| Resposta da API fora do contrato | Usada sem verificação | Validação com Zod antes de chegar à tela (D-22, TK-09.03) |
| Segredo no JavaScript entregue | Nenhum hoje | Regra: `VITE_*` é público, nunca segredo |
| Dependência vulnerável | Sem verificação | `npm audit` na CI do frontend (TK-13.01) |
| Dado pessoal exposto | Telas mostram nome completo onde o colaborador vê a si mesmo | Primeiro nome nas telas do massoterapeuta; nada de dado pessoal em `console` ou erro técnico |

### O que é aceitável guardar no navegador

| Chave | Conteúdo | Por quê |
| --- | --- | --- |
| `userId` | UUID do usuário de demonstração | Identificação do protótipo (D-12); some com o login real |
| `theme` | Tema escolhido | Preferência de acessibilidade |
| `scene-paused` | Se a cena 3D do hero está pausada | Preferência de acessibilidade (D-24) |
| `sessionMinutes` | Duração descoberta | Evita tentativas na API |

Nada além disso sem atualizar esta tabela.

## Por que o código é assim

O código não tem comentários (o lint barra qualquer um, com a regra `local/no-comments`). O porquê das decisões que não cabem num nome fica aqui.

### Acessibilidade nas telas

- **Barra do dia é só visual.** A barra da reserva (faixas livres, indisponíveis, a sessão "fantasma" sob o ponteiro) tem `aria-hidden`, assim como a legenda e o eixo das horas. O caminho acessível pelo teclado e pelo leitor de tela são os horários, num único grupo de rádio (as setas passam por todos), separado em manhã, tarde e noite. Os títulos desses períodos também são `aria-hidden`: o período já vai no nome de cada horário ("Tarde, 14:00").
- **Título animado da agenda.** Cada palavra sobe de dentro de uma máscara, mas o `h2` leva o `aria-label` com a frase inteira e as palavras são `aria-hidden`. Com "reduzir movimento" o título já começa no lugar, porque o Motion não anula um deslocamento em porcentagem.
- **CTA do hero.** O texto que vai sendo "digitado" na pílula é só visual; o leitor de tela recebe a frase inteira de uma vez, como descrição da seta (`aria-describedby`). O botão "Reservar uma sessão" some ao ser pressionado, e o foco passa para a seta que o substitui.
- **Foco.** Títulos que recebem foco ao trocar de tela não ganham anel de foco, porque esse foco é só para o leitor de tela. Num diálogo que altera dados, o foco começa na opção que não altera nada.
- **Região viva.** É limpa antes de cada anúncio, para que a mesma frase seja anunciada de novo.
- **Inicial do avatar.** Vem do CSS (`::before`), para não entrar no texto visível do botão (2.5.3, o nome contém o rótulo).
- **Cena 3D do hero.** Decorativa e `aria-hidden`. As cores vêm dos tokens `--logo-*`, então acompanham o tema. Ela para de desenhar fora da tela e redesenha um quadro quando o tema muda com a animação parada.

### Ferramentas

- **`react/no-unknown-property` desligada** no lint: as props da cena do three.js e do Motion não são atributos do DOM e a regra as acusaria.
- **`optimizeDeps` com o three.js** no `vite.config.ts`: ele é importado sob demanda (`LogoWire`), e sem a pré-otimização o servidor de desenvolvimento recarrega a página no primeiro acesso.
- **`API_PROXY_TARGET`** acompanha o `PORT` do `backend/.env` (padrão 3000); em desenvolvimento e no `preview`, `/api` vai para o backend.

### Testes em navegador real

- **A cena 3D começa pausada** nos testes do Playwright, como se a pessoa tivesse usado "Pausar animação": sem GPU, o Chromium a desenha por software e, com vários workers, os testes estouram o tempo. Daí também `workers: "50%"`. A exceção é o teste de movimento reduzido, em que "reduzir movimento" sozinho precisa deixar a cena parada.
- **Contraste fora em `forced-colors`.** Com cores forçadas, quem escolhe as cores é a paleta do sistema, e o axe mede o contraste com a cor do tema (o Chromium não força `-webkit-text-fill-color`), não com a cor pintada. Por isso as regras de contraste ficam desligadas só nesse modo.
- **Antes do axe**, a página rola até o fim para disparar as entradas "ao aparecer na tela" e espera as animações terminarem, para medir o contraste com as cores finais.
- **Detector de movimento.** Acusa animação (posição que muda em quadros seguidos com a página parada) e paralaxe (posição que muda em muitos passos da rolagem). Um salto direto para a posição final não conta, e elementos `fixed`/`sticky` ficam de fora. Há um teste que confere que ele acusa as animações quando o movimento não é reduzido.
- **400% de zoom** numa janela de 1280 px equivale a 320 px de largura (reflow, 1.4.10).
- **Porta 4319** só para a suíte, fora da 4173 do `npm run preview`, para nunca testar um build antigo que já esteja no ar.

## Estado atual do código

O código veio do repositório `reservas-massagem`, foi ajustado à API deste repositório e funciona para o colaborador. **Não segue** o `AGENTS.md`. Decisão de 2026-10-27: **organizar e migrar para TypeScript no EP-09**, mantendo o comportamento e os testes que já existem. Ao mexer num trecho fora do EP-09, leve-o para a estrutura e as convenções do `AGENTS.md`.

| Hoje | Alvo |
| --- | --- |
| `api.ts` com tipos escritos à mão; resposta usada sem validar | `shared/api` tipado, com validação Zod das respostas (TK-09.03, D-22) |
| Rota lida com `window.location.pathname` e regex no `App.tsx` | React Router com rotas por papel, título e foco por rota (TK-09.04, D-21) |
| Hero, reserva e sessões numa página só | Landing page com destinos; reserva e sessões em rotas próprias (D-27, TK-10.01) |
| `shared/a11y` e `shared/ui` só com o que veio do antigo `ui.tsx` | Fundação completa: `SkipLinks`, `VisuallyHidden`, foco gerenciado (TK-09.05) |
| Contraste mínimo de AA; `letter-spacing` negativo no corpo; sem `forced-colors` | Tokens com contraste 7:1, `forced-colors`, alvos de 44 px, reflow a 400% (TK-09.06) |
| Script inline no `index.html`; `vercel.json` sem cabeçalhos de segurança; fontes do Google Fonts | CSP e cabeçalhos; script em arquivo; fontes hospedadas (TK-09.07, D-25) |
| axe só no jsdom (sem contraste) | Playwright + axe em navegador real, por tema, zoom e `forced-colors` (TK-09.08, D-26) |
| Comentários no código | Sem comentários e sem código morto (TK-09.09) |
| Cena 3D do hero sem botão de pausar | Botão de pausar visível (2.2.2), mantida a cena (D-24, TK-09.06) |
| Sem Prettier | Scripts de qualidade e CI (TK-09.09, TK-13.01) |
| Massoterapeuta, RH e suporte veem "a tela ainda não existe" | EP-11 e EP-12 |

## O que a API ainda não permite na tela

Lacunas anteriores da lista de espera foram resolvidas pelo backend TK-04.06/TK-04.09 em 2026-11-03.

| Falta | Afeta | Contorno hoje | Ticket no backend |
| --- | --- | --- | --- |
| Rota que diga ao colaborador a duração vigente da sessão | Reserva (RF-01, RF-02, TK-10.02) | Descoberta por tentativa (ver "Decisões tomadas") | TK-04.10 |
| Rota de unidades para o colaborador | Filtro por unidade (TK-10.02) | Unidades extraídas dos próprios horários | TK-03.10 |
| Consulta administrativa de unidades com IDs e nomes para RH | Criação de salas (TK-12.02) | Resolvido por `GET /locations/admin` protegido por RH | Backend TK-12.02 |
| Geração de QR Code local e origem pública canônica do check-in | Impressão de QR (TK-12.02) | Resolvido com `qrcode.react`, `window.location.origin` e `/check-in/:token`; token nunca vai a serviço externo | Decisão aplicada no TK-12.02 |

## Questões em aberto

| Questão | Afeta |
| --- | --- |
| Qual leitor de tela e aparelho os massoterapeutas usam? (`[PREENCHER]` no `requisitos.md`) | Matriz obrigatória de testes, TK-11.04 |
