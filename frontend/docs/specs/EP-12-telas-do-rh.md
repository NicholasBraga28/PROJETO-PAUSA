# EP-12 — Telas do RH

Épico em `docs/roadmap.md`. Requisitos: RF-17, RF-20 a RF-27, RN-04, RN-05, RN-08, RNF-01, RNF-04 e RNF-05.

Dependências de API: backend TK-03.01 a TK-03.08, TK-08.02 e TK-08.03 estão no roadmap. O contrato administrativo de consulta de unidades para TK-12.02 é `GET /locations/admin`, protegido para HR.

## Objetivo

Permitir que RH e suporte (`ADMIN`) administrem usuários, salas, agendas, bloqueios e parâmetros; gerem códigos de pareamento da Alexa; acompanhem os KPIs definidos para o MVP; e consultem a auditoria dos agendamentos. Todas as tarefas devem funcionar por teclado e leitor de tela. Gráficos e cores são complementos a dados explicados em texto e tabelas.

As regras RN-01 a RN-11 mantêm seus valores atuais como provisórios. A interface apresenta os valores fornecidos pela API e não os fixa nem recalcula.

## Decisões de interação adotadas nesta spec

- **Cópia da agenda (TK-12.03):** aplicar D-02, registrada em `backend/docs/requisitos.md` e no roadmap do backend: copiar uma data de origem para uma lista de datas futuras, gravando períodos concretos. A forma de interação da tela será um formulário com data de origem, filtro opcional por massoterapeuta e campos repetíveis de data de destino (máximo de 31), revisão e confirmação. A lista explícita corresponde a `targetDates`; não usar arrastar, recorrência ou intervalo implícito.
- A anotação `[DECIDIR]` ainda aparece junto a RF-26 e o cabeçalho da cópia na spec antiga do EP-03 ainda mostra `🔒`, mas D-02 está registrada como decidida e TK-03.05 está feito. Para esta spec, esses dois marcadores são tratados como desatualizados; prevalecem a decisão registrada, o ticket concluído e o contrato implementado de `POST /schedules/copy`.
- **Permissões:** `ADMIN` herda `HR`, conforme EP-02 e o `RolesGuard`; ambos usam as telas administrativas.

## Fora de escopo

- Login Google, hospedagem e mudanças no modo de identificação do protótipo.
- Funções do colaborador, do massoterapeuta ou da Alexa; pareamento é apenas a geração e apresentação do código pelo RH.
- Exportação de relatórios, metas, alertas, comparações, previsão, métricas fora de D-08 e alteração/exclusão de eventos de auditoria.
- Edição direta de salas, desativação de salas ou criação/edição/desativação de unidades enquanto a API não oferecer esses contratos.
- Configurar recorrência de agenda, copiar por intervalo semanal ou criar uma prévia persistida; a API copia datas explicitamente e cria registros concretos.
- Escolher ou validar novos valores de negócio: os valores atuais seguem provisórios e são recebidos da API.

## Telas e rotas

Prefixo da API: `/api`. Todas as rotas abaixo exigem perfil `HR` ou `ADMIN`; o backend continua responsável por autorização. A navegação administrativa é comum a ambos os papéis.

| Rota | Tela e ticket | Conteúdo |
| --- | --- | --- |
| `/hr` | Início do RH | Navegação para as áreas administrativas, com links nomeados e um `h1`. |
| `/hr/users` | Usuários (TK-12.01) | Lista pesquisável, cadastro, ativação e desativação. |
| `/hr/locations` | Unidades e salas (TK-12.02) | Consulta administrativa das unidades e salas, criação de sala em unidade ativa, visualização/impressão local do QR Code e regeneração confirmada do token. |
| `/hr/schedules` | Agendas (TK-12.03) | Consulta por data/unidade/massoterapeuta, criação, edição, remoção protegida e cópia de uma data para datas futuras explícitas. |
| `/hr/blocks` | Bloqueios (TK-12.04) | Formulário para criar bloqueio pontual e apresentação textual de conflitos. Não há consulta/listagem de bloqueios no contrato atual. |
| `/hr/rules` | Regras de negócio (TK-12.05) | Valores e descrições atuais, edição de um parâmetro e validação apresentada pela API. |
| `/hr/alexa` | Pareamento da Alexa (TK-12.06) | Seleção de massoterapeuta ativo, geração do código e validade. |
| `/hr/reports` | KPIs (TK-12.07) | Filtros de período/unidade/massoterapeuta/granularidade e dados tabulares equivalentes aos gráficos. |
| `/hr/audit` | Auditoria (TK-12.08) | Filtros e paginação por cursor dos eventos de agendamento. |

