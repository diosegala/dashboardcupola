
-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. Integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name IN ('sympla','pipedrive','meta','google_ads','rd_station','google_analytics')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  credentials JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle','syncing','error')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- 6. Goals table
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  label TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

-- 7. Ticket sales (Sympla)
CREATE TABLE public.ticket_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sympla_order_id TEXT UNIQUE NOT NULL,
  event_id TEXT,
  ticket_type TEXT,
  ticket_type_id TEXT,
  quantity INT NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  buyer_name TEXT,
  buyer_email TEXT,
  status TEXT,
  sold_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_sales ENABLE ROW LEVEL SECURITY;

-- 8. Deals (Pipedrive)
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_deal_id TEXT UNIQUE NOT NULL,
  title TEXT,
  value NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  stage_id TEXT,
  stage_name TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','won','lost')),
  owner_name TEXT,
  created_at_source TIMESTAMPTZ,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- 9. Ad metrics (Meta + Google Ads)
CREATE TABLE public.ad_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('meta','google_ads')),
  campaign_id TEXT,
  campaign_name TEXT,
  ad_set_id TEXT,
  ad_set_name TEXT,
  date DATE NOT NULL,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  spend NUMERIC DEFAULT 0,
  conversions INT DEFAULT 0,
  ctr NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  cpm NUMERIC DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, campaign_id, ad_set_id, date)
);
ALTER TABLE public.ad_metrics ENABLE ROW LEVEL SECURITY;

-- 10. Email campaigns (RD Station)
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rd_campaign_id TEXT UNIQUE NOT NULL,
  name TEXT,
  subject TEXT,
  sent_at TIMESTAMPTZ,
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  open_rate NUMERIC DEFAULT 0,
  click_rate NUMERIC DEFAULT 0,
  unsubscribes INT DEFAULT 0,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

-- 11. Site analytics (Google Analytics)
CREATE TABLE public.site_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  sessions INT DEFAULT 0,
  users INT DEFAULT 0,
  new_users INT DEFAULT 0,
  pageviews INT DEFAULT 0,
  bounce_rate NUMERIC DEFAULT 0,
  avg_session_duration NUMERIC DEFAULT 0,
  top_pages JSONB DEFAULT '[]'::jsonb,
  traffic_sources JSONB DEFAULT '[]'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- 12. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. RLS Policies

-- Profiles: users read own, admins read all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- User roles: only admins manage, users read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Integrations: all authenticated read, admins write
CREATE POLICY "Authenticated users can view integrations" ON public.integrations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage integrations" ON public.integrations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Goals: all authenticated read, admins write
CREATE POLICY "Authenticated users can view goals" ON public.goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage goals" ON public.goals FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Metric tables: all authenticated can read
CREATE POLICY "Authenticated can view ticket_sales" ON public.ticket_sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view deals" ON public.deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view ad_metrics" ON public.ad_metrics FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view email_campaigns" ON public.email_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can view site_analytics" ON public.site_analytics FOR SELECT TO authenticated USING (true);

-- Service role (edge functions) will bypass RLS for inserts/updates
