# Chat informativo com RAG

O endpoint de conversa encaminha a pergunta ao assistente informativo. Ele responde com base no guia do sistema e não consulta nem altera agendamentos.

O índice padrão é carregado na inicialização a partir de `docs/pausa.md`, uma base escrita para usuários, sem detalhes internos de implementação. `CONTEXT.md` e `docs/requisitos.md` são documentos de desenvolvimento e não entram no índice padrão. Reinicie o serviço RAG para carregar alterações no guia.

O passo a passo de validação real, os resultados do teste Ollama e as limitações observadas estão em [chat-rag-validacao.md](chat-rag-validacao.md).

## Configuração padrão

| Variável | Padrão | Uso |
| --- | --- | --- |
| `RAG_DOCUMENTS_DIR` | `docs/pausa.md` | Diretório alternativo com documentos `.md`; se definido, substitui a base padrão |
| `RAG_EMBEDDING_MODEL` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | Modelo multilíngue usado para criar o índice e buscar perguntas |
| `RAG_TOP_K` | `4` | Número máximo de trechos recuperados |
| `RAG_MIN_SCORE` | `0.28` | Pontuação combinada mínima para considerar um trecho |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434/v1` | API compatível com OpenAI fornecida pelo Ollama |
| `OLLAMA_MODEL` | `mistral` | Modelo de chat local |
| `OLLAMA_API_KEY` | `ollama` | Valor exigido pelo cliente OpenAI; Ollama local não exige uma chave real |
| `RAG_CHAT_URL` | `http://127.0.0.1:8000/chat` | URL privada usada pela API NestJS para chamar o serviço RAG |

O encoder roda em CPU (`device="cpu"`). O serviço define timeout de 60 segundos na chamada ao modelo. A API NestJS também aborta chamadas ao RAG após 60 segundos. O endpoint NestJS aceita perguntas de até 500 caracteres; o endpoint Python usa o mesmo limite.

## Recuperação e proteção contra respostas inventadas

- O serviço separa linhas de tabelas Markdown em trechos próprios. Isso evita que uma regra fique escondida no meio de várias linhas sem relação.
- A classificação combina similaridade semântica com cobertura lexical, com pesos atuais de 0,55 e 0,45. Linhas que não compartilham termos suficientes com a pergunta não acionam o modelo.
- Quando a linha mais correspondente contém `[PREENCHER]`, `[VALIDAR]` ou `[DECIDIR]`, o serviço responde deterministicamente que a informação está pendente e não chama o modelo. O trecho precisa ser tão correspondente quanto a melhor linha recuperada e atingir a cobertura mínima configurada no código.
- Quando nenhum trecho tem cobertura lexical suficiente, o serviço retorna a mensagem de informação não encontrada, sem chamar o modelo e sem citar uma fonte irrelevante.
- Para fatos documentados sem marca de pendência, o modelo redige uma resposta curta e cita os documentos recuperados. Essa geração ainda precisa ser validada com os modelos e perguntas que serão usados na implantação.

Não coloque documentos pessoais, dados de saúde, agendas ou credenciais no corpus. O serviço RAG deve ficar acessível somente à API NestJS; não publique a porta 8000 na internet. A rota NestJS é pública e depende do rate limit global da API.

## Rodar localmente

Requer Python 3.12, Ollama instalado e um modelo de chat disponível. Na primeira execução, `sentence-transformers` baixa o modelo de embeddings configurado. O primeiro download do Mistral e do encoder pode consumir vários gigabytes de disco e depende de acesso à internet.

No terminal do backend:

```powershell
py -3.12 -m venv .venv-rag
.venv-rag\Scripts\Activate.ps1
python -m pip install -r rag\requirements.txt
ollama pull mistral
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1"
$env:OLLAMA_MODEL = "mistral"
python -m uvicorn main:app --app-dir rag --host 127.0.0.1 --port 8000
```

Configure `RAG_CHAT_URL=http://127.0.0.1:8000/chat` no ambiente da API NestJS (`backend/.env`). Se a variável não estiver definida, a API usa esse endereço local como padrão. O endpoint NestJS permanece público e limitado pelo rate limit global já existente; o serviço Python deve ficar acessível apenas à API.

## Testes do serviço

Com as dependências de `rag/requirements.txt` instaladas, rode no diretório `backend/`:

```powershell
python -m unittest discover -s rag -p test_main.py
```

Os testes usam embeddings e respostas do modelo simulados; não baixam o modelo nem exigem Ollama ativo.

O teste ponta a ponta com modelo local não faz parte dessa suíte unitária. Consulte [chat-rag-validacao.md](chat-rag-validacao.md) para executar e interpretar a validação real.

## Rodar em container

Com o Dockerfile do serviço:

```bash
docker build -f rag/Dockerfile -t pausa-rag .
docker run --rm -p 127.0.0.1:8000:8000 \
  -e OLLAMA_BASE_URL=http://host.docker.internal:11434/v1 \
  -e OLLAMA_MODEL=mistral pausa-rag
```

No Windows e macOS, `host.docker.internal` aponta para o host onde o Ollama está rodando. Em Linux, configure a rota do host apropriada para o ambiente.

## Contrato interno do serviço Python

`POST /chat` recebe `{"message":"Como funciona o cancelamento?"}` e responde com `answer`, `sources` e `suggestions`. `GET /health` informa o status e o número de trechos indexados.

Configurações opcionais: `RAG_DOCUMENTS_DIR`, `RAG_EMBEDDING_MODEL`, `RAG_TOP_K`, `RAG_MIN_SCORE`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` e `OLLAMA_API_KEY`.
