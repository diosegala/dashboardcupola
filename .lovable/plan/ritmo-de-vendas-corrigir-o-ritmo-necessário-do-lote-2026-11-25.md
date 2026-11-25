# Ritmo de vendas: corrigir o "Ritmo necessário" do lote

## O que encontrei
- **Evento todo: a conta está certa.** A meta é de 2.000 pagantes e já foram vendidos 238. Faltam 1.762 para cerca de 118 dias úteis até o evento, o que dá 15 por dia útil. O ritmo atual é de 1,8 por dia (238 pagantes em 130 dias úteis). A diferença é real: o ritmo está bem abaixo do necessário.
- **Lote 1: aqui há um erro.** O card mistura duas formas de contar as vendas do lote:
  - O **ritmo atual** (6 por dia) conta as vendas pela data, dentro das datas do lote (09/11 a 25/11). Faturados entram. São 75 pagantes.
  - O **"faltam"** usado no ritmo necessário conta só os produtos com "Lote 1" no nome. Os faturados do Pipedrive não têm lote no nome e ficam de fora (GT Building 10, Terramar 10 e outros). Por isso ele conta só 44 e diz que faltam 121 para a meta de 165.
- O Lote 1 termina hoje (25/11). Por isso o necessário divide tudo o que falta por 1 dia útil.

## O que muda
1. O ritmo necessário do lote passa a usar os mesmos pagantes do ritmo atual, contados pelas datas do lote e com os faturados. A conta fica assim: meta do lote (165) − pagantes do lote pela data (75) = **90 faltam**, divididos pelos dias úteis que restam no lote.
2. O velocímetro e a pílula de alerta passam a usar esse número corrigido.
3. A linha de apoio mostra a conta inteira ("165 de meta − 75 vendidos = 90 faltam ÷ 1 dia útil restante"), para ninguém ter que adivinhar de onde vem o número.
4. No último dia do lote, uma nota curta avisa que o lote termina hoje e que o necessário vale só para esse dia.

## O que não muda
O cálculo do Evento todo, a regra de dias úteis, o cadastro de lotes, a atribuição de lote das vendas nos outros cards e o banco.

## Detalhes técnicos
- Em `PaceGauge.tsx`, troco `ritmoNecessario(metaLote, l?.pagantes ?? r.pagantes, …)` por `ritmoNecessario(metaLote, r.pagantes, r.diasRestantes)`. A meta continua vindo de `resumoLotes`.
- Adiciono um teste em `batchPace.test.ts`: um faturado dentro das datas do lote reduz o "faltam" do lote.
- Confiro na prévia o Lote 1 (90 faltam) e o Evento todo (15 por dia útil, sem mudança).
