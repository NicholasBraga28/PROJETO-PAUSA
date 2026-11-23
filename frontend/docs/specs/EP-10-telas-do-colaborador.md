# EP-10 — Telas do colaborador

Épico em `docs/roadmap.md`. Requisitos: RF-01, RF-02, RF-03, RF-04, RF-06, RF-07, RF-09, RN-01, RN-02, RN-05, RN-06, RN-07, RN-08, RN-09, RN-10, RN-04, RNF-04, RNF-05.

Dependências de API: TK-04.01 a TK-04.06, TK-04.09, TK-04.10, TK-03.10 e TK-05.02 estão ✅ no roadmap do backend.

## Objetivo

Decisao de produto (2026-11-03): entradas novas sao vinculadas ao terapeuta e unidade escolhidos. A oferta pode ser aceita ou recusada na secao Suas sessoes; a recusa avanca a fila.

Separar os fluxos do colaborador em páginas com rotas próprias e fornecer reserva, consulta/cancelamento de sessões, lista de espera e check-in. A API é a fonte de verdade para disponibilidade, duração, limites, estados, prazos e confirmação. Cada ação e resultado deve continuar compreensível sem visão, por teclado, toque ou leitor de tela.

As regras RN-01 a RN-11 permanecem com os valores atuais como provisórios, conforme orientação do produto. A validação dos valores aplicáveis continua em aberto; a interface não os fixa nem recalcula.

## Fora de escopo

- Login Google, sessão por cookie, envio de e-mail, lembrete externo ou push. O lembrete do colaborador é um card da próxima sessão, conforme decisão registrada no `backend/docs/requisitos.md`.
- Reagendamento atômico (RF-08), pagamento, avaliação e cadastro/edição de unidades.
- Captura de QR Code pela câmera dentro do site; o acesso ao check-in começa no link do QR Code impresso.
- Telas do massoterapeuta, RH ou suporte (EP-11/EP-12), inclusive critérios de uso validados com massoterapeutas.
- Mudanças no backend. Divergências de contrato encontradas ficam registradas como perguntas em aberto.

## Telas e rotas

Prefixo de API: `/api`. Todas as páginas do colaborador exigem perfil `EMPLOYEE`; usuário não autenticado passa pelo fluxo existente de entrada. `/accessibility` permanece disponível pela navegação global.

| Rota | Tela e ticket | Conteúdo principal |
| --- | --- | --- |
| `/` | Página inicial (TK-10.01) | `h1`, hero decorativo, card da próxima sessão e links reais para reservar, sessões, tela do perfil e acessibilidade. |
| `/book` | Horários e reserva (TK-10.02) | Seleção por unidade, massoterapeuta, dia e horário; confirmação da reserva. |
| `/sessions` | Suas sessoes (TK-10.03, TK-10.04) | Proximas e anteriores em listas ordenadas; lista de espera com entradas proprias, saida, aceite e recusa de oferta. |
| `/check-in/:token` | Check-in (TK-10.05) | Instrução e ação para confirmar presença usando o token opaco do QR Code. |
| `/accessibility` | Página de acessibilidade existente | Preferências e informações globais; fora das mudanças funcionais deste épico. |

A lista de espera fica na secao `/sessions`; a reserva tambem permite selecionar horarios ocupados que a API inclui em `waitlistSlots`.

## Contratos da API usados

Identificação de protótipo: `x-user-id`, enviada pelo cliente compartilhado da API. Autorização e propriedade dos dados são verificadas pelo backend, não pela interface. Respostas entram como `unknown` e são validadas por Zod antes de serem usadas.

### Perfil e página inicial

`GET /me` fornece `id`, `role`, `firstName`, `effectiveRoles` e `spokenText`; usado pelo fluxo existente de entrada/roteamento para confirmar que a pessoa é `EMPLOYEE`.

`GET /booking/appointments/next` retorna `200` com `appointment` ou `null` e `spokenText`. O card mostra data/hora, massoterapeuta, sala e status a partir da sessão estruturada. A fala de sucesso usa o `spokenText` do backend; sem próxima sessão, o card apresenta o estado vazio correspondente.

