# EP-06 — API do massoterapeuta

Status: ⬜ Planejada (especificação do épico)  
Marco: M3  
Épico: EP-06 · Roadmap: `docs/roadmap.md`  
Triage: `ready-for-agent`  
Tickets: TK-06.01 a TK-06.07 (`docs/tickets/EP-06/`)  
Requisitos: RF-10, RF-11, RF-14, RF-15, RF-30, RF-31, RF-32, RF-33, RN-02, RN-08, RN-09, RN-10, RN-12, RN-13, RN-14, RNF-01, RNF-04, RNF-05  
Decisões relacionadas: D-04 (2026-10-20), D-05 e confirmação só em cancelar e bloquear (2026-10-22), D-06 (2026-10-20), decisões do EP-06 (2026-10-23, abaixo), D-07 (2026-10-26: consulta periódica)  
Revisão: Mariana (regra de convivência do roadmap: a spec do EP-06 é revisada por ela)

Criada em 2026-10-23. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

> **Relação com o EP-07.** A Alexa não tem regra de agenda própria (spec do EP-07, "Módulo e responsabilidades"). Ela chama os services exportados por este épico e fala os textos produzidos pelo formatador de fala daqui. Tudo o que esta spec decide sobre "atual", "próximo", "quem chegou", alvo de iniciar/finalizar e regras de cancelar e bloquear vale igualmente para a tela (EP-11) e para a voz (EP-07).

> **Decisões de 2026-10-23 refletidas nesta spec** (sessão de perguntas sobre a spec; as que mudam regra estão no `requisitos.md`):
> - Rotas em `/therapists/me/*`, só `THERAPIST`; as `/therapist/*` saem.
> - Confirmação sem estado no backend: ele entrega o texto da pergunta e o do resultado; quem pergunta é o cliente.
> - **Marcar ausência também pede confirmação** (além de cancelar e bloquear).
> - Iniciar e finalizar sem ID (`sessions/current/*`); iniciar com outra sessão em andamento é recusado.
> - **Iniciar só vale da abertura do check-in (RN-09) até o fim do atendimento.**
> - **Cancelamento pelo massoterapeuta não oferece a vaga à lista de espera.**
> - Aviso ao colaborador com `NotificationKind` próprio (`APPOINTMENT_CANCELLED_BY_THERAPIST`) e a MSG-07.
> - Eventos continuam na `AppointmentEvents`; o de cancelamento é corrigido e ganha-se o de ausência.
> - Sem coluna nova para a ausência: o `AuditEvent` basta.
> - As regras de bloqueio nascem no TK-03.06 (Guilherme faz o EP-03 por completo); o TK-06.07 reaproveita.
> - Prévia do bloqueio por rota própria, sem gravar.
> - Agenda de qualquer dia; bloqueio de hoje e de dias futuros.

---

## Problem Statement

O massoterapeuta com deficiência visual não consegue usar a agenda sem ajuda de alguém que enxerga. A tela acessível (EP-11) e a Alexa (EP-07) dependem de uma API que ainda não serve para isso. Hoje, as rotas legadas `/therapist/*`:

- **Calculam "hoje" errado.** "Quem chegou" usa o fuso do servidor para achar o início do dia; num servidor em UTC, entre 21h e meia-noite em São Paulo a resposta é sobre o dia seguinte. A agenda exige que o cliente mande `from`/`to` em ISO.
- **Não têm texto pronto para leitura.** Nenhuma resposta traz `spokenText`. O leitor de tela teria de ler IDs, datas ISO e nomes de status em inglês.
- **Expõem o nome completo do colaborador**, contra a RNF-04, e não falam o horário como se fala ("às 14h").
- **Não sabem o que é "atual" nem "próximo".** O "próximo" ignora quem está como possível ausência e não existe o "atendimento atual". O massoterapeuta não tem como perguntar "com quem estou agora?".
- **Exigem o ID do atendimento** para iniciar e finalizar. A Alexa não tem como falar um identificador, e a tela teria de procurar o atendimento certo.
- **Cancelam com a regra do colaborador.** O cancelamento pelo massoterapeuta passa pela antecedência mínima (RN-01), que não vale para ele (D-05). O evento de cancelamento leva o ID do massoterapeuta no lugar do colaborador, o colaborador não é avisado e a vaga é oferecida à lista de espera mesmo que ninguém vá atender naquele horário.
- **Bloqueiam sem nenhuma regra.** O bloqueio aceita período fora do horário de funcionamento (RN-08) e por cima de atendimentos marcados, contra a D-04.
- **Não há como marcar ausência** (RF-33): `POSSIBLE_NO_SHOW` → `NO_SHOW` existe na máquina de estados, mas nenhuma rota usa.
- **Não há confirmação de nada.** Nenhuma resposta traz o texto de confirmação que a tela ou a Alexa precisam ler antes de uma ação que afeta o colaborador.

Sem este épico, nem a tela do massoterapeuta nem a Alexa conseguem cumprir a métrica principal: ele passar o dia sem pedir informação a ninguém.

---

## Solution

Ao término do EP-06, o massoterapeuta tem uma API própria, sob `/api/therapists/me`, servida pelos mesmos services que a Alexa usa:

1. **Agenda de um dia** (hoje por padrão) com o atendimento atual, o próximo e a lista do dia em ordem cronológica. Cada item traz o primeiro nome do colaborador, o horário falado ("às 14h"), a situação em português e as ações disponíveis. A resposta inteira traz um `spokenText` com a informação principal primeiro ("Agora: Ana, até 14h20. Próximo: Bruno, às 14h30."). "Hoje" é sempre o dia em `America/Sao_Paulo`, calculado pelo `Clock`.
2. **Quem chegou:** os check-ins do dia (RN-14), com o mais recente na frase falada.
3. **Ações sobre a própria agenda** (RN-13): iniciar sessão (inclusive sem check-in), finalizar, cancelar, bloquear horário e marcar ausência. Cada ação responde com um texto que confirma o resultado. Cancelar, bloquear e marcar ausência têm um texto de confirmação pronto, que o cliente lê antes de pedir o "sim". Iniciar e finalizar não pedem confirmação.
4. **Iniciar e finalizar sem ID:** "iniciar a sessão de agora" e "finalizar a sessão em andamento" são resolvidos pelo backend, para a Alexa e para um atalho na tela.
5. **Cancelar a qualquer momento** (D-05). O colaborador é avisado pelo `NotificationChannel`. A vaga **não** vai para a lista de espera: cancelar quer dizer "não vou atender".
6. **Bloquear** um período de hoje ou de um dia futuro, dentro do horário de funcionamento, com prévia antes da confirmação. Se houver atendimentos marcados no período, o bloqueio é recusado com quantos são e o primeiro (D-04). As regras são as mesmas do bloqueio pelo RH (TK-03.06).
7. **Formatador de fala pt-BR** (TK-06.01): uma única peça que transforma horários, nomes e contagens em frases curtas. É usada pela API e pela Alexa e tem testes de formato, tamanho e ordem.
8. **Avisos para a tela** (TK-06.04, consulta periódica pela D-07): o feed de avisos do massoterapeuta, pronto para `aria-live`.

---

## User Stories

### Agenda e consultas (TK-06.02)

1. Como massoterapeuta, quero abrir a minha agenda de hoje sem informar datas, para não precisar saber que dia é no formato que o sistema pede (RF-30).
2. Como massoterapeuta, quero que "hoje" seja o dia em São Paulo, para que à noite a agenda não mostre o dia seguinte (RNF-05).
3. Como massoterapeuta, quero que a agenda venha em ordem cronológica, para que o leitor de tela leia na ordem em que vou atender (RNF-01).
4. Como massoterapeuta, quero ouvir primeiro com quem estou agora e quem é o próximo, para saber o essencial nas primeiras palavras (RF-30, RF-11).
5. Como massoterapeuta, quero que o "atendimento atual" seja a sessão em andamento ou, se nenhuma estiver em andamento, a que está no horário agora e ainda não terminou, para saber com quem devo estar.
6. Como massoterapeuta, quero que o "próximo" inclua quem ainda não fez check-in ou está como possível ausência, para não ser surpreendido por alguém que chega atrasado.
7. Como massoterapeuta, quero ouvir "Você não tem mais atendimentos hoje." quando não houver próximo, para saber que o dia acabou.
8. Como massoterapeuta, quero ouvir "Você não tem atendimentos hoje." quando o dia estiver vazio, para não achar que a tela falhou.
9. Como massoterapeuta, quero ouvir quantos atendimentos ainda tenho hoje e qual é o primeiro deles, para ter o resumo do dia em uma frase (RF-10).
10. Como massoterapeuta, quero que cada item da agenda diga o horário como se fala ("às 14h", "às 9h30"), para que o leitor de tela não leia datas ISO (RNF-01).
11. Como massoterapeuta, quero que cada item diga a situação em português ("chegou", "em andamento", "possível ausência"), para saber o que fazer com aquele atendimento.
12. Como massoterapeuta, quero que cada item diga quais ações estão disponíveis para ele agora, para não tentar uma ação que será recusada.
13. Como massoterapeuta, quero que atendimentos cancelados e liberados não apareçam na agenda, para que a lista mostre só o que importa.
14. Como massoterapeuta, quero que atendimentos já concluídos ou marcados como ausência continuem na lista do dia, mas fora da contagem dos que ainda tenho, para conferir o que já passou sem confundir com o que falta.
15. Como massoterapeuta, quero consultar a agenda de qualquer outro dia, com o mesmo formato da de hoje, para me planejar.
16. Como massoterapeuta, quero perguntar quem chegou hoje e ouvir o mais recente primeiro ("Ana chegou às 13h55."), para saber se posso começar (RF-15, RN-14).
17. Como massoterapeuta, quero ouvir "Ninguém chegou ainda." quando não houver check-in hoje, para não esperar à toa.
18. Como massoterapeuta, quero que, quando várias pessoas chegaram, a frase diga a mais recente e quantas são no total, para que a resposta caiba em uma ou duas frases.
19. Como colaborador, quero que a agenda do massoterapeuta mostre e fale só o meu primeiro nome, sem e-mail nem dado de saúde, porque outra pessoa pode estar na sala (RNF-04).
20. Como massoterapeuta, quero ver só a minha agenda, nunca a de um colega, mesmo que eu tente o ID de um atendimento dele (RN-13).

### Ações (TK-06.03, TK-06.06 e TK-06.07)

