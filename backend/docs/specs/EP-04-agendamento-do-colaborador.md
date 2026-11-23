# EP-04 — Agendamento do colaborador

Status: ⬜ Planejada  
Marco: M2  
Épico: EP-04 · Roadmap: `docs/roadmap.md`  
Tickets: TK-04.01 a TK-04.10
Requisitos: RF-01, RF-02, RF-03, RF-04, RF-07, RF-08, RF-09, RN-01, RN-05, RN-06, RN-07, RN-08, RN-10, RN-12, RNF-01, RNF-04, RNF-05

Fonte de verdade: `docs/requisitos.md`. Onde esta spec e `docs/requisitos.md` divergirem, vale `docs/requisitos.md`.

## Objetivo

Permitir que o colaborador consulte horários disponíveis, faça e cancele reservas, consulte seus próprios agendamentos, entre ou saia da lista de espera e receba uma oferta de vaga dentro do sistema.

O backend continua sendo a fonte da verdade para disponibilidade, concorrência, prazos, limites de reservas, auditoria e transições de estado. A reserva nasce `CONFIRMED` no protótipo. O `RF-08` permanece rastreável, mas está fora do MVP: para trocar de horário, o colaborador cancela a sessão atual e faz uma nova reserva.

Os valores iniciais das regras usados nesta spec são provisórios: RN-01 (60 minutos para agendar e 120 para cancelar), RN-05 (20 minutos), RN-06 (1 reserva futura ativa), RN-07 (21 dias) e RN-10 (30 minutos para aceitar oferta). A política usa os parâmetros vigentes de `BusinessRules`; estes números documentam apenas a configuração atual no código e ainda dependem de validação do grupo/RH.

## Fora de escopo

- Reagendamento atômico; para o MVP, cancelar e reservar novamente (`RF-08`, decisão D-03).
- Envio de e-mail, SMS, WhatsApp ou Telegram para confirmação ou oferta de vaga.
- Login Google; a identificação continua sendo feita por `x-user-id` no protótipo.
- Tela React do colaborador, pertencente ao EP-10.
- Check-in por QR Code, pertencente ao EP-05.
- Lembrete falado da Alexa, pertencente ao EP-07.
- Feedback, Google Calendar e notificações externas.

## Contrato comum

As rotas abaixo usam o prefixo global `/api`.

Todas as rotas exigem identificação por `x-user-id` e papel `EMPLOYEE`, salvo quando indicado. O colaborador só pode consultar ou alterar seus próprios agendamentos e entradas na fila. A resposta de erro HTTP do NestJS contém `statusCode` e `message`; o campo `path` do exemplo é ilustrativo do contrato pretendido pelo frontend, pois não é garantido pelo filtro global atual.

Formato de data de entrada: ISO 8601 com timezone. Datas são persistidas em UTC. A interpretação de dia civil e horário de funcionamento usa o timezone da unidade, atualmente `America/Sao_Paulo`.

Erros seguem o formato global do NestJS (`statusCode`, `message`, `path`) e usam as chaves e textos de `src/messages/catalog.ts`:

```json
{
  "statusCode": 409,
  "message": "O horário não está disponível.",
  "path": "/api/booking/appointments"
}
```

Mensagens do catálogo aplicáveis ao EP-04 (chave → texto atual):