### Horários e reserva

`GET /locations` não recebe parâmetros. Retorna `200` com uma lista de unidades ativas, ordenada por nome, cada item com `code`, `name` e `timezone` (IANA). Lista vazia é `[]`. Só `EMPLOYEE` pode consultar.

`GET /booking/availability?from=<ISO>&to=<ISO>&locationCode=<code>&therapistId=<uuid>&durationMinutes=<n>` aceita `from` e `to` obrigatórios; os demais filtros são opcionais. Sem `durationMinutes`, a API usa a duração vigente. Retorna `therapists`, `slots` em ordem cronológica, `sessionDurationMinutes` e `spokenText`. Cada slot contém início/fim ISO em UTC, IDs e nomes de massoterapeuta/sala e os dados de unidade/fuso necessários para apresentação. `slots: []` é uma resposta `200`, não erro.

`POST /booking/appointments` recebe `therapistId`, `roomId`, `startsAt` e `endsAt` (ISO 8601). Retorna `201` com a reserva em `CONFIRMED`, os dados necessários para a confirmação e `spokenText` da reserva. Mensagem de confirmação vigente na API: “Reserva confirmada para {data/hora}, com {primeiro nome}, na {sala}.” Para o MSG-02, a confirmação é destinada ao colaborador que reservou; a interface mostra as ações “Ver minhas sessões” e “Fechar”.

Erros de disponibilidade/reserva: `400` com `invalidPeriod`, `invalidDuration`, `outsideOperatingHours`, `outsideBookingHorizon`, `bookingNotice`, `outsideAvailability` ou `invalidRoom`, conforme a causa; `401 notIdentified`; `403 accessDenied`; `409 activeBookingLimit` ou `unavailable`. Textos vêm do catálogo, por exemplo: “A antecedência mínima para agendamento não foi respeitada.”, “Você já tem o máximo de reservas futuras. Cancele uma para agendar outra.” e “O horário não está disponível.”

### Sessões e cancelamento

`GET /booking/appointments` retorna `{ upcoming, past, spokenText }`. As listas contêm sessões próprias com `id`, `startsAt`, `endsAt`, `status`, nomes de massoterapeuta/sala e `locationCode`; ambas vêm ordenadas por início crescente. A API pode receber filtros `status`, `from`, `to` e `includePast`.

`DELETE /booking/appointments/:id` não recebe body. Retorna `200` com a sessão atualizada e `spokenText`. Só a sessão do colaborador identificado pode ser alterada. Erros: `401 notIdentified`, `403 accessDenied`, `404 appointmentNotFound`, `400 cancellationNotice` e `409 appointmentCannotCancel`.

### Lista de espera

`GET /booking/availability` inclui `waitlistSlots` para periodos ocupados por agendamento, sem dados do colaborador. Bloqueios administrativos nao sao elegiveis.

- `POST /booking/waitlist` exige `desiredStartsAt`, `desiredEndsAt`, `therapistId` e `locationId`; so aceita periodo ocupado por agendamento e rejeita o proprio agendamento.
- `GET /booking/waitlist` retorna apenas as entradas proprias, com status, periodo, oferta, `therapistId`, `therapistName`, `locationId`, `locationName` e `spokenText`. Entradas antigas podem retornar metadados nulos.
- `DELETE /booking/waitlist/:id` remove a entrada propria ativa; se estiver `NOTIFIED`, encaminha a oferta ao proximo da fila.
- `POST /booking/waitlist/:id/accept` aceita uma oferta propria ainda valida. `POST /booking/waitlist/:id/decline` recusa oferta `NOTIFIED`, marca `DECLINED` e avanca a fila.

### Check-in

`POST /booking/check-in/:token` não recebe body. O token do caminho é opaco; resposta `200` inclui status `CHECKED_IN`, timestamp e `spokenText` da confirmação. Erros: `401 notIdentified`, `403 accessDenied`, `404 invalidCheckIn`, `noAppointmentForRoom`, `checkInTooEarly` ou `lateCheckIn`; `409 checkInUnavailable` em conflito de estado. Nenhuma tela ou log deve repetir o token.

