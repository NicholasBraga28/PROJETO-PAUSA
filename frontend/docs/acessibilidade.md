# Padrão de acessibilidade visual do frontend

Criado em 2026-10-27. Documento **normativo**: toda tela, componente e PR do frontend segue este arquivo. O `AGENTS.md`, o `CONTEXT.md` e o `docs/roadmap.md` apontam para cá; em caso de dúvida, este arquivo detalha e eles resumem.

## Por que este documento existe

O usuário principal do sistema é o **massoterapeuta com deficiência visual**. Para ele, a tela não é um complemento da Alexa: é o canal em que ele lê a agenda, recebe avisos e age sobre os próprios atendimentos, sem pedir informação a ninguém (métrica principal do projeto). Um único botão sem nome, um foco perdido ou um aviso que não é anunciado quebra essa autonomia.

Por isso a acessibilidade visual **não é uma etapa de revisão no fim**: é requisito de entrada de toda tarefa. Funcionalidade que não cumpre este padrão não está pronta, mesmo que funcione para quem enxerga.

## Normas e referências seguidas

Seguimos **todas** as referências abaixo. Quando duas divergirem, vale a mais exigente.

| Referência | O que é | Como usamos |
| --- | --- | --- |
| **Lei Brasileira de Inclusão** (Lei 13.146/2015, art. 63) | Obriga a acessibilidade de sites mantidos por empresas no Brasil | Base legal. Acessibilidade não é opcional |
| **ABNT NBR 17225:2025** | Norma brasileira de requisitos de acessibilidade em conteúdo e aplicações web | Requisitos obrigatórios; alinhada à WCAG |
| **eMAG 3.1** (Modelo de Acessibilidade em Governo Eletrônico) | Recomendações brasileiras de acessibilidade web | Atalhos de teclado para regiões, página de acessibilidade, barra de acessibilidade |
| **WCAG 2.2** (W3C) | Diretrizes internacionais de acessibilidade para conteúdo web | **Nível AA em tudo, sem exceção**, mais os critérios **AAA** listados abaixo |
| **WAI-ARIA 1.2** | Especificação de papéis, estados e propriedades ARIA | Só quando o HTML nativo não basta |
| **ARIA Authoring Practices Guide (APG)** | Padrões de teclado e de semântica para cada tipo de componente | Todo componente interativo segue o padrão APG correspondente |
| **AccName 1.2** e **HTML-AAM** | Como o navegador calcula o nome acessível e expõe o HTML às tecnologias assistivas | Verificar o nome que o leitor de tela vai de fato anunciar |
| **W3C COGA** (*Making Content Usable for People with Cognitive and Learning Disabilities*) | Orientações de linguagem e previsibilidade | Linguagem simples, fluxos curtos, nada de surpresas |
| **EN 301 549** e **Section 508** | Normas europeia e americana | Referência de verificação; ambas incorporam a WCAG |

> **Requisito fulcral (D-23, 2026-10-27).** Acessibilidade é o requisito fulcral do frontend: nenhuma tela é entregue sem ela, e em conflito com estética, prazo ou funcionalidade, **a acessibilidade vence**. A meta deste arquivo está registrada no RN-04 do `backend/docs/requisitos.md`.

## Meta de conformidade

1. **WCAG 2.2 nível AA em todas as telas** (colaborador, massoterapeuta, RH, suporte, check-in, "Entrar como…"), sem exceções nem "depois a gente arruma".
2. **Critérios AAA obrigatórios** em todo o frontend, escolhidos porque pesam diretamente para quem tem deficiência visual:

| Critério | Nome | O que exigimos |
| --- | --- | --- |
| 1.4.6 | Contraste (aprimorado) | Texto com contraste de **7:1**; texto grande (≥ 24 px, ou ≥ 18,66 px em negrito) com **4,5:1** |
| 1.4.8 | Apresentação visual | Linhas com até 80 caracteres, entrelinha de pelo menos 1,5, texto nunca justificado, cores escolhidas pelo usuário (temas) |
| 1.4.9 | Imagens de texto (sem exceção) | Nenhum texto em imagem, nem em logotipo decorativo com informação |
| 2.1.3 | Teclado (sem exceção) | Tudo operável só por teclado |
| 2.3.3 | Animação de interações | Movimento não essencial pode ser desligado (e já sai desligado com "reduzir movimento") |
| 2.4.9 | Finalidade do link (só o link) | O texto do link diz sozinho para onde ele leva |
| 2.4.10 | Cabeçalhos de seção | Todo bloco de conteúdo começa com um cabeçalho |
| 2.4.12 | Foco não obscurecido (aprimorado) | Nenhuma parte do elemento focado fica escondida por barra fixa, aviso ou diálogo |
| 2.4.13 | Aparência do foco | Indicador com pelo menos 2 px de espessura em todo o contorno e contraste de 3:1 entre o estado focado e o não focado |
| 2.5.5 | Tamanho do alvo (aprimorado) | Todo alvo de toque ou clique com pelo menos **44 × 44 px** |
| 3.2.5 | Mudança a pedido | Nenhuma mudança de contexto acontece sozinha; só por ação do usuário |
| 3.3.6 | Prevenção de erros (todas) | Toda ação que altera dados pode ser revista, confirmada ou desfeita |

3. Critérios AAA que **não** conseguimos garantir, com o porquê:
   - **2.2.3 Sem tempo:** prazos de negócio (oferta da lista de espera, janela de check-in) vêm das regras do RH. A interface não impõe tempo próprio, anuncia o prazo com antecedência, mostra o tempo restante em texto e nunca encerra a tela por inatividade.
   - **3.1.5 Nível de leitura:** buscamos linguagem simples, mas termos do domínio (check-in, lista de espera) ficam.

## Perfis de deficiência visual cobertos

Toda tela é pensada e testada para estes perfis, não só para a cegueira total.

| Perfil | Como a pessoa usa o sistema | O que precisa funcionar |
| --- | --- | --- |
| **Cegueira** | Leitor de tela (NVDA, JAWS, Narrador, VoiceOver, TalkBack), teclado ou gestos | Semântica, nomes acessíveis, ordem de leitura, foco gerenciado, anúncios |
| **Baixa visão** | Zoom do navegador até 400%, ampliador de tela (Lupa do Windows, Zoom do macOS e do iOS, ZoomText), fonte grande do sistema | Reflow sem rolagem horizontal, foco e informação relacionada próximos, contraste alto, alvos grandes |
| **Baixa sensibilidade ao contraste** | Tema de alto contraste, contraste do sistema operacional | Contraste 7:1, bordas visíveis, tema "Alto contraste", `prefers-contrast` |
| **Daltonismo** (protanopia, deuteranopia, tritanopia, acromatopsia) | Visão normal das formas, cores confundidas | Nenhuma informação só por cor: status sempre com texto e, se houver, ícone |
| **Fotofobia** | Tema escuro, brilho baixo | Tema escuro sem branco puro em grandes áreas |
| **Campo visual reduzido** (visão tubular, perda central) | Ampliação, leitura por partes | Informação principal no começo, ações perto do conteúdo, nada que dependa de visão periférica |
| **Modo de cores forçadas** (Contraste do Windows) | Cores do sistema substituem as do site | Bordas, foco, ícones e estados visíveis em `forced-colors: active` |

## Requisitos por tema

### 1. Semântica e estrutura

- **HTML nativo antes de ARIA** (primeira regra do ARIA). `<button>` para ações, `<a href>` para navegação, `<ul>`/`<ol>` para listas, `<table>` só para dados tabulares (com `<caption>`, `<th>` e `scope`).
- **Landmarks** em toda tela: `header` (banner), `nav` com `aria-label`, um único `main` com `id="conteudo"`, `footer` quando houver. Regiões extras são `section` com `aria-labelledby` apontando para o cabeçalho visível.
- **Um `h1` por tela**, e a hierarquia de cabeçalhos não pula níveis. O leitor de tela navega por cabeçalhos: eles são o índice da página.
- **`lang="pt-BR"`** no `<html>`; trechos em outro idioma levam `lang` próprio.
- **Título da página** (`document.title`) único e descritivo em cada tela: `"<Tela> · Pausa"`. Muda a cada troca de tela.
- **Ordem do DOM = ordem visual = ordem de leitura.** Nada de reordenar com CSS (`order`, `flex-direction: row-reverse`, posição absoluta) o que muda o sentido.
- ARIA, quando usada, **completa**: papel, nome, estado (`aria-expanded`, `aria-pressed`, `aria-current`, `aria-selected`, `aria-invalid`) e relações (`aria-describedby`, `aria-controls`) sempre atualizados.

