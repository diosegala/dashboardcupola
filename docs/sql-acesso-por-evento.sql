-- Acesso por evento: opção "todos os eventos" (inclui os futuros).
-- Pedir no chat do Lovable para aplicar exatamente este SQL.
-- Admin continua vendo tudo. Qualquer outro papel (atual ou futuro) vê:
-- todos os eventos, se all_events = true; senão, só os liberados em event_users.

-- 1. Alcance de cada pessoa. Fica numa tabela própria porque profiles pode ser
--    editado pelo próprio usuário; esta só pode ser alterada por admin.
CREATE TABLE public.user_event_scope (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  all_events boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_event_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View own event scope" ON public.user_event_scope
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage event scope" ON public.user_event_scope
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON public.user_event_scope FROM anon;

-- 2. Quem já existe continua vendo todos os eventos, inclusive os próximos.
INSERT INTO public.user_event_scope (user_id, all_events)
SELECT DISTINCT user_id, true FROM public.user_roles
ON CONFLICT (user_id) DO UPDATE SET all_events = true;

-- 3. A regra de acesso passa a considerar o "todos os eventos".
--    Todas as políticas que já usam can_see_event passam a valer automaticamente.
CREATE OR REPLACE FUNCTION public.can_see_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.user_event_scope WHERE user_id = auth.uid() AND all_events)
      OR EXISTS (SELECT 1 FROM public.event_users WHERE event_id = _event_id AND user_id = auth.uid())
$$;