### Dados e mensagens

Não há mudança de modelo no frontend. `AppointmentStatus` e `WaitlistStatus` são uniões fechadas validadas por Zod. O frontend consome datas/timestamps UTC e os fusos das unidades; não calcula regras de negócio. A mensagem de êxito para reservar, cancelar, check-in e oferta é a `spokenText` correspondente devolvida pelo backend. Erros visíveis usam as mensagens do catálogo, nunca corpo bruto, stack trace ou código HTTP como único texto.

## Estados por tela

| Tela | Carregando | Vazio | Erro e recuperação |
| --- | --- | --- | --- |
| Página inicial | Anunciar “Carregando sua próxima sessão” se a consulta demorar; preservar foco. | `appointment: null`: mostrar mensagem curta e link “Reservar horário”. | Mensagem de catálogo/erro acessível junto ao card e botão “Tentar novamente”. Destinos continuam disponíveis. |
| Reserva | Carregar unidades, horarios livres e horarios ocupados para lista de espera; indicar filtros em carregamento. | Sem slots livres, mostrar o `spokenText`; dias com `waitlistSlots` continuam selecionaveis para pedir espera. | Erro proximo do passo afetado; conflito 409 oferece entrada para o horario selecionado. |
| Suas sessões | Carregar próximas, anteriores e entradas da lista de espera sem deslocar o foco. | Próximas vazias e histórico vazio: informar “Você não tem agendamentos.”; se apenas uma lista estiver vazia, identificar qual. Lista vazia explica que a entrada é oferecida após uma tentativa de reserva indisponível e mantém um link para horários. | Erro próximo da lista afetada, com “Tentar novamente”; manter as demais seções quando somente uma consulta falhar. Oferta expirada/indisponível atualiza o item. |
| Check-in | Validar o formato do token localmente e mostrar instrução/ação; anunciar envio e conclusão uma vez. | Token inválido não chama a API; exibir instrução para ler novamente o QR Code. | Usar mensagem do catálogo, com foco no erro que impede a tarefa e ação clara para voltar ou tentar outra leitura. Não mostrar o token. |

## Critérios de aceite (Dado / Quando / Então)

### TK-10.01 — Página inicial (RF-09)

- **Dado** um colaborador autenticado, **Quando** abre `/`, **Então** encontra um `h1`, um card da próxima sessão com data/hora, massoterapeuta e sala e links reais para reserva, sessões, perfil e acessibilidade.
- **Dado** uma próxima sessão retornada pela API, **Quando** a página termina de carregar, **Então** apresenta os dados estruturados no card e anuncia uma vez o `spokenText` devolvido pelo backend.
- **Dado** `appointment: null`, **Quando** a página termina de carregar, **Então** mostra o estado vazio e o destino para reservar sem apresentar um card falso.
- **Dado** qualquer rota da página inicial, **Quando** a pessoa ativa um link de destino, **Então** navega para uma rota própria com título de documento e foco no `h1`.
- **Dado** tema, preferência de movimento reduzido ou cores forçadas, **Quando** a landing page é exibida, **Então** a cena 3D continua decorativa, não interfere na leitura e pode ser pausada por controle acessível.

### TK-10.02 — Horários disponíveis e reserva (RF-01, RF-02)