21. Como massoterapeuta, quero iniciar a sessão de um atendimento, para registrar que comecei (RF-14, RF-32).
22. Como massoterapeuta, quero iniciar a sessão mesmo que o colaborador não tenha feito check-in ou esteja como possível ausência, porque ele pode estar na minha frente sem ter lido o QR Code.
23. Como massoterapeuta, quero dizer só "iniciar sessão", sem escolher o atendimento, e o sistema iniciar o atendimento de agora, para não precisar navegar na lista.
24. Como massoterapeuta, quero que só dê para iniciar um atendimento a partir de quando o check-in dele abre até o fim do horário dele, para não iniciar por engano a sessão das 16h às 9h.
25. Como massoterapeuta, quero que iniciar e finalizar não peçam confirmação e respondam "Sessão com Ana iniciada." ou "Sessão finalizada. Próximo: Bruno, às 15h.", porque são ações frequentes e a resposta já serve de conferência.
26. Como massoterapeuta, quero que o sistema recuse iniciar uma sessão enquanto outra está em andamento e me diga qual, para não ter duas sessões abertas ao mesmo tempo (RN-12).
27. Como massoterapeuta, quero finalizar a sessão em andamento sem escolher o atendimento, para encerrar com um comando só.
28. Como massoterapeuta, quero ouvir "Nenhuma sessão em andamento." quando não houver o que finalizar, e "Não há atendimento para iniciar agora." quando não houver o que iniciar, para não achar que o sistema travou.
29. Como massoterapeuta, quero cancelar um atendimento a qualquer momento, mesmo perto do horário, porque posso passar mal ou ter um imprevisto (D-05).
30. Como massoterapeuta, quero ler ou ouvir "Cancelar o atendimento de Ana às 14h. Confirma?" antes de cancelar, para conferir o alvo (RN-13).
31. Como massoterapeuta, quero ouvir "Cancelado." depois do cancelamento, para saber que aconteceu.
32. Como colaborador, quero ser avisado quando o massoterapeuta cancelar o meu atendimento, com data, hora e o primeiro nome dele, para não ir à sala à toa (MSG-07).
33. Como colaborador na lista de espera, quero não receber oferta de uma vaga que o massoterapeuta cancelou, porque ninguém vai atender naquele horário.
34. Como massoterapeuta, quero bloquear um período de hoje ou de um dia futuro, para não receber reservas nele (RF-32, RF-13).
35. Como massoterapeuta, quero ler ou ouvir "Bloquear das 15h às 16h. Confirma?" antes de bloquear, para conferir o período.
36. Como massoterapeuta, quero saber antes de confirmar que o bloqueio vai ser recusado, para não ouvir "Confirma?" e depois um erro.
37. Como massoterapeuta, quero que o bloqueio seja recusado quando houver atendimentos marcados no período, ouvindo quantos são e o primeiro, para decidir se cancelo antes (D-04).
38. Como massoterapeuta, quero que um bloqueio com fim antes do início, no passado, fora do horário de funcionamento ou que atravesse dias seja recusado com uma frase que diga o que corrigir (RN-08).
39. Como massoterapeuta, quero que um bloqueio sobre um período que já está bloqueado seja recusado com "Esse período já está bloqueado.", para que um "sim" repetido não crie dois bloqueios.
40. Como colaborador, quero que um período bloqueado deixe de aparecer nos horários disponíveis, para não tentar reservar quando o massoterapeuta não vai atender.
41. Como massoterapeuta, quero que, se o atendimento mudar entre a confirmação e a ação (por exemplo, o colaborador cancelou), a ação seja recusada com o motivo, para nunca agir sobre algo diferente do que ouvi.
42. Como massoterapeuta, quero que uma ação sobre o atendimento de outro massoterapeuta responda como se o atendimento não existisse, para que ninguém descubra a agenda de outra pessoa (RN-13).
43. Como RH, quero que toda ação do massoterapeuta gere um evento de auditoria com ele como ator, seja pela tela ou pela Alexa, para que o histórico seja completo.

### Marcar ausência (TK-06.05)

44. Como massoterapeuta, quero marcar como ausente um colaborador que está como possível ausência, para liberar o meu tempo e registrar a falta (RF-33).
45. Como massoterapeuta, quero ler "Marcar Ana como ausente no atendimento das 14h. Confirma?" antes de marcar, porque a ausência conta contra o colaborador e não tem como desfazer.
46. Como massoterapeuta, quero que só um atendimento em possível ausência possa ser marcado como ausente, para não marcar a falta de quem ainda está dentro da tolerância de atraso (RN-02).
47. Como massoterapeuta, quero ouvir "Ausência registrada. Próximo: Bruno, às 15h." depois de marcar, para já saber o que vem a seguir.
48. Como massoterapeuta, quero que o lembrete falado de uma sessão marcada como ausência seja apagado, como o de uma sessão cancelada (RF-16, depende do EP-07).

### Formatador de fala (TK-06.01)

49. Como massoterapeuta, quero ouvir horários como se fala ("às 14h", "às 9h30", "à 1h"), nunca "14:00" nem "2026-10-23T17:00:00Z" (RNF-01).
50. Como massoterapeuta, quero frases curtas, de no máximo duas, com a informação principal nas primeiras palavras, para entender sem ouvir tudo de novo.
51. Como massoterapeuta, quero que plurais e singulares estejam certos ("1 atendimento", "2 atendimentos"), para que a frase soe natural.
52. Como colaborador, quero que nenhuma frase falada contenha meu sobrenome, e-mail ou ID (RNF-04).
53. Como desenvolvedor, quero que tela e Alexa usem o mesmo formatador, para que a mesma informação seja dita do mesmo jeito nos dois canais.

