# EP-07 — Alexa

Status: ⬜ Planejada (especificação do épico)  
Marco: M3  
Épico: EP-07 · Roadmap: `docs/roadmap.md` · Roteiro de testes no aparelho: `docs/alexa/roadmap.md`  
Triage: `ready-for-agent`  
Tickets: TK-07.01 a TK-07.10  
Requisitos: RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-16, RF-17, RN-13, RN-14, RN-15, RN-17, RNF-01, RNF-02, RNF-03, RNF-04, RNF-05  
Decisões relacionadas: D-04 (2026-10-20), D-05, D-15, D-16, D-18 e D-19 (2026-10-22), D-09 e nome de invocação (2026-10-23), D-20 (em aberto, não trava este épico)  
Revisão: Mariana (regra de convivência do roadmap: a spec do EP-07 é revisada por ela)

Criada em 2026-10-22. Fonte de verdade: `docs/requisitos.md`. Onde esta spec e o `requisitos.md` divergirem, vale o `requisitos.md`.

> **Decisões de 2026-10-22 refletidas nesta spec** (registradas no `requisitos.md`):
> - **D-19:** o aparelho guarda vários massoterapeutas vinculados. A Alexa deduz quem fala e, se não der, pergunta o nome.
> - **D-05:** a RN-01 não vale para o massoterapeuta.
> - **Confirmação:** só cancelar e bloquear pedem confirmação por voz.
> - **D-15:** o lembrete só é criado durante uma conversa com a Alexa.
> - **D-16:** o lembrete não diz o nome do colaborador.
>
> **Decisões de 2026-10-23:**
> - **D-09:** frontend na Vercel; backend e PostgreSQL em contêiner sempre ligado (Render, Railway ou Fly.io).
> - **Nome de invocação:** "pausa".
> - **Sala:** uma Alexa por sala, com vários massoterapeutas atendendo **ao mesmo tempo** na mesma sala (RN-12 revisada, TK-03.09). A pergunta "Quem está falando?" passa a ser o caso comum.
> - **Schema:** o schema de `AlexaDevice` com vários massoterapeutas foi combinado com a Mariana.
> - **Lembrete:** o TK-07.09 confirma o desenho do lembrete num Echo real o quanto antes.

## Limitações da plataforma

