
Diagnóstico rápido (confirmado)
- A sincronização do Meta está funcionando (logs mostram `success: true`, `rows: 32`).
- O problema é de recorte de data: os registros gravados em `ad_metrics` ficaram todos com `date = 2026-02-11`.
- O dashboard consulta `ad_metrics` por período (ex.: março: `date >= 2026-03-01` e `<= 2026-03-31`), então retorna `[]` e os cards ficam vazios.

Causa raiz
- Na função `supabase/functions/sync-meta/index.ts`, a chamada ao Insights usa `date_preset=last_30d` sem granularidade diária.
- Assim, a API retorna dados agregados do período com um único `date_start` (início da janela), que caiu em fevereiro.

Plano de implementação
1. Ajustar granularidade da coleta Meta (arquivo `supabase/functions/sync-meta/index.ts`)
- Adicionar `time_increment=1` na query de Insights para receber 1 linha por dia/adset.
- Manter `level=adset`, `actions` e mapeamentos atuais (`purchase`, `onsite_conversion.messaging_conversation_started_7d`, `add_to_cart`, `offsite_conversion.fb_pixel_custom`).

2. Manter estratégia de limpeza + carga completa
- Preservar o fluxo atual: deletar `source='meta'` e inserir lote novo.
- Com `time_increment=1`, os registros passam a cobrir vários dias dentro da janela e voltam a casar com os filtros do dashboard.

3. Melhorar observabilidade (mesmo arquivo)
- Logar intervalo efetivo inserido (`min(date_start)` / `max(date_start)`) e quantidade total de linhas.
- Isso facilita diagnosticar rapidamente quando o período do dashboard não bate com o período sincronizado.

4. Melhorar feedback no frontend (arquivo `src/components/dashboard/MarketingSection.tsx`)
- Quando `meta.length === 0`, exibir aviso explícito: “Sem dados de Meta no período selecionado” (em vez de parecer erro silencioso nos cards).
- Mantém os cards, mas com contexto claro para o usuário.

Validação após implementação
- Executar sincronização manual do Meta.
- Conferir no banco se existem linhas `source='meta'` dentro do mês atual (não apenas um único dia antigo).
- Recarregar dashboard e validar que os cards de Compras, Mensagens, Adição de Carrinho e Remarketing Qualificado voltam a exibir valores.
- Validar também o gráfico “Cliques por Dia” com múltiplos pontos de data (não apenas 1 data agregada).

Detalhes técnicos
- Arquivo principal: `supabase/functions/sync-meta/index.ts`
  - `URLSearchParams`: incluir `time_increment: "1"`.
  - Manter `date: r.date_start` no mapeamento.
- Arquivo de UX: `src/components/dashboard/MarketingSection.tsx`
  - Condicional de empty state para `meta.length === 0`.