- `invalidPeriod` → “O período informado é inválido.”
- `invalidDuration` → “A duração informada é inválida.”
- `outsideOperatingHours` → “O período está fora do funcionamento ou coincide com o almoço.”
- `outsideBookingHorizon` → “O período está fora da janela de agendamento.”
- `locationNotFound` → “A unidade selecionada não foi encontrada. Confira a unidade e tente novamente.”
- `therapistNotFound` → “Massoterapeuta não encontrado.”
- `therapistInactive` → “O massoterapeuta selecionado está inativo.”
- `notIdentified` → “Você ainda não se identificou: escolha um usuário na tela de entrada.”
- `accessDenied` → “Seu perfil não tem acesso a esta função: volte para a página inicial.”
- `activeBookingLimit` → “Você já tem o máximo de reservas futuras. Cancele uma para agendar outra.”
- `bookingNotice` → “A antecedência mínima para agendamento não foi respeitada.”
- `cancellationNotice` → “A antecedência mínima para cancelamento não foi respeitada.”
- `outsideAvailability` → “O período não pertence à disponibilidade do massoterapeuta.”
- `unavailable` → “O horário não está disponível.”
- `appointmentNotFound` → “Agendamento não encontrado.” (também para recurso de outro colaborador, sem revelar sua existência)
- `appointmentCannotCancel` → “O agendamento não pode mais ser cancelado.”
- `waitlistEntryNotFound` → “Entrada da lista de espera não encontrada.”
- `waitlistAlreadyJoined` → “Você já está na lista de espera para este horário.”
- `waitlistOfferExpired` → “A oferta da vaga expirou.”
- `waitlistOfferUnavailable` → “A vaga já foi aceita por outra pessoa ou não está mais disponível.”
- `availability.noSlots` → “Não há horários disponíveis.”
- `booking.confirmed` → “Reserva confirmada para {data/hora}, com {primeiro nome}, na {sala}.”
- `booking.cancelled` → “Agendamento cancelado para {data/hora}, com {primeiro nome}, na {sala}.”
- `appointments.empty` → “Você não tem agendamentos.”; `appointments.upcoming` e `appointments.past` resumem próximos e anteriores.
- `nextAppointment.empty` → “Você não tem próxima sessão agendada.”; `nextAppointment.summary` informa data/hora, terapeuta e sala.
- `waitlist.waiting`, `waitlist.converted`, `waitlist.expired` e `waitlist.cancelled` anunciam o status e o horário da entrada.
- `waitlist.offer` descreve o horario, massoterapeuta, unidade e prazo, e direciona para Suas sessoes, onde a oferta pode ser aceita ou recusada.

## Contrato da API

### TK-04.01 — Horários disponíveis

#### `GET /booking/availability`

Query params de `GET /booking/availability`:

- `from`: início do intervalo ISO 8601, obrigatório;
- `to`: fim do intervalo ISO 8601, obrigatório;
- `locationCode`: `SAO_PAULO` ou `LONDRINA`, opcional;
- `therapistId`: UUID do massoterapeuta, opcional.
- `durationMinutes`: duração a consultar, opcional; quando omitida, usar a duração vigente da regra de negócio.


A resposta inclui `waitlistSlots` com horarios ocupados por agendamento para entrada na fila. Nao inclui dados pessoais de quem reservou; periodos bloqueados administrativamente nao aparecem nessas opcoes.
Resposta `200 OK`:

```json
{
  "therapists": [
    { "id": "uuid", "name": "Ana Souza" }
  ],
  "slots": [
    {
      "therapistId": "uuid",
      "therapistName": "Ana Souza",
      "roomId": "uuid",
      "roomName": "Sala 1",
      "locationCode": "SAO_PAULO",
      "startsAt": "2026-10-21T12:00:00.000Z",
      "endsAt": "2026-10-21T12:20:00.000Z"
    }
  ],
  "sessionDurationMinutes": 20,
  "spokenText": "Há 1 horário disponível. Quarta-feira, às 9h, com Ana Souza."
}
```

`sessionDurationMinutes` informa a duração configurada vigente, independentemente do valor enviado em `durationMinutes`, para a interface exibir a regra atual. Os horários devem ser derivados de `ScheduleSlot`, removendo sessões, bloqueios e conflitos existentes. A lista vem em ordem cronológica por `startsAt ASC`, e os filtros são aplicados no backend. A duração de 20 minutos no exemplo é provisória.

