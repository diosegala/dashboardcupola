# Desconto médio por lote: diagnóstico e recomendação

## Parte 1. Diagnóstico

**a) De onde vem o valor cheio hoje.** O quadro "Descontos concedidos" não usa um preço cheio cadastrado. Ele lê o percentual escrito no nome do cupom (ex.: ALINE10 = 10%) e faz a conta de trás para frente sobre o valor pago: pago ÷ (1 − 10%) − pago. Cupom em valor fixo usa o valor fixo. Já existe uma função de "preço cheio do lote", que pega o preço mais comum das vendas sem cupom de cada produto. Mas ela é usada só para dar valor às cortesias, não para o desconto.

**b) Produtos de grupo da Sympla ("10% OFF a partir de 3 - Padrão").** Não entram. O cálculo só olha cupons aplicados. Os produtos de grupo têm preço próprio e sem cupom. Por isso o desconto deles fica invisível hoje. No Lote 1, por exemplo, o "10% OFF a partir de 3 - Padrão" sai a R$ 935 e o "Ingresso padrão" sai a R$ 1.099. Também ficam de fora os cupons de 100%, de propósito, porque podem ser resgates de faturados.

**c) Faturados do Pipedrive.** Entram só se o comercial preencher o desconto na linha do produto no negócio do Pipedrive. Como os 7 negócios estão sem esse campo, o desconto deles conta zero. O painel não compara o valor do faturado com nenhum preço de tabela.

**d) Dá para calcular por lote?** Sim. Toda venda da Sympla tem o lote no nome do produto, e os faturados recebem lote pela data. O que falta é uma referência confiável de preço cheio para cada tipo de ingresso em cada lote.

## Parte 3. Recomendação: caminho misto

- **Sympla, automático (Caminho B):** o valor cheio de cada venda é o preço do produto base do mesmo lote e do mesmo tipo. Para Padrão, o "Ingresso padrão". Para VIP, o "Ingresso VIP". Para Combo, o combo base. Esse preço vem do valor mais comum das vendas sem cupom daquele produto, com o mesmo cálculo que já usamos para as cortesias. Assim o desconto de grupo entra sozinho, porque o "10% OFF" é comparado com o "Ingresso padrão" do lote.
- **Faturados, pelo mesmo preço de referência:** o valor cheio é o preço do produto base do lote vigente na data do negócio, multiplicado pela quantidade. O desconto é a diferença para o valor fechado. Assim não dependemos de o comercial preencher o campo no Pipedrive.
- **Configurações, só quando necessário (Caminho A como reserva):** se um lote ou tipo não tiver nenhuma venda sem cupom para servir de referência, o card avisa "sem preço de referência". Nesse caso, um admin poderá informar o valor cheio. Esse campo extra só entra se você aprovar, porque muda o banco.

O cadastro manual puro não funciona bem: cada lote tem de 5 a 10 produtos, e você teria que manter todos à mão. O automático puro falha nos lotes em que todo mundo usou cupom.

## Parte 2. O quadro (depois da sua aprovação)

- Novo card **"Desconto médio"**, colocado logo depois do quadro de canal.
- No topo, o percentual acumulado do evento. Abaixo, uma linha por lote com o percentual, a quantidade de ingressos e o valor de desconto. Os faturados aparecem marcados.
- **Média ponderada pelo valor:** desconto total ÷ valor cheio total. Seguindo o seu exemplo (50%, 0% e 20% em ingressos de mesmo preço), a média dá 23%. A média simples por ingresso aparece no "i".
- Ficam fora: cortesias, cupons de 100% e visitas avulsas. O card segue o filtro de período.
- O cálculo fica isolado e testado, com casos tirados das vendas reais.

## Fora do escopo
Cadastro de lotes, atribuição de lote, regra de dias úteis, quadro de visitas e separação entre pagantes e cortesias. O quadro atual de "Descontos concedidos" não muda, a menos que você peça.

## Decisões para você
1. Confirmar o caminho misto.
2. Média ponderada pelo valor (recomendado) ou média simples por ingresso.
3. Cupons de 100% fora do cálculo, como hoje?
