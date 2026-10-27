# reservas-massagem

Agenda de massagens acessível (Pausa), do Desafio de Inovação do Programa de Estágio Semantix 2026: site de reservas do colaborador e API. A explicação completa (contexto, como rodar, frontend, backend, rotas, integração e próximos passos) está no [README.md](README.md).

- `frontend/` — site de reservas (React + Vite), já ligado à API
- `backend/` — API (NestJS + Prisma + PostgreSQL), importada de github.com/A949604/projeto-estagio
- `.github/workflows/` — CI do backend

Rodar: backend em `backend/` (`docker compose up -d`, `npm run prisma:deploy`, `npm run db:seed-demo`, `npm run start:dev`) e frontend em `frontend/` (`npm run dev` → http://localhost:5173). O backend precisa de `SESSION_DURATION_MINUTES=30` e `SLOT_STEP_MINUTES=30` no `backend/.env`.

## _paralelos
- `_paralelos/animacao-logo/` — animação da logo PAUSA para o serviço, feita em 2026-10-27. Tem:
  - `pausa-logo.mp4`: o vídeo, 1920×1080, 4,5 s (versão 3, aprovada);
  - `pausa-logo-diamante.mp4` e `animacao-diamante.html`: a mesma animação com a logo de diamante. A palavra corta o diamante na cinta, e dele aparecem só o tampo e o bico. Tem 5 s. Há duas variantes de tamanho, em `pausa-logo-diamante-menor.mp4` (diamante do tamanho da palavra) e `pausa-logo-diamante-palavra.mp4` (palavra 35% maior). Elas saem de `animacao-diamante.html?variante=menor` e `?variante=palavra`;
  - `logo-pausa.svg`: a logo em vetor, redesenhada da imagem original;
  - `animacao.html`: a animação, com prévia;
  - `servidor.py`: refaz o MP4 a partir da página. Rode `python servidor.py`, abra http://127.0.0.1:8790/animacao.html e clique em "exportar MP4". Precisa do `imageio-ffmpeg` (`pip install --user imageio-ffmpeg`).
