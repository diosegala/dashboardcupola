-- Patrocínios: desbloqueio da leitura da conta e da sincronização do Pipedrive (05/11/2026).
-- Rodar inteiro no editor SQL do Lovable, como os outros SQLs. Não apaga dados.
--
-- 1. Erro "Não foi possível gravar ou ler os dados do CRM (PGRST201)".
--    As funções do servidor leem a configuração junto com o evento (sponsorship_config + events). A tabela tem duas
--    ligações com events: event_id (o evento) e copied_from_event_id (de qual evento a configuração foi copiada).
--    Com duas ligações o banco não sabe qual usar e recusa a leitura. Tirando a trava da segunda, sobra uma só.
--    A coluna copied_from_event_id continua existindo e guardando o evento de origem; só deixa de ser uma chave.
ALTER TABLE public.sponsorship_config
  DROP CONSTRAINT IF EXISTS sponsorship_config_copied_from_event_id_fkey;

-- 2. Código do produto que marca a venda de patrocínio (no Summit, "B2B"), junto com o termo no nome.
ALTER TABLE public.sponsorship_config
  ADD COLUMN IF NOT EXISTS product_code text;

-- Recarrega o cache do banco de dados para a mudança valer na hora.
NOTIFY pgrst, 'reload schema';

-- Conferência: deve mostrar só uma chave para events (sponsorship_config_event_id_fkey) e a coluna product_code.
SELECT conname AS chave FROM pg_constraint
WHERE conrelid = 'public.sponsorship_config'::regclass AND contype = 'f';
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sponsorship_config' AND column_name = 'product_code';
