# EP-11 — Tela do massoterapeuta

Status: especificação
Épico: EP-11 · Roadmap: `../roadmap.md`
Requisitos: RF-10, RF-11, RF-12, RF-13, RF-14, RF-15, RF-30, RF-31, RF-32, RF-33, RN-02, RN-08, RN-09, RN-12, RN-13, RNF-01, RNF-04, RNF-05
Contratos de referência: `backend/docs/specs/EP-06-api-do-massoterapeuta.md`

## Objetivo

Dar ao massoterapeuta com deficiência visual acesso autônomo à própria agenda do dia, aos atendimentos atual e próximo, às mudanças recebidas e às ações sobre seus atendimentos. A tela deve funcionar integralmente com leitor de tela e teclado, sem depender de informação visual ou de ajuda de outra pessoa. A API é a fonte da verdade para agenda, estados, regras, permissões e mensagens faladas.

## Fora de escopo

- Alexa, notificações Web Push e service worker de push.
- Edição da agenda do massoterapeuta, criação de reservas ou consulta de agendas alheias.
- Funcionalidade offline ou sincronização de dados em segundo plano.
- Regras de negócio calculadas no frontend (duração, tolerância, janela de início, conflitos e transições de status).
- Leitor de tela/aparelho específico obrigatório: permanece como pergunta em aberto até a entrevista TK-14.01.