Cada rota tem título e foco próprios no `h1`, com a navegação comum disponível sem repetir informação no foco inicial. Endpoints inexistentes não são simulados nem contornados no cliente.

## Contratos da API usados

Identificação do protótipo: cabeçalho `x-user-id` pelo cliente compartilhado. Todas as respostas são validadas com Zod antes do uso. `401 notIdentified` e `403 accessDenied` usam as mensagens do catálogo; não confiar em controles ocultos para autorizar.

### Usuários — TK-12.01 / RF-20

- `GET /users?role=<role>&status=<status>&search=<texto>`: filtros opcionais; retorna array de `{ id, email, name, role, status, therapistId, createdAt }`, ordenado por nome.
- `POST /users` com `{ email, name, role }`: `201` com o usuário criado, inicialmente ativo. Para `role=THERAPIST`, cria também o perfil de massoterapeuta.
- `PATCH /users/:id/status` com `{ status: "ACTIVE" | "INACTIVE" }`: `200` com o usuário atualizado. Não existe remoção de usuário.
- Erros de domínio: `userEmailAlreadyExists` (“Já existe um usuário cadastrado com este e-mail.”), `userNotFound`, `notIdentified`, `accessDenied`; entradas inválidas retornam `400` pelo validador global.

### Unidades e salas — TK-12.02 / RF-24

O RH carrega todas as unidades por `GET /locations/admin` (resposta: `id`, `code`, `name`, `timezone`, `active`) e consulta salas com `GET /rooms?locationCode=&active=`. Cria salas por `POST /rooms` com `{ name, locationId }`. A API emite o token de check-in e devolve sala, unidade e token; o frontend gera o QR localmente com `qrcode.react`, sem enviar o token a terceiros. O destino é a rota existente `/check-in/:token`, montada com `window.location.origin`. A regeneração exige confirmação e usa `POST /rooms/:id/regenerate-token`; o QR antigo deixa de funcionar após sucesso. Impressão inclui nome da sala, unidade, QR e instrução textual.

- `GET /rooms?locationCode=<code>&active=<boolean>`: lista ordenada por nome com `{ id, name, locationId, locationCode, active, checkInToken }`.
- `POST /rooms` com `{ name, locationId }`: `201`; retorna sala criada e token de check-in gerado.
- `POST /rooms/:id/regenerate-token`: `200` com `{ id, name, checkInToken, updatedAt }`; invalida imediatamente o token anterior.
- **Contrato administrativo do ticket:** `GET /locations/admin` retorna `id`, `code`, `name`, `timezone` e `active` para RH. `GET /locations` continua exclusivo do colaborador e retorna somente unidades ativas. Criar, editar ou desativar unidades exige ticket próprio; não faz parte do TK-12.02.
- Não há `PATCH` ou `DELETE /rooms`; a interface não deve oferecer edição/desativação de sala sem novo contrato.
- Erros de domínio: `locationNotFound`, `roomNotFound`, `roomNameAlreadyExists`, `notIdentified`, `accessDenied`; demais validações usam `400` e a mensagem do catálogo quando houver.
- A resposta fornece o token, não uma imagem QR. A interface gera a impressão localmente a partir do link de check-in e imprime também o nome da sala e a instrução textual. O token é dado de acesso e não pode ir a logs/telemetria.

### Agenda — TK-12.03 / RF-25, RF-26