Restrições da Amazon que moldam as decisões abaixo. Fontes: [Reminders API](https://developer.amazon.com/en-US/docs/alexa/smapi/alexa-reminders-api-reference.html), [Reminders overview](https://developer.amazon.com/docs/smapi/alexa-reminders-overview.html), [Personalization](https://developer.amazon.com/docs/custom-skills/add-personalization-to-your-skill.html), [Host a custom skill as a web service](https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html).

| # | Limitação | Consequência nesta spec |
| --- | --- | --- |
| L1 | A Reminders API só **cria** lembrete durante uma conversa, com o token da própria requisição ("Reminders can only be created in session"). Fora da conversa, só consultar, listar e apagar; sobre atualizar, a documentação se contradiz | O lembrete nasce na conversa; cancelar apaga; mudar = apagar e recriar na próxima conversa |
| L2 | O lembrete exige permissão concedida no app da Alexa e interrompe o que estiver tocando. Há um limite por aparelho (cerca de 500) | Permissão é passo de instalação; a falta dela não quebra nada |
| L3 | O perfil de voz (`personId`) só vem se a voz estiver cadastrada na conta Amazon dona do Echo, com a opção "Personalizar skills" ligada | Não é usado para identificar quem fala; a Alexa pergunta o nome |
| L4 | O horário da requisição tolera no máximo 150 s. HTTPS na porta 443, com certificado aceito pela Amazon (autoassinado só em teste). A Alexa desiste depois de 8 s sem resposta | `AlexaSignatureGuard`; backend em contêiner sempre ligado, não em função serverless (D-09) |
| L5 | A Alexa não fala sozinha um texto livre; só o lembrete toca sem ser chamado | "Fulano chegou" continua só na tela |
| L6 | Cada pedido começa com o nome de invocação ("Alexa, pergunte à {skill}…"), a não ser que a conversa já esteja aberta. Cada pergunta assim abre uma conversa nova | Perguntar o nome em toda conversa seria atrito: por isso a Alexa deduz quem fala sempre que puder |
| L7 | Skill em desenvolvimento só roda em aparelhos da conta do desenvolvedor ou de testadores beta | Os Echos da demonstração precisam estar numa dessas contas |
| L8 | O slot de número pode perder zeros à esquerda | O código de pareamento é completado com zeros até 6 dígitos |
| L9 | Na certificação, o nome de invocação de uma palavra só é aceito se for marca própria. Nomes genéricos ou parecidos com comandos nativos podem falhar ("pausa" é também o comando de pausar mídia) | "pausa" vale para o MVP, que não passa por certificação; testar "Alexa, abrir pausa" e "Alexa, pergunte à pausa…" no aparelho. Alternativa: "pausa massagem" |

---

## Problem Statement

O massoterapeuta com deficiência visual não tem um canal direto até a própria agenda. Hoje ele espera: não sabe quem é o próximo atendimento, não sabe se a pessoa já chegou e depende de alguém que enxerga para saber de qualquer mudança. A Alexa na sala é o canal mais natural para ele, mas o corte atual da skill não serve para uso real:

- Qualquer pessoa pode chamar o endpoint da Alexa e se passar pela Amazon: não há verificação de assinatura, certificado nem horário da requisição (RNF-03). Sem isso a skill também é reprovada na certificação.
- O aparelho não sabe quem é o massoterapeuta. A identificação vem de um mapa fixo no ambiente (`ALEXA_USER_MAP`); o código de pareamento que o RH já consegue gerar (TK-03.08) não tem como ser usado por voz.
- As ações (iniciar, finalizar, cancelar) pedem o identificador do atendimento, algo que ninguém consegue falar. Nenhuma ação pede confirmação antes de alterar dados.
- As respostas usam o nome completo do colaborador, listam a agenda inteira numa frase longa e calculam "hoje" com o relógio e o fuso do servidor.
- Os textos falados estão espalhados no controller, fora do catálogo de mensagens, e todos os intents vivem num único construtor, sem teste.
- Não há lembrete falado antes da sessão (RF-16), e não se sabe ainda se a Amazon permite criá-lo a partir do backend.
- Uma mesma Alexa pode atender vários massoterapeutas (RN-17), mas o modelo atual liga cada aparelho a um único massoterapeuta.

Sem este épico, a métrica principal do projeto ("o massoterapeuta passa o dia sem pedir informação a ninguém") não tem como ser alcançada pela voz.

---

## Solution

Ao término do EP-07, o massoterapeuta fala com a Alexa da sala e:

1. **Vincula o aparelho** dizendo "vincular código 482913", com o código que o RH gerou para ele. Um aparelho não vinculado explica o que fazer, em uma frase.
2. **Consulta a agenda** sem dizer identificadores: "quem é o próximo", "qual minha agenda de hoje", "quem chegou". As respostas têm uma ou duas frases, usam só o primeiro nome do colaborador e falam o horário como se fala ("às 14h"), no fuso `America/Sao_Paulo`.
3. **Age sobre a própria agenda** por horário falado ou pelo contexto do momento: "cancelar o atendimento das duas da tarde", "bloquear das 15h às 16h", "iniciar sessão", "finalizar sessão". Cancelar e bloquear, que afetam o colaborador, são anunciados e só acontecem depois de um "sim" explícito numa segunda fala; "não" ou silêncio não altera nada. Iniciar e finalizar acontecem na hora, e a resposta diz o que foi feito.
4. **Pede ajuda, repete e sai** a qualquer momento: "ajuda", "repetir", "parar". Uma frase não entendida leva a uma sugestão curta do que dizer.
5. **Ouve um lembrete** antes de cada sessão ("Sua próxima sessão começa em 5 minutos."). Os lembretes do dia são criados quando ele conversa com a Alexa e apagados quando a sessão é cancelada (D-15).

Numa Alexa compartilhada (RN-17), ele não precisa se identificar quando a agenda já diz quem está trabalhando. Quando não diz, a Alexa pergunta "Quem está falando?" uma vez por conversa (D-19).

Do lado do sistema:

- O endpoint da Alexa só aceita requisições assinadas pela Amazon, recentes e destinadas à nossa skill.
- Cada intent é uma classe com `canHandle`/`handle`; o controller só despacha. Intents novos entram como classes novas.
- A Alexa não tem regra de negócio própria: consultas e ações chamam os mesmos services do EP-06 que atendem a tela do massoterapeuta, e as frases vêm do formatador de fala (TK-06.01) e do catálogo de mensagens.
- O modelo de interação pt-BR fica versionado no repositório e é publicado pela ASK CLI.

---

## User Stories

### Vínculo do aparelho

1. Como massoterapeuta, quero vincular a Alexa da sala dizendo "vincular código" seguido dos seis dígitos que o RH me passou, para que o aparelho saiba que a agenda é minha sem eu precisar de ajuda de alguém que enxerga.
2. Como massoterapeuta, quero ouvir uma confirmação curta com o meu primeiro nome depois do vínculo, para saber que deu certo.
3. Como massoterapeuta, quero que um código errado, expirado ou já usado seja recusado com uma frase dizendo o que fazer ("Peça um novo código ao RH."), para não ficar sem saber por que não funcionou.
4. Como massoterapeuta, quero poder dizer o código com ou sem pausas e começando com zero, para que o vínculo não falhe por causa do jeito de falar os números.
5. Como massoterapeuta, quero que um aparelho não vinculado me diga, em uma frase, que precisa de um código do RH, em vez de responder com um erro genérico.
6. Como RH, quero que o código que eu gerei deixe de valer assim que for usado, para que ninguém vincule outro aparelho com o mesmo código.
7. Como RH, quero que cada vínculo gere um evento de auditoria com o aparelho, o massoterapeuta e o código usado, para conseguir rastrear quem está ligado a qual Alexa.
8. Como massoterapeuta que divide a Alexa com colegas, quero que vincular o meu código acrescente o meu nome ao aparelho sem desvincular os outros, para que todos continuem usando a mesma Alexa (RN-17, D-19).
9. Como massoterapeuta, quero poder vincular mais de um aparelho à minha agenda (por exemplo, quando troco de sala), para continuar sendo atendido onde eu estiver.
10. Como RH, quero que um massoterapeuta desativado deixe de ser atendido por qualquer Alexa, para que um ex-profissional não consulte agenda nenhuma.
10a. Como massoterapeuta, quero que a Alexa não me pergunte quem sou quando só eu estou vinculado ao aparelho, ou quando só eu tenho agenda naquele horário, para não repetir o meu nome a cada pedido (D-19).
10b. Como massoterapeuta, quero que, quando não der para saber quem fala, a Alexa pergunte "Quem está falando?" e aceite o meu primeiro nome, para que a resposta seja sobre a minha agenda.
10c. Como massoterapeuta, quero dizer o meu nome uma vez e seguir a conversa sem repeti-lo, para que a pergunta não atrapalhe.
10f. Como massoterapeuta que atende ao mesmo tempo que colegas na mesma sala, quero poder dizer o meu nome já no pedido ("aqui é a Diana, quem é o próximo?"), para não ter de responder "Quem está falando?" toda vez.
10d. Como massoterapeuta, quero que um nome que não é de ninguém vinculado ao aparelho seja recusado com uma frase dizendo quem pode usar ("Esta Alexa atende Bruno e Diana."), para entender o que aconteceu.
10e. Como massoterapeuta, quero que, se dois vinculados tiverem o mesmo primeiro nome, a Alexa peça o sobrenome, para não confundir as agendas.

### Consultas

11. Como massoterapeuta, quero perguntar "quem é o próximo" e ouvir o primeiro nome e o horário ("Próximo: Ana, às 14h."), para me preparar sem depender de ninguém (RF-11, ALX-01).
12. Como massoterapeuta, quero ouvir "Você não tem mais atendimentos hoje." quando não houver próximo, para saber que posso encerrar ou descansar.
13. Como massoterapeuta, quero perguntar "qual minha agenda de hoje" e ouvir quantos atendimentos tenho e qual é o primeiro ainda por vir ("Hoje, 5 atendimentos. Primeiro: Ana, às 9h."), para ter o resumo do dia em uma frase (RF-10, ALX-02).
14. Como massoterapeuta, quero que a agenda do dia considere o dia em `America/Sao_Paulo`, para que perto da meia-noite UTC a Alexa não fale a agenda de amanhã.
15. Como massoterapeuta, quero perguntar "quem chegou" e ouvir quem fez check-in hoje para os meus atendimentos ("Ana chegou às 13h55."), para saber se posso começar (RF-15, RN-14, ALX-03).
16. Como massoterapeuta, quero ouvir "Ninguém chegou ainda." quando não houver check-in, para não ficar esperando uma resposta que não vem.
17. Como massoterapeuta, quero que, quando várias pessoas tiverem chegado, a Alexa fale a mais recente primeiro e diga quantas são, sem uma lista longa, para que a resposta caiba em uma ou duas frases.
18. Como colaborador, quero que a Alexa fale só o meu primeiro nome e nenhum dado de saúde, porque outra pessoa pode estar na sala (RNF-04).
19. Como massoterapeuta, quero que as consultas não incluam atendimentos cancelados, liberados ou de outro massoterapeuta, para que a informação seja a que importa para mim.

### Ações com confirmação

20. Como massoterapeuta, quero dizer "cancelar o atendimento das duas da tarde" e ouvir "Cancelar o atendimento de Ana às 14h. Confirma?", para conferir antes de mudar a agenda (RF-12, ALX-04).
21. Como massoterapeuta, quero que só um "sim" explícito numa segunda fala execute o cancelamento ou o bloqueio, e que "não" ou silêncio os descarte com uma frase dizendo que nada mudou, para nunca alterar a agenda do colaborador por engano (RN-13).
22. Como massoterapeuta, quero ouvir "Cancelado." depois de confirmar, para saber que a ação aconteceu.
23. Como massoterapeuta, quero ouvir "Não há atendimento às 14h hoje." quando não houver sessão no horário falado, para entender por que nada aconteceu.
24. Como massoterapeuta, quero que "duas da tarde", "14h" e "duas" encontrem o mesmo atendimento quando só houver uma interpretação possível na minha agenda, para não ter que falar o horário de um jeito específico.
25. Como colaborador, quero ser avisado quando o massoterapeuta cancelar o meu atendimento por voz, como já acontece pela tela, para não ir à sala à toa.
26. Como massoterapeuta, quero dizer "bloquear das três às quatro da tarde" e ouvir "Bloquear das 15h às 16h. Confirma?", para fechar um período da minha agenda de hoje (RF-13, ALX-05).
27. Como massoterapeuta, quero que o bloqueio seja recusado quando houver atendimentos marcados no período, ouvindo quantos são e o primeiro deles, para decidir conscientemente se cancelo antes (D-04).
28. Como massoterapeuta, quero que um bloqueio com fim antes do início, fora do horário de funcionamento ou com um horário vago ("de tarde") seja recusado com uma frase que diga como falar, para não criar um bloqueio errado.
29. Como massoterapeuta, quero dizer "iniciar sessão" e ouvir na hora "Sessão com Ana iniciada.", sem dizer o horário e sem pergunta de confirmação, para começar o atendimento do momento sem atrito (RF-14, ALX-06).
30. Como massoterapeuta, quero poder iniciar a sessão mesmo que o colaborador não tenha feito check-in ou esteja como possível ausência, porque ele pode estar na minha frente sem ter lido o QR Code.
31. Como massoterapeuta, quero dizer "finalizar sessão" e ouvir na hora "Sessão finalizada. Próximo: Bruno, às 15h.", para já saber o que vem depois (RF-14, ALX-07).
32. Como massoterapeuta, quero ouvir uma frase clara quando não houver sessão para iniciar ou finalizar ("Nenhuma sessão em andamento."), para não achar que a Alexa travou.
33. Como massoterapeuta, quero que, se a agenda mudar entre a pergunta de confirmação e o meu "sim" (por exemplo, o colaborador cancelou), o cancelamento ou o bloqueio não seja executado e eu ouça o motivo, para nunca agir sobre um atendimento diferente do que ouvi.
33a. Como massoterapeuta, quero cancelar um atendimento a qualquer momento, mesmo perto do horário, porque posso passar mal ou ter um imprevisto; o colaborador é avisado (D-05).
34. Como massoterapeuta, quero que a Alexa só aja sobre a minha própria agenda, nunca sobre a de um colega que usa o mesmo aparelho (RN-13, RN-17).
35. Como RH, quero que toda ação feita por voz gere o mesmo evento de auditoria que a ação feita pela tela, com o massoterapeuta como ator, para que o histórico seja completo.

### Ajuda, repetição, saída e erros

36. Como massoterapeuta, quero abrir a skill e ouvir uma saudação curta com dois exemplos do que dizer, para lembrar os comandos.
37. Como massoterapeuta, quero dizer "ajuda" e ouvir uma lista curta do que posso pedir, para descobrir os comandos sem manual (ALX-08).
38. Como massoterapeuta, quero dizer "repetir" e ouvir de novo a última resposta, para não perder uma informação que não entendi (RNF-02).
39. Como massoterapeuta, quero dizer "parar" ou "cancelar" a qualquer momento e encerrar sem mudar nada, para sair de uma conversa que não quero continuar (ALX-09).
40. Como massoterapeuta, quero que uma frase que a Alexa não entendeu receba uma sugestão do que dizer, em vez de silêncio ou erro.
41. Como massoterapeuta, quero que, se algo der errado no sistema, a Alexa diga em uma frase que não conseguiu e que posso tentar de novo, sem códigos nem termos técnicos.
42. Como massoterapeuta, quero respostas rápidas, para que a Alexa não desista da conversa por demora (RNF-02).

### Lembrete falado

43. Como massoterapeuta, quero ouvir a Alexa dizer sozinha "Sua próxima sessão começa em 5 minutos." antes de cada sessão confirmada, para me preparar sem perguntar (RF-16, RN-15).
43a. Como massoterapeuta, quero que, ao abrir a skill ou pedir a agenda do dia, a Alexa prepare os lembretes das minhas sessões restantes de hoje sem eu pedir, para não ter um passo a mais (D-15).
43b. Como massoterapeuta, quero que os lembretes já criados não sejam duplicados quando eu falar com a Alexa de novo, para não ouvir o mesmo aviso duas vezes.
44. Como massoterapeuta, quero que o lembrete de uma sessão cancelada, liberada ou marcada como ausência seja apagado na hora, mesmo sem eu falar com a Alexa, porque um lembrete errado é pior do que nenhum.
44a. Como massoterapeuta, quero saber que uma sessão marcada depois da minha última conversa com a Alexa só ganha lembrete na próxima conversa, para não contar com um aviso que não vai tocar (limitação L1).
45. Como colaborador, quero que o lembrete não fale o meu nome, porque outra pessoa pode estar na sala (D-16).
46. Como RH, quero ajustar a antecedência do lembrete como um parâmetro de negócio, sem novo deploy (RF-27).
47. Como massoterapeuta, quero que a falta de permissão de lembretes no app da Alexa não quebre a conversa: a resposta continua normal, e o RH consegue saber que o lembrete não foi criado.

### Segurança e operação

48. Como responsável pela aplicação, quero que requisições sem assinatura válida, com certificado inválido, com horário fora da tolerância ou destinadas a outra skill sejam rejeitadas sem resposta de voz, para que ninguém se passe pela Amazon (RNF-03).
49. Como desenvolvedor, quero publicar o modelo de interação a partir de um arquivo versionado, para que frases e intents sejam revisados em PR como o código.
50. Como desenvolvedor, quero acrescentar um intent novo criando uma classe nova, sem editar o controller nem os outros intents, para que a skill cresça sem regressões.
51. Como desenvolvedor, quero testar toda a conversa pela API, com relógio falso e verificador de assinatura substituído, para não depender de um Echo nem da Amazon nos testes.
52. Como responsável pela privacidade, quero que os logs da Alexa tenham só IDs (nada de nome, frase falada ou código de pareamento), para cumprir a LGPD (RNF-04).

---

## Implementation Decisions

### Módulo e responsabilidades

- Tudo fica no feature module `alexa/`, que já existe (hoje com a geração do código de pareamento do TK-03.08). O `AlexaController` legado é substituído; o `ask-sdk-core` (`SkillBuilders`) sai do caminho da requisição. Conforme o `AGENTS.md`, o SDK da Alexa é usado só para verificar a assinatura; o resto é JSON puro, tipado com `ask-sdk-model`.
- O módulo `alexa/` **não tem regra de agenda**. Consultas e ações chamam os services exportados pelo módulo do massoterapeuta do EP-06 (agenda do TK-06.02, ações do TK-06.03, TK-06.06 e TK-06.07), os mesmos que atendem a tela. A Alexa só traduz fala → chamada de service → fala. Isso vale também para o legado: o `TherapistService` atual é a porta de entrada provisória até o EP-06 entregar a versão refatorada.
- Textos falados vêm do formatador de fala pt-BR (TK-06.01) e do catálogo de mensagens (`notifications/messages.ts`, ou o catálogo atual até a migração), nunca de strings no handler.

### Endpoint

- Uma única rota `POST /api/alexa`, `@Public()` (a Amazon não manda `x-user-id`), protegida pelo `AlexaSignatureGuard`. Entra na matriz de permissões como rota pública protegida pelo guard.
- Sempre responde `200` com um envelope de resposta válido para a Alexa quando a requisição passou pelo guard, inclusive em erro inesperado (frase genérica de falha). Erros de verificação respondem `400` sem corpo de fala.

### `AlexaSignatureGuard` (TK-07.02)

- Depende de uma interface `AlexaRequestVerifier`, injetada pelo token `ALEXA_REQUEST_VERIFIER`. A implementação real é um Adapter sobre os verificadores do `ask-sdk-express-adapter` (assinatura `Signature-256`/`Signature` + `SignatureCertChainUrl`, cadeia do certificado e domínio `echo-api.amazon.com`).
- O guard confere ainda: o `timestamp` da requisição contra o `Clock` injetado, com tolerância de 150 segundos (constante técnica nomeada, valor exigido pela Amazon); e o `applicationId` contra `ALEXA_SKILL_ID`, que passa a ser obrigatório na validação de ambiente fora de `test`.
- O guard precisa do corpo bruto (a assinatura é sobre os bytes recebidos): a rota da Alexa recebe o `rawBody` do Nest.
- Nos testes, `ALEXA_REQUEST_VERIFIER` é substituído por um dublê que aceita ou recusa conforme o caso; a implementação real tem teste unitário próprio com certificados de teste gerados localmente, sem chamar a Amazon.

### Despacho por intents (TK-07.03)

- Interface `AlexaIntentHandler` com `canHandle(request): boolean` e `handle(request): Promise<AlexaReply>`. Cada intent é uma classe registrada num multi-provider (token `ALEXA_INTENT_HANDLERS`); o `AlexaDispatcher` percorre a lista em ordem e usa o primeiro que aceitar (Chain of Responsibility). Um handler de fallback no fim garante resposta.
- `AlexaReply` é um tipo do domínio da skill (fala, reprompt opcional, se encerra a sessão, diretiva de confirmação opcional, atributos de sessão); só o `AlexaResponseBuilder` conhece o formato JSON da Amazon. A fala é sempre SSML com escape, como hoje.
- Handlers que precisam do massoterapeuta recebem um `AlexaRequestContext` já resolvido pelo dispatcher (ver "Quem está falando"), para que nenhum handler repita a identificação.
- **Estado de conversa sem servidor:** a última fala (para "repetir") e a ação pendente de confirmação viajam nos `sessionAttributes` da própria Alexa. O backend não guarda sessão.
- Nada de `new Date()`: todo "agora" e "hoje" vem do `Clock`, com o dia calculado em `America/Sao_Paulo`.

### Modelo de interação (TK-07.04)

- Um arquivo de modelo de interação pt-BR versionado no repositório, publicado pela ASK CLI (passo manual documentado; credenciais nunca no repositório).
- Nomes de intent em inglês (são identificadores de código); frases de exemplo em pt-BR (exceção do `AGENTS.md`). A troca dos nomes atuais (`ProximoAtendimentoIntent` etc.) acontece junto com a publicação do modelo e a troca dos handlers, no mesmo PR, para não quebrar o aparelho de teste.

| Intent | Slots | Exemplos de frase (a validar no TK-14.03) | Req. |
| --- | --- | --- | --- |
| `PairDeviceIntent` | `code` (`AMAZON.NUMBER`) | "vincular código {code}", "vincular o código {code}" | RF-17 |
| `NextAppointmentIntent` | — | "quem é o próximo", "qual o próximo atendimento" | RF-11 |
| `TodayAgendaIntent` | — | "qual minha agenda de hoje", "como está minha agenda" | RF-10 |
| `WhoArrivedIntent` | — | "quem chegou", "alguém chegou" | RF-15 |
| `CancelAppointmentIntent` | `time` (`AMAZON.TIME`) | "cancelar o atendimento das {time}" | RF-12 |
| `BlockScheduleIntent` | `startTime`, `endTime` (`AMAZON.TIME`) | "bloquear das {startTime} às {endTime}" | RF-13 |
| `StartSessionIntent` | — | "iniciar sessão", "começar atendimento" | RF-14 |
| `FinishSessionIntent` | — | "finalizar sessão", "terminar atendimento" | RF-14 |
| `IdentifySpeakerIntent` | `name` (tipo próprio `TherapistName`) | "{name}", "sou {name}", "é {name}" | RN-17 |
| `AMAZON.HelpIntent`, `AMAZON.RepeatIntent`, `AMAZON.StopIntent`, `AMAZON.CancelIntent`, `AMAZON.FallbackIntent`, `AMAZON.YesIntent`, `AMAZON.NoIntent` | — | nativos | RNF-02 |

- Só `CancelAppointmentIntent` e `BlockScheduleIntent` declaram **confirmação de intent** no modelo de diálogo; o prompt de confirmação é montado pelo backend (`Dialog.ConfirmIntent`), porque depende dos dados (nome e horário). `StartSessionIntent` e `FinishSessionIntent` não têm confirmação (decisão de 2026-10-22).
- Consultas e ações também aceitam um slot opcional `name` (`TherapistName`) com frases como "aqui é {name}, quem é o próximo", para o massoterapeuta se identificar na mesma fala (ver "Quem está falando").
- O tipo `TherapistName` não tem valores fixos no modelo: a cada pergunta "Quem está falando?", o backend envia com a resposta os nomes dos massoterapeutas vinculados àquele aparelho como entidades dinâmicas (`Dialog.UpdateDynamicEntities`), para que a Alexa reconheça esses nomes e devolva o ID do massoterapeuta no slot.
- O nome de invocação da skill é **"pausa"** (decidido em 2026-10-23; riscos na limitação L9).

### Quem está falando (TK-07.05, D-19)

Decidido em 2026-10-22: o aparelho guarda vários massoterapeutas vinculados. A Alexa deduz quem fala e, só quando não dá, pergunta.

Como há uma Alexa por sala e vários massoterapeutas atendem ao mesmo tempo nela (2026-10-23), a dedução pela agenda raramente resolve no meio do expediente, e **a pergunta é o caso comum**. Para reduzir o atrito, todo intent que precisa de quem fala aceita o nome na própria frase ("Alexa, pergunte à pausa: aqui é a Diana, quem é o próximo?"), num slot opcional `name`. O backend compara o valor falado com os nomes dos vinculados àquele aparelho; se bater com um só, não pergunta. As frases com nome entram no modelo de interação e são validadas com os massoterapeutas (TK-14.03).

- Uma interface `AlexaSpeakerResolver` recebe o `deviceId`, o massoterapeuta já identificado na conversa (dos `sessionAttributes`, se houver) e o instante do `Clock`. Devolve um de três resultados:
  - **identificado** (o massoterapeuta);
  - **precisa perguntar** (com a lista de candidatos);
  - **não atende** (aparelho sem vínculo, ou nenhum vinculado ativo).
- Regra de dedução, nesta ordem, considerando só os vinculados com usuário ativo:
  1. Já identificado nesta conversa e ainda vinculado e ativo: é ele.
  2. Nome dito na própria frase (slot `name`) que corresponde a um único vinculado: é ele.
  3. Um único vinculado: é ele.
  4. Exatamente um dos vinculados tem `ScheduleSlot` que contém o instante atual: é ele.
  5. Caso contrário: perguntar.
- **Pergunta:** "Quem está falando?", com os primeiros nomes dos vinculados como entidades dinâmicas do slot `name`. O pedido original (intent e slots) fica guardado nos `sessionAttributes` e é executado assim que o nome é dado, sem o massoterapeuta repetir. O massoterapeuta identificado vale até o fim da conversa.
- Nome que não é de nenhum vinculado: "Esta Alexa atende {nomes}. Quem está falando?", no máximo duas tentativas, depois encerra sem agir. Se dois vinculados tiverem o mesmo primeiro nome, as entidades dinâmicas usam nome e sobrenome para eles, e a pergunta pede o sobrenome.
- `personId` (perfil de voz) **não** é usado (limitação L3).
- O `ALEXA_USER_MAP` sai do código e do `.env.example` no TK-07.05, quando o pareamento o substitui. Até lá, o TK-07.03 o usa como identificação provisória no `AlexaRequestContext`, para o teste no Echo com dados reais não parar (decisão de 2026-10-28).
- Aparelho sem vínculo responde "Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação." e encerra. Sem vínculo, só funcionam o `PairDeviceIntent`, a ajuda, o parar e a abertura.

**Mudança de schema (TK-07.05), combinada com a Mariana em 2026-10-23:**

- `AlexaDevice` deixa de ter `therapistId`. Continua com `deviceId` único, representando o aparelho físico.
- Nova tabela de associação `alexa_device_therapists` (`AlexaDeviceTherapist`), com `alexaDeviceId`, `therapistId` e `pairedAt`. Restrição única no par.
- A migração copia os vínculos existentes. O teste e2e atual que exige um único massoterapeuta por `device_id` muda para "o mesmo massoterapeuta não é vinculado duas vezes ao mesmo aparelho".
- Desvincular um massoterapeuta de um aparelho: só por banco ou seed no MVP. A rota e a tela do RH ficam para o EP-12 (ver Out of Scope).

### Pareamento por voz (TK-07.05)

- O slot `code` chega como número. O backend completa com zeros à esquerda até 6 dígitos (D-18, L8) e recusa qualquer coisa que não tenha 6 dígitos depois disso.
- O consumo do código é atômico, numa transação. O código precisa existir, não estar consumido e não estar expirado (comparado ao `Clock`), e o massoterapeuta precisa estar ativo. O código recebe `consumedAt` e `consumedByDeviceId`; o `AlexaDevice` é criado se não existir, e o massoterapeuta é **acrescentado** aos vinculados (se já estava, nada muda). Se duas Alexas disserem o mesmo código ao mesmo tempo, só uma vincula.
- O massoterapeuta que acabou de vincular fica identificado no resto da conversa.
- Gera `AuditEvent` `ALEXA_DEVICE_PAIRED`. Ator: o massoterapeuta dono do código. Dados: IDs do aparelho e do código, nunca o código em si.
- Respostas:
  - sucesso: "Pronto. Esta Alexa agora atende {primeiro_nome}.";
  - código inválido, usado ou expirado: uma única frase para os três casos ("Código inválido ou expirado. Peça um novo código ao RH."), para não ajudar quem tenta adivinhar.

### Consultas (TK-07.06)

- Cada handler chama o service de agenda do EP-06 e fala o `spokenText` que ele produz, ou monta a frase pelo formatador com os dados devolvidos. Frases do `docs/requisitos.md` (ALX-01 a ALX-03).
- "Agenda de hoje" fala o total do que ainda resta hoje. Com um só atendimento, diz qual é ("Hoje, 1 atendimento. Primeiro: Ana, às 14h."). Com mais de um, pergunta "Quer que eu fale todos?" (decisão de 2026-11-04): com "sim", lê todos os que restam, em ordem, com nome e horário numa frase ("Ana às 14h, Bruno às 15h e Carla às 16h30."); com "não", responde "Tudo bem.". A lista só é lida a pedido, então a primeira resposta continua em duas frases. Atendimentos em estados finais ou liberados não contam.
- "Quem chegou" considera os check-ins do dia do massoterapeuta (RN-14): fala o mais recente e, se houver mais, quantos são no total.
- Consultas deixam a sessão aberta com reprompt curto ("Para ouvir de novo, diga repetir.") para que "repetir" funcione; o silêncio encerra.

### Ações (TK-07.07)

- Cancelar e bloquear passam pela confirmação abaixo. Iniciar e finalizar executam direto e falam o resultado (decisão de 2026-10-22, refina a RN-13).
- Fluxo de confirmação em duas falas (cancelar e bloquear):
  1. O handler resolve o alvo (atendimento ou período) e responde com `Dialog.ConfirmIntent` e a pergunta, guardando nos `sessionAttributes` o ID do alvo e o estado esperado.
  2. Na fala seguinte, com `confirmationStatus = CONFIRMED`, o handler relê o alvo; se ele não existe mais ou mudou de estado, não age e diz por quê. Se continua igual, chama o service do EP-06 e fala o resultado. `DENIED` responde "Tudo bem, nada foi alterado." Silêncio encerra sem alterar.
- **Cancelar (RF-12):** o horário falado é procurado entre os atendimentos do massoterapeuta **hoje** que ainda podem ser cancelados. Horário falado sem período ("às duas") vale se só uma das leituras (2h ou 14h) cair num atendimento. Horários vagos do `AMAZON.TIME` (manhã, tarde, noite) são recusados com uma frase de exemplo. A antecedência mínima (RN-01) **não vale** para o massoterapeuta (D-05): ele cancela a qualquer momento, e o colaborador é avisado pelo `NotificationChannel`. A regra mora no service do EP-06, não aqui.
- **Bloquear (RF-13):** só no dia de hoje, início antes do fim, dentro do horário de funcionamento (RN-08, lido do `BusinessRulesService`). Período com atendimentos ativos é recusado (D-04): a fala diz quantos são e o primeiro ("Há 2 atendimentos nesse período, o primeiro às 15h. Cancele-os antes de bloquear.").
- **Iniciar (RF-14), sem confirmação:** o alvo é o atendimento do massoterapeuta mais próximo de agora que pode ir para `IN_PROGRESS` (`CONFIRMED`, `CHECKED_IN` ou `POSSIBLE_NO_SHOW`, pela máquina de estados). A resposta já diz com quem ("Sessão com Ana iniciada."), o que serve de conferência. Nenhum candidato: frase explicando.
- **Finalizar (RF-14), sem confirmação:** o alvo é o atendimento `IN_PROGRESS` do massoterapeuta. A resposta de sucesso já fala o próximo (ALX-07).
- Toda ação é registrada pelo próprio service do EP-06, com o massoterapeuta como ator, gerando o mesmo `AuditEvent` e os mesmos avisos que a ação pela tela. A Alexa não cria auditoria de ação por conta própria.
- RN-13 é garantido pelo service: o alvo é sempre procurado só na agenda do massoterapeuta resolvido pelo `AlexaSpeakerResolver`.

### Ajuda, repetir, parar e fallback (TK-07.08)

- `LaunchRequest`: saudação com dois exemplos; sessão aberta.
- `AMAZON.HelpIntent`: lista curta (no máximo três comandos) e reprompt.
- `AMAZON.RepeatIntent`: repete a última fala guardada nos `sessionAttributes`; sem fala anterior, responde como a ajuda.
- `AMAZON.StopIntent` / `AMAZON.CancelIntent`: "Até logo." e encerra; descartam uma ação pendente sem alterar nada.
- `AMAZON.FallbackIntent` e qualquer pedido sem handler: sugestão curta do que dizer.
- `SessionEndedRequest`: resposta vazia, sem fala.
- Erro inesperado: "Não consegui consultar a agenda agora. Tente de novo em instantes." Log com o tipo de requisição, o nome do intent e IDs; nunca o corpo da fala nem o código de pareamento.

### Lembrete falado (TK-07.09 spike, TK-07.10)

Decidido em 2026-10-22 (D-15, D-16), por causa da limitação L1: **o lembrete nasce durante a conversa e morre fora dela.**

- **TK-07.09 (spike)** confirma no Echo o que a documentação diz:
  1. criar um lembrete com o `apiAccessToken` de uma requisição da skill e ouvi-lo tocar;
  2. apagá-lo depois, fora da conversa, com token LWA obtido por credenciais da skill;
  3. conferir se o `PUT` fora da conversa funciona (a documentação se contradiz).

  O resultado vai para o `docs/alexa/roadmap.md`. Nenhum código de produção sai do spike. Se o passo 2 falhar, o TK-07.10 só cria lembretes, e o cancelamento fica sem apagar até ser revisto: volte a esta spec antes de codar.
- **TK-07.10:**
  - **Criação, durante a conversa.** Em toda requisição em que o massoterapeuta já está identificado (abertura, agenda do dia, qualquer consulta), um `AlexaReminderSync` compara as sessões restantes de hoje (`CONFIRMED`, ainda não começadas, com início depois de agora + antecedência) com os lembretes já registrados para aquele aparelho e massoterapeuta. Ele cria os que faltam com o token da requisição. Idempotente: falar com a Alexa duas vezes não duplica lembrete.
  - **Tempo de resposta.** A criação chama a Amazon, o que contraria "sem chamadas externas no caminho da resposta" (RNF-02). Para respeitar o RNF-02, a sincronização roda depois que a resposta de voz é montada, sem bloqueá-la. O token da requisição vale por alguns minutos, o que basta. Se der errado, nada é dito ao massoterapeuta; a próxima conversa tenta de novo.
  - **Remoção, fora da conversa.** Listeners nos eventos de domínio de `Appointment` (Observer): cancelada, liberada ou ausente → apaga o lembrete com token LWA. Horário alterado não existe no MVP (reagendamento fora, D-03); se surgir, vira apagar e recriar na próxima conversa.
  - **Eventos de domínio.** Nomes e payloads (`appointment.cancelled`, `appointment.released`, `appointment.no-show`) são contrato a combinar com a Mariana antes do código (regra de convivência do roadmap). Hoje o código ainda não emite eventos.
  - **Isolamento.** Interface `AlexaReminderClient` (criar com token de conversa, apagar com token fora da conversa), token `ALEXA_REMINDER_CLIENT`, com Adapter real e dublê em memória (Adapter + DI, como o `NotificationChannel`). Os services de negócio nunca chamam o `AlexaReminderClient`; só o `alexa/`.
  - **Permissão.** Sem a permissão de lembretes (L2), a Amazon recusa a criação. A conversa segue normal e o lembrete fica registrado como falho, para o RH ver. Pedir a permissão por voz (cartão de permissão no app) fica para o passo de instalação, não para a conversa.
  - **Texto.** "Sua próxima sessão começa em {n} minutos.", sem o nome do colaborador (D-16), vindo do catálogo de mensagens.
  - **Limitação aceita.** Uma sessão marcada depois da última conversa do dia só ganha lembrete na próxima conversa. Um lembrete que deveria ter sido apagado e não foi (falha na Amazon) é registrado e tentado de novo na próxima conversa.
- Mudanças de schema do TK-07.10:
  - Tabela `alexa_reminders` (`AlexaReminder`), com `appointmentId`, `alexaDeviceId`, `alexaReminderId` (ID devolvido pela Amazon), `status` (criado, falhou, apagado, falha ao apagar) e datas. Restrição única em (`appointmentId`, `alexaDeviceId`). É uma tabela à parte, e não uma coluna em `appointments`, porque com a RN-17 um atendimento pode ter lembrete em mais de um aparelho.
  - Novo parâmetro de negócio da antecedência do lembrete (RN-15, `alexaReminderLeadMinutes`, valor inicial 5 [VALIDAR]), editável pelo RH pelo fluxo do TK-03.07.
  - Credenciais da skill para o token LWA (client ID e secret) como variáveis de ambiente, obrigatórias só quando o lembrete estiver ligado.

### Configuração

- `ALEXA_SKILL_ID`: obrigatório fora de `test`.
- `ALEXA_USER_MAP`: removido.
- Nenhum valor de negócio no código: horário de funcionamento e antecedência do lembrete vêm do `BusinessRulesService`. A tolerância de 150 s do horário da requisição e a validade do código (60 min, D-18) são constantes técnicas nomeadas.

---

## Testing Decisions

### O que é um bom teste aqui

- Testa o comportamento de fora: um envelope de requisição da Alexa entra, um envelope de resposta sai, e o banco muda (ou não). Não testa a ordem interna dos handlers, nomes de métodos privados nem o formato do SSML além do texto falado.
- Os nomes dos testes citam o requisito (`it('RF-12: cancels the appointment only after an explicit yes')`).
- Relógio sempre falso (`FakeClock` pelo `createTestApp({ clock })`), inclusive para casos perto da meia-noite em `America/Sao_Paulo` e para o `timestamp` da requisição.
- Nenhum teste chama a Amazon: verificador de assinatura e cliente de lembretes são substituídos por dublês.
- Textos falados têm teste de conteúdo, tamanho (no máximo duas frases), ordem (informação principal primeiro) e privacidade (só primeiro nome, sem IDs, sem ISO, sem UTC), como pede a seção "Acessibilidade" do `AGENTS.md`.

### Seams

1. **Principal — `POST /api/alexa` de ponta a ponta** (e2e, `test/*.e2e-spec.ts`, banco real). Cobre pareamento, identificação de quem fala (dedução pela agenda, pergunta, nome desconhecido, nomes repetidos), consultas, ações (cancelar e bloquear com as duas falas da confirmação, iniciar e finalizar diretos), ajuda/repetir/parar/fallback, aparelho não vinculado e erro inesperado. É a única seam pela qual os comportamentos do massoterapeuta são verificados. Um construtor de envelopes de teste (LaunchRequest, IntentRequest com slots, confirmação e `sessionAttributes`) entra no `test/support/`.
2. **`ALEXA_REQUEST_VERIFIER`** — substituído por dublê no e2e, para que a seam principal teste o comportamento sem assinatura real. A implementação real (Adapter sobre o `ask-sdk-express-adapter`) e o `AlexaSignatureGuard` (horário, `applicationId`) têm testes próprios: requisição válida, adulterada, sem cabeçalho, antiga e de outra skill.
3. **`ALEXA_REMINDER_CLIENT`** (só no TK-07.10): dublê em memória que registra criações e remoções. Os testes de lembrete conversam pela seam 1 (criação), mudam o estado da sessão pela API (remoção) e verificam o que o dublê recebeu, inclusive que uma segunda conversa não duplica lembrete e que uma recusa de permissão não muda a fala.

O `AlexaSpeakerResolver` não é uma seam de teste: é exercitado pela seam principal com dados reais (`AlexaDevice`, `AlexaDeviceTherapist`, `ScheduleSlot`).

### Por módulo

- `alexa/` (handlers, dispatcher, resolver, pareamento): e2e pela seam 1. Unitários só onde há lógica pura que vale isolar: normalização do código de 6 dígitos e interpretação do slot `AMAZON.TIME` (2h/14h, horários vagos).
- Concorrência do pareamento: e2e com duas requisições simultâneas usando o mesmo código; só uma vincula.
- Matriz de permissões: a rota da Alexa entra como pública protegida pelo guard.
- Modelo de interação: um teste unitário confere que todo intent do arquivo tem handler e vice-versa, e que só cancelar e bloquear declaram confirmação.

### Prior art

- `test/alexa-pairing-code.e2e-spec.ts` e `test/alexa-pairing.e2e-spec.ts`: geração do código e restrições das tabelas de pareamento (mesmo domínio, mesmo `createTestApp` com `pairingCodeSource` falso).
- `test/next-appointment.e2e-spec.ts` e `test/check-in.e2e-spec.ts`: dados de agenda e check-in criados por teste, com relógio falso.
- `test/permissions.e2e-spec.ts`: matriz de rotas e papéis.
- `src/notifications/notification-channel.spec.ts` e o `InMemoryNotificationChannel`: modelo para o dublê do `AlexaReminderClient`.
- `src/alexa/pairing-code-source.spec.ts`: modelo de porta injetável com implementação real testada à parte.
- `docs/alexa/roadmap.md`: roteiro manual no Echo Show, complementar aos testes automáticos; cada ticket registra lá o resultado no aparelho.

---

## Out of Scope

- Account linking OAuth (decisão de 2026-10-16: pareamento por código).
- Falar texto livre na hora, como "Ana chegou" (a Alexa não permite; o aviso de chegada vai pela tela, EP-06/EP-11, e pelo Web Push no futuro). Campainha virtual (Smart Home + Event Gateway): fora do MVP.
- Consultas e ações sobre outros dias além de hoje (agenda de amanhã, bloquear amanhã).
- Marcar ausência (`NO_SHOW`) por voz: RF-33 é da tela (TK-06.05); pode virar intent depois.
- Reagendar por voz (RF-08 fora do MVP, D-03).
- Rota e tela do RH para ver aparelhos vinculados e desvincular um massoterapeuta de um aparelho (EP-12). Esta spec cobre só o vínculo por voz.
- Identificação por perfil de voz (`personId`), descartada pela limitação L3.
- Criar lembrete fora da conversa, impossível pela limitação L1.
- Hospedagem com HTTPS público (D-09 decidida em 2026-10-23; implementação no TK-13.03). O desenvolvimento usa túnel.
- Mudança da RN-12 nas reservas e na agenda (vários massoterapeutas na mesma sala): TK-03.09, da Mariana. Este épico só depende de a agenda permitir isso.
- Certificação e publicação da skill na loja da Amazon.
- Alexa+, outros idiomas e outros assistentes de voz.

---

## Further Notes

### Ordem e dependências

- TK-07.01 (spike "olá") e TK-07.09 (spike Reminders) começam já: são os maiores riscos técnicos do projeto.
- TK-07.02 → TK-07.03 → TK-07.08 não dependem de nenhuma decisão em aberto.
- TK-07.04 deve sair no mesmo PR da troca de nomes dos handlers (TK-07.03) para não quebrar o aparelho.
- TK-07.09 (spike do lembrete) deve rodar **o quanto antes** num Echo real: o resultado pode mudar o TK-07.10.
- TK-07.05 está destravado (D-19) e traz a migração de `AlexaDevice`, já combinada com a Mariana.
- TK-07.06 depende do TK-06.02 e do TK-06.01; TK-07.07 depende do TK-06.03, do TK-06.06 e do TK-06.07 (destravados pela D-04 e pela D-05). A Alexa não deve reimplementar o que o EP-06 ainda não entregou.
- TK-07.10 está destravado (D-15, D-16), mas depende do resultado do spike TK-07.09 (passos 2 e 3) e dos eventos de domínio combinados com a Mariana.

### Divergências e pendências

- O `CONTEXT.md` e o `requisitos.md` foram alinhados com as decisões de 2026-10-22 e 2026-10-23.
- A identificação por nome depende de o reconhecimento de nomes próprios em pt-BR funcionar bem, tanto na resposta a "Quem está falando?" quanto no nome dito na própria frase. Como a pergunta é o caso comum, esse é o maior risco de uso do épico. Validar no aparelho com os nomes reais dos massoterapeutas (TK-14.03); se falhar, a alternativa é um número curto atribuído a cada um.
- Privacidade com vários massoterapeutas e colaboradores na mesma sala: todos ouvem as respostas. A regra do primeiro nome e de nenhum dado de saúde (RNF-04) continua bastando; nada além disso é falado.
- Força bruta no código de pareamento: 6 dígitos válidos por 60 minutos, e só requisições assinadas pela Amazon chegam ao backend. Limitar tentativas por aparelho fica como melhoria, não como requisito do MVP.
- As frases desta spec são sugestões do `requisitos.md`; a versão final sai da validação com os massoterapeutas (TK-14.03), e mudar uma frase não muda o contrato dos handlers.