- **Dado** um colaborador autenticado, **Quando** abre `/book`, **Então** a tela carrega unidades de `GET /locations` e disponibilidade de `GET /booking/availability`, sem descobrir duração por tentativas.
- **Dado** unidades, massoterapeutas e horários disponíveis, **Quando** percorre as etapas de unidade, massoterapeuta, dia e horário, **Então** cada etapa informa sua seleção atual e apresenta os slots em ordem cronológica, como frases completas com data, hora, massoterapeuta e sala.
- **Dado** um horário selecionado, **Quando** confirma a reserva, **Então** envia a seleção de IDs e timestamps para `POST /booking/appointments` e só mostra sucesso após `201`.
- **Dado** uma reserva confirmada, **Quando** a API responde, **Então** mostra os detalhes e ações MSG-02 (“Ver minhas sessões” e “Fechar”) e anuncia o `spokenText` atual da API na região viva.
- **Dado** uma tentativa de reserva cujo horário foi ocupado desde a consulta de disponibilidade, **Quando** `POST /booking/appointments` retorna conflito por indisponibilidade, **Então** informa explicitamente “Este horário já está reservado ou ficou indisponível”, explica que lista de espera significa aguardar uma oferta se esse horário for liberado e oferece entrar nela para o intervalo e massoterapeuta escolhidos.
- **Dado** que o colaborador aceita entrar na lista após esse conflito, **Quando** confirma a ação, **Então** envia `POST /booking/waitlist` com `desiredStartsAt`, `desiredEndsAt` e `therapistId` escolhido, consulta `GET /booking/waitlist` e anuncia o `spokenText` da entrada sem criar reserva.
- **Dado** disponibilidade vazia ou erro de regra de negócio diferente do conflito de indisponibilidade, **Quando** a tela recebe `slots: []` ou um erro, **Então** apresenta o estado adequado e a mensagem do catálogo perto dos filtros/ação, sem selecionar slot indisponível nem oferecer entrada sem um horário selecionado.
- **Dado** a duração vigente ou o fuso da unidade alterado no backend, **Quando** a interface recebe nova resposta, **Então** atualiza opções e apresentação sem regra duplicada no cliente.

### TK-10.03 — Suas sessões e cancelamento (RF-07, RF-03)

- **Dado** sessões futuras e anteriores, **Quando** abre `/sessions`, **Então** vê listas separadas, ordenadas pelo backend, com data, hora local da unidade, massoterapeuta, sala e status textual.
- **Dado** uma lista de espera existente ou vazia, **Quando** abre `/sessions`, **Então** encontra uma seção identificada “Lista de espera” após as listas de sessões, com estados próprios de carregamento/vazio/erro e sem uma rota ou página separada.
- **Dado** uma sessão cancelável, **Quando** ativa “Cancelar sessão”, **Então** abre diálogo de confirmação que descreve qual sessão será cancelada e oferece “Voltar” como ação inicial de foco.
- **Dado** confirmação explícita, **Quando** a tela envia `DELETE /booking/appointments/:id`, **Então** atualiza as listas, anuncia o `spokenText` retornado e move o foco para a próxima sessão ou para o título da lista vazia.
- **Dado** que o backend recusa por prazo ou estado, **Quando** o cancelamento falha, **Então** a sessão permanece visível e o erro do catálogo explica o motivo e como prosseguir.

### TK-10.04 — Lista de espera integrada ao fluxo de reserva e às sessões (RF-04, RN-10)

- **Dado** que a confirmação de um horário selecionado retorna conflito de indisponibilidade, **Quando** a API informa que ele não está disponível, **Então** a tela enfatiza que o horário já está reservado ou indisponível, esclarece que lista de espera significa aguardar uma oferta caso ele seja liberado e oferece entrar para aquele período e massoterapeuta.
- **Dado** que o colaborador escolhe entrar na fila após o conflito, **Quando** ativa a ação, **Então** envia `POST /booking/waitlist` com o período selecionado e massoterapeuta, atualiza por `GET /booking/waitlist` e anuncia o `spokenText` da entrada; não cria agendamento.
- **Dado** entradas próprias em qualquer estado, **Quando** consulta a seção “Lista de espera” dentro de `/sessions`, **Então** vê apenas as próprias entradas na ordem do backend e o texto correspondente ao estado; não existe tela/rota independente para a fila.
- **Dado** uma entrada `WAITING` ou `NOTIFIED` na seção de `/sessions`, **Quando** escolhe sair e confirma, **Então** chama `DELETE /booking/waitlist/:id`, atualiza a lista e anuncia o resultado sem manter a entrada como ativa.
- **Dado** uma oferta `NOTIFIED` ainda válida na seção de `/sessions`, **Quando** aceita, **Então** chama `POST /booking/waitlist/:id/accept`, atualiza a lista e as próximas sessões para refletir a conversão, anunciando o estado atualizado pelo backend.
- **Dado** uma oferta com `offerExpiresAt`, **Quando** a interface a apresenta, **Então** mostra o prazo em data/hora legível, anuncia-o como texto e não dispara anúncio de contagem regressiva.
- **Dado** oferta expirada ou indisponível, **Quando** a API retorna erro, **Então** a tela atualiza a lista e apresenta a mensagem do catálogo sem oferecer aceite como se ainda fosse possível.

