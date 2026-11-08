# Cupons: nome de quem concedeu em vez do código

## O que muda para quem usa
- Na lista "Cupons em uso", no gráfico e na busca, cada cupom da equipe aparece pelo **primeiro nome** de quem o concedeu, só com a inicial maiúscula: KARINY5 vira **Kariny**, SUELLEN5 vira **Suellen**.
- Quando o código tem letras além do nome, elas entram também: ALINEB5 vira **Aline B**, ALINEP5 vira **Aline P**, LETICIAA5 vira **Letícia A**, GUILHERMED5 vira **Guilherme D**, MATHEUSH5 vira **Matheus H**, THAISP5 vira **Thais P**, ALINEPAVEZI5 vira **Aline Pavezi**. A Bello continua como **Leticia B**, como você pediu antes.
- Acentos seguem a planilha (Letícia, Kássia, Taís, Elaíny).
- Ao passar o mouse sobre o nome, aparece o cupom oficial usado (ex.: "KARINY5"; para a Leticia B, "LETICIAC5 + LETICIA10 + LETICIA15"). A linha cinza com os códigos embaixo do nome sai.
- Cupom que não está na planilha (ex.: CREDSUM26_PEPE, SECOVIPR5, GANHADOR...) continua aparecendo com o código completo.
- Os 56 colaboradores da planilha ficam no grupo Equipe CUPOLA, inclusive a Erica, cujo cupom ERICA não tem o número 5 e hoje cai em Parceiros e outros.

## Como os nomes ficam cadastrados
- Os 56 colaboradores entram na seção Configurações › Cupons e vendedores, um por pessoa, com o nome já padronizado, o cupom e o nome completo para ligar as vendas faturadas do Pipedrive. Depois, qualquer admin pode editar ou incluir pessoas por lá.
- A Leticia B mantém os 3 cupons e continua fora do ranking.

## Detalhes técnicos
- Inserção de dados (sem mudar estrutura) em `coupon_people`: `name` = nome de exibição, `codes` = [cupom], `seller_names` = [nome completo], `outside_ranking` = false; pula o LETICIAC5 já cadastrado.
- `parseCoupon`: pessoa cadastrada passa a ficar no grupo `equipe` (quando o código não é de resgate/palestrante/faturado), sem depender do formato NOME5.
- `Coupons.tsx`: a célula mostra `couponLabel`, com Tooltip mostrando `couponCodes`; o mesmo vale para a legenda do gráfico, quando for possível.
- O ranking continua mostrando o primeiro nome (`teamMemberName`); com nomes como "Aline B" ele passa a usar o nome cadastrado inteiro, para não juntar duas Alines.
- Atualizar `outsideTeam.test.ts` com KARINY5 → Kariny, ALINEB5 → Aline B, código não mapeado → código completo.