Sem slots ou sem correspondência para os filtros: mantém `200 OK`, `slots: []` e `spokenText` igual a `messages.availability.noSlots` (“Não há horários disponíveis.”). Erros: `400` (`invalidPeriod`, `invalidDuration`, `outsideOperatingHours` ou `outsideBookingHorizon`) para período, duração, funcionamento ou janela inválidos; `401` (`notIdentified`) sem identificação e `403` (`accessDenied`) para perfil sem permissão. `locationCode` deve ser valor válido do enum; não se distingue na resposta uma unidade ou terapeuta sem slots correspondentes.

### TK-04.02 — Reservar horário

#### `POST /booking/appointments`

Body `CreateAppointmentDto`:

```json
{
  "therapistId": "uuid",
  "locationId": "uuid",
  "roomId": "uuid",
  "startsAt": "2026-10-21T12:00:00.000Z",
  "endsAt": "2026-10-21T12:20:00.000Z"
}
```

Resposta `201 Created`: o `Appointment` criado, com `status: "CONFIRMED"`, `employeeId` igual ao usuário identificado e dados do terapeuta, sala e unidade necessários à interface, além de `spokenText` conforme `messages.booking.confirmed` (“Reserva confirmada para {data/hora}, com {primeiro nome}, na {sala}.”).

Validações: antecedência mínima, janela máxima, duração configurada, agenda, horário de funcionamento, ausência de bloqueio, limite de reservas ativas e sobreposição. A operação precisa ser serializável ou usar outra proteção equivalente para que duas reservas simultâneas não ocupem o mesmo horário.

Emite `appointment.booked`, cria auditoria e cria as notificações internas previstas para a reserva.

Erros: `400` para regra temporal ou horário fora da disponibilidade; `409` para limite de reservas ou conflito de concorrência.

### TK-04.03 — Cancelar reserva

#### `DELETE /booking/appointments/:id`

Sem body. O ator é o colaborador identificado pelo cabeçalho.

Resposta `200 OK` com a representação atualizada da sessão e `spokenText`, sem expor dados de outro colaborador. A sessão passa a `CANCELLED`, registra `cancelledAt` e `cancelledById`, emite `appointment.cancelled` e cria a auditoria.

O cancelamento respeita a antecedência mínima configurada em `CANCELLATION_MIN_NOTICE_MINUTES`.

Erros: `404` (`appointmentNotFound`) para sessão inexistente ou pertencente a outro usuário; `400` (`cancellationNotice`) para antecedência mínima não respeitada; `409` (`appointmentCannotCancel`) para disputa de atualização ou transição indisponível.

### TK-04.04 — Meus agendamentos

#### `GET /booking/appointments`

Query params de `GET /booking/appointments`:

- `status`: status de sessão;
- `from` e `to`: intervalo ISO 8601;
- `includePast`: booleano opcional; `false` exclui o histórico, enquanto omitido (padrão atual) inclui próximos e anteriores.

Resposta `200 OK`:

```json
{
  "upcoming": [],
  "past": [],
  "spokenText": "Você tem 1 próximo agendamento. Quarta-feira, às 9h, com Ana Souza, na Sala 1."
}
```

Os dados pertencem exclusivamente ao colaborador identificado. Ambas as listas são ordenadas cronologicamente por `startsAt ASC`; o frontend não precisa reorganizar a resposta.

### TK-04.05 — Próxima sessão

#### `GET /booking/appointments/next`

Resposta `200 OK`:

```json
{
  "appointment": {
    "id": "uuid",
    "startsAt": "2026-10-21T12:00:00.000Z",
    "endsAt": "2026-10-21T12:20:00.000Z",
    "therapistName": "Ana Souza",
    "roomName": "Sala 1",
    "locationCode": "SAO_PAULO",
    "status": "CONFIRMED"
  },
  "spokenText": "Sua próxima sessão é quarta-feira, às 9h, com Ana Souza, na Sala 1."
}
```

