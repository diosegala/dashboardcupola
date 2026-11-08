# Deixar as telas mais rápidas

## O que já foi verificado
- O banco está no ar, sem alertas de falta de recursos (memória 68%, conexões baixas, disco 6%).
- Quase todo o tempo do banco vai para as **sincronizações gravando dados**, não para as telas lendo:
  - Gravação de vendas da Sympla: 128.500 chamadas, cerca de 53 minutos de banco somados.
  - Gravação dos detalhes das vendas: cerca de 25 minutos somados (170 ms em média por chamada).
  - RD Station, Analytics, GA4 e anúncios vêm depois. Os anúncios apagam e regravam tudo a cada rodada.
- As telas carregam as vendas em páginas de 1.000, uma depois da outra. Os faturados do CRM fazem uma cadeia de 6 a 10 buscas em sequência (evento → configuração → evento anterior → produtos → itens → negócios), e cada uma espera a anterior.
- O dado fica guardado por 5 minutos, mas cada tela (Comercial, Cupons, Compradores, Marketing) monta sua própria busca e repete parte do trabalho.

Ainda não foi medido quanto cada tela demora de verdade. Esse é o primeiro passo.

## Plano
1. **Medir**: abrir Comercial, Marketing, Cupons e Compradores no navegador de teste, já conectado, e registrar o tempo até aparecer o conteúdo, além de quais buscas atrasam. Isso confirma o diagnóstico antes de mexer.
2. **Telas (sem mexer em regras nem números)**:
   - Rodar ao mesmo tempo as buscas que hoje esperam umas pelas outras, nas vendas e nos faturados do CRM.
   - Fazer as quatro telas reaproveitarem a mesma busca de vendas do evento, sem buscar tudo de novo a cada tela.
   - Pedir só as colunas que cada tela usa, porque os detalhes de formulário são pesados.
   - Mostrar os cards assim que os dados de cada um chegam, sem esperar a página inteira.
3. **Sincronizações** (só com a sua aprovação, porque mexem nas funções de sincronização):
   - Gravar na Sympla apenas as vendas novas ou alteradas, em vez de regravar todas a cada rodada.
   - Rever com que frequência cada sincronização roda.
4. **Medir de novo** e mostrar o antes e depois.

Não está incluído: aumentar o tamanho do servidor. Os números atuais não mostram falta de capacidade.

## Detalhes técnicos
- `useDashboardData.ts`: o loop `fetchAllTimeTickets` e `fetchInvoicedTickets` fazem os `await` em série. Usar `Promise.all` nas páginas, depois de um `count` inicial, e nas buscas independentes do CRM. Compartilhar a mesma `queryKey` entre as páginas.
- Conferir no `EXPLAIN` se as leituras de `ticket_sales` por `event_id` usam índice. Um índice novo só entra com aprovação.
- Upsert da Sympla: filtrar as linhas sem mudança antes de gravar. Isso muda edge function e exige aprovação.
