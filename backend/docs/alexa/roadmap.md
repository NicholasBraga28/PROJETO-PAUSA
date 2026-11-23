# Roadmap de testes da Alexa

Roteiro para testar a skill da Alexa de ponta a ponta: da primeira resposta "Olá" no Echo Show até as ações por voz. Complementa o épico EP-07 de [docs/roadmap.md](../roadmap.md) e segue os requisitos de [docs/requisitos.md](../requisitos.md) (RF-10 a RF-17, RNF-02 e RNF-03).

Este roteiro é só para testar a Alexa. Ele não substitui o roadmap geral: os tickets continuam sendo a fonte de verdade para o trabalho, e cada fase aponta o ticket correspondente.

## Como usar

- Faça as fases em ordem. Cada fase tem um critério de sucesso; só avance quando ele for atendido.
- Atualize a coluna **Status** ao terminar cada fase: ⬜ a fazer · 🟡 em andamento · ✅ concluída · 🔒 bloqueada.
- Registre o que aconteceu de verdade, inclusive as falhas, na seção "Registro de testes" no fim do arquivo.

| Fase | Objetivo | Ticket | Status |
| --- | --- | --- | --- |
| 0 | Pré-requisitos | — | ✅ |
| 1 | "Olá" de ponta a ponta no Echo Show | TK-07.01 | ✅ |
| 2 | Consultas com dados reais (próximo, agenda, quem chegou) | TK-07.06 (versão provisória) | ✅ |
| 3 | Modelo de interação pt-BR publicado pela ASK CLI | TK-07.04 | ✅ |
| 4 | Assinatura das requisições | TK-07.02 | ✅ |
| 5 | Arquitetura de handlers | TK-07.03 | ⬜ |
| 6 | Pareamento por código ("vincular código") | TK-07.05 | ✅ |
| 7 | Ações por voz com confirmação | TK-07.07 | ⬜ |
| 8 | Lembrete falado antes da sessão | TK-07.09, TK-07.10 | ⬜ |

## Fase 0: pré-requisitos

**Objetivo:** deixar o ambiente pronto para receber requisições da Amazon.

- [x] Conta Amazon Developer criada e logada (feito pelo responsável, Guilherme).
- [x] Skill customizada criada: idioma principal **Português (BR)**, modelo **Custom**, hospedagem **Provision your own**, template **Start from scratch**.
- [x] Skill ID copiado para `ALEXA_SKILL_ID` no `backend/.env`.
- [x] Echo Show na mesma conta Amazon, com idioma do aparelho e do app Alexa em **Português (Brasil)**.
- [x] `backend/.env` com `PORT=3001` (a porta 3000 está ocupada por outro projeto).
- [x] PostgreSQL local no ar: `docker compose up -d` dentro de `backend/`.
- [x] Migrações aplicadas: `npm run prisma:deploy`.
- [x] Túnel HTTPS escolhido: **port forwarding do VS Code** (dev tunnels), com a porta 3001 em visibilidade **Public**. O cloudflared foi bloqueado pela política do PC da empresa ("Access is denied" ao executar).

**Critério de sucesso:** `curl http://localhost:3001/api/health` responde `{"status":"ok"}`.

## Fase 1: "Olá" de ponta a ponta (TK-07.01)

**Objetivo:** provar que a Amazon chega ao backend e que a resposta volta para o Echo Show.

1. Subir o backend: `npm run start:dev` (em `backend/`).
2. Subir o túnel apontando para `http://localhost:3001`: no VS Code, painel **Ports** → **Forward a Port** → `3001` → **Port Visibility: Public**. Copiar a URL HTTPS (`https://<id>-3001.brs.devtunnels.ms`).
3. Na skill, em **Endpoint**, colar a URL HTTPS com o caminho `/api/alexa`. Tipo HTTPS, certificado: subdomínio de domínio com certificado curinga.
4. Em **Test**, ativar **Development** para pt-BR.
5. Testar no **simulador** do console: digitar "abrir pausa" (nome de invocação decidido em 2026-10-23).
6. Testar no **Echo Show**: "Alexa, abrir pausa".

**Critério de sucesso:** o Echo Show responde "Olá. Você pode pedir o próximo atendimento, a agenda do dia ou quem já chegou." e o log do backend mostra a requisição `LaunchRequest`.

