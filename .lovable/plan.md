# Vendas por e-mail: o que falta para ligar a venda ao e-mail

## Resultado da verificação

| Pergunta | Resposta |
|---|---|
| RD Station traz links ou UTMs de cada e-mail? | **Não.** A sincronização só traz números de desempenho: nome, ID da campanha, data, enviados, entregues, aberturas, cliques e bounce. Nada sobre os links. |
| Sympla traz os UTMs de cada pedido? | **Sim.** Traz utm_source, utm_medium e utm_campaign. Também traz **utm_content** e utm_term, que chegam da Sympla mas hoje ficam guardados sem uso. |
| Existe um campo em comum? | **Não existe um código em comum.** Todos os e-mails usam a mesma campanha `cupola_summit`. O que muda entre eles é só o **utm_content**, um apelido livre como `segredo-curadoria`, `ingresso-pendente` ou `vendas-abertas`. O RD não traz esse apelido, então hoje a ligação teria que ser por semelhança com o nome do e-mail. |

Dados de hoje: 13 pedidos vieram de e-mail desde outubro. Dos pedidos de e-mail no histórico, cerca de 1 em cada 5 não tem utm_content, e esses nunca poderão ser ligados a um e-mail.

## Por isso, não construo o selo ainda

Ligar por semelhança de nome é frágil. "segredo-curadoria" com "Segredos da curadoria do CUPOLA Summit (ass. Kariny)" até funciona, mas "6h-para-garantir" não bate com nenhum nome de e-mail. Isso daria selos errados ou faltando.

## O que precisa ser feito

### 1. Padrão de UTM nos links dos e-mails, a partir de agora (time de marketing)

```text
utm_source=rd-station
utm_medium=email
utm_campaign=cupola_summit_2027
utm_content=<ID da campanha no RD>
```

O ID da campanha é o número que aparece no RD Station. Por exemplo, 20466375 é "Segredos da curadoria". Com o ID no utm_content, a ligação fica exata e automática.

Alternativa, se o ID for difícil de colocar no link: manter o apelido no utm_content e cadastrar no painel qual apelido corresponde a cada e-mail.

### 2. Ajustes no painel (eu faço, quando aprovar)

- Passar a guardar o **utm_content** de cada pedido da Sympla junto com os outros UTMs. Os dados já existem e podem ser preenchidos também para os pedidos antigos, sem chamar a API de novo.
- Criar em **Configurações** uma tela simples de "Apelidos de e-mail": apelido do link → e-mail do RD. Ela serve para os envios antigos e para quem não usar o ID.
- Depois disso, construir o selo "N vendas" no nome do e-mail, como você descreveu: receita ao passar o mouse, filtro "só com venda", filtros globais e lote, e a mesma conta do canal E-mail marketing.

### 3. Envios antigos

- **Dá para recuperar a maior parte**: os pedidos com utm_content já guardado podem ser ligados pelo cadastro de apelidos. Posso trazer uma primeira sugestão automática de correspondência para você só confirmar.
- **Não dá para recuperar** os pedidos de e-mail sem utm_content (cerca de 20%). Eles continuam contando no canal E-mail marketing, mas sem e-mail específico.

### Sobre a API do RD

A API de análise de e-mails do RD, que é a usada hoje, não traz os links. Não confirmei se outra parte da API do RD devolve o conteúdo de cada e-mail com os links. Mesmo que devolva, o padrão de UTM do item 1 continua sendo o caminho mais confiável.

## Decisão que preciso de você

Aprovar este plano significa: eu faço o item 2, ou seja, guardar o utm_content, criar o cadastro de apelidos com sugestão automática e construir o selo. Enquanto isso, o marketing passa a usar o padrão do item 1.
