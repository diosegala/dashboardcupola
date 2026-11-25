# Desconto médio por lote, etapa 1: preços oficiais no cadastro de lotes

## Conferência das datas
As 9 datas da sua tabela são **iguais** às do cadastro do Summit 27, do Lote 0 (03/11/2026 a 08/11/2026) ao Lote 8 (07/05/2027 a 21/05/2027). Não encontrei nenhuma divergência.

## Faixas de grupo na Sympla (ponto em aberto)
Só existem vendas de grupo no Lote 0 e no Lote 1:
- **Lote 0:** "10% OFF - 2 a 5 - Padrão" (17 vendas), "10% OFF - 2 a 5 Ingressos Padrão" (22) e "15% OFF - 6 a 10 Ingressos Padrão" (8). Os dois primeiros parecem a mesma faixa com nomes diferentes. O terceiro é uma segunda faixa, com 15%.
- **Lote 1:** "10% OFF - a partir de 3 - Padrão" (21) e "10% OFF - a partir de 3 - VIP" (4). É uma faixa só.
- **Lote 2 em diante:** ainda não há vendas de grupo. Por isso não consigo ver quais faixas estão cadastradas na Sympla para esses lotes.

Sugestão: manter um campo de grupo por tipo. O valor cheio do desconto já vem do Valor padrão ou do Valor VIP, então a faixa de 15% aparece como desconto maior sozinha.

## Ponto de atenção antes da carga
O valor que a Sympla envia por venda parece estar **sem a taxa**. No Lote 0, o "10% OFF 2 a 5" chega a R$ 833,93, e a sua tabela diz R$ 890. Isso dá cerca de 6,7% de diferença. Se for isso, comparar a tabela (com taxa) com o valor da venda (sem taxa) criaria um desconto falso em todas as vendas. Na etapa 2, antes de montar o quadro, vou confirmar o cálculo com vendas reais sem cupom e propor como igualar as bases. Isso não muda esta etapa.

## O que construo agora
1. Sete campos de preço em cada lote, com valores em reais, todos opcionais: Padrão, VIP, Visita, Padrão + visita, VIP + visita, Grupo padrão (a partir de 3) e Grupo VIP (a partir de 3).
2. Na tela **Configurações › Lotes**, os campos ficam editáveis ao lado das datas, salvos do mesmo jeito. Só admin pode editar.
3. **Carga inicial** dos 9 lotes do Summit 27 com os valores da sua tabela.
4. **Preço da pré-venda:** R$ 949 para "Pré-Venda 2027 | Ingresso Padrão", guardado como um ajuste do evento, fora dos lotes.
5. Regra de equivalência entre produto e campo, que fica isolada e testada. Inclui os nomes duplicados por renomeação, como "Padrão + Visita" e "Combo Padrão", e as duas escritas do "10% OFF 2 a 5". Um produto que não se encaixa fica fora do desconto e aparece no aviso de produto sem classificação. A regra nunca tenta adivinhar pelo nome parecido.

## Confirmação sobre os cupons de 100%
Hoje eles já entram como **cortesia** no quadro de ingressos emitidos e no de cortesias, e continuam aparecendo lá. Na etapa 2 eu confiro isso na tela, com números.

## Etapa 2 (só depois da sua aprovação desta etapa)
Quadro **Desconto médio** colocado depois do quadro de canal, com três médias ponderadas pelo valor: total (em destaque), Sympla e faturado. Tem a quebra por lote e a média simples no "i".

## Fora do escopo
Datas e atribuição de lote, regra de dias úteis, quadro de visitas e separação entre pagantes e cortesias.

## Técnico
- Migração: colunas numéricas que podem ficar vazias em `event_batches` (`price_standard`, `price_vip`, `price_visit`, `price_standard_visit`, `price_vip_visit`, `price_group_standard`, `price_group_vip`) e `presale_price` em `events`. A auditoria por linha já cobre a tabela. A carga inicial é feita por UPDATE.
- `src/lib/lotPricing.ts` (puro, com testes): `tipoDePreco(nomeProduto)` e `valorCheio(venda, lotes)`.
- Edição em `Settings` › Lotes, usando o mesmo componente de salvar das datas.