**Se falhar:**
- Erro de endpoint no console: confira se a URL é HTTPS e se o túnel está no ar (`curl` na URL pública deve responder).
- Echo não responde a pt-BR: confira o idioma do aparelho e do app.
- "Um problema ocorreu com a resposta da Skill solicitada" (`SessionEndedRequest` com `INVALID_RESPONSE`): a Alexa só aceita HTTP 200. O NestJS responde 201 em `POST` por padrão; por isso a rota leva `@HttpCode(HttpStatus.OK)`.
- HTTP 500 num `curl` manual: o `ALEXA_SKILL_ID` está preenchido e o `applicationId` da requisição não bate com ele. O ASK SDK recusa antes dos handlers.
- Resposta vazia: olhe o terminal do `start:dev`. O `AlexaController` não loga as requisições; o JSON enviado e recebido aparece no painel **Skill I/O** do simulador.

## Fase 2: consultas com dados reais (versão provisória de TK-07.06)

**Objetivo:** testar "próximo atendimento", "agenda do dia" e "quem chegou" com um terapeuta de demonstração e agendamentos reais no banco. Até o TK-07.05 a identificação era provisória (`ALEXA_USER_MAP`); agora é o pareamento por código (passo 4).

1. No simulador, painel **Skill I/O → JSON Input**, copiar `context.System.user.userId` (`amzn1.ask.account...`). O valor é o mesmo no Echo da mesma conta.
2. Confirmar o conteúdo de `backend/prisma/demo-seed.ts` antes de rodar. Ele cria um terapeuta em UUID fixo.
3. Rodar o seed de demonstração (`npm run db:seed-demo`). Ele cria usuários, salas e a grade, mas **não cria atendimentos**: reservar os de hoje pela API como colaborador do seed (`POST /api/booking/appointments` com `x-user-id`), com pelo menos 1 h de antecedência e um colaborador por reserva (limite de reservas ativas).
4. Vincular o Echo (desde o TK-07.05, que removeu o `ALEXA_USER_MAP`): gerar um código como RH do seed para o **registro de terapeuta** (`POST /api/therapists/00000000-0000-4000-8000-000000000111/alexa-pairing-code` com `x-user-id: 00000000-0000-4000-8000-000000000106`) e dizer "Alexa, pergunte à pausa vincular código {código}" dentro de 60 minutos. A resposta esperada é "Pronto. Esta Alexa agora atende {primeiro nome}."
5. A skill encerra a sessão depois de cada resposta, então a pergunta vai na mesma frase: "Alexa, pergunte à pausa {pergunta}".
6. Testar no Echo Show:

| Frase | Resposta observada em 2026-10-29 |
| --- | --- |
| "qual é o meu próximo atendimento" | A agenda do dia, com o próximo atendimento (o intent reaproveita a agenda de hoje). |
| "qual minha agenda de hoje" | "Hoje, 1 atendimento. Próximo: Beatriz, às 13h20." |
| "quem chegou" | Ninguém chegou ainda (sem check-in feito). |

**Critério de sucesso:** as três consultas respondem com os dados do seed, em português falado, sem IDs.

**Divergências conhecidas (a registrar, não a corrigir nesta fase):**
- "Próximo atendimento" e "agenda do dia" devolvem o mesmo texto (TK-07.06).
- A skill encerra a sessão depois de cada resposta (`shouldEndSession: true`): depois de "abrir pausa", a pergunta seguinte exige nova invocação.
- Erros de "terapeuta não encontrado" aparecem como "Não consegui consultar a agenda agora", sem indicar o motivo (ver Fase 6). Foi o que aconteceu com o backend ainda rodando sem o `ALEXA_USER_MAP`.
- "Quem chegou" com alguém já com check-in não foi testado no Echo.

## Fase 3: modelo de interação pt-BR (TK-07.04)

**Objetivo:** versionar o modelo de interação no repositório e publicá-lo pela ASK CLI, em vez de montá-lo só no console.

O modelo fica em `backend/alexa/interaction-model.pt-BR.json`, com os intents em inglês da spec (`NextAppointmentIntent`, `TodayAgendaIntent`, `WhoArrivedIntent` etc.). Ele substitui os nomes antigos do console (`ProximoAtendimentoIntent`, ...), que o backend do TK-07.03 já não reconhece. O teste `src/alexa/interaction-model.spec.ts` confere que todo intent do modelo tem handler (ou está na lista dos que caem no fallback até o ticket deles) e que só cancelar e bloquear pedem confirmação.

**Publicação pela ASK CLI** (passo manual do responsável, rodar dentro de `backend/`):