Sem próxima sessão, retorna `200 OK` com `appointment: null` e `spokenText` curto informando que não há sessão próxima.

### TK-04.06 — Lista de espera

#### `POST /booking/waitlist`

Body `JoinWaitlistDto`:

```json
{
  "therapistId": "uuid",
  "locationId": "uuid",
  "desiredStartsAt": "2026-10-21T12:00:00.000Z",
  "desiredEndsAt": "2026-10-21T12:20:00.000Z"
}
```

Resposta `201 Created`: `WaitlistEntry` com `id`, `employeeId`, `therapistId`, `locationId`, periodo desejado, `status: WAITING` e timestamps.

#### `DELETE /booking/waitlist/:id`

Remove a entrada própria ainda não convertida. Resposta `204 No Content`.

Quando uma sessão é cancelada, o backend oferece a vaga ao primeiro `WAITING` compatível por ordem de `createdAt ASC`. A oferta é representada por uma notificação interna e expira após `WAITLIST_ACCEPTANCE_MINUTES`. O colaborador recebe o card com a mensagem `waitlist.offer` do catálogo (associada ao `MSG-03`):

> Uma vaga ficou disponivel para voce em {data}, as {hora}, com {massoterapeuta}, na unidade {unidade}. A oferta expira em {prazo}. Acesse Suas sessoes para aceitar ou recusar.

#### `POST /booking/waitlist/:id/accept`

Sem body. Aceita somente uma oferta própria, dentro do prazo e enquanto o horário estiver livre. Resposta `201 Created`: appointment criado com `status: CONFIRMED`, dados básicos de terapeuta, sala, unidade e horário, além de `spokenText` de confirmação. Marca a entrada como `CONVERTED`, emite `appointment.booked` e registra auditoria.

O job de expiração marca a oferta como expirada/cancelada e oferece a vaga ao próximo candidato sem duplicar notificações ou reservas.

Erros: `404` (`waitlistEntryNotFound`) para entrada inexistente/alheia; `409` (`waitlistAlreadyJoined` ou `waitlistOfferUnavailable`) para duplicidade, estado inadequado, conflito ou vaga indisponível; `410` (`waitlistOfferExpired`) para oferta expirada. A validação temporal também pode retornar `400` (`invalidPeriod`, `invalidDuration`, `bookingNotice`, `outsideBookingHorizon` ou `outsideOperatingHours`).

### TK-04.09 — Consultar minhas entradas e identificar oferta

#### `GET /booking/waitlist`

Sem parametros obrigatorios. Retorna apenas entradas do colaborador, ordenadas por criacao, com `id`, periodo, estado, prazo, `therapistId`, `therapistName`, `locationId`, `locationName` e `spokenText`. Entradas antigas sem correspondencia de agenda podem ter metadados nulos.

Exemplo de resposta `200 OK`:

```json
{
  "items": [
    {
      "id": "uuid",
      "therapistId": "uuid",
      "therapistName": "Ana Souza",
      "locationId": "uuid",
      "locationName": "Sao Paulo",
      "desiredStartsAt": "2026-10-21T12:00:00.000Z",
      "desiredEndsAt": "2026-10-21T12:20:00.000Z",
      "status": "NOTIFIED",
      "offeredAt": "2026-10-20T14:00:00.000Z",
      "offerExpiresAt": "2026-10-20T14:30:00.000Z",
      "spokenText": "Uma vaga ficou disponivel com Ana Souza na unidade Sao Paulo. A oferta expira em segunda-feira, as 9h30. Acesse Suas sessoes para aceitar ou recusar."
    }
  ],
  "spokenText": "Você tem uma oferta de vaga na lista de espera."
}
```

O objeto de notificacao `WAITLIST_VACANCY` inclui `waitlistEntryId` para aceitar ou recusar a oferta. `GET /booking/waitlist` inclui IDs e nomes do terapeuta e da unidade, prazo e `spokenText`; estados finais incluem `DECLINED`.

