# Lote vigente automático pelas datas da configuração de lotes

## Onde estava o problema
Hoje não existe uma configuração com as datas dos lotes. O painel adivinha os lotes pelas vendas:
- O **lote vigente** é o lote da venda paga mais recente. A última venda é de 08/11 e foi do Lote 0, por isso ele continua aparecendo como vigente.
- **Cada lote começa** no dia da primeira venda com o nome dele na Sympla. O Lote 1 ainda não tem nenhuma venda, por isso ele não aparece em lugar nenhum.
- O **Ritmo de vendas** não olha lote nenhum: ele usa sempre a meta do evento todo.

## O que muda para quem usa
**1. Nova seção "Lotes" em Configurações (só admins), por evento.**
- Uma linha por lote: nome, data de início e data de término. As duas datas contam como dentro do período.
- Dá para adicionar, editar e excluir lotes.
- Já entra preenchida com as datas que você passou: do Lote 0 (03/11/2026 a 08/11/2026) ao Lote 8 (07/05/2027 a 21/05/2027).
- O painel avisa quando um lote se sobrepõe a outro ou termina antes de começar.

**2. Regra do lote vigente, usada em todo o painel.** O horário é sempre o de Brasília.
- O lote vigente é aquele em que a data de hoje está entre o início e o término. A troca acontece à meia-noite do dia de início do novo lote.
- Se hoje não cair em nenhum lote, vale o próximo lote a começar.
- Um lote esgotado antes da data de término continua vigente até o fim do período, com o selo "Esgotado".
- Se algum lote estiver sem data de início ou de término, o painel não escolhe um lote por conta própria. O administrador vê o aviso "Faltam datas na configuração de lotes", com um link para Configurações. A equipe vê só "Lote vigente não definido".

**3. Situação de cada lote no card "Lote vigente" (aba "Por lote").**
- **Encerrado:** mostra o resultado final de vendidos, meta, saldo e receita.
- **Vigente:** fica destacado.
- **Esgotado:** aparece como selo junto com Vigente ou Encerrado.
- **Não iniciado:** os lotes futuros aparecem mesmo sem vendas, com as datas e a meta quando houver.

**4. Os três pontos mostram sempre o mesmo lote.**
- **Card "Lote vigente":** passa a mostrar o lote certo, hoje o Lote 1.
- **"Vendas por canal":** o seletor de lote abre no lote vigente e lista todos os lotes cadastrados, mesmo os sem vendas.
- **"Ritmo de vendas":** mantém o ritmo do evento e ganha uma linha do lote vigente: nome do lote, dias que faltam até o término e quanto falta vender por dia para bater a meta do lote, quando ela existir.

**5. Vendas por lote seguem as datas cadastradas.**
- Faturados internos e vendas com nome de lote diferente entram no lote cujo período contém a data da venda, no horário de Brasília.
- A Pré-venda continua separada, como hoje.
- Antes do primeiro lote cadastrado, tudo cai no Lote 0, como hoje.

## Detalhes técnicos
- **Migration:** nova tabela `public.event_batches`, com:
  - colunas: `id`, `event_id`, `name`, `start_date date`, `end_date date`, `sort_order`, `created_at`
  - unique `(event_id, name)`
  - GRANT de SELECT para `authenticated` e de ALL para `service_role`
  - RLS: leitura por `can_see_event(event_id)` e escrita só por admin
  - validação de `end_date >= start_date` por trigger, não por CHECK
  - as datas podem ficar vazias, para o aviso de "datas faltando" funcionar
- **Dados:** os 9 lotes entram via insert no evento CUPOLA Summit 2027.
- **`src/lib/batchCalendar.ts`** (novo, funções puras):
  - `hojeBrasilia()`: data atual em `America/Sao_Paulo`, no formato YYYY-MM-DD
  - `loteVigente(lotes, hoje)`: devolve `{ lote } | { faltamDatas: true }`
  - `situacao(lote, hoje)`: devolve `encerrado`, `vigente` ou `nao_iniciado`
  - `loteNaData(dataVenda, lotes)`: converte o horário da venda para Brasília antes de comparar
- **Hook `useEventBatches`:** feito com React Query sobre a tabela e carregado uma vez por evento.
- **Telas que passam a usar essa regra no lugar da antiga:**
  - `resumoLotes` (batchSummary.ts): aceita a lista de lotes cadastrados e substitui a regra "venda mais recente"; lotes sem vendas também entram
  - `withBatchByDate` em `useDashboardData.ts`: passa a usar as datas cadastradas no lugar de `batchStarts`
  - `CurrentBatchCard`, `ChannelGoalsCard` e `PaceGauge` (via `CommercialOverview`)
  - a lista de lotes do formulário de metas
- **Configurações:** novo `BatchesManager.tsx` em Configurações, com tabela, formulário e confirmação de exclusão.
- **Testes em `src/lib/batchCalendar.test.ts`:**
  - 09/11/2026 00:00 em Brasília → Lote 1
  - 08/11/2026 23:59 em Brasília → Lote 0
  - data entre lotes → próximo lote
  - lote esgotado continua vigente até o término
  - lote sem data → aviso de datas faltando
  - lote futuro → não iniciado
  - venda às 01:00 UTC de 09/11 → Lote 0, porque ainda é 08/11 em Brasília