1. Instalar a ASK CLI: `npm install -g ask-cli`.
2. Autenticar: `ask configure`. Abre o navegador para o login na conta Amazon Developer; responder **não** à pergunta sobre a conta AWS. As credenciais ficam em `~/.ask/cli_config`, fora do repositório: **nunca** copiar esse arquivo, tokens ou o Vendor ID para o projeto.
3. Publicar o modelo no estágio de desenvolvimento, com o Skill ID do `ALEXA_SKILL_ID` do `.env`:

   ```bash
   ask smapi set-interaction-model --skill-id <ALEXA_SKILL_ID> --stage development --locale pt-BR --interaction-model "file:alexa/interaction-model.pt-BR.json"
   ```

4. Acompanhar o build até `SUCCEEDED`: `ask smapi get-skill-status --skill-id <ALEXA_SKILL_ID> --resource interactionModel`. Se o build falhar, a mensagem de erro aponta o intent ou a frase.

**Se falhar:**
- `set-interaction-model` responde só `Request failed with status code 400`, com `detail` vazio: rodar o mesmo comando com `--debug` e ler a linha `Response body` (as linhas de cabeçalho trazem o token de acesso, não copiá-las para lugar nenhum). `MALFORMED_INPUT` indica um campo que a Amazon não conhece no JSON; por exemplo, a confirmação do intent fica em `prompts.confirmation`, não em `prompts.confirm`.
5. No console, aba **Build**, conferir que os intents novos aparecem e que os antigos sumiram.
6. Testar no Echo Show, com o backend e o túnel no ar (Fase 1): "Alexa, pergunte à pausa quem é o próximo", "Alexa, pergunte à pausa qual minha agenda de hoje" e "Alexa, pergunte à pausa quem chegou". Registrar o resultado abaixo.

**Critério de sucesso:** o modelo publicado aparece no console e o Echo Show reconhece as três consultas com os dados do seed (mesmas respostas da Fase 2).

**Observações:**
- As frases de exemplo precisam ser validadas com massoterapeutas (TK-14.03). Esta fase valida só o reconhecimento técnico; mudar uma frase não muda o contrato dos handlers.
- O tipo `TherapistName` tem um único valor de preenchimento ("massoterapeuta", id `PLACEHOLDER`), porque a Amazon não aceita tipo próprio sem nenhum valor. Os nomes reais chegam como entidades dinâmicas (TK-07.05); o backend não deve tratar o `PLACEHOLDER` como massoterapeuta.
- Os textos de confirmação em `prompts` só existem porque a Amazon exige um prompt quando o intent declara confirmação. Com `delegationStrategy: SKILL_RESPONSE`, a pergunta falada é a que o backend monta (`Dialog.ConfirmIntent`, TK-07.07), com o nome e o horário.
- `AMAZON.NavigateHomeIntent` está no modelo porque o console o exige; ele cai no fallback.
- Pareamento, bloqueio, identificação, ajuda, repetir, sim e não ainda caem no fallback, até os tickets deles (TK-07.05, TK-07.07, TK-07.08).
- O cancelamento declara o slot `time`, mas o handler atual ainda lê `appointmentId`; a troca para o horário falado é do TK-07.07.

## Fase 4: assinatura das requisições (TK-07.02)

**Objetivo:** cumprir o RNF-03. Hoje o endpoint aceita qualquer requisição.

- Verificar a assinatura (`Signature` e `SignatureCertChainUrl`), o certificado e o horário da requisição (tolerância de 150 segundos).
- Rejeitar requisições sem assinatura válida com erro HTTP, sem resposta de voz.
- Testar com requisições assinadas e adulteradas; os testes não chamam a Amazon, usam certificados de teste.

**Critério de sucesso:** o Echo Show continua respondendo (as requisições reais são válidas) e uma requisição sem assinatura é rejeitada nos testes.

**Se falhar:**
- "Um problema ocorreu com a resposta da Skill solicitada" sem nenhum `WARN` no terminal: a requisição não chegou ao backend. Confira no painel **Ports** do VS Code se a porta 3001 continua com visibilidade **Public**: ela volta para Private quando o encaminhamento é recriado, e a Amazon recebe a página de login do túnel.
- `WARN [AlexaSignatureGuard] Alexa request refused: reason=...`: o guard recusou. `signature_rejected` vem acompanhado da linha `Signature check failed: <motivo do SDK>`; `timestamp_out_of_tolerance` indica relógio do PC fora da hora; `other_skill`, `ALEXA_SKILL_ID` diferente do Skill ID do console.

**Por que nesta ordem:** a assinatura só entra depois da Fase 1, para não misturar um problema de conexão com um problema de segurança. Antes de publicar a skill para outras pessoas, ela é obrigatória.

