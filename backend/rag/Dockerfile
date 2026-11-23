FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    RAG_DOCUMENTS_DIR=/app/knowledge

WORKDIR /app
COPY rag/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY rag/main.py ./main.py
COPY CONTEXT.md ./knowledge/CONTEXT.md
COPY docs/requisitos.md ./knowledge/requisitos.md

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