- **Dado** que ha horarios ocupados por agendamento em `waitlistSlots`, **Quando** escolhe dia, unidade, massoterapeuta e horario, **Entao** pode solicitar entrada na fila com confirmacao, sem depender de uma corrida de reserva.
- **Dado** uma oferta `NOTIFIED`, **Quando** escolhe aceitar ou recusar e confirma, **Entao** a API atualiza o estado, apresenta unidade e massoterapeuta e, ao recusar, avanca a fila.
- **Dado** que a API informa periodos ocupados em `waitlistSlots`, **Quando** o colaborador seleciona um horario, **Entao** pode pedir entrada na lista por terapeuta e unidade sem depender de conflito concorrente.
- **Dado** uma oferta `NOTIFIED`, **Quando** o colaborador aceita ou recusa e confirma, **Entao** a API atualiza a entrada; a recusa avanca a fila.
### TK-10.05 — Check-in por QR Code (RF-06)

- **Dado** um token no caminho `/check-in/:token`, **Quando** o colaborador abre a página e está autenticado, **Então** vê uma instrução curta e botão nomeado “Fazer check-in”, sem abrir câmera no site.
- **Dado** que o usuário aciona “Fazer check-in”, **Quando** confirma a ação, **Então** a tela envia `POST /booking/check-in/:token` sem body e anuncia o `spokenText` da confirmação quando recebe `200`.
- **Dado** token inválido, fora da janela, atraso excedido ou estado concorrente, **Quando** a API rejeita o check-in, **Então** mostra a mensagem específica do catálogo em texto, junto da ação de retorno/tentativa permitida, sem revelar o token.
- **Dado** que o check-in foi confirmado, **Quando** a resposta chega, **Então** a tela apresenta o estado “Check-in confirmado” também em texto e impede envio duplicado enquanto a requisição está em andamento.

## Acessibilidade

### Foco e ordem

- Cada rota tem um único `h1`, título de página próprio e foco inicial no `h1` na navegação; conteúdo carregado depois não rouba foco.
- A ordem do DOM corresponde à ordem visual e de leitura. Seletores seguem a sequência unidade → massoterapeuta → dia → horário → confirmar.
- Diálogos usam React Aria/APG, focam “Voltar” ao abrir e retornam foco ao controle que abriu ao fechar. Após remoção/cancelamento, foco vai ao próximo item ou ao título da lista vazia, nunca ao `body`.
- Erro que impede uma ação posiciona foco no resumo/erro relevante. Erros comuns e confirmações anunciam sem deslocar foco.

### Anúncios e leitor de tela

- Uma região viva compartilhada `role="status"`, `aria-live="polite"`, `aria-atomic="true"` anuncia cada `spokenText` uma única vez. `role="alert"` fica reservado a erros que impedem a tarefa.
- `spokenText` do backend não é reescrito nem duplicado com anúncio equivalente. A informação principal vem primeiro.
- Carregamentos longos anunciam início e fim; atualizações periódicas/reloads não repetem fala nem reorganizam conteúdo sob o cursor.
- Roteiro do PR: NVDA com Chrome e Firefox; no fim do épico, também TalkBack/Chrome Android e VoiceOver/Safari iOS e macOS conforme a matriz de `docs/acessibilidade.md`. A combinação definitiva do dispositivo do massoterapeuta continua ligada ao TK-14.01, fora deste épico.

### Nomes, teclado e toque

- Todo link e botão tem nome acessível que contém o texto visível. Ações repetidas incluem contexto (“Cancelar sessão de terça, às 14h”). Ícones e cena são decorativos/ocultos da árvore acessível.
- Etapas de escolha usam grupos de rádio React Aria: Tab entra/sai do grupo e setas alteram a opção segundo APG. A barra visual do dia não duplica controles nem informação (`aria-hidden`).
- Todas as tarefas são completáveis por teclado sem armadilha, hover, arrasto ou gesto complexo; toque tem alvos de ao menos 44 × 44 px e distância suficiente para uma mão.
- Estados/status são texto, nunca apenas cor ou ícone. Status `Appointment`/`WaitlistEntry` deve ser apresentado em português claro junto ao valor de negócio.

### Contraste, zoom e movimento

- Texto atende contraste 7:1 (texto grande 4,5:1); componentes e foco atendem 3:1 em temas claro, escuro, alto contraste e `forced-colors`. Informação nunca depende apenas de cor.
- A 200% de zoom não há perda de conteúdo ou função; a 400%/320 px há reflow sem rolagem horizontal, controles se reorganizam sem alterar a ordem e texto respeita espaçamento ampliado.
- Respeitar `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme` e `forced-colors`. A animação do hero tem botão visível e operável para pausar, e começa/respeita estado reduzido.
- Testes incluem axe em cada tela e Playwright nos temas, zoom de 400%, `forced-colors` e navegação só por Tab, conforme a suíte do EP-09.

## Segurança e privacidade

- Todas as rotas de colaborador exigem sessão/perfil e papel `EMPLOYEE`; a API repete autorização e verifica propriedade em reserva, listagem, cancelamento, fila e check-in. Não confiar em controles escondidos no cliente para autorização.
- O protótipo usa `x-user-id`; isso permite impersonação e é risco conhecido e aceito somente no protótipo. Não persistir tokens de autenticação; armazenamento atual do user ID fica isolado na camada de sessão.
- Validar respostas externas por Zod. Mensagem de erro mostra somente texto amigável do catálogo; não expor stack, resposta bruta, SQL, IDs de outros usuários ou detalhes pessoais em console/analytics.
- Token QR é dado sensível de acesso: validar seu formato, codificar com `encodeURIComponent` no request, não renderizá-lo, registrá-lo em logs/analytics ou enviar URL como referrer. Manter `Referrer-Policy: no-referrer`; não adicionar scripts de terceiros.
- `spokenText` é texto simples. Nunca renderizar resposta de API como HTML; não incluir e-mail, token QR ou dado de saúde em tela/mensagem.
- A UI nunca solicita câmera para o check-in. O colaborador lê o QR pelo leitor do dispositivo e chega ao site por link HTTPS.

## Perguntas em aberto

- Resolvido em 2026-11-03: `GET /booking/availability` inclui `waitlistSlots` com periodos ocupados por agendamento, sem dados pessoais.
- Resolvido em 2026-11-03: entrada nova exige terapeuta e unidade; a listagem informa os respectivos nomes.
- Resolvido em 2026-11-03: recusa explicita usa `POST /booking/waitlist/:id/decline` e avanca a fila.
- Permanece em aberto: contrato para a janela maxima de reserva RN-07 sem duplicar a regra no frontend.
- Permanece em aberto: valores provisórios de RN-10 e demais regras devem ser validados com RH/produto.
- Permanece em aberto: `POST /booking/waitlist` nao devolve `spokenText`; a tela atualiza a lista e anuncia o texto retornado em `GET /booking/waitlist`.

### Ajuste de sessoes e calendario da reserva (2026-11-03)
`GET /booking/appointments` coloca em `upcoming` somente atendimentos com status ativo. Status finais, como `CANCELLED` e `RELEASED`, ficam no historico mesmo quando a data prevista ainda esta no futuro; eles nao entram no total nem no card de proximo atendimento.

Na reserva, periodos elegiveis para espera aparecem no mesmo seletor de horarios, marcados como `Indisponivel`. Ao selecionar um deles, a acao permite aguardar uma vaga e pede confirmacao. Nao existe uma secao separada de horarios ocupados.