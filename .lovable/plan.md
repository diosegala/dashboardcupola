# Ranking e Lista de responsáveis na página Patrocínios

## Verificação dos dados do Pipedrive (feita)

A integração já traz tudo. Não é preciso puxar nada novo:

- **Negócios perdidos:** vêm com status e data da perda, nos funis de patrocínio desta edição.
- **Motivo de perda:** vem preenchido nos perdidos desta edição.
- **Data da última mudança de etapa:** vem na maioria dos negócios abertos. Quando falta, uso a data de criação do negócio e mostro "desde a criação".
- **Valor:** muitos negócios abertos estão sem valor no Pipedrive. Eles vão aparecer como **"valor não informado"**.

## Card "Vendas por responsável" (substitui o atual)

No topo:
- a frase curta de sempre: "Quem fechou, quem está negociando e quem perdeu cada cota, com os dados do Pipedrive.";
- o seletor **Ranking | Lista**, igual às abas da página. Ranking abre por padrão;
- uma linha de filtros comum às duas visões, que se mantém ao trocar de visão: **cota** (Todas, Platina, Prata… vindas do Pipedrive), e na Lista também **status**, **responsável** e **busca por empresa**.

Clicar numa cota em "Por cota" aplica esse filtro de cota. Um novo clique, ou "Todas", limpa o filtro.

### Ranking

- Uma linha por responsável, sem caixas: posição, nome, valor fechado em destaque e, abaixo, "X cotas vendidas · Y em negociação".
- Uma barra fina, proporcional ao líder, mostra o peso de cada um. Ela é verde só pelo que foi fechado. A negociação aparece só como texto cinza.
- O 1º lugar tem destaque discreto: posição em negrito e uma leve faixa de fundo.
- Ordenar por: **Valor fechado** ou **Cotas vendidas** (botões pequenos).
- Clicar no nome abre o painel do responsável.

### Lista

- Tabela com um negócio por linha: Empresa, Cota, Responsável, Status, Valor, Etapa, Data e Motivo de perda.
- O status aparece como selo: Ganho em verde, Em negociação em cinza neutro e Perdido em tom de alerta suave.
- A data depende do status: fechamento para ganho, perda para perdido e última mudança de etapa para negociação.
- Clicar no título de uma coluna ordena por ela; clicar de novo inverte a ordem.
- Clicar no responsável abre o mesmo painel.
- A tabela rola dentro do card e tem altura máxima, para não alongar a página. Em telas pequenas, rola na horizontal.

### Painel do responsável (gaveta lateral)

- Nome e taxa de conversão: ganhos ÷ (ganhos + perdidos), por exemplo "Conversão 42%".
- Três números grandes clicáveis: **Ganhos**, **Em negociação** e **Perdidos**. Ganhos abre selecionado.
- Ganhos: empresa, cota, valor e data de fechamento.
- Em negociação: empresa, cota, valor, etapa e "parado há N dias".
- Perdidos: empresa, cota, valor, data da perda e motivo, ou "sem motivo registrado".
- O painel respeita o filtro de cota ativo e mostra qual é.

## Nomes

- Primeiro nome do responsável no Pipedrive, com a primeira letra maiúscula.
- Exceção pedida: a responsável cujo nome tem "Bello" aparece como **Leticia Bello**. Essa troca fica numa regra de apelido no código de formatação, sem lista de nomes da equipe.
- Se dois responsáveis tiverem o mesmo primeiro nome, junto a inicial do sobrenome (ex.: "Ana P.") para não misturar.

## Consistência

- Ganhos e em negociação usam a mesma conta das barras de cotas: mesmo evento, mesmos funis, mesma edição e mesmos produtos. A soma do ranking bate com as barras, com ou sem filtro de cota.
- Perdidos: negócios dos funis de patrocínio perdidos dentro do período desta edição. A cota vem dos produtos; sem produto do evento, aparecem como "Sem cota".
- Respeita o evento selecionado e o modo de exemplo.
- Barras e textos do card Cotas vendidas não mudam. Só a seleção por clique continua.

## Detalhes técnicos

- `sponsorshipMetrics.ts`:
  - `byOwner` vira `sponsorDeals(...)`, que devolve linhas `{dealId, empresa, cotaKey, cota, owner, status, valor|null, quantidade, data, etapa, diasNaEtapa, motivo}`. Ganhos vêm de `m.vendas` e abertos da mesma regra de hoje. Perdidos usam `lost_at` dentro da edição, por `inEdition`. Valor 0 ou ausente vira `null`.
  - Nova função `ownerRanking(rows, cota, ordem)`.
  - Nova função `displayOwnerName(full, all)` para primeiro nome, apelido Bello e desempate por inicial.
- Testes: as somas de ganhos e negociações por cota batem com `quotaBreakdown`; a conversão é ganhos ÷ (ganhos + perdidos); os nomes saem como Keity, Leticia Bello e "Ana P." no desempate; valor 0 vira null.
- `SponsorOwnersCard.tsx` é reescrito com `CardTabs` (Ranking/Lista), filtros num estado único e uma `Sheet` para o painel.
- `Sponsorship.tsx`: passa as linhas novas e mantém `cotaSel` ligado ao filtro de cota.
