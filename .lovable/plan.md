# Resumo por responsável na página Patrocínios

## Verificação dos dados do Pipedrive (feita)

A integração já traz tudo o que o resumo precisa, sem puxar nada novo:

- **Responsável (proprietário):** vem preenchido em todos os negócios.
- **Status:** ganho, aberto ou perdido em todos os negócios. Os excluídos ficam de fora.
- **Etapa do funil:** vem preenchida em todos os negócios abertos.
- **Empresa:** vem em quase todos. Quando falta, o painel já usa o título do negócio, como faz nas barras.
- **Cota e valor:** vêm dos produtos de cada negócio, os mesmos que as barras já usam.
- **Data do fechamento:** vem em todos os negócios ganhos. Para os abertos existe a data da última atualização e a da última troca de etapa.

## O que será criado

Um card novo, **"Por responsável"**, ao lado do card Cotas vendidas. O card **Ritmo**, que hoje fica nesse lugar, desce para a linha de baixo, sem outras mudanças. Em telas menores, o resumo aparece abaixo das cotas.

Cada responsável vem do Pipedrive e aparece num bloco próprio, ordenado pelo valor fechado:

- **Totais:** quantidade e valor fechado; quantidade e valor em negociação.
- **Fechamentos:** empresa, cota, valor e data do fechamento.
- **Em negociação:** empresa, cota, valor e etapa atual no Pipedrive.

Cores: os fechamentos usam o verde de venda, como nas barras. As negociações usam o cinza neutro do painel, nunca verde claro.

Texto curto e sempre visível no topo do card, no padrão das legendas do painel:
"Quem fechou e quem está negociando cada cota, com os dados do Pipedrive. Negócios perdidos não aparecem."
O "i" do card explica que os números são os mesmos das barras de cotas.

## Clique em uma cota

Clicar numa linha de cota (Platina, Prata etc.) na aba "Por cota" seleciona essa cota:

- a linha clicada ganha um contorno discreto de seleção. A barra e os números continuam iguais;
- o resumo destaca os responsáveis que fecharam ou negociam aquela cota e mostra os outros apagados;
- dentro de cada responsável, aparecem só os negócios daquela cota;
- um botão "Ver todas" no resumo, ou um novo clique na mesma cota, desfaz a seleção.

## Regras de consistência

- O resumo usa exatamente a mesma conta das barras: mesmo evento, mesmos funis, mesmo período da edição e mesmos produtos do evento. Os fechamentos de todos os responsáveis somam as cotas vendidas. As negociações somam a contagem "X em negociação" de cada cota.
- Negócios perdidos e excluídos ficam de fora.
- Respeita o evento selecionado no topo e o modo de exemplo da página, quando não há dados.
- Responsável sem nome no Pipedrive aparece como "Sem responsável".

## Sem mudanças

Barras das cotas, contagem de negociações, textos e números dos outros cards continuam como estão.

## Detalhes técnicos

- `src/lib/sponsorshipMetrics.ts`: nova função pura `byOwner(...)` que reaproveita o mesmo filtro de `computeSponsorship`. Ela devolve, por responsável, fechamentos (de `vendas`, que já tem `closer`) e linhas abertas por produto (empresa, cota/key, valor, quantidade, `stage_name`). `computeSponsorship` não muda.
- A consulta de `deals` da página passa a trazer também `stage_name`, se ainda não trouxer.
- Novo `src/components/sponsorship/SponsorOwnersCard.tsx` com `selectedQuota` e `onClear`.
- `SponsorQuotasCard`: novas props opcionais `selectedKey` e `onSelect`. As linhas da aba "Por cota" ficam clicáveis (botão acessível), sem mudar o visual da barra.
- `Sponsorship.tsx`: guarda o estado da cota selecionada. Layout: Cotas `lg:col-span-5`, Responsáveis `lg:col-span-7`, Ritmo em seguida.
- Testes em `sponsorshipMetrics.test.ts`: a soma dos fechamentos por responsável é igual às vendidas por cota; a soma das negociações é igual a `abertasPorCota`; negócios perdidos ficam de fora.
