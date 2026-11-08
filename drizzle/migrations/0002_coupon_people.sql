CREATE TABLE public.coupon_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  codes text[] NOT NULL DEFAULT '{}',
  seller_names text[] NOT NULL DEFAULT '{}',
  outside_ranking boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_people TO authenticated;
GRANT ALL ON public.coupon_people TO service_role;

ALTER TABLE public.coupon_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios logados leem pessoas dos cupons" ON public.coupon_people
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins incluem pessoas dos cupons" ON public.coupon_people
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins alteram pessoas dos cupons" ON public.coupon_people
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins excluem pessoas dos cupons" ON public.coupon_people
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_coupon_people_updated_at
  BEFORE UPDATE ON public.coupon_people
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();