### Avisos para a tela (TK-06.04)

54. Como massoterapeuta, quero que a tela me avise de mudanças na agenda sem eu procurar (chegada, possível ausência, cancelamento), para ter a mesma informação que a secretária, no mesmo momento (RF-31).
55. Como massoterapeuta, quero que cada aviso tenha um texto pronto para o leitor de tela e chegue em ordem cronológica, para que o `aria-live` leia algo que faça sentido.
56. Como massoterapeuta, quero marcar um aviso como lido, para que a tela não o leia de novo.

### Segurança e operação

57. Como responsável pela aplicação, quero que só o papel `THERAPIST` use as rotas `/therapists/me/*`, e que um usuário sem perfil de massoterapeuta ou inativo receba uma recusa compreensível.
58. Como desenvolvedor, quero que a Alexa chame os mesmos services da tela, para que uma regra corrigida num canal valha no outro.
59. Como desenvolvedor, quero testar "agora" e "hoje" com relógio falso, inclusive perto da meia-noite em São Paulo, para que o fuso nunca volte a quebrar.
60. Como responsável pela privacidade, quero que os logs destas rotas tenham só IDs, nunca nome nem texto falado (RNF-04).

---

## Implementation Decisions

### Módulo e responsabilidades

- Novo feature module `therapists/` (alvo do `AGENTS.md`), que substitui o `therapist/` legado. As rotas `/therapist/*` saem; a matriz de permissões troca as linhas legadas pelas novas no mesmo PR.
- O módulo exporta dois services, usados pelo controller da tela e pelo módulo `alexa/`:
  - **`TherapistAgendaService`** (consultas, TK-06.02): agenda de um dia, atual e próximo, quem chegou, e a busca de atendimentos de hoje por horário local (usada pela Alexa para "cancelar o atendimento das 14h").
  - **`TherapistActionsService`** (ações, TK-06.03, TK-06.05, TK-06.06 e TK-06.07): iniciar, finalizar, cancelar, bloquear, marcar ausência e a prévia do bloqueio.
- Ambos recebem o massoterapeuta já resolvido (ID do `Therapist`), não o `x-user-id`. A tradução usuário → `Therapist` (perfil existente, usuário ativo) fica numa peça só do módulo, usada pelo controller. A Alexa chega com o massoterapeuta resolvido pelo `AlexaSpeakerResolver` (EP-07).
- **RN-13 é garantida no service:** toda busca de atendimento filtra pelo massoterapeuta. Atendimento de outro massoterapeuta responde `404` com a mesma mensagem de atendimento inexistente.
- O controller do Alexa legado, que hoje usa o `TherapistService`, passa a chamar os services novos com o mínimo de mudança para compilar. A troca completa é do EP-07.
- Transições de estado continuam passando pela tabela de transições (`assertTransitionAllowed`) e por `updateMany` condicionado ao estado lido, como hoje. Corrida perdida responde `409` com frase compreensível.
- Nada de `new Date()`: "agora" vem do `Clock`; "hoje" é o dia local em `America/Sao_Paulo` derivado do instante do `Clock`. O cálculo do início e do fim do dia local fica numa função única reaproveitada (já há cálculo parecido em `reports/` e em `schedules/`; o TK-06.02 consolida o que precisar, sem reescrever os outros módulos).

### Formatador de fala (TK-06.01)

- Funções puras no módulo `notifications/`, ao lado do catálogo de mensagens (o `AGENTS.md` manda a formatação de mensagem para lá). Frases novas entram no catálogo atual (`messages`), num grupo do massoterapeuta; a migração do catálogo para `notifications/messages.ts` não é deste épico.
- Regras de formato:
  - Horário local em `America/Sao_Paulo`: hora cheia vira "14h"; com minutos, "9h30" e "13h05". Preposição "às", exceto 1h e 0h, que usam "à" ("à 1h").
  - Intervalo: "das 15h às 16h".
  - Data de outro dia: "amanhã" ou "na segunda-feira, 26 de outubro"; "hoje" é omitido quando o contexto já é hoje.
  - Pessoas: só o primeiro nome (`firstNameOf`, que já existe).
  - Contagens com singular e plural corretos.
  - No máximo duas frases por `spokenText`, cada uma terminada em ponto. Informação principal primeiro.
- O formatador não conhece estados nem regras: recebe dados prontos (instantes, nomes, números) e devolve texto. Quem decide o que falar é o service.
- Situação de cada atendimento em português, também pelo catálogo: `CONFIRMED` "confirmado", `CHECKED_IN` "chegou", `POSSIBLE_NO_SHOW` "possível ausência", `IN_PROGRESS` "em andamento", `COMPLETED` "concluído", `NO_SHOW` "ausente".

### Rotas

Todas sob `@Roles("THERAPIST")`, sem herança para `HR`/`ADMIN` (o RH não age como massoterapeuta). Toda resposta de sucesso tem `spokenText`; todo erro traz uma mensagem do catálogo em uma frase, pronta para leitura.