### 2. Nome acessível e textos alternativos

- **Todo controle tem nome acessível.** Botão só com ícone leva `aria-label`; o ícone leva `aria-hidden="true"`.
- **O nome visível está contido no nome acessível** (2.5.3): se o botão mostra "Cancelar", o `aria-label` começa por "Cancelar" ("Cancelar a sessão de terça, 14h").
- Botões repetidos numa lista têm nomes distintos ("Cancelar a sessão de terça, 14h", não cinco "Cancelar").
- `title` nunca é o único rótulo.
- **Imagens:** `alt` que descreve a função; imagem decorativa com `alt=""`. SVG decorativo com `aria-hidden="true"` e `focusable="false"`.
- **Cenas 3D, animações e ilustrações** (a cena `three.js` do hero, mantida pela D-24, o logotipo animado, o texto "digitado") são decorativas: `aria-hidden="true"`, sem informação exclusiva, e o leitor de tela recebe a frase inteira. Texto sobre a cena fica sobre fundo sólido, com contraste 7:1.
- **QR Code** (impressão pelo RH) acompanha texto com a sala e a instrução de uso.
- Caracteres decorativos (`·`, `→`, `|`, emojis) que o leitor de tela lê de forma estranha ficam em `aria-hidden` ou saem do texto.

### 3. Teclado

- **Tudo operável por teclado** (2.1.1 e 2.1.3), sem armadilha (2.1.2).
- Componentes interativos seguem o **padrão APG**: grupo de rádio (Tab entra, setas trocam), diálogo modal (foco preso, Esc fecha), abas, listbox, menu, disclosure. Usamos o React Aria (D-10), que já implementa esses padrões; não recriamos à mão.
- **Atalhos de região** (eMAG): links de pulo no topo para cada região principal. Na tela do massoterapeuta: "Ir para Agora", "Ir para Próximo", "Ir para Agenda de hoje", "Ir para Ações", "Ir para Avisos".
- Atalhos de tecla única só se puderem ser desligados ou remapeados (2.1.4). Atalhos com modificador não colidem com os do leitor de tela (NVDA usa Insert e CapsLock; JAWS também).
- Nada depende de `hover`, duplo clique, arrastar ou gesto complexo (2.5.1, 2.5.7). Arrastar sempre tem alternativa por botão.

### 4. Foco

- **Visível sempre** (2.4.7), com a aparência do 2.4.13: contorno de pelo menos 2 px, `outline-offset` positivo, contraste de 3:1 contra o fundo e contra o estado não focado, em **todos** os temas e em `forced-colors`.
- **Nunca** `outline: none` sem substituto equivalente.
- **Não obscurecido** (2.4.12): a barra fixa do topo reserva espaço com `scroll-padding-top`; avisos e banners não cobrem o elemento focado.
- **Foco gerenciado** em toda mudança sem recarregar a página:
  - troca de tela ou de rota: foco no `h1` da nova tela (com `tabIndex={-1}`), sem rolar;
  - diálogo aberto: foco na opção **que não altera nada** ("Voltar"); ao fechar, volta ao botão que abriu;
  - item removido de uma lista: foco no próximo item, ou no título da lista se ela ficou vazia;
  - erro de formulário: foco no resumo de erros ou no primeiro campo inválido;
  - conteúdo carregado depois de um "Carregando…": o foco fica onde estava.
- O foco **nunca** cai no `body` depois de uma ação.

### 5. Anúncios e mudanças dinâmicas