## Telas e rotas

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/therapist` | Agenda do massoterapeuta, com regiões fixas Agora, Próximo, Agenda de hoje, Ações e Avisos | Papel `THERAPIST` |

A rota carrega a agenda de hoje por padrão. Os atalhos de pulo levam às cinco regiões, na mesma ordem em que aparecem no DOM e na leitura. A interface também permite consultar o histórico de avisos na própria região Avisos. A rota tem título descritivo, um `h1`, foco inicial no `h1` e cabeçalhos hierárquicos.

## Contratos da API usados

Todas as respostas e erros passam pelo cliente compartilhado e validação Zod. As rotas do terapeuta exigem o papel `THERAPIST`; a identificação do protótipo segue o mecanismo isolado em `shared/api` (`x-user-id`). A API limita cada resposta ao massoterapeuta autenticado. Erros exibidos vêm do catálogo do backend, sem corpo bruto ou detalhes técnicos.

### Consultas

- `GET /therapists/me/agenda?date=AAAA-MM-DD` — sem `date`, retorna o dia atual em `America/Sao_Paulo`. Resposta `TherapistAgenda`: `date`, `isToday`, `current`, `next`, `remainingCount`, `items` e `spokenText`. Cada `AgendaItem` inclui `id`, `startsAt`, `endsAt`, `spokenTime`, `status`, `spokenStatus`, `employee.firstName`, `room.name`, `checkedInAt`, `actions` e `spokenText`. A lista já vem cronológica; o frontend não reordena. `CANCELLED` e `RELEASED` não aparecem. Itens `COMPLETED` e `NO_SHOW` permanecem para consulta, mas não contam como restantes. Ações disponíveis e `confirmationText` vêm da API.
- `GET /therapists/me/arrivals` — check-ins do dia; resposta `items` e `spokenText`, incluindo “Ninguém chegou ainda.” no estado vazio. Usado como informação da agenda/avisos conforme a resposta da API.
- `GET /notifications?since=<ISO>` — feed de avisos em ordem cronológica, com `id`, `appointmentId`, `waitlistEntryId`, `kind`, `status`, `scheduledFor`, `readAt`, `spokenText`, cursor de paginação e resumo falado. O filtro `since` inclui fuso (`Z` ou `-03:00`). A tela repete a consulta periodicamente conforme D-07; intervalo exato é configurável e fica em aberto se não estiver definido no app.

### Ações

- `POST /therapists/me/appointments/:id/start` ou `POST /therapists/me/sessions/current/start` — inicia o atendimento indicado ou o atendimento elegível mais próximo do horário atual. Sem confirmação. Resposta contém `spokenText`.
- `POST /therapists/me/appointments/:id/finish` ou `POST /therapists/me/sessions/current/finish` — finaliza o atendimento ou sessão atual. Sem confirmação. Resposta contém `spokenText`.
- `POST /therapists/me/appointments/:id/cancel` — cancela atendimento elegível. Exige confirmação na interface usando o `confirmationText` da agenda. Resposta contém `appointmentId`, `status` e `spokenText`.
- `POST /therapists/me/appointments/:id/no-show` — marca como ausente somente após confirmação. Resposta contém `spokenText`.
- `POST /therapists/me/schedule-blocks/preview` — recebe `startsAt`, `endsAt` e `reason`; valida sem gravar e devolve `confirmationText` ou o erro de validação/conflito.
- `POST /therapists/me/schedule-blocks` — recebe o mesmo pedido e cria o bloqueio após confirmação. Revalida regras no backend e responde com `id`, `startsAt`, `endsAt`, `reason` e `spokenText`.
- `POST /notifications/:id/read` — marca aviso como lido; operação idempotente, resposta inclui `spokenText`. Aviso inexistente ou de outro usuário resulta em `404`.

Datas de negócio são interpretadas e apresentadas em `America/Sao_Paulo`. Não calcular elegibilidade ou transições localmente. O backend pode responder `400` por entrada inválida, `403` por papel sem permissão, `404` para recurso inexistente ou de outra pessoa, e `409` por conflito/estado inválido; as mensagens do catálogo orientam a pessoa sobre a próxima ação.

## Estados da interface

- **Carregando:** mostrar mensagem visível e anunciar uma vez o início (“Carregando sua agenda”) e a conclusão. Não mover o foco quando os dados chegarem. Consultas periódicas não interrompem a leitura em curso.
- **Vazio:** diferenciar “Você não tem atendimentos hoje”, “Você não tem mais atendimentos hoje” e “Ninguém chegou ainda” conforme `spokenText` da API. Mostrar o conteúdo também visualmente; não inferir estado vazio a partir de erro ou de lista ainda carregando.
- **Erro:** apresentar mensagem curta do backend, próxima da região/ação afetada. Erro impeditivo da tarefa recebe anúncio urgente (`role="alert"`) e foco no resumo/mensagem conforme o padrão compartilhado. Falha temporária da consulta periódica não apaga avisos já carregados e oferece nova tentativa acessível.
- **Ação pendente:** estados de envio impedem duplo envio, mantêm o contexto e comunicam progresso. Em ação confirmada, o diálogo começa com foco em “Voltar”; ao fechar, foco retorna ao acionador.
- **Atualização periódica:** incorporar apenas avisos inéditos, preservando foco e ordem dos itens sob leitura; não anunciar novamente IDs conhecidos. Erro de atualização não descarta o histórico local já recebido.

## Critérios de aceite

### TK-11.01 — Regiões Agora, Próximo e Agenda de hoje

- **Dado** que o massoterapeuta abre `/therapist`, **Quando** a agenda carrega, **Então** as regiões Agora, Próximo, Agenda de hoje, Ações e Avisos aparecem nessa ordem, cada uma como seção nomeada por cabeçalho e com atalho de pulo correspondente.
- **Dado** que a API retorna `current`, `next` e `items`, **Quando** a agenda é apresentada, **Então** atual e próximo são destacados por seus textos e a lista conserva a ordem cronológica recebida, sem grade ou reordenação.
- **Dado** um item de agenda, **Quando** é lido visualmente ou por tecnologia assistiva, **Então** forma uma frase autossuficiente com horário, somente primeiro nome, sala e estado em português (por exemplo, “14h, Ana, sala 2, confirmada”).
- **Dado** uma agenda de outro dia ou vazia, **Quando** a resposta chega, **Então** o frontend mostra o `spokenText` correspondente e não inventa `current` nem `next`.
- **Dado** uma sessão concluída ou ausência registrada, **Quando** a lista aparece, **Então** o item permanece consultável e não é contado como restante; cancelados e liberados não são exibidos.
- **Dado** uma consulta com papel diferente de `THERAPIST` ou sem perfil ativo, **Quando** a API recusa, **Então** a pessoa recebe a mensagem compreensível do backend, sem dados de agenda.

### TK-11.02 — Ações do massoterapeuta

- **Dado** uma ação `START` ou `FINISH` disponível, **Quando** o massoterapeuta a aciona, **Então** a chamada correspondente é feita sem confirmação, o resultado `spokenText` é anunciado e a agenda é atualizada a partir da resposta da API.
- **Dado** uma ação `CANCEL` ou `MARK_NO_SHOW`, **Quando** é acionada, **Então** abre diálogo com o alvo descrito pelo `confirmationText`, foco inicial em “Voltar”, controles de confirmar e voltar com nomes distintos, e foco retorna ao acionador se cancelar.
- **Dado** um bloqueio solicitado, **Quando** o massoterapeuta preenche início, fim e motivo, **Então** a prévia é consultada antes do diálogo e só uma prévia válida permite confirmação; o bloqueio só é enviado após confirmação explícita.
- **Dado** uma alteração de agenda entre prévia/confirmação e envio, **Quando** o backend revalida e responde conflito, **Então** nenhum sucesso é anunciado, o erro explica a situação e a pessoa pode rever a ação.
- **Dado** uma ação concluída com sucesso, **Quando** a API responde, **Então** o `spokenText` recebido é anunciado sem mover o foco e a agenda é atualizada pela API.
- **Dado** uma ação recusada, **Quando** a API responde com erro, **Então** a mensagem do catálogo é exibida e anunciada; o frontend não tenta contornar a regra nem repete automaticamente a ação.
- **Dado** um atendimento de outro massoterapeuta ou um papel sem permissão, **Quando** uma ação é solicitada, **Então** a API a recusa e a interface não revela dados da outra agenda.

### TK-11.03 — Avisos, histórico e leitura

- **Dado** a tela aberta, **Quando** o ciclo periódico consulta avisos novos, **Então** avisos inéditos são adicionados ao histórico e anunciados pela região viva sem mover o foco ou alterar a posição do conteúdo que está sendo lido.
- **Dado** um aviso comum, **Quando** chega, **Então** o anúncio é `polite`, não interrompe a leitura corrente, permanece no histórico e não desaparece automaticamente.
- **Dado** uma mudança no atendimento atual ou próximo, **Quando** o backend a classifica como urgente, **Então** é anunciada com urgência (`assertive`); nenhuma outra categoria usa anúncio assertivo.
- **Dado** um aviso já recebido, **Quando** a consulta periódica o retorna novamente, **Então** ele não é anunciado nem inserido como duplicata.
- **Dado** um aviso não lido, **Quando** a pessoa aciona “Marcar como lido”, **Então** a API é chamada, o estado é atualizado pela resposta e o `spokenText` é anunciado; o foco avança de modo previsível se o item for removido da lista de não lidos.
- **Dado** falha de rede ou resposta inválida, **Quando** a consulta periódica falha, **Então** os avisos já carregados continuam disponíveis e a falha não produz anúncio repetitivo.

### TK-11.04 — Validação com leitores e pessoas

- **Dado** os fluxos de agenda, ações e avisos prontos, **Quando** forem validados manualmente com a matriz de tecnologias assistivas e a tela coberta/desligada, **Então** todas as informações e ações necessárias são compreensíveis e operáveis sem visão, sem foco perdido e sem anúncio perdido.
- **Dado** a sessão de validação com os próprios massoterapeutas, **Quando** forem encontrados problemas de compreensão ou autonomia, **Então** os achados são registrados e priorizados antes de considerar o épico concluído.
- **Dado** o roteiro de validação, **Quando** ele for registrado, **Então** inclui combinações efetivamente usadas e limitações da sessão; a combinação principal permanece pendente até TK-14.01.

### TK-11.05 — PWA instalável

- **Dado** que a aplicação pode ser instalada, **Quando** o sistema exibe os detalhes da PWA, **Então** o manifesto usa nome e `short_name` em português e os ícones têm versões apropriadas e nome/alternativa acessível onde forem expostos na interface.
- **Dado** que a PWA é aberta pelo ícone instalado, **Quando** inicia, **Então** `start_url` leva à agenda do massoterapeuta e a autenticação/permissões continuam sendo verificadas pela aplicação e API.
- **Dado** que a PWA está instalada, **Quando** consulta os recursos do aplicativo, **Então** não registra service worker de push nem solicita permissão de notificação do navegador.

## Casos de acessibilidade

- **Foco:** foco visível com contorno mínimo de 2 px e contraste 3:1, nunca coberto; início no `h1` na entrada da rota. Diálogo abre em “Voltar”, mantém foco dentro dele, Escape/Voltar fecha e restaura foco. Após remoção/atualização de item, foco não cai no `body`; consulta periódica nunca o move.
- **Anúncio:** usar a região viva única compartilhada, `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, com `spokenText` literal para mudanças e sucessos. `role="alert"` só em erro impeditivo. Avisos comuns são polite; assertive apenas para mudanças urgentes no atual/próximo. Não duplicar anúncios nem anunciar cada atualização/contagem de consulta.
- **Nome acessível:** cada botão/link tem nome que descreve ação e alvo, contém o texto visível e diferencia controles repetidos (“Cancelar o atendimento de Ana, às 14h”). Nome de região deriva de cabeçalho visível. Ícones decorativos ficam ocultos da árvore acessível.
- **Teclado:** todos os fluxos operáveis só com teclado, sem armadilha; atalhos de pulo no topo para as cinco regiões. Componentes compostos seguem APG via React Aria. Ações equivalem a botões, navegação a links, sem hover, arraste ou gesto complexo obrigatório.
- **Contraste:** texto 7:1 (texto grande 4,5:1), componentes e foco ao menos 3:1; status sempre em texto, nunca só por cor. Verificar temas claro, escuro, alto contraste, `prefers-contrast` e `forced-colors`, incluindo bordas reais e foco.
- **Zoom e reflow:** funcionar a 400% e largura de 320 CSS px sem rolagem horizontal; texto a 200% e espaçamentos WCAG sem perda de conteúdo ou ação. Alvos interativos de no mínimo 44 × 44 px; regiões permanecem na ordem lógica em telas estreitas.
- **Leitor de tela:** landmarks, um `h1`, cabeçalhos sem saltos, listas semânticas, ordem DOM igual à leitura; agenda como lista cronológica. Expor status, estado lido/não lido e diálogos corretamente. Cobrir testes manuais com leitor de tela com a tela coberta/desligada. Qual combinação é obrigatória permanece em aberto (TK-14.01).
- Respeitar `prefers-reduced-motion`, `prefers-color-scheme`, `prefers-contrast`, `prefers-reduced-transparency` e cores forçadas. Não usar animação para transmitir estado.

