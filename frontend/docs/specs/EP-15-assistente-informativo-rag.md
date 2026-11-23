# EP-15 — Assistente informativo com RAG

**Lidera:** Guilherme · **Requisito:** RF-34 · **Prioridade:** em aberto (`[M/S/C/W]`)

## Objetivo

Permitir que uma pessoa usuária pergunte sobre o funcionamento do sistema e receba uma resposta em português baseada nos documentos oficiais, com indicação das fontes. O assistente informa; não reserva, cancela, consulta dados pessoais nem altera agendamentos.

O índice usa `backend/CONTEXT.md` e `backend/docs/requisitos.md`. Em caso de divergência, `requisitos.md` prevalece. Quando os documentos não respondem, a resposta orienta a pessoa a confirmar com o RH.

## Fora de escopo

- Executar ações, consultar agenda individual, autenticar ou modificar dados.
- Guardar histórico entre navegações, transmitir voz, fazer streaming de respostas ou consultar fontes externas.
- Definir a prioridade do RF-34, a hospedagem do modelo e a política de retenção operacional; permanecem em aberto.

## Telas e rotas

- `/chat`, página pública com formulário de pergunta e conversa em ordem cronológica. O link “Tirar dúvidas” aparece na navegação compartilhada.
- Estado inicial vazio com exemplo; estado enviando; resposta com fontes e perguntas relacionadas; erro com nova tentativa.
- A conversa permanece apenas no estado da página e é descartada ao sair dela ou recarregá-la.

## Contratos da API usados

### Frontend → NestJS

`POST /api/chat/messages`

Request: `{"message":"Como funciona o cancelamento?"}`. O DTO remove espaços externos, rejeita pergunta vazia e limita a 500 caracteres. O endpoint é público, sujeito ao rate limit global da API; o frontend não envia `x-user-id` nessa chamada.

Response: `{"answer":"...","topic":"rag","sources":["requisitos.md"],"suggestions":["..."]}`. O frontend valida o objeto com Zod antes de apresentar qualquer campo.

### NestJS → serviço RAG

- `POST /chat` recebe `{"message":"..."}` e retorna `answer`, `sources` e `suggestions`.
- `GET /health` informa o estado do índice e o total de trechos carregados.
- O endereço é configurado por `RAG_CHAT_URL`; o serviço Python deve ser acessível apenas pela API NestJS.

## Estados

| Estado | Comportamento |
| --- | --- |
| Vazio | Exemplo de pergunta, formulário rotulado e orientação para não incluir dados pessoais. |
| Carregando | Pergunta aparece na conversa, formulário evita envio duplicado, o início é anunciado e o foco permanece. |
| Resposta | Texto simples, fontes e sugestões aparecem em ordem; a resposta é anunciada uma vez. |
| Erro | Mensagem compreensível vinda da API/cliente, erro anunciado como bloqueador e botão para repetir a mesma pergunta. O texto digitado permanece disponível. |
| Sem trecho relevante | O serviço informa que não encontrou a resposta e orienta confirmar com o RH; fontes vazias são aceitas. |

## Critérios de aceite

### TK-15.01 — Serviço Python RAG

- **Dado** que os documentos oficiais estão disponíveis, **Quando** o serviço inicia, **Então** indexa `CONTEXT.md` e `docs/requisitos.md` e informa quantidade de trechos em `/health`.
- **Dado** que a pergunta encontra trechos relevantes, **Quando** o RAG responde, **Então** usa apenas o contexto recuperado, retorna fontes e não segue instruções da pergunta que tentem substituir as regras do sistema.
- **Dado** que não há trecho acima do limiar ou o modelo falha, **Quando** a pergunta é processada, **Então** o serviço retorna orientação de não encontrado ou indisponibilidade sem inventar dados.

### TK-15.02 — API NestJS

- **Dado** que uma pergunta não vazia de até 500 caracteres é enviada, **Quando** `POST /api/chat/messages` é chamado, **Então** encaminha a pergunta ao endereço configurado e responde com `answer`, `topic: "rag"`, `sources` e `suggestions`.
- **Dado** que a entrada é vazia, não textual ou maior que 500 caracteres, **Quando** a API valida o corpo, **Então** rejeita a requisição sem encaminhá-la ao RAG.
- **Dado** que o serviço RAG demora além do limite ou está indisponível, **Quando** a API tenta encaminhar, **Então** retorna erro de indisponibilidade com mensagem compreensível e sem detalhes internos.