| Método e rota | Ticket | O que faz |
| --- | --- | --- |
| `GET /therapists/me/agenda?date=AAAA-MM-DD` | TK-06.02 | Agenda de um dia local, qualquer dia; sem `date`, hoje |
| `GET /therapists/me/arrivals` | TK-06.02 | Check-ins de hoje |
| `POST /therapists/me/appointments/:id/start` | TK-06.03 | Inicia aquele atendimento |
| `POST /therapists/me/sessions/current/start` | TK-06.03 | Inicia o atendimento de agora (sem ID) |
| `POST /therapists/me/appointments/:id/finish` | TK-06.03 | Finaliza aquele atendimento |
| `POST /therapists/me/sessions/current/finish` | TK-06.03 | Finaliza a sessão em andamento (sem ID) |
| `POST /therapists/me/appointments/:id/cancel` | TK-06.06 | Cancela (D-05) |
| `POST /therapists/me/schedule-blocks/preview` | TK-06.07 | Valida o bloqueio e devolve a confirmação ou a recusa, sem gravar |
| `POST /therapists/me/schedule-blocks` | TK-06.07 | Cria o bloqueio |
| `POST /therapists/me/appointments/:id/no-show` | TK-06.05 | Marca ausência |
| `GET /notifications?since=<ISO>` e `POST /notifications/:id/read` | TK-06.04 | Avisos do massoterapeuta para `aria-live` (D-07: consulta periódica) |

`me` não colide com `/therapists/:id/alexa-pairing-code` (RH): os sufixos são diferentes e o `:id` daquela rota é UUID.

### Contrato da agenda (TK-06.02)

Resposta de `GET /therapists/me/agenda` (forma; nomes de campo são o contrato):

```ts
type TherapistAgenda = {
  date: string;                 // AAAA-MM-DD local
  isToday: boolean;
  current: AgendaItem | null;   // só quando isToday
  next: AgendaItem | null;      // só quando isToday
  remainingCount: number;       // itens não finais com fim depois de agora (hoje) ou todos não finais (outro dia)
  items: AgendaItem[];          // ordem cronológica por startsAt, depois por id
  spokenText: string;
};

type AgendaItem = {
  id: string;
  startsAt: string;             // ISO UTC
  endsAt: string;
  spokenTime: string;           // "às 14h"
  status: AppointmentStatus;
  spokenStatus: string;         // "chegou"
  employee: { firstName: string };
  room: { name: string };
  checkedInAt: string | null;
  actions: AgendaAction[];      // só as permitidas agora
  spokenText: string;           // "Ana, às 14h, chegou."
};

type AgendaAction =
  | { kind: "START" | "FINISH" }
  | { kind: "CANCEL" | "MARK_NO_SHOW"; confirmationText: string };
```

- `items` contém todos os atendimentos do dia local, exceto `CANCELLED` e `RELEASED`. `COMPLETED` e `NO_SHOW` aparecem, mas não contam em `remainingCount`.
- **Atual:** o `IN_PROGRESS` do massoterapeuta hoje; se não houver, o atendimento em `CONFIRMED`, `CHECKED_IN` ou `POSSIBLE_NO_SHOW` cujo intervalo `[startsAt, endsAt)` contém agora.
- **Próximo:** o primeiro atendimento em `CONFIRMED`, `CHECKED_IN` ou `POSSIBLE_NO_SHOW` com `startsAt` depois de agora e diferente do atual.
- `actions` segue a tabela de transições com ator `THERAPIST` e as regras desta spec:
  - `START` em `CONFIRMED`/`CHECKED_IN`/`POSSIBLE_NO_SHOW`, só dentro da janela de início (ver "Ações");
  - `FINISH` em `IN_PROGRESS`;
  - `CANCEL` em `BOOKED`/`CONFIRMED`, com `confirmationText` "Cancelar o atendimento de Ana às 14h. Confirma?";
  - `MARK_NO_SHOW` em `POSSIBLE_NO_SHOW`, com `confirmationText` "Marcar Ana como ausente no atendimento das 14h. Confirma?".
- `spokenText` da agenda de hoje, por ordem de prioridade:
  - com atual e próximo: "Agora: Ana, até 14h20. Próximo: Bruno, às 14h30.";
  - sem atual: "Hoje, 3 atendimentos. Próximo: Ana, às 14h." (o mesmo sentido do ALX-02, com o primeiro ainda por vir);
  - sem nada por vir, mas com o dia preenchido: "Você não tem mais atendimentos hoje.";
  - dia vazio: "Você não tem atendimentos hoje.".
- Agenda de outro dia (passado ou futuro, sem limite): sem `current`/`next`; `spokenText` "Na segunda-feira, 26 de outubro, 4 atendimentos. Primeiro: Ana, às 9h.". `date` inválida responde `400` com frase do catálogo.
- A Alexa usa o mesmo service: "quem é o próximo" fala a parte do próximo; "agenda de hoje" fala o resumo. Frases específicas da voz (ALX-01 a ALX-03) saem do mesmo formatador.

### Quem chegou (TK-06.02)

- Atendimentos do massoterapeuta hoje com `checkedInAt` preenchido, em qualquer estado diferente de `CANCELLED` (RN-14). Lista em ordem cronológica do check-in.
- `spokenText`: o mais recente primeiro ("Ana chegou às 13h55."); com mais de um, acrescenta o total ("Ana chegou às 13h55. Hoje, 3 pessoas chegaram."); sem nenhum, "Ninguém chegou ainda.".

### Busca por horário falado (TK-06.02, para o EP-07)