- `GET /schedules?date=YYYY-MM-DD` ou `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`, com filtros opcionais `therapistId`, `roomId`, `locationCode`: lista de `{ id, therapistId, roomId, startsAt, endsAt, createdAt }`, ordenada por início.
- `POST /schedules` com `{ therapistId, roomId, startsAt, endsAt }`: `201` com o período criado.
- `PATCH /schedules/:id` com campos opcionais `roomId`, `startsAt`, `endsAt`: `200` com período atualizado; alterações que afetem atendimentos ativos são recusadas.
- `DELETE /schedules/:id`: `204`; períodos com atendimentos ativos não podem ser removidos.
- `POST /schedules/copy` com `{ sourceDate: "YYYY-MM-DD", targetDates: ["YYYY-MM-DD", ...], therapistId?: UUID }`: no máximo 31 datas de destino. Retorna `201` com `{ created: ScheduleSlot[], skipped: [{ date, message }] }`. Cada data com algum conflito é ignorada por inteiro; as demais são criadas. O massoterapeuta é opcional; sem filtro, copia os períodos de todos os massoterapeutas na origem.
- Regras vêm da API: períodos futuros, dia útil e expediente conforme RN-08, massoterapeuta/sala ativos, sem sobreposição do mesmo massoterapeuta. Datas de negócio usam `America/Sao_Paulo`; timestamps são ISO em UTC. Não calcular janelas de negócio no cliente.
- Erros de domínio: `scheduleNotFound`, `therapistNotFound`, `therapistInactive`, `roomInactive`, `outsideOperatingHours`, `invalidPeriod`, `scheduleConflictTherapist`, `scheduleConflictRoom`, `scheduleHasAppointments`, `scheduleCopyEmptySource`, `scheduleCopyInvalidTargets`, `notIdentified`, `accessDenied`. Uma falha em uma data de cópia vem em `skipped[].message`; erro que invalida o pedido todo usa envelope global `400`.

### Bloqueios — TK-12.04 / RF-23

- `POST /schedule-blocks` com `{ therapistId, startsAt, endsAt, reason? }` (`reason` até 200 caracteres): `201` com `{ id, therapistId, startsAt, endsAt, reason, createdById, createdAt }`.
- A API valida período, passado, dia local, expediente e massoterapeuta ativo. Não oferece listagem, edição ou remoção de bloqueios.
- Um conflito com atendimento retorna `409` e identifica atendimentos conflitantes; a interface lista o que conflita e orienta a ação consciente. Erros de domínio: `invalidPeriod`, `scheduleBlockInPast`, `scheduleBlockSpansDays`, `scheduleBlockOutsideOperatingHours`, `therapistNotFound`, `therapistInactive`, `scheduleAlreadyBlocked`, `scheduleBlockHasAppointments`, `notIdentified`, `accessDenied`.
- D-04: bloqueio sobre atendimento marcado é recusado, não cancela o atendimento automaticamente.

### Parâmetros — TK-12.05 / RF-27

- `GET /business-rules`: lista `{ key, value, type, description }`; `type` é `MINUTES`, `DAYS`, `COUNT`, `TIME_OF_DAY` ou `WEEKDAYS`.
- `PATCH /business-rules/:key` com `{ value: string }`: retorna o parâmetro atualizado. A API valida formato, limites e consistência entre parâmetros e grava auditoria.
- Erros: `businessRuleNotFound`, `invalidBusinessRuleValue`, `notIdentified`, `accessDenied`. Valores atuais permanecem provisórios. A tela mostra os valores recebidos e erros da API; não os corrige silenciosamente.

### Código de pareamento — TK-12.06 / RF-17

- `POST /therapists/:id/alexa-pairing-code`: `201` com `{ code, therapistId, expiresAt }`.
- O código tem seis dígitos numéricos e validade de 60 minutos (D-18); gerar outro expira o anterior ainda não consumido para o mesmo massoterapeuta. O código não é gravado em auditoria.
- Erros: `therapistNotFound`, `therapistInactive`, `notIdentified`, `accessDenied`. A resposta não contém `spokenText`; a interface anuncia os dígitos individualmente, a validade como data/hora local e não persiste o código.

### KPIs — TK-12.07 / RF-21 / D-08

- `GET /reports/kpis?from=YYYY-MM-DD&to=YYYY-MM-DD&locationId=<uuid>&therapistId=<uuid>&granularity=DAY|WEEK|MONTH`: período obrigatório; filtros restantes opcionais; granularidade de cancelamentos padrão `DAY`.
- Resposta `{ range, filters, demand, cancellations, spokenText }`. `demand` contém `byShift`, `mostRequestedShift`, `byWeekday`, `mostRequestedWeekday`, `byStartTime`, `mostRequestedStartTime`. Cancelamentos incluem período, contagem agendada, contagem cancelada e taxa percentual.
- D-08: procura por turno, dia da semana, horário de início e cancelamentos. Incluir manhã/tarde e segunda a domingo mesmo em zero; taxas são contagem cancelada / contagem agendada × 100, com zero quando denominador zero. O backend determina agrupamento, ordem, empate, fuso e cálculo.
- Erros: `invalidReportPeriod`, `invalidReportFilter`, `locationNotFound`, `therapistNotFound`, `notIdentified`, `accessDenied`.

