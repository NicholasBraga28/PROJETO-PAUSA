# EP-16 — Pesquisa de satisfação (FE)

## Objetivo

Permitir que colaboradores compartilhem, anonimamente, a experiência com a reserva, a plataforma e o atendimento. O RH consulta médias/distribuições e comentários sem metadados de identidade.

## Escopo

- Exibir a pesquisa em **Suas sessões** quando a API informar pelo menos uma sessão `COMPLETED`.
- Manter o questionário no mesmo lugar após o envio; confirmações de sucesso e falha não movem o foco indevidamente.
- Não enviar identificador do colaborador, sessão, terapeuta ou unidade. O envio é anônimo; respostas repetidas são aceitas.
- Exibir, na área de relatórios do RH, os agregados e comentários anônimos da API.

## Fora de escopo

- Pesquisa para sessões canceladas, liberadas ou marcadas como ausência.
- Envio por e-mail/push, bloqueio de duplicidade ou associação da resposta a uma sessão específica.
- Filtros de unidade, terapeuta, período ou colaborador nos resultados.

## Conteúdo do formulário

Título: **PESQUISA DE SATISFAÇÃO**  
Subtítulo: **Plataforma de Agendamento de Massoterapia**

> Olá! 😊  
> Queremos conhecer sua experiência com nossa plataforma de agendamento e com o atendimento de massoterapia. Sua opinião é muito importante para identificarmos melhorias e oferecermos uma experiência cada vez melhor.  
> A pesquisa é rápida e leva apenas alguns minutos. Agradecemos pela sua participação!

1. **Como você avalia a facilidade para realizar o agendamento pela plataforma?** — Muito fácil; Fácil; Regular; Difícil; Muito difícil.
2. **Em relação à tecnologia, a plataforma atendeu às suas necessidades de uso e navegabilidade?** — Atendeu totalmente; Atendeu em grande parte; Atendeu parcialmente; Não atendeu.
3. **Como você avalia o serviço de massoterapia recebido?** — Excelente; Bom; Regular; Ruim; Péssimo.
4. **De 0 a 10, o quanto você recomendaria nossa plataforma e serviços para um amigo ou familiar?** — escala inclusiva de 0 a 10.
5. **O que podemos fazer para melhorar sua experiência na plataforma ou no atendimento?** — resposta aberta, opcional.

Texto de privacidade junto ao formulário: **Suas respostas não são vinculadas ao seu perfil nem a uma sessão. Você pode responder mais de uma vez. Evite incluir nomes, dados pessoais ou informações de saúde no comentário.**

Após sucesso: **Obrigado por fazer parte da construção do nosso projeto!** e anunciar o `spokenText` da API uma única vez. Não limpar a tela antes de o usuário perceber a confirmação.

## Rotas e contratos usados

- `/sessions`: consulta existente de `GET /booking/appointments`; a pesquisa só aparece quando há pelo menos um item `COMPLETED` no histórico.
- `POST /feedback`: `{ bookingEase: 1..5, technologySatisfaction: 1..4, serviceRating: 1..5, recommendationScore: 0..10, comment?: string }`. Não enviar IDs nem metadados do usuário/sessão.
- `GET /reports/feedback`: para RH/ADMIN; distribuições, média, comentários, sem metadados por envio. A página de relatórios reutiliza `/hr/reports`, sem criar rota para consulta de dados individuais.

O Zod valida todas as respostas. As opções das questões 1–3 são transmitidas na mesma ordem textual apresentada: Q1 `1=muito fácil` e `5=muito difícil`; Q2 `1=atendeu totalmente` e `4=não atendeu`; Q3 `1=excelente` e `5=péssimo`.

## Estados

| Área | Carregando | Vazio | Erro |
| --- | --- | --- | --- |
| Formulário | Indicar envio e desabilitar apenas a ação de enviar. | Não mostrar sem sessão concluída; se já enviado nesta montagem, mostrar a confirmação. | Associar erro ao formulário, preservar respostas e permitir tentar novamente. |
| Relatório | Anunciar carregamento sem remover o foco. | Mostrar zero respostas, distribuições zeradas e explicar que ainda não há comentários. | Mensagem clara, foco no erro impeditivo e ação de tentar novamente. |

## Critérios de aceite

### TK-16.03 — Formulário em Suas sessões

- **Dado** nenhum atendimento `COMPLETED`, **Quando** abrir Suas sessões, **Então** a pesquisa não aparece.
- **Dado** ao menos um atendimento `COMPLETED`, **Quando** abrir Suas sessões, **Então** vê o convite e pode abrir o questionário sem o identificador da sessão.
- **Dado** o formulário aberto, **Quando** responde às perguntas 1–4, **Então** cada resposta é obrigatória, as alternativas e escalas preservam a ordem do template, e a questão 5 aceita texto opcional até o limite da API.
- **Dado** o envio, **Quando** a API responde com sucesso, **Então** o payload inclui somente as respostas, mostra o agradecimento e anuncia `spokenText`; nenhuma chave de identidade/sessão é enviada.
- **Dado** erro no envio, **Quando** a API recusa ou falha, **Então** mantém respostas, comunica o erro e oferece nova tentativa sem focar o topo da página.
- **Dado** um envio concluído, **Quando** a página é recarregada mais tarde, **Então** a pesquisa pode ser respondida de novo; o sistema não tenta deduplicar nem vincular envios.

### TK-16.04 — Resultados para RH

- **Dado** perfil RH/ADMIN, **Quando** abre os relatórios, **Então** encontra contagem, distribuições, média da recomendação e comentários sem ID, data, unidade, terapeuta, colaborador ou sessão.
- **Dado** zero respostas, **Quando** abre a seção, **Então** vê estado vazio com métricas zeradas e média indisponível.
- **Dado** perfil diferente de RH/ADMIN, **Quando** tenta consultar, **Então** a rota protegida não expõe respostas.
- **Dado** comentário livre, **Quando** o relatório o apresenta, **Então** o conteúdo é tratado como texto, escapado contra HTML e sem metadados de origem.

## Acessibilidade

- Um `h1` por rota; formulário e seção de resultados com títulos `h2`/`h3` em ordem.
- Cada pergunta usa `fieldset` e `legend`; cada resposta é um `radio` com nome completo. Q4 usa grupo de rádios 0–10, não slider.
- Teclado: Tab entre grupos e ações, setas dentro dos grupos de rádio; não depender de arrasto, hover, cor ou gesto.
- Foco visível, ordem do DOM, diálogo/erro sem armadilha; após envio, manter o foco no contexto e anunciar o sucesso uma vez.
- Contraste, alvos de toque, reflow a 320 px/400%, zoom de 200%, temas, `forced-colors` e movimento reduzido conforme `docs/acessibilidade.md`.
- Leitor de tela anuncia instrução de anonimato antes das perguntas e o erro/sucesso sem ler a resposta do comentário duas vezes.

## Segurança e privacidade

- O frontend não lê/escreve localStorage, cookies extras, analytics, IDs ou histórico individual para relacionar respostas.
- Comentário livre é texto simples, limitado e exibido com escape. A orientação pede para não incluir nomes, dados pessoais ou informação de saúde.
- Os resultados não oferecem drill-down ou filtros que reidentifiquem grupos pequenos.

## Perguntas em aberto

- Política de retenção e descarte das respostas antes da produção (RF-34/RN-18).
- O comentário voluntário pode conter autoidentificação; a tela orienta o colaborador, mas não altera o texto.