- `TherapistAgendaService` expõe a busca dos atendimentos de hoje do massoterapeuta que começam num dos horários locais recebidos (lista de candidatos, porque "às duas" pode ser 2h ou 14h) e que permitem uma ação dada (por exemplo, cancelar). Devolve zero, um ou mais. A interpretação do slot `AMAZON.TIME` (quais candidatos) é do EP-07; qual atendimento casa é daqui.

### Ações (TK-06.03, TK-06.06 e TK-06.07)

- **Janela de início (decisão de 2026-10-23):** um atendimento só pode ser iniciado de `startsAt − antecedência do check-in` (RN-09, `checkInEarlyMinutes` lido do `BusinessRulesService`) até `endsAt`. Vale com e sem ID. Fora da janela: `409` "Este atendimento ainda não pode ser iniciado." ou "O horário deste atendimento já terminou.".
- **Iniciar por ID:** atendimento em `CONFIRMED`, `CHECKED_IN` ou `POSSIBLE_NO_SHOW`, dentro da janela. Recusa se o massoterapeuta já tem uma sessão `IN_PROGRESS` ("Finalize a sessão com Ana antes de iniciar outra."), porque o mesmo massoterapeuta não atende dois ao mesmo tempo (RN-12). Grava `sessionStartedAt`. Resposta: "Sessão com Ana iniciada.".
- **Iniciar o atual (sem ID):** o alvo é, entre os atendimentos que podem ir para `IN_PROGRESS` e estão dentro da janela, o de `startsAt` mais perto de agora; empate fica com o mais cedo. Mesma recusa se já houver sessão em andamento. Sem candidato: "Não há atendimento para iniciar agora.".
- **Finalizar:** o alvo é o `IN_PROGRESS` do massoterapeuta (sem ID) ou o informado (com ID). Grava `sessionEndedAt`. Resposta: "Sessão finalizada." mais o próximo, se houver ("Próximo: Bruno, às 15h."). Sem sessão: "Nenhuma sessão em andamento.".
- **Cancelar (D-05):**
  - Não aplica a RN-01. O cancelamento pelo massoterapeuta deixa de passar pela verificação de antecedência; a do colaborador continua igual.
  - Estados aceitos pela tabela de transições (`BOOKED`, `CONFIRMED`).
  - **Não oferece a vaga à lista de espera** (decisão de 2026-10-23): o listener da lista de espera ignora o cancelamento quando quem cancelou tem o papel `THERAPIST`. Cancelamento pelo colaborador e pelo RH continua oferecendo a vaga (RN-10).
  - Avisa o colaborador pelo `NotificationChannel`, com o novo `NotificationKind` `APPOINTMENT_CANCELLED_BY_THERAPIST` e a MSG-07: "Seu atendimento de {data}, às {hora}, com {primeiro_nome}, foi cancelado pelo massoterapeuta. Você pode reservar outro horário na página inicial." Sem motivo. Pede migração do enum.
  - Cancela os avisos pendentes daquele atendimento, como hoje.
  - Resposta: "Cancelado.".
- **Bloquear:**
  - As regras moram no service do módulo `schedule-blocks/`, criado no TK-03.06 (bloqueio pelo RH). O TK-06.07 só chama esse service com o massoterapeuta resolvido como dono e ator. Ver a spec do EP-03, seção 5.
  - Regras (as mesmas para o RH e o massoterapeuta):
    - início antes do fim;
    - início não anterior a agora;
    - início e fim no mesmo dia local (vários dias = um bloqueio por dia);
    - dentro do horário de funcionamento (RN-08, `WORK_DAYS`, `WORK_START`, `WORK_END` do `BusinessRulesService`); pode cobrir o almoço;
    - não precisa estar dentro de um `ScheduleSlot`;
    - D-04: atendimentos do massoterapeuta em `BOOKED`, `CONFIRMED`, `CHECKED_IN`, `POSSIBLE_NO_SHOW` ou `IN_PROGRESS` que se sobreponham ao período → `409` com a lista (ordem cronológica, formato de `AgendaItem`) e `spokenText` "Há 2 atendimentos nesse período, o primeiro às 15h. Cancele-os antes de bloquear.";
    - outro bloqueio do mesmo massoterapeuta sobreposto → `409` "Esse período já está bloqueado.".
  - **Prévia** (`/preview`): aplica todas as regras sem gravar. Sucesso devolve `confirmationText` ("Bloquear das 15h às 16h. Confirma?"; "Bloquear amanhã, das 15h às 16h. Confirma?" para outro dia); recusa devolve o mesmo erro que a criação devolveria. A Alexa usa a prévia antes de perguntar "Confirma?".
  - A criação reaplica as regras numa transação, porque a agenda pode ter mudado depois da prévia.
  - Resposta: "Bloqueado.". Auditoria `SCHEDULE_BLOCK_CREATED`, como hoje.
- **Auditoria:** cada ação registra `AuditEvent` com o massoterapeuta como ator: `SESSION_STARTED`, `SESSION_FINISHED` (já existem), cancelamento pelo listener existente, `SCHEDULE_BLOCK_CREATED` e o novo `APPOINTMENT_MARKED_NO_SHOW`. Os nomes falados das ações novas entram no catálogo de auditoria do RH (`reports.auditActionNames`).

### Eventos de domínio (decisão de 2026-10-23)