### Auditoria — TK-12.08 / RF-22 / RNF-04

- `GET /audit-events?from=<ISO UTC>&to=<ISO UTC>&appointmentId=<uuid>&actorId=<uuid>&action=<código>&limit=<1..100>&cursor=<uuid>`; todos opcionais, `limit` padrão 50.
- Resposta `{ items, nextCursor, spokenText }`. Item contém `{ id, actorId, action, entityType, entityId, createdAt, data, spokenText }`; somente eventos de `Appointment`, ordenados por `createdAt DESC` e `id DESC`. `data` é filtrado pelo backend; `actorId: null` identifica evento do sistema.
- Erros: `invalidReportPeriod`, `invalidAuditCursor`, `notIdentified`, `accessDenied`. O backend omite dados pessoais, dados de saúde, payloads arbitrários e chaves não permitidas; a interface não amplia esses dados nem os envia a analytics.

### Respostas e mensagens

Erros são apresentados com as mensagens do catálogo do backend, associados ao formulário/campo ou filtro que os causou; nunca mostrar resposta bruta, stack ou SQL. `spokenText` de KPIs e auditoria é apresentado e anunciado literalmente pela região viva. Os contratos de criação/edição de usuário, sala, agenda, bloqueio, regra e código não têm `spokenText`; a forma de anunciar resultados dessas mutações é pergunta em aberto abaixo, não uma mensagem de catálogo inventada.

## Mudanças no modelo de dados

Nenhuma mudança de modelo prevista para o frontend. As telas consomem `User`, `Therapist`, `Location`, `Room`, `ScheduleSlot`, `ScheduleBlock`, `BusinessRule`, `AlexaPairingCode` e `AuditEvent` existentes. A API é fonte de verdade para estados, regras, fuso e auditoria.

## Estados por tela

| Tela | Carregando | Vazio | Erro e recuperação |
| --- | --- | --- | --- |
| Usuários | Indicador `role=status`; preservar filtros e foco. | “Nenhum usuário encontrado”; botão para cadastrar usuário. | Resumo de erros com foco; duplicidade de e-mail vinculada ao campo; permitir corrigir/repetir. |
| Unidades e salas | Carregar salas e dependências de unidades separadamente. | Nenhuma sala: ação de criar se unidade válida; indicar se a consulta de unidades não está disponível. | Falha de salas permite repetir. Falta do contrato de unidades é estado de dependência, sem seleção codificada localmente. |
| Agendas | Carregar períodos e opções de filtros; não deslocar foco. | Sem períodos na data: oferecer formulário para criar ou escolher outra data. | Erro ao lado de filtros/formulário; conflitos e atendimentos afetados em lista textual; recuperação sem apagar entradas. |
| Bloqueios | Indicar envio e manter formulário enquanto aguarda. | Formulário pronto; não afirmar que não existem bloqueios, pois API não lista bloqueios. | `409` mostra os atendimentos conflitantes e o que fazer; `400` associa mensagem ao campo/período. |
| Regras | Carregar lista e valores da API. | A API deve fornecer o catálogo; lista ausente é erro, não presumir que não há parâmetros. | Erro junto ao parâmetro; manter valores atuais e permitir tentar novamente. |
| Pareamento | Carregar massoterapeutas ativos. | Sem massoterapeuta ativo, explicar e oferecer link para cadastro/ativação. | Falha de carregamento ou geração com mensagem do catálogo e opção de tentar novamente. Código só aparece após sucesso. |
| KPIs | Carregar consulta para os filtros selecionados; anunciar início se necessário. | Séries com zeros, resumo “Sem atendimentos no período” conforme `spokenText`; tabelas continuam disponíveis. | Erro dos filtros/período com foco no resumo e ação “Tentar novamente”; manter resposta anterior claramente marcada como desatualizada ou removê-la. |
| Auditoria | Carregar página atual sem perder filtros; indicar número/página quando recebido. | `items: []`: anunciar resumo de zero eventos e manter filtros. | Erro de cursor sugere atualizar/reiniciar consulta; erro de filtro aponta campo e mantém filtros editáveis. |