## Segurança e privacidade

- Permitir a entrada somente ao papel `THERAPIST`; backend continua sendo autoridade para autorização e propriedade dos recursos. Não confiar em papel/IDs fornecidos pelo cliente nem mostrar agenda de terceiros.
- Usar o cliente compartilhado; validar todas as respostas da API com Zod. Validar IDs e datas antes do envio; codificar parâmetros de rota/query adequadamente.
- Renderizar mensagens como texto, sem HTML vindo do backend ou de usuário. Não usar `dangerouslySetInnerHTML`, `innerHTML`, `eval` ou URLs não validadas.
- Exibir somente `employee.firstName` nas regiões do terapeuta. Não registrar dados pessoais, conteúdo de avisos ou `spokenText` em console, telemetria ou ferramentas de terceiros.
- Não guardar dados de agenda, avisos, dados de saúde, nem segredos em `localStorage`; a preferência de tema continua permitida conforme a política geral. Não persistir notificações em cache de PWA; sem service worker de push.
- Tratar falhas sem expor stack trace, corpo bruto, IDs internos ou mensagens técnicas. Em ações que alteram dados, respeitar a confirmação definida por ticket e não repetir automaticamente requisições de mutação.

## Perguntas em aberto

- Qual leitor de tela e aparelho os massoterapeutas usam? Permanece em aberto até TK-14.01; a matriz mínima documentada aplica-se enquanto isso.
- Quais combinações de leitor/navegador e dispositivos serão efetivamente disponíveis para a validação do TK-11.04? Registrar após a entrevista e agendamento com os massoterapeutas.
- Qual intervalo de consulta periódica de `/notifications` será usado na interface? D-07 define polling, mas o contrato consultado não fixa o intervalo; manter configurável e validar impacto com a equipe antes de adotar um valor.
- Os textos e a prioridade de urgência dos avisos serão validados com os massoterapeutas em TK-14.03; assertive fica limitado às mudanças de Agora/Próximo conforme o roadmap.