- Continuam na classe `AppointmentEvents`; a migração para o `@nestjs/event-emitter` fica como pendência no roadmap.
- **Cancelamento corrigido:** o payload passa a ser `{ appointmentId, employeeId, cancelledById, cancelledByRole }`. `employeeId` é sempre o colaborador do atendimento (hoje vai o ID de quem cancelou). Os listeners de auditoria e da lista de espera passam a usar os campos novos.
- **Ausência (novo):** `emitNoShow` / `onNoShow`, com `{ appointmentId, therapistId, markedById }`. Usado pelo EP-07 para apagar o lembrete falado (TK-07.10).
- Os dois contratos são revisados pela Mariana na revisão desta spec (regra de convivência do roadmap).

### Confirmação (RN-13; decisões de 2026-10-22 e 2026-10-23)

- O backend não guarda estado de confirmação. Ele fornece o **texto da pergunta** (`confirmationText` na agenda para cancelar e marcar ausência; a prévia para bloquear) e o **texto do resultado** (`spokenText` da ação). Quem pergunta e espera o "sim" é o cliente: o diálogo de confirmação acessível na tela (EP-11) e o `Dialog.ConfirmIntent` na Alexa (EP-07).
- A segurança contra "o alvo mudou entre a pergunta e o sim" vem do `updateMany` condicionado ao estado e, no bloqueio, da revalidação na transação.
- Pedem confirmação: cancelar, bloquear e marcar ausência. Iniciar e finalizar não.

### Marcar ausência (TK-06.05)

- Só `POSSIBLE_NO_SHOW` → `NO_SHOW`, ator `THERAPIST`, pela tabela de transições. Antes da tolerância (ainda `CONFIRMED`), a ação não aparece e a rota responde `409` com "Ainda está dentro da tolerância de atraso." (RN-02).
- Registra `APPOINTMENT_MARKED_NO_SHOW` (quando e quem; nenhuma coluna nova em `Appointment`).
- Cancela os avisos pendentes daquele atendimento, como o cancelamento já faz.
- Emite o evento de ausência.
- Resposta: "Ausência registrada." mais o próximo, se houver.

### Avisos para a tela (TK-06.04, D-07)

- D-07 decidida em 2026-10-26: consulta periódica no protótipo. O feed é o `GET /notifications` existente, acrescido de: filtro "desde" (para buscar só o que é novo), ordem cronológica, `spokenText` de cada aviso pronto para `aria-live` e marcação como lido. Os avisos do massoterapeuta (chegada, possível ausência) já são gerados pelo EP-05.
- Marcar como lido grava `notifications.read_at` (única coluna nova além do `NotificationKind`) e é idempotente; aviso de outro usuário responde `404`.

### Dados e schema

- `NotificationKind` ganha `APPOINTMENT_CANCELLED_BY_THERAPIST`.
- `Notification` ganha `readAt` (`read_at`), para marcar aviso como lido (TK-06.04).
- Nenhuma outra mudança de schema: `ScheduleBlock`, `sessionStartedAt`, `sessionEndedAt` e `checkedInAt` já existem, e a ausência fica registrada no `status` e no `AuditEvent`.

### Privacidade e logs

- Respostas expõem do colaborador só `firstName`. Nada de e-mail, nome completo ou ID de usuário do colaborador.
- Logs só com IDs (massoterapeuta, atendimento, bloqueio), pelo `Logger` do Nest.

---

## Testing Decisions

### O que é um bom teste aqui

- Testa o comportamento de fora: uma requisição HTTP entra, uma resposta sai, e o banco muda (ou não). Não testa nomes de métodos privados, a ordem das consultas nem qual service interno foi chamado.
- Os nomes dos testes citam o requisito (`it('D-05: lets the therapist cancel inside the minimum notice and notifies the employee')`).
- Relógio sempre falso (`FakeClock` pelo `createTestApp({ clock })`), com casos perto da meia-noite em `America/Sao_Paulo` (por exemplo, 23h30 locais = 02h30 UTC do dia seguinte) para "hoje", atual, próximo e quem chegou, e nas bordas da janela de início.
- Textos falados têm teste de conteúdo, tamanho (no máximo duas frases), ordem (informação principal primeiro) e privacidade (só primeiro nome, sem IDs, sem ISO, sem UTC), como pede a seção "Acessibilidade" do `AGENTS.md`.
- Nenhum teste chama serviço externo; avisos são verificados pela tabela de avisos ou pelo `InMemoryNotificationChannel`.

### Seams

1. **Principal — a API `/api/therapists/me/*` de ponta a ponta** (e2e em `test/`, banco real). Cobre agenda (hoje, outro dia, vazia, atual e próximo, ordem, estados excluídos), quem chegou, todas as ações (sucesso, recusa por estado, janela de início, corrida perdida, posse de outro massoterapeuta), confirmações e prévia de bloqueio, D-04, D-05 com aviso ao colaborador e **sem** oferta à lista de espera, marcar ausência, auditoria e permissões. Os services exportados para a Alexa são exercitados por aqui; o EP-07 os exercita de novo pela seam dele (`POST /api/alexa`).
2. **Formatador de fala** (unitário, funções puras). É uma seam porque o TK-06.01 pede testes de formato, tamanho e ordem independentes de banco, e porque tela e Alexa dependem do mesmo texto. Casos: hora cheia, com minutos, "à 1h", intervalo, plural/singular, primeiro nome com espaços extras, outro dia, nunca mais de duas frases.