## Fase 5: arquitetura de handlers (TK-07.03)

**Objetivo:** trocar o controller com handlers inline por uma classe por intent, com `canHandle` e `handle`, e tirar `new Date()` e `ALEXA_USER_MAP` do controller.

- Cada intent vira uma classe em `src/alexa/handlers/`.
- O controller só despacha.
- Os testes das Fases 1 a 3 continuam passando sem mudança de comportamento: esta fase é refatoração.

**Critério de sucesso:** as respostas da Fase 2 não mudam, e os testes unitários dos handlers passam.

## Fase 6: pareamento por código (TK-07.05)

**Objetivo:** substituir `ALEXA_USER_MAP` pelo pareamento de RF-17: o RH gera um código e o massoterapeuta diz "vincular código {código}".

**Depende de:** TK-01.05 (tabela `AlexaDevice`), TK-03.08 (geração do código, EP-03) e TK-07.03.

**Critérios de sucesso:**
- Um aparelho sem pareamento recebe: "Este aparelho ainda não está vinculado. Peça ao RH um código de vinculação."
- Um código válido vincula o aparelho; um código usado ou expirado é recusado.
- `ALEXA_USER_MAP` é removido do código e do `.env.example`.

**Enquanto isso:** a Fase 2 continua com `ALEXA_USER_MAP`, e a mensagem de aparelho não vinculado fica como pendência.

## Fase 7: ações por voz com confirmação (TK-07.07)

**Objetivo:** cancelar, bloquear, iniciar e finalizar sessão, sempre com confirmação falada antes da mudança (ALX-04 a ALX-07).

**Depende de:** TK-06.03, TK-06.06, TK-06.07, TK-07.05 e as decisões **D-04** (bloqueio com atendimentos marcados) e **D-05** (antecedência de cancelamento para o massoterapeuta).

**Critérios de sucesso:**
- Nenhuma ação altera dados sem um "sim" explícito em outra fala.
- O "não" ou o silêncio cancela a ação e diz isso.
- A confirmação do resultado é falada e curta (uma ou duas frases).

## Fase 8: lembrete falado antes da sessão (TK-07.09, TK-07.10)

**Objetivo:** confirmar no Echo o desenho do D-15 (RF-16): o lembrete é criado durante a conversa e apagado fora dela. Fazer **o quanto antes**, num aparelho real.

1. **Spike (TK-07.09):** criar um lembrete pelo backend para um aparelho de teste e confirmar que ele aparece e toca no Echo Show. Esse é o resultado que fecha D-15.
2. **TK-07.10:** criar, atualizar e apagar o lembrete quando a sessão mudar. Só depois que D-16 (se o lembrete diz o nome do colaborador) for decidido.

**Critério de sucesso do spike:** um lembrete criado durante a conversa (com o token da própria requisição) toca no Echo Show no horário, e um lembrete criado assim é apagado depois pelo backend, fora da conversa. A documentação da Amazon diz que a criação fora da conversa não é aceita (D-15, decidido em 2026-10-22); o spike só confirma isso no aparelho.

**Atenção:** a Reminders API exige permissão do usuário para lembretes. Confirmar esse passo antes de testar.

## Lacunas registradas

Lacunas do código atual, em `backend/src/alexa/alexa.controller.ts`, que este roteiro precisa cobrir:

- Nenhuma verificação de assinatura (RNF-03) → Fase 4.
- Identificação por `ALEXA_USER_MAP` e ID do simulador → Fase 6.
- `new Date()` no intent de agenda (regra do CLAUDE.md) → Fase 5.
- Textos fixos no controller, fora de `notifications/messages.ts` → fase do TK-06.01.
- Ações pedem `appointmentId` em vez de horário falado → Fase 7.
- Status `RESERVED` em vez de `BOOKED` → TK-01.03.

## Registro de testes

Preencher a cada rodada. Não apague os registros antigos: eles mostram o que mudou.