### TK-15.03 — Interface do assistente

- **Dado** que a pessoa abre `/chat`, **Quando** a página termina de carregar, **Então** vê um título, a conversa vazia, o aviso de privacidade e o formulário com limite de 500 caracteres.
- **Dado** que uma pergunta é enviada, **Quando** o serviço responde, **Então** a pergunta, resposta, fontes e sugestões aparecem na conversa; uma sugestão pode iniciar outra pergunta.
- **Dado** que a requisição falha, **Quando** o erro aparece, **Então** a pergunta permanece e a pessoa pode tentar de novo sem redigitá-la.
- **Dado** que a resposta contém texto fornecido pelo modelo, **Quando** é exibida, **Então** aparece como texto escapado, sem interpretação de HTML.

### TK-15.04 — Validação integrada e acessibilidade

- **Dado** que NestJS, RAG e modelo configurado estão disponíveis, **Quando** uma conversa é feita ponta a ponta, **Então** a resposta deriva dos documentos oficiais, contém as fontes e falhas de dependência são apresentadas com recuperação possível.
- **Dado** que os testes automatizados da página e da API são executados, **Quando** cobrem estados vazio, envio, resposta, fontes, sugestão, validação e erro, **Então** passam com respostas simuladas e não exigem download ou serviço Ollama.
- **Dado** que a rota é avaliada nos temas e larguras documentados, **Quando** axe, teclado, zoom e `forced-colors` são usados, **Então** não há violações e o conteúdo permanece utilizável.

## Acessibilidade

- **Foco:** título focável ao entrar por rota; envio e resposta não deslocam o foco; erro deixa a pergunta disponível e mantém foco previsível; nenhuma barra fixa cobre campos e controles.
- **Anúncio:** uma única região viva compartilhada anuncia início e texto da resposta; conversa é uma lista cronológica com `aria-live="off"` para evitar repetição; `role="alert"` apenas para erro que impede a consulta.
- **Nome acessível:** `main`, um `h1`, seção “Conversa”, campo “Sua pergunta”, botão “Enviar pergunta”, lista da conversa, fontes e sugestões têm rótulos compreensíveis.
- **Teclado:** formulário envia com Enter conforme o comportamento do campo e botão; sugestões e nova tentativa operam com Enter/Espaço; sem atalhos exclusivos de ponteiro.
- **Contraste:** texto 7:1, componentes/foco 3:1; tema claro, escuro, alto contraste e `forced-colors`; estados nunca dependem só da cor.
- **Zoom:** 400%/320 px sem rolagem horizontal; texto do modelo pode quebrar linhas longas; controles com alvo mínimo de 44 × 44 px; espaçamento de texto não corta mensagens.
- **Leitor de tela:** pergunta e resposta são identificadas por título, lista cronológica é navegável, resposta é anunciada uma vez e continua disponível para releitura; testar NVDA/Chrome e TalkBack/Chrome.

## Segurança e privacidade

- Limite de 500 caracteres validado no DTO e no serviço Python; rejeitar entrada inválida antes de chamar o modelo.
- Só documentos oficiais entram no índice; respostas tratam o contexto como dados, citam fontes e não alegam executar operações.
- O endpoint NestJS é público e usa o rate limit global. O processo Python deve ficar privado à API; não expor a porta RAG publicamente.
- O frontend não envia `x-user-id` para o chat, não salva a conversa em armazenamento local e não interpreta resposta como HTML.
- A tela orienta a não enviar dados pessoais ou detalhes de agendamento. Revisar logs, acesso anônimo em produção e retenção antes do deploy.
- Chaves/configurações do Ollama permanecem no ambiente do serviço, nunca em variáveis `VITE_*`.

## Perguntas em aberto

- Qual prioridade MoSCoW terá RF-34? Continua `[M/S/C/W]` até decisão do produto.
- Qual modelo e infraestrutura serão usados no deploy, e quais limites de latência/custo serão aceitos?
- O chat permanecerá anônimo em produção? Qual política será aplicada à retenção de prompts e registros de erro?
- Como medir utilidade e precisão sem armazenar perguntas que possam conter dados pessoais?