#### Contrato da lista de espera atualizado (2026-11-03)

`GET /booking/availability` inclui `waitlistSlots`: periodos ocupados por agendamento, sem dados do colaborador. Bloqueios administrativos nao sao elegiveis. `POST /booking/waitlist` exige `therapistId`, `locationId`, `desiredStartsAt` e `desiredEndsAt`; a API confirma que o periodo esta ocupado por agendamento e nao pertence ao colaborador que solicita.

`POST /booking/waitlist/:id/decline` recusa uma oferta `NOTIFIED` ativa. O estado passa a `DECLINED`, a auditoria registra `WAITLIST_DECLINED` e a vaga e oferecida a proxima entrada compativel na unidade. `DELETE /booking/waitlist/:id` tambem avanca a fila se a entrada estava `NOTIFIED`.

`GET /booking/waitlist` retorna `therapistId`, `therapistName`, `locationId` e `locationName` junto aos dados do periodo, estado, oferta e `spokenText`. A migracao preenche `locationId` onde houver agenda correspondente; entradas legadas sem correspondencia continuam com metadados nulos.

### TK-04.07 — Reagendamento

Não haverá rota de reagendamento no MVP. O `RF-08` tem prioridade `W` e o fluxo oficial é cancelar a sessão atual e criar uma nova reserva. Uma futura implementação de reagendamento deverá definir uma operação atômica, auditoria, concorrência, notificações e efeito sobre a lista de espera antes de alterar esta decisão.

### TK-04.08 — Auditoria de eventos de agendamento

Não cria rota nova neste ticket. Listeners de `appointment.booked` e `appointment.cancelled` persistem `AuditEvent` com:

- `actorId`;
- ação (`APPOINTMENT_CREATED` ou `APPOINTMENT_CANCELLED`);
- `entityType: "Appointment"`;
- `entityId`;
- dados mínimos antes/depois, sem dados sensíveis.

### TK-04.10 — Expor duração vigente da sessão

O contrato de `GET /booking/availability` inclui `sessionDurationMinutes`, inteiro positivo fornecido pela regra de negócio vigente. O campo permanece presente tanto com quanto sem o filtro opcional `durationMinutes`; o filtro determina a grade consultada, enquanto o novo campo declara a duração configurada para a interface.

## Mudanças no modelo de dados

O modelo atual já contém `ScheduleSlot`, `Appointment`, `Notification`, `WaitlistEntry`, `BusinessRules` e `AuditEvent`. `WaitlistEntry` já contém `offeredAt`, `offerExpiresAt` e status para `WAITING`, `NOTIFIED`, `CONVERTED`, `EXPIRED` e `CANCELLED`; os índices atuais apoiam busca por status, período e ordem de criação. Não se antecipa nova coluna em `Appointment` para os contratos de duração ou de reserva.

Para concluir o EP-04, são necessárias as seguintes mudanças:

- adicionar a `Notification` um vínculo opcional `waitlistEntryId` com relação a `WaitlistEntry` e índice/constraint apropriados, expondo esse ID na resposta de notificações `WAITLIST_VACANCY` (TK-04.09);
- adicionar unicidade lógica ou transação serializável que impeça duas reservas ativas no mesmo terapeuta/sala e intervalo;
- manter `Appointment.status = CONFIRMED` como estado inicial do protótipo;
- usar `Notification` para a oferta interna da fila, vinculada ao colaborador e, quando aplicável, ao agendamento;
- ler duração, janela, limites e prazos de `BusinessRules`; não embutir os valores provisórios no contrato nem no cálculo;
- não armazenar dados de saúde na reserva, na notificação ou na auditoria.

As alterações de schema devem ser feitas em migração Prisma própria do épico. O contrato de eventos pode ser implementado como eventos internos do NestJS, sem tabela adicional.