Nenhuma seam nova além dessas. A busca por horário falado (para a Alexa) é testada pela seam 1 de forma indireta e pela seam do EP-07; se o EP-07 começar antes da tela, um teste unitário do `TherapistAgendaService` com `Test.createTestingModule` cobre só essa busca. As regras de bloqueio têm os testes completos no TK-03.06; aqui só os casos vistos pelo massoterapeuta (posse, prévia, D-04, duplicado).

### Por módulo

- `therapists/`: e2e pela seam 1.
- `notifications/` (formatador): unitário pela seam 2.
- `schedule-blocks/`: testes do TK-03.06; o EP-06 só cobre o uso pelo massoterapeuta.
- `waitlist/`: e2e que confirma que o cancelamento pelo massoterapeuta não gera oferta e que o do colaborador continua gerando.
- Matriz de permissões: as linhas `/therapist/*` saem e as `/therapists/me/*` entram, só `THERAPIST`; `HR` e `ADMIN` recebem `403`.
- Concorrência: duas requisições simultâneas de iniciar o mesmo atendimento, e cancelamento pelo colaborador concorrente com o do massoterapeuta; só uma vence, a outra recebe `409` com frase.

### Prior art

- `test/next-appointment.e2e-spec.ts` e `test/my-appointments.e2e-spec.ts`: agenda com relógio falso e `spokenText` para o colaborador.
- `test/check-in.e2e-spec.ts` e `test/attendance-tolerance.e2e-spec.ts`: dados de check-in e `POSSIBLE_NO_SHOW` criados por teste.
- `test/appointment-cancellation.e2e-spec.ts` e `test/waitlist.e2e-spec.ts`: cancelamento, aviso e oferta à fila.
- `test/schedules-appointments.e2e-spec.ts`: recusa com lista de atendimentos conflitantes (mesmo formato da D-04).
- `test/status-transitions.e2e-spec.ts` e `test/appointment-audit.e2e-spec.ts`: transições e auditoria.
- `test/permissions.e2e-spec.ts`: matriz de rotas e papéis.
- `src/common/names/first-name.spec.ts` e `src/reports/report-date.spec.ts`: unitários de funções puras de nome e data, modelo para o formatador.

---

## Out of Scope

- A tela do massoterapeuta (EP-11): este épico entrega a API e os textos; o diálogo de confirmação, o foco e o `aria-live` são do frontend.
- Toda a parte da Alexa (EP-07): modelo de interação, interpretação do `AMAZON.TIME`, identificação de quem fala, confirmação por voz e lembrete falado. Daqui ela usa só os services e o formatador.
- Bloqueio pelo RH e as regras de bloqueio em si (TK-03.06); aqui só o uso pelo massoterapeuta.
- Desfazer ações (reabrir sessão finalizada, desfazer cancelamento ou ausência, remover bloqueio). Remover bloqueio pelo massoterapeuta pode virar ticket depois.
- Liberar para a lista de espera um horário que o massoterapeuta cancelou (cancelar quer dizer "não vou atender"); pode virar ação própria depois.
- Motivo do cancelamento informado pelo massoterapeuta.
- Iniciar, finalizar e marcar ausência em outros dias além de hoje.
- Reagendamento (RF-08, D-03).
- Entrega em tempo real por SSE (a D-07 decidiu por consulta periódica no protótipo).
- Migração dos eventos para o `@nestjs/event-emitter` (pendência no roadmap).
- Migração do catálogo de mensagens para `notifications/messages.ts`.
- Login real (Google); a identificação continua pelo `x-user-id` (D-12).

---

## Further Notes

### Ordem e dependências

- TK-06.01 não depende de nada e destrava o TK-06.02 e as consultas da Alexa (TK-07.06).
- TK-06.02 depende do TK-06.01 e do TK-04.02.
- TK-06.03 (iniciar e finalizar) depende do TK-06.02. Cria o `TherapistActionsService` e o padrão das ações (posse, transição, `updateMany` condicionado, auditoria).
- TK-06.06 (cancelar) depende do TK-06.03.
- TK-06.07 (bloquear) depende do TK-06.03 e do TK-03.06 (regras de bloqueio).
- TK-06.03, TK-06.06 e TK-06.07 juntos destravam as ações por voz (TK-07.07) e a tela de ações (TK-11.02).
- O TK-06.03 da primeira versão do roadmap foi dividido em 2026-10-23 em TK-06.03, TK-06.06 e TK-06.07, para caber cada um numa sessão de trabalho.
- Cada ticket tira a rota legada `/therapist/*` que substitui e troca a linha da matriz de permissões; o último a terminar apaga o módulo `therapist/`.
- TK-06.05 depende do TK-05.03 (já entregue) e do TK-06.03 (padrão das ações). Não depende do TK-06.06: o evento de ausência é novo.
- TK-06.04 destravado pela D-07 (2026-10-26).
- O Guilherme faz o EP-03 por completo (2026-10-23), então o TK-03.06 entra antes do TK-06.07 na mesma trilha.

### Divergências e pendências

- A confirmação em marcar ausência refina a decisão de 2026-10-22 ("só cancelar e bloquear"); registrada no `requisitos.md` em 2026-10-23 e alinhada ao `AGENTS.md`.
- As frases desta spec são sugestões; a versão final sai da validação com os massoterapeutas (TK-14.03). Mudar uma frase não muda o contrato dos campos.
- A RN-12 revisada (vários massoterapeutas na mesma sala, TK-03.09) não muda esta API: a sobreposição que importa aqui é a do mesmo massoterapeuta.
