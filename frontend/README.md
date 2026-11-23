# Pausa · frontend

Site de reservas do colaborador, em React. Veio do repositório `reservas-massagem` e foi ajustado à API deste repositório: **o backend é a fonte da verdade**, e a tela só mostra o que a API devolve.

## Como rodar

Com o backend no ar (veja `backend/AGENTS.md`: `docker compose up -d`, `npm run prisma:deploy`, `npm run db:seed-demo`, `npm run start:dev`):

```bash
cd frontend
npm install
cp .env.example .env   # ajuste API_PROXY_TARGET para a porta do PORT em backend/.env
npm run dev            # http://localhost:5173
```

Em dev, o Vite repassa `/api` para `API_PROXY_TARGET` (padrão `http://localhost:3000`). Em produção, defina `VITE_API_URL` antes do `npm run build` se a API estiver em outro endereço.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` / `npm run preview` | Versão de produção em `dist/` / servida localmente com os cabeçalhos de segurança do `vercel.json` (CSP etc.) |
| `npm test` | Testes de tela com axe-core (jsdom + Testing Library) , das funções puras ao lado de cada arquivo e das fronteiras entre pastas (`eslint.config.test.ts`) |
| `npm run lint` | ESLint com `jsx-a11y` no modo estrito e regras dos hooks |
| `npm run typecheck` | TypeScript strict (`tsc --noEmit`) no `src/`, no `vite.config.ts` e no `eslint.config.test.ts` |

## Telas

- **Entrar como… (D-12):** lista os usuários ativos de `GET /auth/demo-users`, agrupados por papel. A escolha fica no navegador e vai no cabeçalho `x-user-id`. O perfil vem de `GET /me` e decide a tela (roteamento por papel).
- **Colaborador:**
  - hero com o card da próxima sessão (RF-09, `GET /booking/appointments/next`) e o atalho para o próximo horário livre;
  - reserva em etapas: unidade, terapeuta, dia, horário e confirmação (`GET /booking/availability`, `POST /booking/appointments`);
  - suas sessões, com cancelamento confirmado num diálogo (`GET /booking/appointments`, `DELETE /booking/appointments/:id`).
- **Check-in (RF-06):** `/check-in/<token da sala>`, a página aberta pelo QR Code (`POST /booking/check-in/:token`). Token fora do formato não chega à API: a tela diz que o QR Code é inválido. Quem abre o QR Code sem ter entrado volta a ele depois de escolher o usuário.
- **Massoterapeuta, RH e suporte:** aviso de que a tela do perfil ainda não existe (EP-11 e EP-12).

## Rotas (React Router, D-21)

Cada papel tem a sua área: colaborador em `/` (também `/book` e `/sessions`, que por enquanto mostram a mesma página até o TK-10.01, e `/check-in/:token`), massoterapeuta em `/therapist`, RH em `/hr` e suporte em `/admin`. Quem abre a rota de outro papel é levado à própria área com uma frase explicando. `/sign-in` e `/accessibility` não dependem do papel. A cada troca de rota feita pela pessoa, inclusive com voltar e avançar do navegador, o foco vai para o `h1` (na carga da página, e nos redirecionamentos dela, o foco fica no topo) (links para uma seção da mesma página, como o de pulo, não movem o foco) e o `document.title` vira `"<Tela> · Pausa"` (`app/RouteFocus.tsx`). O `vercel.json` manda todas as rotas para o `index.html`.

## Como a tela se encaixa no backend

- **Duração da sessão:** é uma regra de negócio que só o RH lê. O frontend descobre a vigente perguntando pelos horários de um intervalo de um minuto, porque a API recusa qualquer duração diferente ("A duração informada é inválida."). Guarda o valor no navegador e começa por ele na próxima vez; se o RH mudar a regra, a descoberta roda de novo.
- **Expediente, intervalo e dias abertos:** não ficam fixos no frontend. A barra do dia e a lista de horários saem dos slots que a API devolve.
- **Fuso:** datas e horas aparecem no fuso das unidades (`America/Sao_Paulo`), o mesmo das frases do backend.
- **Mensagens:** erros e confirmações mostram o texto do backend. O `spokenText` das respostas é anunciado na região `aria-live="polite"`; `announce(texto, { urgent: true })` usa a região `assertive`, reservada a avisos urgentes ao massoterapeuta.
- **O que saiu da versão anterior:** e-mail e telefone no formulário (a API não recebe), a "confirmação por e-mail" (não existe), a duração fixa de 30 minutos e o expediente fixo das 9h às 18h.

## Acessibilidade (RN-04, meta WCAG 2.2 AA)

- Links de pulo (`SkipLinks`, por padrão só "Pular para o conteúdo", configuráveis por tela), landmarks (`nav`, `header`, `main`) e um `h1` por tela. O link leva o foco à região, e não só a rolagem.
- Ao trocar de tela, o foco vai para o título; na carga da página ele fica no topo, e o primeiro Tab chega em "Pular para o conteúdo". Num diálogo que altera dados, o foco começa em "Voltar".
- Seletores (unidade, terapeuta, dia, horário, tema) são grupos de rádio do React Aria: Tab e setas, anunciados pelo leitor de tela. A barra do dia é só visual; a lista de horários é o caminho acessível.
- Cancelar pede confirmação num diálogo modal (`alertdialog`) com o foco preso e Esc para fechar; enquanto confirma, o foco fica no botão e nem Esc nem nova confirmação têm efeito. Depois de cancelar, o foco vai para a próxima sessão, ou para o título "Próximas" se a lista ficou vazia (`useFocusAfterRemoval`).
- Temas claro, escuro e alto contraste. O anel de foco (`--focus`) tem contraste de 3:1 ou mais contra o fundo em cada tema.
- "Reduzir movimento" do sistema desliga deslocamentos e as cenas 3D.
- O texto "digitado" do hero é só visual; o leitor de tela recebe a frase inteira.
- `npm test` roda o axe-core em todas as telas e no diálogo (sem a regra de contraste, que o jsdom não calcula); `npm run lint` roda o `jsx-a11y` estrito.

## O que a API ainda não permite na tela

- **Lista de espera (RF-04):** entrar na fila funciona (`POST /booking/waitlist`), mas não há rota para listar as entradas do colaborador, e o aviso de vaga (`WAITLIST_VACANCY`) não traz o ID da entrada, que é preciso para aceitar.
- **Unidades:** não há rota de unidades para o colaborador; as unidades saem dos próprios horários.

## Identidade visual

Open Sans em todo o site, títulos em negrito semicondensado; Instrument Serif só no título do hero. Paleta `#5A179A`, `#A07BF6`, `#CBBAFF`, `#DED6FF` e `#FFFFFF`, com as cores de cada tema em `src/styles/themes.css`, ajustadas para 7:1 no texto (`npm run check:contrast`).