- **Uma região viva única** (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`) para confirmações e mudanças, alimentada pelo `spokenText` que o backend devolve pronto.
- **`role="alert"`** só para erro que impede a tarefa. `aria-live="assertive"` só para aviso urgente ao massoterapeuta (por exemplo, cancelamento do atendimento que está prestes a começar); nunca para notícias comuns.
- Toda mensagem de status é anunciada **sem mover o foco** (4.1.3).
- Mensagens **ficam visíveis** na tela; nada de aviso que some sozinho antes de poder ser lido. Se um aviso temporário for inevitável, ele dura até ser fechado.
- **Atualizações automáticas** (consulta periódica de avisos, D-07) não movem o foco, não reordenam o conteúdo sob o cursor e não repetem o mesmo anúncio. Avisos ficam num histórico consultável ("Avisos"), além de anunciados.
- Carregamentos longos anunciam o início ("Carregando sua agenda") e o fim, uma vez cada.

### 6. Formulários

- **Rótulo visível e associado** (`<label for>` ou componente do React Aria) em todo campo. Placeholder nunca substitui rótulo.
- Instruções e formato esperado **antes** do campo, ligados por `aria-describedby`.
- `autocomplete` com o propósito certo (1.3.5) quando o dado for pessoal.
- **Erros:** texto que diz o que aconteceu e o que fazer, em uma frase, ligado ao campo por `aria-describedby`, com `aria-invalid="true"`; nunca só borda vermelha.
- Preferir manter o botão habilitado e explicar o motivo a desabilitá-lo em silêncio. Se desabilitar, o motivo aparece em texto perto dele.
- **Entrada redundante** (3.3.7): não pedir de novo o que o sistema já sabe.
- **Autenticação acessível** (3.3.8): sem captcha nem teste cognitivo; colar senha e gerenciador de senhas permitidos (relevante quando o login Google entrar).

### 7. Cor e contraste

- **Texto: 7:1** (AAA). Texto grande: 4,5:1. Vale em todos os temas, inclusive texto sobre imagem, gradiente ou cena 3D (use fundo sólido atrás do texto).
- **Componentes de interface e gráficos: 3:1** (1.4.11) no mínimo; nas telas do massoterapeuta, buscar 4,5:1 em bordas de campos e botões.
- **Nenhuma informação só por cor** (1.4.1). Status de atendimento sempre com **texto** ("Confirmada", "Possível ausência"); cor e ícone apenas reforçam. Links dentro de texto são sublinhados.
- Paletas novas passam pelo **simulador de daltonismo** do DevTools (protanopia, deuteranopia, tritanopia, acromatopsia) antes do PR.
- Os pares de cor dos tokens são verificados por **script automatizado** em todos os temas (TK-09.06); cor nova não entra sem passar nele.

### 8. Temas e preferências do sistema

- Temas **Automático, Claro, Escuro e Alto contraste**, escolhidos por um grupo de rádio acessível e lembrados no navegador.
- Respeitar as preferências do sistema: `prefers-color-scheme`, `prefers-contrast: more`, `prefers-reduced-motion`, `prefers-reduced-transparency` e **`forced-colors: active`**.
- Em `forced-colors`, usar as cores do sistema (`CanvasText`, `Canvas`, `ButtonText`, `ButtonFace`, `Highlight`, `LinkText`), manter bordas reais (não só sombra) e garantir que foco, seleção e estados continuem visíveis.

### 9. Ampliação, reflow e espaçamento

- **Texto ampliado a 200%** sem perda de conteúdo ou função (1.4.4).
- **Zoom de 400% / largura de 320 px CSS** sem rolagem horizontal (1.4.10). Tabelas de dados são a única exceção permitida pela WCAG e, mesmo assim, ganham versão em lista no celular.
- **Espaçamento de texto** ajustável (1.4.12): o layout não quebra com entrelinha 1,5, espaço entre parágrafos 2×, entre letras 0,12× e entre palavras 0,16× a fonte.
- Tamanhos em `rem`/`em`, nunca altura fixa em contêiner de texto; a fonte base respeita a configuração do navegador e do sistema (sem `font-size` fixo em `px` no `html`). Fonte base de pelo menos 16 px.
- **Ampliadores de tela:** rótulo, valor e ação ficam próximos; mensagens aparecem perto de onde a pessoa está olhando; conteúdo que surge no hover ou no foco pode ser dispensado, fica enquanto o ponteiro estiver sobre ele e não some sozinho (1.4.13).
- **Orientação livre** (1.3.4): retrato e paisagem.

### 10. Tipografia e conteúdo visual

- Fonte legível (Open Sans), peso mínimo 400 no corpo, entrelinha ≥ 1,5, linhas de até 80 caracteres, alinhamento à esquerda, sem texto justificado.
- Sem letras espremidas: nada de `letter-spacing` negativo em texto corrido; sem frases longas em maiúsculas ou itálico.
- Fontes decorativas (Instrument Serif) só em títulos grandes, nunca em texto informativo.

### 11. Movimento e animação

- **"Reduzir movimento" do sistema desliga** deslocamentos, parallax, rolagem suave, cenas 3D e o texto "digitado" (2.3.3).
- Nada pisca mais de três vezes por segundo (2.3.1).
- Movimento automático que dura mais de 5 s tem **pausar/parar** visível (2.2.2), mesmo sem "reduzir movimento". A cena 3D do hero tem um botão "Pausar animação" alcançável por teclado, com nome acessível e estado (`aria-pressed`), e a escolha fica lembrada no navegador.
- Animações não carregam informação: o estado final é o que importa e aparece sem animação.

### 12. Conteúdo e linguagem

- **Informação principal nas primeiras palavras** ("14h, Ana, confirmada"), porque quem usa leitor de tela decide em segundos se continua ouvindo.
- Datas e horas como se fala: "hoje às 14h", "amanhã às 9h", "terça, 28 de outubro"; nunca ISO, UTC ou abreviações ambíguas ("seg", "14:00h"). Fuso `America/Sao_Paulo`.
- Frases curtas, voz ativa, português simples. Só o primeiro nome do colaborador nas telas do massoterapeuta.
- Mensagens de erro dizem o que aconteceu e o que fazer, em uma frase, sem códigos ou jargão. O texto vem do backend (catálogo de mensagens).
- Ajuda consistente (3.2.6): o caminho para ajuda fica no mesmo lugar em todas as telas.
- Navegação e identificação consistentes (3.2.3, 3.2.4): o mesmo controle tem o mesmo nome e a mesma posição em todas as telas.

### 13. Tempo

- A interface **não impõe limite de tempo próprio** e não desconecta por inatividade.
- Prazos de negócio (oferta da lista de espera, janela de check-in) aparecem em texto ("A vaga fica reservada para você até 14h10"), não só em contagem regressiva visual. Contagem regressiva, se existir, não é anunciada a cada segundo.

### 14. Celular e toque

- Alvos com pelo menos 44 × 44 px e espaço entre alvos vizinhos.
- Ação dispara ao **soltar** o dedo, com chance de cancelar arrastando para fora (2.5.2).
- Funciona com os gestos do **TalkBack** e do **VoiceOver** (deslizar para navegar, toque duplo para ativar) e com teclado externo conectado ao celular.
- Nada depende de agitar, inclinar ou de gesto com vários dedos (2.5.4).

## Regras específicas da tela do massoterapeuta (EP-11)

O massoterapeuta é o usuário principal; aqui não há meio-termo.

- **Regiões fixas e previsíveis**, sempre na mesma ordem, cada uma uma `section` com cabeçalho e atalho de pulo: **Agora**, **Próximo**, **Agenda de hoje**, **Ações**, **Avisos**.
- **Agenda em lista ordenada cronologicamente**, nunca em grade ou calendário visual. Cada item é uma frase completa e autossuficiente: "14h, Ana, sala 2, confirmada". O backend já devolve a lista em ordem; o frontend não reordena.
- **Ações com confirmação explícita** (RN-13) em diálogo modal: foco começa em "Voltar", o texto descreve exatamente o que vai acontecer e o resultado é anunciado com o `spokenText` da resposta.
- **Avisos em tempo real** (RF-31) anunciados na região viva e guardados em "Avisos", com hora e marcação de lido. Nenhum aviso some sem ter sido anunciado.
- Funciona **só com leitor de tela, sem olhar a tela**, no computador e no celular do massoterapeuta. Os testes manuais desta tela são feitos com a tela desligada ou coberta (NVDA "cortina de tela", VoiceOver "cortina de tela", TalkBack "escurecer tela").
- Validação com os próprios massoterapeutas antes de considerar o épico pronto (TK-11.04, princípio "nada sobre nós sem nós").

## Matriz de tecnologias assistivas

| Leitor de tela | Navegador | Sistema | Quando testar |
| --- | --- | --- | --- |
| **NVDA** (versão estável mais recente) | Chrome e Firefox | Windows | **Todo PR que muda tela** |
| **TalkBack** | Chrome | Android | Todo PR que muda tela do massoterapeuta; fim de cada épico |
| **VoiceOver** | Safari | iOS | Fim de cada épico |
| **VoiceOver** | Safari | macOS | Fim de cada épico |
| **Narrador** | Edge | Windows | Fim de cada épico |
| **JAWS** | Chrome | Windows | Se houver licença disponível; fim de cada épico |

Ampliação: zoom do navegador a 200% e 400% em todo PR que muda tela; Lupa do Windows e Zoom do iOS no fim de cada épico. Cores forçadas: Contraste do Windows (tema "Deserto" e "Noite") no fim de cada épico e emulação do DevTools em todo PR.

> O leitor de tela e o aparelho que os massoterapeutas usam ainda estão `[PREENCHER]` no `backend/docs/requisitos.md` (perfil do usuário principal, TK-14.01). Quando a entrevista responder, a combinação deles passa a ser obrigatória em todo PR.

## Como verificamos

### Automático (bloqueia o PR)

| Ferramenta | O que pega | Onde |
| --- | --- | --- |
| `eslint-plugin-jsx-a11y` no modo **strict** | Rótulos, papéis, `alt`, eventos sem teclado | `npm run lint` |
| **axe-core** em todo teste de tela (jsdom) | Regras WCAG 2.0, 2.1 e 2.2 A/AA e boas práticas; o jsdom não calcula contraste | `npm test` |
| **Playwright + `@axe-core/playwright`** em navegador real (D-26) | Contraste AA e AAA (`color-contrast-enhanced`), em cada tema, com zoom de 400% / 320 px, `forced-colors`, `prefers-reduced-motion` | `npm run test:a11y` |
| **Script de contraste dos tokens** | Todos os pares texto/fundo e foco/fundo de cada tema | `npm run check:contrast` |
| Testes com Testing Library **por papel e nome** (`getByRole`, `getByLabelText`) | Se o leitor de tela acha o controle pelo nome que deveria | `npm test` |

Regras dos testes:

- Controles são encontrados por `getByRole(..., { name })`, nunca por `getByTestId` ou classe CSS. Se o teste não acha pelo papel, o leitor de tela também não acha.
- Toda tela e todo diálogo têm um teste de axe sem violações.
- Testes de teclado com `user-event`: Tab, Shift+Tab, setas, Enter, Espaço, Esc.
- Testes de foco: depois de cada ação, o teste confere onde o foco está.
- Testes de anúncio: depois de cada ação, o teste confere o texto da região viva.

### Manual (antes de pedir revisão)

Roteiro mínimo, registrado no PR (o modelo de PR em `.github/pull_request_template.md` traz a lista para marcar):

1. **Só teclado**, do início ao fim da tarefa, sem mouse.
2. **NVDA + Chrome**, navegando por cabeçalhos (H), regiões (D), formulários (F) e pela lista de elementos (Insert+F7); a tarefa termina sem olhar a tela.
3. **Zoom de 400%** no navegador, sem rolagem horizontal e sem nada cortado.
4. **Alto contraste** do site e emulação de `forced-colors` no DevTools.
5. **Simulação de daltonismo** no DevTools para cada tela com status ou cor.
6. **Reduzir movimento** ligado no sistema.

### Com pessoas

- Sessão com os massoterapeutas no fim do EP-11 (TK-11.04) e no teste de usabilidade do M3 (TK-14.05).
- Problema relatado por eles vira ticket com prioridade sobre funcionalidade nova.

## Definição de pronto de acessibilidade

Todo PR que toca a interface só vai para revisão com:

- [ ] Semântica, landmarks, cabeçalhos e título da página conferidos
- [ ] Todo controle com nome acessível que contém o texto visível
- [ ] Tudo operável por teclado, seguindo o padrão APG do componente
- [ ] Foco visível (2.4.13), não obscurecido e gerenciado em cada mudança de tela, diálogo e remoção
- [ ] Mudanças anunciadas na região viva, com o `spokenText` do backend quando houver
- [ ] Contraste 7:1 no texto e 3:1 nos componentes, em todos os temas, verificado pelo script e pelo axe em navegador real
- [ ] Nenhuma informação só por cor
- [ ] Zoom de 400% e 320 px sem rolagem horizontal; espaçamento de texto ajustável
- [ ] `forced-colors`, `prefers-contrast` e `prefers-reduced-motion` respeitados
- [ ] Alvos com pelo menos 44 × 44 px
- [ ] Testes automáticos (lint, axe, foco, anúncio, teclado) passando
- [ ] Roteiro manual feito e registrado no PR (NVDA + Chrome, teclado, zoom, contraste, daltonismo, movimento)

Se uma funcionalidade **não puder** ser tornada acessível, ela não é implementada: pare e pergunte.
