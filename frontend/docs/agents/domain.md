# Domain docs

O domínio de negócio é um só e fica no `backend/`. O frontend tem o próprio `CONTEXT.md` para decisões de interface, acessibilidade e segurança. Caminhos relativos a `frontend/`.

## Antes de explorar, leia

- `CONTEXT.md`: para quem é a tela, decisões do frontend, segurança, estado atual.
- `docs/acessibilidade.md`: padrão obrigatório de acessibilidade visual.
- `../backend/CONTEXT.md`: domínio, problema, regras de negócio.
- `../backend/docs/requisitos.md`: o contrato (RF, RN, RNF). Se divergir do `CONTEXT.md` ou do `AGENTS.md`, o `requisitos.md` vence; aponte a divergência em vez de escolher. O RN-04 (acessibilidade, requisito fulcral) aponta para o `docs/acessibilidade.md`.
- `docs/adr/`: ADRs do frontend que tocam a área em que vai trabalhar.

Se algum não existir, siga em silêncio: não aponte a ausência nem sugira criar. A skill `/domain-modeling` cria esses arquivos quando um termo ou decisão é de fato resolvido.

## Estrutura

```
frontend/
├── AGENTS.md          ← como trabalhar + glossário PT→EN
├── CLAUDE.md          ← aponta para o AGENTS.md
├── CONTEXT.md
├── docs/
│   ├── acessibilidade.md
│   ├── roadmap.md
│   ├── agents/
│   ├── specs/
│   ├── tickets/
│   └── adr/
│       └── 0001-<decisao>.md
└── src/
```

## Use o vocabulário do glossário

Docs em português, código em inglês. O glossário fica no `AGENTS.md` e segue o do `backend/AGENTS.md`. Ao nomear um conceito (tipo, componente, título de ticket, nome de teste), use o termo do glossário (`Appointment`, não `Booking`). Conceito fora do glossário é sinal: ou é linguagem inventada (reconsidere) ou é uma lacuna real (anote para `/domain-modeling`).

## Sinalize conflitos com ADRs

Se a saída contradiz um ADR, diga explicitamente em vez de sobrescrever:

> _Contradiz o ADR-0003 (…), mas vale reabrir porque…_