## Critérios de aceite

### TK-04.01 — Horários disponíveis

- **Dado** que existem períodos de agenda, bloqueios e reservas em uma unidade;
- **Quando** o colaborador consulta disponibilidade filtrando por unidade ou massoterapeuta;
- **Então** recebe somente horários livres, em ordem cronológica, com terapeuta, sala e unidade.

### TK-04.02 — Reserva e concorrência

- **Dado** que uma tentativa concorrente sofre um deadlock transitório do PostgreSQL (`40P01`);
- **Quando** a reserva é processada;
- **Então** o serviço repete a transação uma vez e retorna o resultado correto: uma reserva criada e a concorrente com `409 Conflict`, sem expor erro interno.

- **Dado** que existe um horário livre e o colaborador está dentro das regras de antecedência e limite;
- **Quando** envia uma reserva válida;
- **Então** uma sessão `CONFIRMED` é criada, o evento `appointment.booked` é emitido e a auditoria é persistida.

- **Dado** que duas requisições tentam reservar simultaneamente o mesmo horário;
- **Quando** ambas são processadas;
- **Então** exatamente uma reserva é criada e a outra recebe `409 Conflict` com mensagem de horário indisponível.

### TK-04.03 — Cancelamento

- **Dado** que o colaborador possui uma sessão futura dentro do prazo permitido;
- **Quando** cancela essa sessão;
- **Então** ela passa a `CANCELLED`, o evento `appointment.cancelled` é emitido, a auditoria é criada e a vaga pode iniciar o fluxo da fila.

### TK-04.04 — Meus agendamentos

- **Dado** que o colaborador possui sessões futuras e anteriores;
- **Quando** consulta seus agendamentos;
- **Então** recebe somente suas sessões, separadas por período e ordenadas cronologicamente.

### TK-04.05 — Próxima sessão

- **Dado** que o colaborador possui uma sessão futura confirmada;
- **Quando** consulta a próxima sessão;
- **Então** recebe os dados do card e um `spokenText` curto com data, hora, terapeuta e sala.

### TK-04.06 — Lista de espera

- **Dado** que um horário está ocupado;
- **Quando** o colaborador entra na lista de espera;
- **Então** sua entrada é criada como `WAITING` e a posição respeita a ordem de entrada.

- **Dado** que uma sessão é cancelada e existe uma fila compatível;
- **Quando** o evento `appointment.cancelled` é processado;
- **Então** a oferta é criada para o primeiro da fila e aparece como notificação/card interno.

- **Dado** que o colaborador recebeu uma oferta ainda válida;
- **Quando** aceita a vaga;
- **Então** uma sessão `CONFIRMED` é criada para ele e a entrada passa a `CONVERTED`.

- **Dado** que o prazo de aceite expirou;
- **Quando** o job de expiração roda;
- **Então** a oferta não pode mais ser aceita e a vaga é oferecida ao próximo candidato.

- **Dado** um colaborador que escolhe um periodo ocupado por agendamento na unidade e com o massoterapeuta selecionados, **Quando** solicita entrada, **Entao** a API cria uma entrada `WAITING` com `therapistId` e `locationId`, sem permitir espera para bloqueios administrativos nem para o proprio agendamento.
- **Dado** uma oferta `NOTIFIED` ainda valida e uma proxima entrada na fila, **Quando** o colaborador recusa e confirma, **Entao** `POST /booking/waitlist/:id/decline` marca `DECLINED`, audita a acao e notifica a proxima entrada compativel.
- **Dado** que `GET /booking/availability` consulta horarios, **Quando** ha periodo ocupado por agendamento, **Entao** `waitlistSlots` identifica data, terapeuta, sala e unidade sem expor o colaborador que reservou.
### TK-04.07 — Reagendamento fora do MVP

