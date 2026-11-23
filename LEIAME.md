# reservas-massagem (PROJETO PAUSA)

Cópia pessoal do Pausa, a agenda de massoterapia acessível do Desafio de Inovação do Programa de Estágio Semantix 2026. A explicação completa (projeto, ferramentas, arquitetura, como rodar e testes) está no [README.md](README.md).

- `backend/`, `frontend/` e `.github/`: o código do repositório do time (`A949604/projeto-estagio`, `main` em `805a723`, 2026-11-10) com as duas correções do dono que não chegaram lá (`4aa89ba`, menu do RH pelo roteador e rótulo de horário no singular; `778e56d`, opção marcada na pesquisa). Entrou num commit só, sem o histórico do time (decisão do dono em 2026-11-22). O repositório do time não foi alterado.
- Até 2026-11-22, este repositório tinha o frontend próprio do dono e um backend importado do time; essa versão continua no histórico do git, antes do commit da cópia.

## _paralelos
- `_paralelos/animacao-logo/` — animação da logo PAUSA para o serviço, feita em 2026-10-27. Tem:
  - **`pausa-logo-diamante-b.mp4`: a versão final aprovada.** É a logo com o diamante da Semantix em contorno e facetas, cortado pela palavra, com a ponta alinhada ao sorriso. Tem 5 s e sai de `animacao-diamante.html?variante=b`. As três propostas paradas estão em `propostas/` (`propostas.html`);
  - `pausa-logo.mp4`: o vídeo sem diamante, 1920×1080, 4,5 s (versão 3, aprovada);
  - `pausa-logo-diamante.mp4` e `animacao-diamante.html`: a mesma animação com a logo de diamante. A palavra corta o diamante na cinta, e dele aparecem só o tampo e o bico. Tem 5 s. Há duas variantes de tamanho, em `pausa-logo-diamante-menor.mp4` (a escolhida pelo dono: diamante mais estreito que a palavra, com as pontas do tampo nos vãos P|A e S|A e o bico logo abaixo do sorriso) e `pausa-logo-diamante-palavra.mp4` (palavra 35% maior). Elas saem de `animacao-diamante.html?variante=menor` e `?variante=palavra`;
  - `logo-pausa.svg`: a logo em vetor, redesenhada da imagem original;
  - `animacao.html`: a animação, com prévia;
  - `servidor.py`: refaz o MP4 a partir da página. Rode `python servidor.py`, abra http://127.0.0.1:8790/animacao.html e clique em "exportar MP4". Precisa do `imageio-ffmpeg` (`pip install --user imageio-ffmpeg`).
