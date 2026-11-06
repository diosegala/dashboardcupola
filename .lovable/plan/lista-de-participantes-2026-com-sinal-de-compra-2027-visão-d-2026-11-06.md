# Lista de participantes 2026 com sinal de compra 2027 (visão da equipe)

## O que a equipe verá

Na página Compradores (visão da equipe), uma nova aba/lista **"Participantes 2026"**: não quero 2 abas, quero uma aba unica que vai relacionar clientes que participara de 2026 e já compraram ou não o de 2027.  pode ajustar o texto para deixar isso claro


| Nome                | Empresa         | Comprou 2027     | Cupom 2027 |
| ------------------- | --------------- | ---------------- | ---------- |
| Ana Luiza Puhl      | Galvão Locações | Sim (selo verde) | KARINY5    |
| Bruno Antoneli Hans | Terramar        | Ainda não        | —          |


- Apenas nome, empresa e cupom usado em 2027 e 2026, pode ser no mesmo campo. Sem e-mail, telefone, CPF ou outros dados.
- Filtros rápidos: Todos · Já compraram 2027 · Ainda não compraram.
- Busca por nome ou empresa.
- A lista atual "Participantes deste evento" continua como está, numa aba ao lado.

## Como o "Comprou 2027" é marcado (automático)

Uma pessoa de 2026 fica marcada quando aparece em 2027:

1. Mesmo **nome da pessoa** em um ingresso 2027 da Sympla, ou
2. Mesma **empresa** em um ingresso 2027 da Sympla, ou
3. Mesmo nome de pessoa ou empresa em uma **venda interna (faturada)** ganha no Pipedrive.

A comparação ignora acentos, maiúsculas e espaços extras. O cupom mostrado é o usado na compra 2027 encontrada (para faturados, o cupom da vendedora, ex.: SUELLEN5). Como depende das novas vendas sincronizadas, a marcação atualiza sozinha a cada sincronização. faturados como não tem cupom, cupom fica sem nada

Observação: casar por empresa marca todos os participantes 2026 daquela empresa, mesmo que outra pessoa dela tenha comprado. O selo indicará "pela empresa" nesses casos.  
  
correção: vamos só marcar quando o nome do comprador ou participante ou 90%, ou seja, se o nome da pessoa for o mesmo, masrca q ja comrppu 2027. nao vamos considerar a empresa pq varias pessoas da mesma podem comprar

## Padronização de nomes

Nomes de pessoas e empresas passam a aparecer sempre com a primeira letra de cada palavra maiúscula ("QUATRO VENTOS ADM" → "Quatro Ventos Adm"), mantendo minúsculas em "de, da, do, dos, das, e". Aplicado em toda a página Compradores (equipe e admin). Os dados originais não são alterados.

## Detalhes técnicos

- `src/lib/buyers.ts`: nova função `titleCase` usada na exibição de nome/empresa; nova função pura `match2027(people2026, compradores2027, faturados)` retornando `{ comprou, via: "pessoa"|"empresa", cupom }`.
- Dados 2026 e 2027 via a função existente `get_buyer_rows` (já permite à equipe ler eventos anteriores ao selecionado e já não entrega contatos). Faturados via `deals` ganhos (a equipe já tem leitura) usando `org_name`/`person_name` e `couponForSeller`.
- Novo componente `src/components/buyers/Returning2026List.tsx`; `SellerBuyerList.tsx` ganha abas.
- Testes em `src/lib/buyers.test.ts`: casar por pessoa, por empresa, por faturado, sem acento/maiúsculas, e `titleCase`.
- Sem mudanças no banco.