| Data | Fase | Dispositivo | Frase ou ação | Resultado | Observação |
| --- | --- | --- | --- | --- | --- |
| 2026-10-29 | 1 | — | `curl` sem `POST` em `/api/alexa` | 404 | Esperado: a rota só aceita `POST`. Confirmou que o túnel chega ao backend. |
| 2026-10-29 | 1 | Simulador | "abrir pausa" | Falha: "Um problema ocorreu com a resposta da Skill solicitada" | `SessionEndedRequest` com `INVALID_RESPONSE`. O corpo estava certo, mas com HTTP 201. Corrigido com `@HttpCode(HttpStatus.OK)` no `AlexaController`, único ajuste no legado. |
| 2026-10-29 | 1 | Simulador | "abrir pausa" | ✅ Saudação | Túnel: port forwarding do VS Code (cloudflared bloqueado no PC da empresa). |
| 2026-10-29 | 1 | Echo Show | "Alexa, abrir pausa" | ✅ Saudação | Resposta em 1 a 2 s. Sem disputa com o comando de pausar mídia (L9). |
| 2026-10-29 | 1 | Echo Show | "Alexa, pergunte à pausa quem é o próximo" | ✅ Abriu a skill | Não foi tomado como "pausar" (L9). |
| 2026-10-29 | 2 | Echo Show | Três consultas, backend sem o `ALEXA_USER_MAP` carregado | Falha: "Não consegui consultar a agenda agora" | O backend não tinha sido reiniciado depois de editar o `.env`. |
| 2026-10-29 | 2 | Echo Show | "pergunte à pausa": próximo atendimento, agenda de hoje e quem chegou | ✅ Dados do seed, sem IDs | "Hoje, 1 atendimento. Próximo: Beatriz, às 13h20." Quem chegou testado só sem check-in. Resposta em 1 a 2 s. |
| 2026-11-03 | 4 | Echo Show | "Alexa, abrir pausa", porta 3001 do túnel com visibilidade Private | Falha: "Um problema ocorreu com a resposta da Skill solicitada" | Nenhum log no backend: o túnel pedia login e a requisição não chegava. Corrigido voltando a porta para Public. |
| 2026-11-03 | 4 | Echo Show | "Alexa, abrir pausa", com o `AlexaSignatureGuard` ativo | ✅ Saudação | A requisição real da Amazon passou pela assinatura, pelo horário e pelo `applicationId`. |
| 2026-11-03 | 5 | Echo Show | "Alexa, abrir pausa", com os handlers do TK-07.03 | ✅ Saudação | A saudação não mudou na migração, então isso só confirma o túnel e o guard, não o código novo. |
| 2026-11-03 | 5 | Echo Show | "Alexa, abrir pausa, quem é o próximo" | Falha: silêncio | Com "abrir", a Alexa só manda a saudação e a sessão fecha (`shouldEndSession: true`); a pergunta não chega à skill. Usar "pergunte à pausa" (Fase 2). |
| 2026-11-03 | 5 | Echo Show | "Alexa, abrir pausa, agenda do dia" | Falha: "Não tem dados ainda da agenda" | Não é frase do backend: provavelmente o calendário nativo da Alexa respondeu. Mesma causa da linha acima. |
| 2026-11-03 | 5 | Echo Show | "Alexa, abrir pausa, quem chegou?" | Falha: "Não sei como posso ajudar" | Resposta da própria Alexa, não da skill. Mesma causa. Mesmo com "pergunte à pausa", as consultas cairiam no fallback: o console ainda tem os nomes antigos dos intents e o backend espera `NextAppointmentIntent`, `TodayAgendaIntent` e `WhoArrivedIntent`. Pede o modelo do TK-07.04 publicado. |
| 2026-11-03 | 3 | ASK CLI | `ask smapi set-interaction-model` do modelo do TK-07.04 | Falha: HTTP 400, `MALFORMED_INPUT` | O JSON usava `prompts.confirm` na confirmação do dialog; a chave certa é `prompts.confirmation`. O motivo só aparece com `--debug`. |
| 2026-11-03 | 3 | ASK CLI | Mesmo comando, com `prompts.confirmation` | ✅ 202 e build `SUCCEEDED` | As quatro etapas do build passaram, inclusive com o `TherapistName` de um único valor. Falta o teste das consultas no Echo. |
| 2026-11-03 | 3 | Echo Show | "pergunte à pausa": quem é o próximo, qual minha agenda de hoje e quem chegou | ✅ Reconhecidas pelo modelo novo | "Você não tem atendimentos hoje." (próximo e agenda) e "Ninguém chegou ainda.": frases do catálogo do backend, então os intents novos chegaram aos handlers com o massoterapeuta identificado. Sem atendimentos reservados para hoje; o teste com dados fica para o TK-07.06. |
| 2026-11-03 | 6 | Echo Show | "pergunte à pausa vincular código {código}" com código gerado pelo RH do seed, depois uma consulta | ✅ Vinculou e a consulta respondeu com a agenda da massoterapeuta do seed | Primeiro teste sem o `ALEXA_USER_MAP`. As consultas ainda encerram a sessão; manter a conversa aberta depois de identificar quem fala é do TK-07.06. |
