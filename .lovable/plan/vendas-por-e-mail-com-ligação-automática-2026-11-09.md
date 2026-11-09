# Vendas por e-mail com ligação automática

O padrão de UTM continua como está e não há cadastro manual. O painel liga cada venda a um e-mail sozinho e mostra o grau de certeza de cada ligação.

## Etapa 1: dados (antes de qualquer tela)

- **Guardar o utm_content** de cada pedido da Sympla junto com os outros UTMs.
  - Preencher os pedidos antigos com o que já está guardado da Sympla, sem chamar a API de novo.
  - A sincronização da Sympla passa a gravar o campo nos próximos pedidos.
- **Verificar a API do RD.** Vou testar se alguma parte da API devolve o conteúdo de cada e-mail com os links.
  - Se devolver, os links com utm_content viram uma pista a mais, e essas ligações passam a "confiável".
  - Se não devolver, sigo só com nome e horário e conto o resultado para você.

## Etapa 2: regra de ligação (automática)

Para cada utm_content dos pedidos de e-mail, o painel procura o e-mail do RD com três pistas:

1. **Código exato:** o nome do e-mail no RD começa com um código igual ao utm_content (ex.: `sum27-segredo-curadoria`). A ligação é **exata**.
2. **Nome parecido:** compara o utm_content com o nome do e-mail, ignorando maiúsculas, acentos, hífens e palavras pequenas (de, do, o, a, seu…). Isso vale para envios da mesma edição.
3. **Horário:** busca o e-mail enviado mais perto, e antes, da primeira venda com aquele utm_content. A janela é de até 3 dias.

Classificação de cada ligação:


| Situação                                      | Classificação | Selo                                              |
| --------------------------------------------- | ------------- | ------------------------------------------------- |
| Código exato, ou o link do e-mail vindo do RD | Exata         | normal                                            |
| Nome e horário apontam para o mesmo e-mail    | Confiável     | normal                                            |
| Só uma das pistas aponta com segurança        | Provável      | contorno tracejado + "ligação estimada"           |
| Nenhuma pista segura, ou pistas em conflito   | Sem ligação   | sem selo; a venda segue no canal E-mail marketing |


**Confirmar ou corrigir (só administrador):** no selo de uma ligação provável, um clique em "Confirmar" ou em "Trocar e-mail" grava a decisão. Essa decisão prevalece sobre a suposição dali em diante. Não existe tela de cadastro: a ação fica no próprio selo.

## Etapa 3: conferência antes de publicar

Antes de mexer na aba, mostro aqui no chat a lista completa de ligações para você conferir: utm_content, e-mail escolhido, classificação, pistas usadas, vendas e receita.

## Etapa 4: aba de e-mails

- **Selo "N vendas"** ao lado do nome do e-mail, só quando houver venda. Ao passar o mouse, mostra a receita. O e-mail sem venda fica como hoje.
- **Filtro "Só com venda"**, que respeita as datas do painel e o lote selecionado.
- **Os números batem com o canal E-mail marketing** da meta por canal. A venda entra pela mesma regra de atribuição e com os mesmos cancelamentos fora. A soma dos selos mais as vendas "sem ligação" é igual ao canal.
- **Clique no selo:** abre a lista das vendas daquele e-mail, com ingresso comprado e nome do comprador.
- **Clique no comprador:** abre os mesmos dados que a tela Compradores mostra para essa pessoa, nas mesmas colunas e com as mesmas permissões. Quem não pode ver um dado lá também não vê aqui.
- **Aviso no padrão do aviso do CRM:**
  - "O RD Station não informa o link de cada e-mail. Por isso, parte das ligações entre venda e e-mail é estimada pelo nome e pelo horário de envio, e aparece como *ligação estimada*."
  - "Para ter certeza: comece o nome do e-mail no RD com um código curto (ex.: `sum27-segredo-curadoria`) e use o mesmo código no utm_content do link."
  - "Vendas sem identificação no link continuam contando no canal E-mail marketing, mesmo sem selo."
- **Uma legenda curta no "i"** explica que o selo mostra quantos ingressos cada e-mail vendeu e serve para repetir os e-mails que funcionaram nos próximos lotes.

## Detalhes técnicos

- Migração: nova coluna `utm_content` em `ticket_sales` e preenchimento a partir de `ticket_sales_details.order_data->'utm'->>'utm_content'`. A função `sync-sympla` passa a gravar a coluna. Esta é uma mudança de tabela e de função que você está aprovando aqui.
- Nova tabela `email_sale_links` (utm_content, rd_campaign_id, decisão, decided_by, decided_at). Ela guarda só as decisões do admin. Leitura para usuários autenticados; escrita só para admin, protegida por RLS com `has_role`.
- Regra pura em `src/lib/emailAttribution.ts`, com testes para: código exato, nome parecido, só horário (caso "6h-para-garantir"), conflito vira sem ligação, decisão do admin prevalece, e soma igual ao canal E-mail marketing.
- Verificação da API do RD feita pela sincronização existente. Se houver endpoint com o conteúdo do e-mail, adiciono a coleta dos links numa coluna nova de `email_campaigns`, também nesta aprovação.  
  
  
Plano aprovado, com um ajuste para a pista de horário não ser decisiva:
  - o horário nunca liga uma venda a um e-mail sozinho. Ele serve só para reforçar o nome ou desempatar
  - código exato: ligação exata, selo normal
  - nome parecido e horário compatível: confiável, selo normal
  - só nome parecido: provável, selo tracejado com "ligação estimada"
  - só horário, sem nome compatível: não gera selo. Mostre apenas para administradores como sugestão para confirmar. Depois de confirmada, a ligação vira confiável
  - se o mesmo utm_content tiver nome compatível com mais de um e-mail, use o horário para ligar cada venda ao e-mail compatível enviado mais perto, e antes, daquela venda
  Atualize os testes com esses casos e o texto do aviso para dizer que as ligações estimadas usam o nome do e-mail. Pode seguir com a implementação e me mostre a lista de ligações antes de publicar.