# Faturamento mês a mês: ingressos, patrocínios e total

## O que encontrei no Pipedrive (funil de patrocínio)
- 211 negócios ganhos no funil de patrocínio. Todos têm data de fechamento, e 203 têm valor (8 sem valor, que entram com o aviso "valor não informado").
- Na edição 2027 os ganhos são poucos até agora (os mesmos que aparecem em Cotas vendidas).
- **Parcelamento:** não há nenhuma parcela registrada nos negócios de patrocínio. As parcelas que existem são só do funil de ingressos. Por isso a "receita prevista por mês de pagamento" não aparece agora. A visão fica pronta para mostrá-la quando houver parcelas, e até lá exibe a nota "Sem datas de pagamento no Pipedrive".
- **Ano anterior:** o evento 2026 não tem configuração de patrocínio (funil, janela e cotas). Sem ela não dá para separar os patrocínios de 2026, então a linha do ano anterior em Patrocínios aparece só depois que 2026 for configurado em Configurações › Patrocínio. Até lá, o card avisa que a comparação não está disponível.
- **Meta mensal de receita:** hoje a aba Metas só tem meta de receita para o evento inteiro, não por mês. A visão de ingressos mostra "realizado x meta" por mês só se existir uma meta de receita cadastrada para um mês. Não vou criar um tipo novo de meta sem você pedir.

## 1. Comercial › novo card "Faturamento de ingressos por mês"
- Barras empilhadas por mês, do início das vendas até o mês do evento: Sympla e Faturados internos.
- Linha da receita acumulada, linha tracejada e discreta do ano anterior (mesmo mês da campanha) e o número de ingressos acima de cada barra.
- O mês atual aparece com o selo "parcial" e a barra mais clara.
- Tabela compacta abaixo: mês, ingressos, Sympla, faturados, total, acumulado, x ano anterior e, quando houver, meta e %.
- Regras: Sympla pela data da compra e faturados pela data em que o negócio foi ganho, sem cancelados, iguais ao "Ingressos por dia". O evento do topo e o filtro de valor mínimo são respeitados.
- Fica perto de "Receita acumulada x meta", ocupando a linha inteira, sem deixar espaço vazio.

## 2. Patrocínios › novo card "Faturamento de patrocínios por mês"
- Barras por mês de fechamento, empilhadas por tipo de cota, com a linha da receita acumulada.
- Contagem de cotas por mês. Ao passar o mouse, aparece a quebra por tipo de cota e quantas estão sem valor informado.
- Abertos e perdidos ficam fora. O mês atual aparece como parcial.
- Os totais vêm da mesma lista de vendas usada em Cotas vendidas e no ranking de responsáveis, então os números batem.
- Os blocos de pagamento previsto e de ano anterior aparecem quando os dados existirem, como explicado acima.

## 3. Comercial › card "Receita acumulada" ampliado
- Seletor Ingressos / Patrocínios / Total, com Total aberto por padrão.
- O card mostra o valor acumulado e uma mini evolução mês a mês. No Total, cada mês aparece dividido entre ingressos e patrocínios.
- A comparação com o ano anterior continua como hoje. O mês atual aparece como parcial.
- As informações de meta, restante e ticket médio continuam valendo para ingressos.
- As legendas ("i") explicam em linguagem simples o que cada opção mostra.

## Detalhes técnicos
- Nova função pura `src/lib/monthlyRevenue.ts` que agrupa por mês em horário de Brasília (vendas de ingressos e vendas de patrocínio). Ela marca o mês parcial e calcula o acumulado, e é reaproveitada pelos três cards.
- A parte de ingressos reaproveita as vendas e faturados já carregados no Comercial (mesma origem do "Ingressos por dia" e da "Receita acumulada").
- A parte de patrocínios reaproveita o mesmo cálculo de vendas da página Patrocínios, exposto num hook compartilhado para ser usado também no Comercial.
- Testes: agrupamento mensal, exclusão de cancelados e totais iguais à soma dos meses.
- Não muda tabelas nem sincronização, e não traz lápis de edição nos cards.
