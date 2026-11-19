-- Histórico das importações de pessoas por evento (Configurações › Eventos › pessoas do evento).
-- Guarda o resumo, o que não entrou e as decisões tomadas (transferências de cupom, reativações),
-- com quem importou e quando, para ficar registrado o consentimento.
-- Pedir no chat do Lovable para rodar este SQL.

CREATE TABLE public.user_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,          -- nome do arquivo ou link da planilha
  totals jsonb NOT NULL,         -- números do resumo
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,     -- linhas que não entraram ou falharam, com o motivo
  decisions jsonb NOT NULL DEFAULT '[]'::jsonb   -- transferências de cupom e reativações confirmadas
);
ALTER TABLE public.user_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view imports" ON public.user_imports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can register imports" ON public.user_imports
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
REVOKE ALL ON public.user_imports FROM anon;
CREATE INDEX user_imports_event_idx ON public.user_imports (event_id, created_at DESC);
