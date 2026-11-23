## O que muda

<!-- Ticket(s) e requisitos: TK-xx.yy, RF/RN/RNF -->

## Como testar

## Verificações automáticas

- [ ] `npm run typecheck`, `npm run lint`, `npm test` e `npm run build` passando
- [ ] Frontend: `npm run test:a11y` (axe em navegador real, por tema, a 320 px, `forced-colors` e movimento reduzido) e `npm run check:contrast` passando

## Roteiro manual de acessibilidade (PR que muda tela)

Roteiro do `frontend/docs/acessibilidade.md`. Marque cada item e anote as telas conferidas e o que foi encontrado.

- [ ] **Só teclado**, do início ao fim da tarefa, sem mouse: foco sempre visível, nunca escondido pela barra fixa, na ordem da leitura
- [ ] **NVDA + Chrome**, por cabeçalhos (H), regiões (D), formulários (F) e lista de elementos (Insert+F7); a tarefa termina sem olhar a tela e os anúncios chegam
- [ ] **Zoom de 400%** no navegador: sem rolagem horizontal e sem nada cortado
- [ ] **Alto contraste** do site e **`forced-colors`** (emulação no DevTools ou contraste do Windows): tudo legível, foco e seleção visíveis
- [ ] **Daltonismo** (emulação no DevTools) em cada tela com status ou cor: nenhuma informação só por cor
- [ ] **Reduzir movimento** ligado no sistema: nada se desloca nem pisca; a cena 3D começa parada

Telas conferidas:

Observações:
