# EP-16 — Pesquisa de satisfação (BE)

## Objetivo

Receber respostas anônimas sobre o agendamento, a plataforma e o atendimento de massoterapia e permitir que o RH consulte distribuições, médias e comentários sem metadados de identidade ou sessão.

## Decisões do escopo

- A pesquisa entra no MVP (RF-34).
- O frontend a oferece em **Suas sessões** quando o colaborador já tem ao menos uma sessão concluída.
- Nenhuma resposta é associada a colaborador, sessão, terapeuta ou unidade. Envios repetidos são aceitos; não existe deduplicação.
- O formulário envia somente as quatro notas e o comentário opcional. Não enviar `employeeId`, `appointmentId`, IP ou identificador de sessão.
- A consulta do RH retorna apenas agregados e comentários sem ID, data, unidade, terapeuta ou outra metainformação por resposta. Não há filtros por pessoa, sessão ou unidade.

## Fora de escopo

- Impedir resposta duplicada, acompanhar respostas por sessão ou convidar uma pessoa por e-mail/push.
- Relacionar respostas individuais a colaboradores, sessões, terapeutas ou unidades.
- Exportação de dados identificáveis ou auditoria por respondente.
- Avaliação clínica, coleta de sintomas ou uso de comentário como dado de saúde.

## Contrato da API

### `POST /feedback`

Requer papel `EMPLOYEE`, mas a identidade autenticada não é enviada ao service, persistida, auditada nem incluída no log da resposta. O payload não aceita campos adicionais.

```json
{
  "bookingEase": 1,
  "technologySatisfaction": 1,
  "serviceRating": 1,
  "recommendationScore": 0,
  "comment": "opcional"
}
```

- `bookingEase`: inteiro de 1 a 5 — muito fácil, fácil, regular, difícil, muito difícil.
- `technologySatisfaction`: inteiro de 1 a 4 — atendeu totalmente, atendeu em grande parte, atendeu parcialmente, não atendeu.
- `serviceRating`: inteiro de 1 a 5 — excelente, bom, regular, ruim, péssimo.
- `recommendationScore`: inteiro de 0 a 10.
- `comment`: opcional, texto simples, até 1000 caracteres; espaços externos são removidos.
- Retorno `201`: `{ "spokenText": "Obrigado por compartilhar sua experiência." }`.
- Erros: `400` para nota fora da escala, comentário inválido ou campos extras; `401` sem identificação; `403` papel sem acesso.

O backend salva somente as quatro notas, o comentário opcional e um ID técnico aleatório. Não salva `employeeId`, `appointmentId`, `createdAt`, IP, user-agent ou unidade. A rota não emite evento de auditoria. O payload não entra em logs.

### `GET /reports/feedback`

Apenas `HR` e `ADMIN`. Retorna contagem total, distribuição por alternativa das perguntas 1–4, média da recomendação e lista de comentários opcionais. Os comentários são retornados sem ID ou metadado da resposta. O endpoint não oferece filtros de unidade, terapeuta, sessão, respondente ou período.

```json
{
  "totalResponses": 12,
  "bookingEase": [{ "value": 1, "count": 0 }],
  "technologySatisfaction": [{ "value": 1, "count": 0 }],
  "serviceRating": [{ "value": 1, "count": 0 }],
  "recommendation": [{ "value": 0, "count": 0 }],
  "recommendationAverage": 8.4,
  "comments": ["texto enviado opcionalmente"]
}
```

Com zero respostas, `totalResponses` é 0, as distribuições têm todas as alternativas com contagem 0, `recommendationAverage` é `null` e `comments` é `[]`. Respostas e comentários não são agrupados por subpopulações.

## Modelo de dados

Tabela `feedback_responses`: `id`, `booking_ease`, `technology_satisfaction`, `service_rating`, `recommendation_score`, `comment`. Sem chave estrangeira para usuário, sessão, terapeuta ou unidade; sem timestamp de resposta; sem restrição de unicidade que impeça repetição.

## Critérios de aceite

### TK-16.01 — Persistir e receber feedback

- **Dado** um colaborador identificado e notas dentro das escalas, **Quando** envia a pesquisa, **Então** o backend valida e persiste uma resposta sem identidade, sessão, unidade, IP, user-agent ou timestamp e retorna `spokenText` de sucesso.
- **Dado** duas respostas com o mesmo conteúdo, **Quando** são enviadas, **Então** ambas são aceitas sem deduplicação.
- **Dado** um payload inválido, com nota fora da escala ou campos extras, **Quando** chama a rota, **Então** recebe `400`, nenhuma resposta é salva e nenhuma resposta é registrada em log ou auditoria.
- **Dado** usuário sem papel `EMPLOYEE`, **Quando** tenta enviar, **Então** recebe `401` ou `403` e nenhuma resposta é salva.

### TK-16.02 — Consultar resultados agregados

- **Dado** um usuário `HR` ou `ADMIN`, **Quando** consulta o relatório, **Então** recebe contagens por alternativa, média da recomendação e comentários sem qualquer vínculo ou metadado da resposta.
- **Dado** nenhum feedback cadastrado, **Quando** consulta o relatório, **Então** recebe as distribuições zeradas, média `null` e comentários vazios.
- **Dado** usuário sem papel `HR` ou `ADMIN`, **Quando** consulta, **Então** recebe `403`.
- **Dado** a pesquisa receber múltiplas respostas iguais, **Quando** o RH consultar, **Então** todas contam no agregado sem expor uma linha identificável por envio.

## Segurança e privacidade

- Nunca persistir nem registrar a identidade autenticada junto à resposta.
- Não persistir IP ou user-agent, nem gerar evento de auditoria com identificador do respondente.
- Consultar somente agregados e comentários, sem filtros que permitam cruzamento por unidade, terapeuta ou data.
- A tela instrui a não incluir nomes, dados pessoais ou informações de saúde no comentário. Não usar conteúdo do comentário em fala, notificação, e-mail ou log.
- Aplicar validação de payload com lista fechada de campos, limite de tamanho e saída escapada no frontend.

## Perguntas em aberto

- Política de retenção e descarte das respostas antes de produção.
- O comentário livre pode permitir autoidentificação pelo conteúdo; o formulário alerta para não inserir dados pessoais, mas não tenta reescrever nem deduzir a identidade.