## Critérios de aceite (Dado / Quando / Então)

### TK-12.01 — Usuários (RF-20)

- **Dado** usuários existentes, **Quando** o RH abre `/hr/users` e filtra por papel, status ou nome/e-mail, **Então** a tela envia `GET /users` com os filtros e apresenta os resultados em tabela semântica/lista responsiva, ordenados pela API.
- **Dado** dados válidos para novo usuário, **Quando** o RH preenche e confirma o cadastro, **Então** envia `POST /users`, apresenta o usuário retornado e informa que um massoterapeuta recebe perfil automaticamente quando o papel for `THERAPIST`.
- **Dado** um usuário ativo ou inativo, **Quando** o RH solicita alternar o status, **Então** uma confirmação acessível explica o efeito; após confirmar, envia `PATCH /users/:id/status`, atualiza a linha e anuncia o resultado.
- **Dado** e-mail duplicado, usuário inexistente ou dados inválidos, **Quando** a API rejeita a ação, **Então** apresenta mensagem de catálogo e mantém os filtros/dados preenchidos para correção; não oferece exclusão.

### TK-12.02 — Unidades, salas e impressão do QR Code (RF-24)

- **Dado** unidades acessíveis pelo contrato administrativo e salas cadastradas, **Quando** o RH abre `/hr/locations`, **Então** pode filtrar salas por unidade e status, criar sala com unidade válida e ver nome, unidade, status e QR Code com nome da sala e instrução textual equivalentes.
- **Dado** uma sala, **Quando** o RH escolhe regenerar o token, **Então** a interface explica que o QR anterior deixará de funcionar, exige confirmação, chama `POST /rooms/:id/regenerate-token` e apresenta/imprime somente o novo QR após sucesso.
- **Dado** que a impressão é iniciada, **Quando** o conteúdo sai em papel, **Então** inclui nome da sala e instrução de check-in além do código visual; o nome/unidade não dependem da imagem do QR.
- **Dado** o RH autenticado, **Quando** abrir a tela, **Então** consulta IDs e status das unidades em `GET /locations/admin`, sem embutir IDs nem usar `GET /locations` de `EMPLOYEE`.

### TK-12.03 — Agendas (RF-25, RF-26)

- **Dado** uma data e filtros opcionais, **Quando** o RH abre `/hr/schedules`, **Então** consulta `GET /schedules` e vê os períodos em ordem da API, com massoterapeuta, sala, data e horário local.
- **Dado** um período válido, **Quando** o RH cria, edita ou remove, **Então** usa `POST`, `PATCH` ou `DELETE /schedules` com os IDs e timestamps correspondentes; toda mudança é confirmada antes do envio e o resultado é anunciado.
- **Dado** agenda de origem existente e datas de destino explicitamente escolhidas, **Quando** o RH confirma a cópia, **Então** envia `sourceDate`, `targetDates` e `therapistId` opcional para `POST /schedules/copy`; cada destino deve ser posterior a hoje, distinto da origem e único, e a lista contém no máximo 31 datas.
- **Dado** uma cópia com datas válidas e inválidas por regra/conflito, **Quando** a API responde, **Então** apresenta períodos criados e cada data ignorada com sua mensagem específica; um conflito em uma data não esconde o resultado das demais.
- **Dado** origem vazia, data inválida, repetição, destino passado, sala/massoterapeuta inativo, conflito ou atendimentos afetados, **Quando** a API recusa a ação, **Então** mostra o erro associado à data/período, não descarta dados sem aviso e permite corrigir ou consultar novamente.
- **Dado** o formulário de agenda, **Quando** ele é operado sem mouse, **Então** criação, edição, remoção e cópia são completáveis por controles de formulário e teclado; nenhuma tarefa depende de arrastar elementos.

### TK-12.04 — Bloqueios (RF-23)