- **Dado** que o colaborador quer outro horário;
- **Quando** segue o fluxo do MVP;
- **Então** cancela o agendamento atual e cria uma nova reserva, sem rota de reagendamento atômico.

### TK-04.08 — Auditoria

- **Dado** que uma reserva é criada ou cancelada;
- **Quando** o evento correspondente é emitido;
- **Então** um `AuditEvent` imutável é persistido com ator, ação, entidade e metadados mínimos.

### TK-04.09 — Minhas entradas na lista de espera

- **Dado** que o colaborador tem entradas em estados ativos e finais;
- **Quando** consulta `GET /booking/waitlist`;
- **Então** recebe apenas as próprias entradas em ordem de criação, com estado, dados da oferta e `spokenText` coerente com cada estado.

- **Dado** que o colaborador recebeu uma notificação `WAITLIST_VACANCY`;
- **Quando** a interface lê a notificação;
- **Então** a resposta contém o ID da `WaitlistEntry` correspondente para aceitar a oferta pela rota de aceite.

- **Dado** que outro colaborador tenta consultar ou alterar a entrada;
- **Quando** usa o ID da entrada;
- **Então** a API não revela a existência nem os dados do recurso alheio.

### TK-04.10 — Duração vigente

- **Dado** que a duração de sessão está configurada no `BusinessRulesService`;
- **Quando** o colaborador consulta `GET /booking/availability`, com ou sem `durationMinutes`;
- **Então** a resposta inclui `sessionDurationMinutes` com o valor vigente e os slots continuam ordenados cronologicamente.

## Acessibilidade, ordem e fuso

- Respostas consumidas pela interface do colaborador devem incluir `spokenText` quando houver uma mensagem para leitura.
- `spokenText` começa pela informação principal: disponibilidade, confirmação, cancelamento ou oferta.
- Horários falados usam `pt-BR` e `America/Sao_Paulo`, por exemplo “quarta-feira, às 9h”.
- Disponibilidade, agendamentos e fila são ordenados pelo backend; a interface não depende de cor, posição ou ícone.
- Cards de lembrete e oferta devem ser anunciáveis por leitor de tela, com foco gerenciado e ações textuais de aceitar, recusar ou cancelar.
- Mensagens usam somente o primeiro nome quando mencionarem pessoas e não expõem dados sensíveis.
- Datas persistidas e comparações de concorrência usam UTC; conversão para apresentação ocorre na borda da API.
- O calendário e as horas mostradas usam o fuso da unidade. O cálculo de funcionamento usa o `timezone` cadastrado na unidade; textos `spokenText` do backend usam atualmente `America/Sao_Paulo`. A resposta de slots deve permitir associar cada horário ao `locationCode`; Londrina está atualmente no fuso de Brasília, mas a apresentação deve usar o fuso retornado/cadastrado para a unidade, sem inferir pelo código.
- Leitor de tela deve receber mudanças de carregamento, resultado, erro e oferta sem deslocamento inesperado de foco; listas e mensagens devem preservar ordem cronológica e ordem de leitura lógica.

## Perguntas em aberto

- Quais prioridades MoSCoW devem ser atribuídas a `RF-04` (lista de espera) e `RF-09` (próxima sessão)? Permanecem em aberto em D-14; as prioridades do roadmap para tickets não substituem esta decisão de requisito.
- O grupo/RH confirma ou altera os valores provisórios das RN-01 (60/120 min), RN-05 (20 min), RN-06 (1 reserva), RN-07 (21 dias) e RN-10 (30 min)?
- Quais campos exatos devem aparecer no histórico de agendamentos além de data, hora, terapeuta, sala e status?
- Resolvido em 2026-11-03: o `spokenText` orienta a aceitar ou recusar em Suas sessoes; `POST /booking/waitlist/:id/decline` implementa a recusa e avanca a fila.
- `GET /booking/waitlist` deve retornar entradas finais indefinidamente ou aplicar uma janela de retenção/paginação?