- **Dado** massoterapeuta, início, fim e motivo opcional válidos, **Quando** o RH solicita criar bloqueio, **Então** revisa o resumo em confirmação acessível e a tela envia `POST /schedule-blocks`.
- **Dado** um bloqueio aceito, **Quando** a API retorna `201`, **Então** a tela apresenta o período e o massoterapeuta em texto e anuncia o resultado sem depender de cor.
- **Dado** atendimento conflitante, outro bloqueio, início passado, período que atravessa dias, fora do expediente ou terapeuta inativo, **Quando** a API rejeita, **Então** a interface apresenta a mensagem do catálogo; para atendimentos conflitantes lista cada item e deixa explícito que precisa ser tratado antes do bloqueio, sem cancelá-los automaticamente.
- **Dado** ausência de `GET /schedule-blocks`, **Quando** o RH usa a tela, **Então** ela não afirma que não existem bloqueios nem oferece consulta/edição/remoção inexistente.

### TK-12.05 — Parâmetros das regras (RF-27)

- **Dado** configurações atuais retornadas pela API, **Quando** o RH abre `/hr/rules`, **Então** vê um nome claro, descrição e valor formatado em destaque, sem chaves, tipos ou códigos internos; valores provisórios continuam identificados.
- **Dado** novo valor para um parâmetro, **Quando** o RH inicia edição, **Então** o controle e exemplo de formato dependem do tipo; antes de salvar há resumo e confirmação do valor atual e proposto.
- **Dado** confirmação, **Quando** envia `PATCH /business-rules/:key`, **Então** mostra a resposta retornada, atualiza o valor e anuncia o resultado; não atualiza localmente se a API falhar.
- **Dado** valor inválido, limite ultrapassado ou conjunto inconsistente, **Quando** a API recusa, **Então** mostra `invalidBusinessRuleValue` e as instruções retornadas, associa o erro ao campo e mantém o valor persistido visível.

### TK-12.06 — Código de pareamento da Alexa (RF-17)

- **Dado** massoterapeuta ativo, **Quando** o RH seleciona “Gerar código de pareamento” e confirma, **Então** envia `POST /therapists/:id/alexa-pairing-code` e recebe código de seis dígitos e `expiresAt`.
- **Dado** código recebido, **Quando** é apresentado, **Então** os dígitos ficam em texto legível e são anunciados individualmente; validade aparece em data/hora local textual e o código não é salvo em storage ou log.
- **Dado** geração de um novo código para o mesmo massoterapeuta, **Quando** o backend expira o código anterior, **Então** a interface confirma qual código/validade está em vigor e não apresenta o anterior como utilizável.
- **Dado** massoterapeuta inexistente/inativo ou erro de autorização, **Quando** a API recusa, **Então** nenhum código é exibido e a mensagem do catálogo é anunciada.

### TK-12.07 — KPIs (RF-21, D-08)

- **Dado** que o RH abre `/hr/reports`, **Quando** a tela carrega, **Então** consulta automaticamente o mês atual em `America/Sao_Paulo` e mostra os quatro indicadores definidos em D-08: turnos, dias da semana, horários de início e cancelamentos.
- **Dado** o seletor mensal, **Quando** o RH usa as setas, **Então** os indicadores do mês anterior ou seguinte são carregados automaticamente.
- **Dado** que o RH quer detalhar os resultados, **Quando** abre os filtros opcionais e os aplica, **Então** a consulta usa unidade, massoterapeuta e agrupamento escolhidos.
- **Dado** qualquer resposta, **Quando** é apresentada, **Então** cada série abre um gráfico de linha compacto e mantém a tabela equivalente em uma expansão separada; manhã/tarde e segunda-domingo aparecem mesmo em zero e cancelamentos oferecem granularidade por dia, semana ou mês.
- **Dado** zero atendimentos ou empates, **Quando** os KPIs são mostrados, **Então** a interface usa os valores e desempates da API e não divide por zero nem inventa total.
- **Dado** período/filtro inválido ou unidade/massoterapeuta inexistente, **Quando** a consulta falha, **Então** a mensagem do catálogo indica como corrigir e o foco vai ao resumo do erro.
- **Dado** a resposta com `spokenText`, **Quando** a consulta termina, **Então** anuncia literalmente o resumo retornado sem depender das cores, da posição ou da forma do gráfico; os botões de navegação mensal têm nome acessível, operam por teclado e alvo mínimo de 44 × 44 px.

### TK-12.08 — Auditoria (RF-22, RNF-04)

- **Dado** filtros opcionais de período, agendamento, ator ou ação, **Quando** o RH consulta `/hr/audit`, **Então** envia os filtros a `GET /audit-events` e lista somente eventos de `Appointment` na ordem mais recente primeiro.
- **Dado** mais resultados que o limite da página, **Quando** o RH escolhe “Carregar mais”, **Então** usa `nextCursor`, mantém os filtros e evita duplicar ou pular itens.
- **Dado** um evento, **Quando** apresentado em tabela/lista, **Então** comunica ação e data/hora, autor (“sistema” quando `actorId` é `null`) e campos de auditoria permitidos; não exibe nem anuncia e-mail, dado de saúde, payload arbitrário ou ID completo como texto de leitura.
- **Dado** consulta sem resultados ou cursor inválido, **Quando** a API responde, **Então** anuncia o estado vazio ou erro do catálogo; cursor inválido oferece reiniciar a consulta desde o início.

## Acessibilidade

### Foco e ordem

- Uma landmark `main` e um `h1` por rota; o título recebe foco inicial de navegação sem anel intrusivo. Navegação, filtros, conteúdo e ações seguem a ordem do DOM.
- Após erro de formulário, foco vai ao resumo com links/campos inválidos; após erro de mutação, foco vai ao erro pertinente; após sucesso, o foco permanece no contexto e o resultado é anunciado.
- Diálogos React Aria/APG para mudanças irreversíveis ou que invalidam código/QR: foco inicial em “Voltar”, confirmação explícita e retorno do foco ao acionador. Remoção exige explicar conflitos antes de confirmar.
- Paginação/filtros atualizados não movem o foco para o topo sem ação da pessoa; ao carregar mais auditoria, manter foco no acionador e anunciar a página/quantidade.

### Anúncios e leitor de tela

- Uma região viva compartilhada `role="status"`, `aria-live="polite"`, `aria-atomic="true"`. Anunciar `spokenText` da API sem reescrever quando presente; `role="alert"` somente para erro que impede a tarefa.
- Para mutações sem `spokenText`, anunciar mensagem confirmada do catálogo se houver. A criação/cópia de agenda, bloqueio, sala, usuário, regra e código não inclui `spokenText` no contrato atual; a estratégia de texto de sucesso está em aberto.
- Tabelas têm `<caption>`, `<th scope="col">` e ordenação anunciada; filtros de tabela usam rótulo visível. A 320 px apresentar uma lista responsiva quando tabela não reflowar sem rolagem lateral.
- KPIs têm resumo textual primeiro, tabela de valores equivalente e rótulos que incluem unidade/contagem; cores e posição visual não carregam significado exclusivo.
- Auditoria usa `spokenText` curto por item, ordem anunciada e fallback compreensível para ação sem rótulo local. Pares de datas e horas são lidos no fuso da unidade (`America/Sao_Paulo` no MVP), sem conversão manual no cliente.
- Código Alexa é lido dígito a dígito; expiração é anunciada como data/hora, sem contagem regressiva por segundo.

### Nomes, teclado e toque

- Todo controle tem nome acessível que contém o rótulo visível; ações repetidas incluem contexto (ex.: “Desativar usuário Ana Silva”, “Regenerar QR Code da Sala 1”). Ícones são decorativos com `aria-hidden`.
- Pesquisa, filtros, paginação, confirmação, cópia com datas repetíveis e ações são completáveis por teclado. Radio groups seguem React Aria/APG; não exigir arrastar, gesto ou hover.
- Controles têm alvo de pelo menos 44 × 44 px com espaço suficiente. Formulários associam `label`, instruções e erro por `aria-describedby`; erros também têm texto e não dependem de borda/cor.

### Contraste, zoom e preferências

- Texto: contraste 7:1 (texto grande, no mínimo 4,5:1); controles, indicadores e foco: 3:1 em temas claro, escuro, alto contraste e `forced-colors`. Status e gráficos têm rótulos textuais/padrões além da cor.
- 200% sem perda de função; 400%/320 px com reflow e sem rolagem horizontal. Tabelas administrativas têm representação em lista para telas estreitas; conteúdo e diálogos não usam altura fixa.
- Respeitar `prefers-reduced-motion`, `prefers-contrast`, `prefers-color-scheme` e `forced-colors`; não usar animação para transmitir mudanças de KPI ou carregamento.
- Testes: axe em cada tela, consultas de teste por papel/nome, foco, anúncio e teclado; Playwright nos três temas, Tab, 320 px/zoom 400%, `forced-colors` e movimento reduzido; script `check:contrast`.
- Roteiro manual no PR: teclado, NVDA + Chrome/Firefox, zoom 400%, alto contraste/`forced-colors`, simulação de daltonismo e movimento reduzido. Validar o fluxo com RH e suporte.

## Segurança e privacidade

- Todas as páginas são protegidas no frontend por papel, mas autorização real é verificada no backend. `ADMIN` herda `HR`; não confiar na navegação como controle de acesso.
- O protótipo usa `x-user-id`, que permite impersonação e é risco aceito só no protótipo. Não persistir segredo; manter identificação no cliente compartilhado.
- Validar todas as respostas com Zod. Mensagens mostram somente catálogo; nunca stack, SQL, payload bruto, HTML, conteúdo de auditoria não permitido ou dado pessoal em console/analytics.
- Dados de usuário são visíveis apenas nas telas administrativas e só na extensão necessária à tarefa. Evitar expor e-mails em relatórios/auditoria; backend filtra estes dados.
- QR Code contém o token de check-in, que é credencial de acesso à ação. Não enviar a serviço externo, não registrar em log/analytics, invalidar visualmente o código antigo após regeneração e imprimir somente em tela autorizada. A URL deve manter `Referrer-Policy: no-referrer`.
- O código de pareamento é temporário e não pode ser guardado em `localStorage`, query string, logs ou telemetria. Mostrar somente para o papel autorizado e não incluir nos eventos de auditoria.
- Inputs de nome, motivo e filtros são texto simples; escapar naturalmente pelo React, validar no backend e nunca injetar HTML. Datas permanecem como datas civis/UTC conforme o endpoint; não mudar fuso no armazenamento.
- Auditoria é somente leitura e imutável; não expor campos omitidos pelo backend nem construir URLs a partir de valores não validados.

## Perguntas em aberto

- **Gestão completa de unidades:** o TK-12.02 usa `GET /locations/admin` para consultar unidades e IDs. Criar, editar e desativar unidades continua fora do contrato/ticket atual e precisa de escopo próprio caso o RH precise dessas operações.
- **Salas:** RF-24 diz “gerenciar”, mas a API só lista/cria e regenera token; não há editar nome, mover de unidade, ativar/desativar ou excluir. Confirmar se o escopo do TK-12.02 limita essas ações a listagem/criação/regeneração ou se são necessários endpoints backend.
- **Bloqueios:** não há `GET /schedule-blocks`, edição nem remoção. Confirmar se o TK-12.04 é exclusivamente criação com resposta/conflictos ou se o RH precisa consultar/liberar bloqueios existentes.
- **QR para impressão:** decisão para TK-12.02: gerar QR local com `qrcode.react`, usar a origem corrente (`window.location.origin`) e a rota pública já existente `/check-in/:token`. A implantação deve servir frontend e API sob a origem configurada para a aplicação.
- **Sucessos sem `spokenText`:** para TK-12.02, anunciar resumo local formado exclusivamente pelos campos confirmados na resposta (nome da sala e unidade) ou a mensagem de sucesso da regeneração. Demais telas administrativas seguem a regra geral de mensagem do catálogo quando houver.
- Pareamento da Alexa: resolvido no TK-12.06 seguindo o critério de aceite. Como o endpoint não retorna `spokenText`, a interface exibe cada dígito individualmente e anuncia os dígitos separados junto da validade. O código permanece apenas em memória enquanto o massoterapeuta estiver selecionado e é removido ao trocar a seleção ou sair da página.
- **KPIs:** período inicial decidido com o usuário: pré-selecionar o mês corrente em `America/Sao_Paulo`. O RH navega mês a mês por setas, e a consulta ocorre somente após ação explícita; a API continua recebendo `from` e `to` no primeiro e último dia do mês.
- **Auditoria:** RF-22, RF-23, RF-26 e RF-27 ainda têm prioridade `[M/S/C/W]` em `backend/docs/requisitos.md`/D-14; os tickets já estão no roadmap e esta spec segue esse escopo. Confirmar prioridade antes de ordenar entrega/demo. O filtro `action` aceita códigos exatos; falta catálogo de rótulos para todas as ações de auditoria e estratégia de fallback para códigos novos.
- **Dados provisórios:** valores das RN-01 a RN-11 mantêm-se provisórios, conforme orientação anterior. Confirmar com RH antes da demonstração; a interface não aprova valores nem altera regras além do que a API permitir.
