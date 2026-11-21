-- Logs de atividade: o registro nasce no banco, é só de leitura para admin e guarda o retrato de quem agiu.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE TABLE public.logs_atividade (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocorrido_em      timestamptz NOT NULL DEFAULT now(),
  acao             text NOT NULL,
  categoria        text NOT NULL CHECK (categoria IN ('dados','acesso','permissao','evento','integracao','operacao')),
  entidade         text NOT NULL,
  entidade_id      text,
  entidade_rotulo  text,
  tela             text,
  event_id         uuid,
  event_nome       text,
  actor_id         uuid,
  actor_nome       text,
  actor_email      text,
  actor_papel      text,
  actor_origem     text NOT NULL DEFAULT 'painel' CHECK (actor_origem IN ('painel','integracao','sistema')),
  actor_processo   text,
  actor_removido   boolean NOT NULL DEFAULT false,
  ip               inet,
  user_agent       text,
  dados_antes      jsonb,
  dados_depois     jsonb,
  campos_alterados text[] NOT NULL DEFAULT '{}',
  qtd_linhas       integer,
  resultado        text NOT NULL DEFAULT 'sucesso' CHECK (resultado IN ('sucesso','erro')),
  detalhe_erro     text
);
REVOKE ALL ON public.logs_atividade FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.logs_atividade TO authenticated, service_role;
ALTER TABLE public.logs_atividade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Só admin lê os logs" ON public.logs_atividade FOR SELECT TO authenticated USING (public.is_admin());

CREATE INDEX logs_atividade_quando ON public.logs_atividade (ocorrido_em DESC, id DESC);
CREATE INDEX logs_atividade_ator ON public.logs_atividade (actor_id, ocorrido_em DESC);
CREATE INDEX logs_atividade_entidade ON public.logs_atividade (entidade, entidade_id);
CREATE INDEX logs_atividade_evento ON public.logs_atividade (event_id, ocorrido_em DESC);
CREATE INDEX logs_atividade_categoria ON public.logs_atividade (categoria, ocorrido_em DESC);
CREATE INDEX logs_atividade_acao ON public.logs_atividade (acao, ocorrido_em DESC);
CREATE INDEX logs_atividade_email ON public.logs_atividade (actor_email);
CREATE INDEX logs_atividade_campos ON public.logs_atividade USING gin (campos_alterados);

CREATE TABLE public.logs_auditoria_erros (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  tabela      text,
  operacao    text,
  mensagem    text NOT NULL
);
REVOKE ALL ON public.logs_auditoria_erros FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.logs_auditoria_erros TO authenticated, service_role;
ALTER TABLE public.logs_auditoria_erros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Só admin lê os erros do log" ON public.logs_auditoria_erros FOR SELECT TO authenticated USING (public.is_admin());

CREATE TABLE public.auditoria_tabelas (
  tabela         text PRIMARY KEY,
  modo           text NOT NULL DEFAULT 'linha' CHECK (modo IN ('linha','resumo')),
  prefixo        text NOT NULL,
  categoria      text NOT NULL DEFAULT 'dados',
  tela           text,
  coluna_rotulo  text,
  coluna_usuario text,
  coluna_evento  text,
  coluna_id      text[] NOT NULL DEFAULT '{id}',
  ignorados      text[] NOT NULL DEFAULT '{}',
  sensiveis      text[] NOT NULL DEFAULT '{}',
  rotulo_resumo  text
);
REVOKE ALL ON public.auditoria_tabelas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.auditoria_tabelas TO authenticated;
GRANT ALL ON public.auditoria_tabelas TO service_role;
ALTER TABLE public.auditoria_tabelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Só admin lê o cadastro da auditoria" ON public.auditoria_tabelas FOR SELECT TO authenticated USING (public.is_admin());

-- Falha do próprio log: vai para a tabela de erros e nunca derruba a operação principal.
CREATE OR REPLACE FUNCTION public._log_erro(p_tabela text, p_operacao text, p_mensagem text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.logs_auditoria_erros (tabela, operacao, mensagem) VALUES (p_tabela, p_operacao, left(coalesce(p_mensagem, 'erro sem mensagem'), 2000));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public._uuid_ou_nulo(v text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN nullif(btrim(v), '')::uuid;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

-- Campos sensíveis: fica o nome do campo, nunca o valor.
CREATE OR REPLACE FUNCTION public._log_mascarar(j jsonb, sensiveis text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN j IS NULL OR jsonb_typeof(j) <> 'object' THEN j ELSE (
    SELECT coalesce(jsonb_object_agg(k, CASE
      WHEN v = 'null'::jsonb THEN v
      WHEN k = ANY(coalesce(sensiveis, '{}')) OR k ~* '(token|secret|segredo|senha|password|credential|api_?key|chave|pepper)' THEN to_jsonb('••••'::text)
      ELSE v END), '{}'::jsonb)
    FROM jsonb_each(j) AS e(k, v)) END
$$;

-- Grava uma linha de log com o retrato do ator no instante da ação.
CREATE OR REPLACE FUNCTION public._log_inserir(
  p_acao text, p_categoria text, p_entidade text, p_entidade_id text, p_rotulo text, p_tela text,
  p_event_id uuid, p_antes jsonb, p_depois jsonb, p_campos text[], p_resultado text, p_erro text,
  p_qtd integer, p_ator jsonb DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb; hdr jsonb; papel_jwt text;
  v_id uuid; v_origem text; v_proc text; v_ip inet; v_ua text;
  v_nome text; v_email text; v_papel text; v_ev text; v_novo bigint;
BEGIN
  BEGIN claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb; EXCEPTION WHEN others THEN claims := NULL; END;
  BEGIN hdr := nullif(current_setting('request.headers', true), '')::jsonb; EXCEPTION WHEN others THEN hdr := NULL; END;
  papel_jwt := coalesce(claims->>'role', '');

  IF p_ator IS NOT NULL THEN
    v_email := p_ator->>'email';
    v_origem := coalesce(p_ator->>'origem', 'painel');
    v_proc := p_ator->>'processo';
  ELSIF papel_jwt = 'authenticated' AND public._uuid_ou_nulo(claims->>'sub') IS NOT NULL THEN
    v_id := public._uuid_ou_nulo(claims->>'sub');
    v_origem := 'painel';
  ELSIF papel_jwt = 'service_role' THEN
    -- Só quem usa a chave de serviço pode dizer em nome de quem age.
    v_id := public._uuid_ou_nulo(coalesce(hdr->>'x-actor-id', current_setting('app.actor_id', true)));
    v_proc := nullif(coalesce(hdr->>'x-actor-processo', current_setting('app.actor_processo', true)), '');
    v_origem := CASE WHEN v_id IS NOT NULL THEN 'painel' ELSE 'integracao' END;
    IF v_id IS NULL AND v_proc IS NULL THEN
      v_proc := 'servidor_sem_identificacao';
      PERFORM public._log_erro(p_entidade, p_acao, 'Gravação pelo servidor sem identificação do processo');
    END IF;
  ELSE
    v_id := public._uuid_ou_nulo(current_setting('app.actor_id', true));
    v_proc := coalesce(nullif(current_setting('app.actor_processo', true), ''),
      CASE session_user WHEN 'supabase_auth_admin' THEN 'login_e_convites' END,
      nullif(current_setting('application_name', true), ''), 'sql_direto');
    v_origem := CASE WHEN v_id IS NOT NULL THEN 'painel' ELSE 'sistema' END;
  END IF;

  IF papel_jwt IN ('authenticated', 'anon') THEN
    BEGIN
      v_ip := btrim(split_part(coalesce(hdr->>'cf-connecting-ip', hdr->>'x-real-ip', hdr->>'x-forwarded-for'), ',', 1))::inet;
    EXCEPTION WHEN others THEN v_ip := NULL; END;
    v_ua := left(hdr->>'user-agent', 300);
  END IF;

  IF v_id IS NOT NULL THEN
    SELECT name INTO v_nome FROM public.profiles WHERE id = v_id;
    SELECT email INTO v_email FROM auth.users WHERE id = v_id;
    SELECT string_agg(role::text, ',' ORDER BY role::text) INTO v_papel FROM public.user_roles WHERE user_id = v_id;
  END IF;
  IF p_event_id IS NOT NULL THEN SELECT name INTO v_ev FROM public.events WHERE id = p_event_id; END IF;
  IF v_ev IS NULL AND p_entidade = 'events' THEN v_ev := p_rotulo; END IF;

  INSERT INTO public.logs_atividade (acao, categoria, entidade, entidade_id, entidade_rotulo, tela, event_id, event_nome,
    actor_id, actor_nome, actor_email, actor_papel, actor_origem, actor_processo, ip, user_agent,
    dados_antes, dados_depois, campos_alterados, qtd_linhas, resultado, detalhe_erro)
  VALUES (p_acao, p_categoria, p_entidade, p_entidade_id, left(p_rotulo, 300), p_tela, p_event_id, v_ev,
    v_id, v_nome, lower(v_email), v_papel, v_origem, v_proc, v_ip, v_ua,
    p_antes, p_depois, coalesce(p_campos, '{}'), p_qtd, coalesce(p_resultado, 'sucesso'), p_erro)
  RETURNING id INTO v_novo;
  RETURN v_novo;
END $$;

-- Gatilho por linha: criação, edição e exclusão com antes e depois.
CREATE OR REPLACE FUNCTION public.auditar_linha()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.auditoria_tabelas%ROWTYPE;
  antes jsonb; depois jsonb; linha jsonb;
  campos text[] := '{}';
  v_acao text; v_cat text; v_rot text; v_ent text; v_ev uuid; v_alvo uuid;
  v_res text := 'sucesso'; v_err text;
BEGIN
  BEGIN
    SELECT * INTO c FROM public.auditoria_tabelas WHERE tabela = TG_TABLE_NAME;
    IF NOT FOUND THEN
      c.prefixo := TG_TABLE_NAME; c.categoria := 'dados'; c.coluna_id := '{id}'; c.ignorados := '{}'; c.sensiveis := '{}';
    END IF;
    IF TG_OP <> 'INSERT' THEN antes := to_jsonb(OLD); END IF;
    IF TG_OP <> 'DELETE' THEN depois := to_jsonb(NEW); END IF;
    linha := coalesce(depois, antes);

    IF TG_OP = 'UPDATE' THEN
      SELECT coalesce(array_agg(k ORDER BY k), '{}') INTO campos
      FROM jsonb_object_keys(depois) AS k
      WHERE (antes->k) IS DISTINCT FROM (depois->k) AND NOT (k = ANY(c.ignorados));
    END IF;

    v_acao := c.prefixo || '.' || CASE TG_OP WHEN 'INSERT' THEN 'criado' WHEN 'UPDATE' THEN 'alterado' ELSE 'excluido' END;
    v_cat := c.categoria;

    IF TG_TABLE_NAME = 'integrations' AND TG_OP = 'UPDATE' THEN
      IF depois->>'sync_status' = 'error' AND (antes->>'sync_status') IS DISTINCT FROM 'error' THEN
        v_acao := 'integracao.falhou'; v_res := 'erro'; v_err := depois->>'error_message';
        campos := ARRAY(SELECT DISTINCT unnest(campos || ARRAY['sync_status', 'error_message']));
      ELSIF 'credentials' = ANY(campos) THEN v_acao := 'integracao.credencial_trocada';
      ELSIF 'is_active' = ANY(campos) THEN
        v_acao := CASE WHEN (depois->>'is_active')::boolean THEN 'integracao.conectada' ELSE 'integracao.desconectada' END;
      END IF;
    ELSIF TG_TABLE_NAME = 'events' AND TG_OP = 'UPDATE' THEN
      IF 'sympla_event_id' = ANY(campos) THEN v_acao := 'evento.sympla_trocado';
      ELSIF 'is_active' = ANY(campos) THEN
        v_acao := CASE WHEN (depois->>'is_active')::boolean THEN 'evento.publicado' ELSE 'evento.arquivado' END;
      END IF;
    ELSIF TG_TABLE_NAME = 'event_integrations' THEN
      v_cat := 'evento';
    ELSIF TG_TABLE_NAME = 'sponsorship_config' AND TG_OP = 'INSERT' AND depois->>'copied_from_event_id' IS NOT NULL THEN
      v_acao := 'evento.config_herdada'; v_cat := 'evento';
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      IF TG_OP = 'UPDATE' AND antes->>'deleted_at' IS NULL AND depois->>'deleted_at' IS NOT NULL THEN
        v_acao := 'usuario.excluido'; v_cat := 'permissao';
        antes := antes || jsonb_build_object('email', (SELECT email FROM auth.users WHERE id = OLD.id));
        UPDATE public.logs_atividade SET actor_removido = true WHERE actor_id = OLD.id AND NOT actor_removido;
      ELSIF TG_OP = 'UPDATE' THEN
        v_cat := 'dados';
      END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND cardinality(campos) = 0 AND v_res = 'sucesso' THEN RETURN NULL; END IF;

    v_rot := nullif(linha->>c.coluna_rotulo, '');
    IF c.coluna_usuario IS NOT NULL THEN
      v_alvo := public._uuid_ou_nulo(linha->>c.coluna_usuario);
      v_rot := concat_ws(' · ', coalesce((SELECT name FROM public.profiles WHERE id = v_alvo), (SELECT email FROM auth.users WHERE id = v_alvo)), v_rot);
    END IF;
    v_rot := coalesce(nullif(v_rot, ''), linha->>'name', linha->>'label', linha->>'title');
    SELECT string_agg(linha->>k, ':') INTO v_ent FROM unnest(c.coluna_id) AS k;
    IF c.coluna_evento IS NOT NULL THEN v_ev := public._uuid_ou_nulo(linha->>c.coluna_evento); END IF;

    PERFORM public._log_inserir(v_acao, v_cat, TG_TABLE_NAME, v_ent, v_rot, c.tela, v_ev,
      public._log_mascarar(antes, c.sensiveis), public._log_mascarar(depois, c.sensiveis), campos, v_res, v_err, NULL);
  EXCEPTION WHEN others THEN
    PERFORM public._log_erro(TG_TABLE_NAME, TG_OP, SQLERRM);
  END;
  RETURN NULL;
END $$;

-- Gatilho por gravação (tabelas que as integrações reescrevem): uma linha de resumo, só quando algo mudou.
CREATE OR REPLACE FUNCTION public.auditar_resumo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.auditoria_tabelas%ROWTYPE;
  n integer := 0; campos text[] := '{}'; amostra jsonb; v_res text := 'sucesso'; v_err text;
BEGIN
  BEGIN
    SELECT * INTO c FROM public.auditoria_tabelas WHERE tabela = TG_TABLE_NAME;
    IF NOT FOUND THEN
      c.prefixo := TG_TABLE_NAME; c.coluna_id := '{id}'; c.ignorados := '{}';
    END IF;
    IF TG_OP = 'INSERT' THEN
      SELECT count(*) INTO n FROM novos;
      IF n = 0 THEN RETURN NULL; END IF;
      PERFORM public._log_inserir(c.prefixo || '.importado', 'integracao', TG_TABLE_NAME, NULL,
        coalesce(c.rotulo_resumo, TG_TABLE_NAME), c.tela, NULL, NULL, jsonb_build_object('novos', n), '{}', 'sucesso', NULL, n);
    ELSIF TG_OP = 'UPDATE' THEN
      WITH a AS (
        SELECT (SELECT string_agg(to_jsonb(y)->>k, ':') FROM unnest(c.coluna_id) k) AS chave, to_jsonb(y) - c.ignorados AS j FROM antigos y
      ), b AS (
        SELECT (SELECT string_agg(to_jsonb(x)->>k, ':') FROM unnest(c.coluna_id) k) AS chave, to_jsonb(x) - c.ignorados AS j FROM novos x
      ), d AS (
        SELECT a.j AS aj, b.j AS bj FROM b JOIN a USING (chave) WHERE a.j IS DISTINCT FROM b.j
      )
      SELECT (SELECT count(*) FROM d),
             coalesce((SELECT array_agg(DISTINCT k ORDER BY k) FROM d, jsonb_object_keys(d.bj) k WHERE d.aj->k IS DISTINCT FROM d.bj->k), '{}')
        INTO n, campos;
      IF n = 0 THEN RETURN NULL; END IF;
      IF TG_TABLE_NAME = 'crm_sync_state' AND 'last_error' = ANY(campos) THEN
        SELECT to_jsonb(x)->>'last_error' INTO v_err FROM novos x WHERE to_jsonb(x)->>'last_error' IS NOT NULL LIMIT 1;
        IF v_err IS NOT NULL THEN v_res := 'erro'; END IF;
      END IF;
      PERFORM public._log_inserir(CASE WHEN v_res = 'erro' THEN c.prefixo || '.falhou' ELSE c.prefixo || '.atualizado' END,
        'integracao', TG_TABLE_NAME, NULL, coalesce(c.rotulo_resumo, TG_TABLE_NAME), c.tela, NULL, NULL,
        jsonb_build_object('alterados', n), campos, v_res, v_err, n);
    ELSE
      SELECT count(*) INTO n FROM antigos;
      IF n = 0 THEN RETURN NULL; END IF;
      SELECT jsonb_agg(j) INTO amostra FROM (SELECT to_jsonb(y) AS j FROM antigos y LIMIT 100) s;
      PERFORM public._log_inserir(c.prefixo || '.removido', 'integracao', TG_TABLE_NAME, NULL,
        coalesce(c.rotulo_resumo, TG_TABLE_NAME), c.tela, NULL,
        jsonb_build_object('removidos', n, 'linhas', amostra, 'linhas_guardadas', least(n, 100)), NULL, '{}', 'sucesso', NULL, n);
    END IF;
  EXCEPTION WHEN others THEN
    PERFORM public._log_erro(TG_TABLE_NAME, TG_OP, SQLERRM);
  END;
  RETURN NULL;
END $$;

-- Liga (ou religa) o gatilho de auditoria numa tabela. Toda migração que cria tabela chama esta função.
CREATE OR REPLACE FUNCTION public.auditoria_ligar(p_tabela text, p_modo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_modo text;
BEGIN
  IF p_tabela IN ('logs_atividade', 'logs_auditoria_erros') THEN RETURN; END IF;
  INSERT INTO public.auditoria_tabelas (tabela, modo, prefixo, coluna_id)
  VALUES (p_tabela, coalesce(p_modo, 'linha'), p_tabela,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_tabela AND column_name = 'id') THEN '{id}'::text[] ELSE '{}'::text[] END)
  ON CONFLICT (tabela) DO UPDATE SET modo = coalesce(p_modo, public.auditoria_tabelas.modo);
  SELECT modo INTO v_modo FROM public.auditoria_tabelas WHERE tabela = p_tabela;
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria_ins ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria_upd ON public.%I', p_tabela);
  EXECUTE format('DROP TRIGGER IF EXISTS auditoria_del ON public.%I', p_tabela);
  IF v_modo = 'linha' THEN
    EXECUTE format('CREATE TRIGGER auditoria AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auditar_linha()', p_tabela);
  ELSE
    EXECUTE format('CREATE TRIGGER auditoria_ins AFTER INSERT ON public.%I REFERENCING NEW TABLE AS novos FOR EACH STATEMENT EXECUTE FUNCTION public.auditar_resumo()', p_tabela);
    EXECUTE format('CREATE TRIGGER auditoria_upd AFTER UPDATE ON public.%I REFERENCING OLD TABLE AS antigos NEW TABLE AS novos FOR EACH STATEMENT EXECUTE FUNCTION public.auditar_resumo()', p_tabela);
    EXECUTE format('CREATE TRIGGER auditoria_del AFTER DELETE ON public.%I REFERENCING OLD TABLE AS antigos FOR EACH STATEMENT EXECUTE FUNCTION public.auditar_resumo()', p_tabela);
  END IF;
END $$;

-- Lista as tabelas do painel sem gatilho de auditoria (deve estar sempre vazia).
CREATE OR REPLACE FUNCTION public.tabelas_sem_auditoria()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.relname::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    AND c.relname NOT IN ('logs_atividade', 'logs_auditoria_erros')
    AND NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid AND NOT t.tgisinternal AND t.tgname LIKE 'auditoria%')
  ORDER BY 1
$$;

-- Registros que não nascem de tabela (login, saída, convite, acesso negado, falha, exportação).
CREATE OR REPLACE FUNCTION public.registrar_atividade(
  p_acao text, p_entidade text DEFAULT NULL, p_entidade_id text DEFAULT NULL, p_rotulo text DEFAULT NULL,
  p_tela text DEFAULT NULL, p_event_id uuid DEFAULT NULL, p_resultado text DEFAULT 'sucesso',
  p_detalhe text DEFAULT NULL, p_dados jsonb DEFAULT NULL, p_email text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claims jsonb; papel text; v_cat text; v_res text; v_email text;
BEGIN
  BEGIN claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb; EXCEPTION WHEN others THEN claims := NULL; END;
  papel := coalesce(claims->>'role', '');
  IF p_acao IS NULL OR p_acao !~ '^[a-z_]+(\.[a-z_]+)+$' THEN RAISE EXCEPTION 'Ação de log inválida' USING ERRCODE = '22023'; END IF;
  IF p_dados IS NOT NULL AND octet_length(p_dados::text) > 8000 THEN p_dados := NULL; END IF;
  v_res := CASE WHEN p_resultado = 'erro' THEN 'erro' ELSE 'sucesso' END;
  v_cat := CASE
    WHEN p_acao LIKE 'acesso.%' THEN 'acesso'
    WHEN p_acao LIKE 'permissao.%' OR p_acao LIKE 'usuario.%' THEN 'permissao'
    WHEN p_acao LIKE 'integracao.%' THEN 'integracao'
    WHEN p_acao LIKE 'evento.%' THEN 'evento'
    WHEN p_acao LIKE 'falha.%' THEN 'dados'
    ELSE 'operacao' END;

  IF papel = 'service_role' THEN
    NULL;
  ELSIF papel = 'authenticated' THEN
    IF p_acao NOT IN ('acesso.login', 'acesso.logout', 'acesso.senha_trocada', 'acesso.convite_aceito', 'acesso.negado', 'falha.gravacao', 'falha.funcao', 'dados.exportado') THEN
      RAISE EXCEPTION 'Ação de log não permitida' USING ERRCODE = '42501';
    END IF;
    IF p_acao LIKE 'falha.%' THEN v_res := 'erro'; END IF;
    IF p_acao = 'acesso.negado' THEN v_res := 'erro'; END IF;
  ELSIF p_acao = 'acesso.login_falhou' THEN
    v_email := lower(left(btrim(coalesce(p_email, '')), 200));
    IF v_email !~ '^[^@\s]+@[^@\s]+$' THEN RETURN; END IF;
    -- Limite contra abuso: 10 por e-mail por hora e 100 no total a cada 10 minutos.
    IF (SELECT count(*) FROM public.logs_atividade WHERE acao = 'acesso.login_falhou' AND actor_email = v_email AND ocorrido_em > now() - interval '1 hour') >= 10
       OR (SELECT count(*) FROM public.logs_atividade WHERE acao = 'acesso.login_falhou' AND ocorrido_em > now() - interval '10 minutes') >= 100 THEN
      RETURN;
    END IF;
    PERFORM public._log_inserir('acesso.login_falhou', 'acesso', 'login', NULL, v_email, 'Login', NULL, NULL, NULL, '{}', 'erro',
      concat_ws(' · ', left(p_detalhe, 300), 'não confirmado: informado por quem ainda não entrou'), NULL,
      jsonb_build_object('email', v_email, 'origem', 'painel'));
    RETURN;
  ELSE
    RAISE EXCEPTION 'Não autorizado' USING ERRCODE = '42501';
  END IF;

  PERFORM public._log_inserir(p_acao, v_cat, coalesce(p_entidade, split_part(p_acao, '.', 1)), left(p_entidade_id, 200),
    left(p_rotulo, 300), left(p_tela, 120), p_event_id, NULL, p_dados, '{}', v_res, left(p_detalhe, 1000), NULL);
END $$;

-- Filtros da tela Logs: um só critério para a lista, os números, as opções e a exportação.
CREATE OR REPLACE FUNCTION public._logs_filtro_ok(l public.logs_atividade, f jsonb)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT (f->>'de' IS NULL OR l.ocorrido_em >= (f->>'de')::timestamptz)
    AND (f->>'ate' IS NULL OR l.ocorrido_em < (f->>'ate')::timestamptz)
    AND (f->>'pessoa' IS NULL OR CASE
          WHEN f->>'pessoa' LIKE 'proc:%' THEN l.actor_id IS NULL AND l.actor_processo = substr(f->>'pessoa', 6)
          WHEN f->>'pessoa' LIKE 'email:%' THEN l.actor_id IS NULL AND l.actor_email = substr(f->>'pessoa', 7)
          ELSE l.actor_id::text = f->>'pessoa' END)
    AND (f->>'papel' IS NULL OR CASE WHEN f->>'papel' = 'automacao' THEN l.actor_id IS NULL AND l.actor_origem <> 'painel' ELSE l.actor_papel = f->>'papel' END)
    AND (f->>'categoria' IS NULL OR l.categoria = f->>'categoria')
    AND (f->>'tela' IS NULL OR l.tela = f->>'tela')
    AND (f->>'evento' IS NULL OR l.event_id::text = f->>'evento')
    AND (f->>'resultado' IS NULL OR l.resultado = f->>'resultado')
    AND (f->>'entidade' IS NULL OR l.entidade = f->>'entidade')
    AND (f->>'entidade_id' IS NULL OR l.entidade_id = f->>'entidade_id')
    AND (f->>'busca' IS NULL OR position(lower(f->>'busca') IN lower(concat_ws(' ', l.entidade_rotulo, l.actor_email, l.actor_nome, l.actor_processo, array_to_string(l.campos_alterados, ' ')))) > 0)
$$;

CREATE OR REPLACE FUNCTION public.logs_buscar(f jsonb DEFAULT '{}', p_antes_em timestamptz DEFAULT NULL, p_antes_id bigint DEFAULT NULL, p_limite integer DEFAULT 50)
RETURNS SETOF public.logs_atividade LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores veem os logs' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT * FROM public.logs_atividade l
    WHERE public._logs_filtro_ok(l, coalesce(f, '{}'))
      AND (p_antes_em IS NULL OR (l.ocorrido_em, l.id) < (p_antes_em, coalesce(p_antes_id, 9223372036854775807)))
    ORDER BY l.ocorrido_em DESC, l.id DESC
    LIMIT least(greatest(coalesce(p_limite, 50), 1), 200);
END $$;

CREATE OR REPLACE FUNCTION public.logs_resumo(f jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores veem os logs' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'total', count(*),
    'exclusoes', count(*) FILTER (WHERE l.acao LIKE '%.excluido' OR l.acao LIKE '%.removido'),
    'permissoes', count(*) FILTER (WHERE l.categoria = 'permissao'),
    'falhas', count(*) FILTER (WHERE l.resultado = 'erro'))
  INTO r FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'));
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.logs_opcoes()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores veem os logs' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'pessoas', coalesce((SELECT jsonb_agg(p ORDER BY p->>'nome') FROM (
      SELECT jsonb_build_object(
        'chave', chave,
        'nome', (array_agg(actor_nome ORDER BY ocorrido_em DESC) FILTER (WHERE actor_nome IS NOT NULL))[1],
        'email', (array_agg(actor_email ORDER BY ocorrido_em DESC) FILTER (WHERE actor_email IS NOT NULL))[1],
        'papel', (array_agg(actor_papel ORDER BY ocorrido_em DESC) FILTER (WHERE actor_papel IS NOT NULL))[1],
        'processo', max(actor_processo),
        'tipo', CASE WHEN chave LIKE 'proc:%' THEN 'automacao' WHEN chave LIKE 'email:%' THEN 'nao_confirmado'
                     WHEN bool_or(actor_removido) THEN 'removido' ELSE 'ativo' END) AS p
      FROM (SELECT *, CASE WHEN actor_id IS NOT NULL THEN actor_id::text
                           WHEN actor_processo IS NOT NULL THEN 'proc:' || actor_processo
                           ELSE 'email:' || coalesce(actor_email, '?') END AS chave
            FROM public.logs_atividade) s
      GROUP BY chave) q), '[]'::jsonb),
    'eventos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', event_id, 'nome', nome) ORDER BY nome) FROM (
      SELECT event_id, max(event_nome) AS nome FROM public.logs_atividade WHERE event_id IS NOT NULL GROUP BY event_id) e), '[]'::jsonb),
    'telas', coalesce((SELECT jsonb_agg(tela ORDER BY tela) FROM (SELECT DISTINCT tela FROM public.logs_atividade WHERE tela IS NOT NULL) t), '[]'::jsonb))
  INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.logs_saude()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores veem os logs' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'sem_auditoria', coalesce((SELECT jsonb_agg(t) FROM public.tabelas_sem_auditoria() t), '[]'::jsonb),
    'erros', (SELECT count(*) FROM public.logs_auditoria_erros),
    'ultimo_erro', (SELECT jsonb_build_object('quando', ocorrido_em, 'tabela', tabela, 'mensagem', mensagem)
                    FROM public.logs_auditoria_erros ORDER BY id DESC LIMIT 1));
END $$;

-- Exportação: o próprio servidor grava "log.exportado" antes de devolver as linhas.
CREATE OR REPLACE FUNCTION public.exportar_logs(f jsonb DEFAULT '{}')
RETURNS SETOF public.logs_atividade LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas administradores exportam os logs' USING ERRCODE = '42501'; END IF;
  SELECT least(count(*), 20000) INTO n FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'));
  PERFORM public._log_inserir('log.exportado', 'operacao', 'logs_atividade', NULL, 'Exportação do log (' || n || ' linhas)', 'Logs', NULL,
    NULL, jsonb_build_object('filtros', coalesce(f, '{}'), 'linhas', n), '{}', 'sucesso', NULL, n);
  RETURN QUERY SELECT * FROM public.logs_atividade l WHERE public._logs_filtro_ok(l, coalesce(f, '{}'))
    ORDER BY l.ocorrido_em DESC, l.id DESC LIMIT 20000;
END $$;

-- Funções internas não ficam expostas pela API.
REVOKE EXECUTE ON FUNCTION public._log_erro(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._log_inserir(text, text, text, text, text, text, uuid, jsonb, jsonb, text[], text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auditar_linha() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auditar_resumo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auditoria_ligar(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tabelas_sem_auditoria() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.logs_buscar(jsonb, timestamptz, bigint, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.logs_resumo(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.logs_opcoes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.logs_saude() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.exportar_logs(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logs_buscar(jsonb, timestamptz, bigint, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logs_resumo(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.logs_opcoes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.logs_saude() TO authenticated;
GRANT EXECUTE ON FUNCTION public.exportar_logs(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_atividade(text, text, text, text, text, uuid, text, text, jsonb, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Pessoa excluída nunca volta a ser ligada a cupons.
CREATE OR REPLACE FUNCTION public.link_coupon_person(p_user uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid; v_email text; v_name text; v_first text; v_short text; v_count int;
BEGIN
  SELECT id INTO v_id FROM public.coupon_people WHERE user_id = p_user;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user AND deleted_at IS NOT NULL) THEN RETURN NULL; END IF;
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = p_user;
  IF v_email IS NULL THEN RETURN NULL; END IF;
  SELECT public.coupon_match_key(p.name) INTO v_name FROM public.profiles p WHERE p.id = p_user;
  v_first := split_part(coalesce(v_name,''), ' ', 1);
  v_short := CASE WHEN position(' ' IN coalesce(v_name,'')) > 0
    THEN v_first || ' ' || left(regexp_replace(v_name, '^.* ', ''), 1) END;
  FOR i IN 1..3 LOOP
    SELECT count(*), min(c.id::text)::uuid INTO v_count, v_id FROM public.coupon_people c
    WHERE c.user_id IS NULL AND NOT c.link_manual AND (
      (i = 1 AND lower(btrim(c.email)) = v_email)
      OR (i = 2 AND v_name IS NOT NULL AND (public.coupon_match_key(c.name) = v_name
          OR EXISTS (SELECT 1 FROM unnest(c.seller_names) s WHERE public.coupon_match_key(s) = v_name)))
      OR (i = 3 AND v_first <> '' AND public.coupon_match_key(c.name) IN (v_first, coalesce(v_short, v_first)))
    );
    IF v_count = 1 THEN
      UPDATE public.coupon_people SET user_id = p_user WHERE id = v_id;
      RETURN v_id;
    ELSIF v_count > 1 THEN
      RETURN NULL;
    END IF;
  END LOOP;
  RETURN NULL;
END; $function$;

CREATE OR REPLACE FUNCTION public.coupon_people_autolink()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  FOR r IN SELECT p.id FROM public.profiles p
    WHERE p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.coupon_people c WHERE c.user_id = p.id) LOOP
    PERFORM public.link_coupon_person(r.id);
  END LOOP;
  RETURN NULL;
END; $function$;

-- Cadastro de cada tabela do painel (modo, nome legível, evento, campos de controle).
INSERT INTO public.auditoria_tabelas (tabela, modo, prefixo, categoria, tela, coluna_rotulo, coluna_usuario, coluna_evento, coluna_id, ignorados, sensiveis, rotulo_resumo) VALUES
 ('events','linha','evento','evento','Configurações › Eventos','name',NULL,'id','{id}','{}','{}',NULL),
 ('event_batches','linha','lote','evento','Configurações › Lotes','name',NULL,'event_id','{id}','{}','{}',NULL),
 ('event_integrations','linha','evento.integracao','evento','Configurações › Eventos','integration_name',NULL,'event_id','{event_id,integration_name}','{}','{credentials}',NULL),
 ('profiles','linha','usuario','permissao','Configurações › Usuários',NULL,'id',NULL,'{id}','{}','{}',NULL),
 ('user_roles','linha','permissao.papel','permissao','Configurações › Usuários','role','user_id',NULL,'{user_id}','{}','{}',NULL),
 ('event_users','linha','permissao.evento','permissao','Configurações › Usuários',NULL,'user_id','event_id','{user_id}','{}','{}',NULL),
 ('user_event_scope','linha','permissao.escopo','permissao','Configurações › Usuários',NULL,'user_id',NULL,'{user_id}','{updated_at}','{}',NULL),
 ('user_imports','linha','importacao','operacao','Configurações › Eventos','source',NULL,'event_id','{id}','{}','{}',NULL),
 ('integrations','linha','integracao','integracao','Integrações','name',NULL,NULL,'{name}','{last_synced_at,sync_status,error_message,updated_at}','{credentials}',NULL),
 ('goals','linha','meta','operacao','Metas','label',NULL,'event_id','{id}','{updated_at}','{}',NULL),
 ('coupon_people','linha','cupom','operacao','Cupons','name',NULL,NULL,'{id}','{updated_at}','{}',NULL),
 ('team_coupons','linha','cupom.antigo','operacao','Cupons','coupon_code','user_id',NULL,'{user_id,coupon_code}','{}','{}',NULL),
 ('sponsorship_config','linha','patrocinio.config','operacao','Patrocínios',NULL,NULL,'event_id','{event_id}','{updated_at}','{}',NULL),
 ('sponsorship_pending','linha','patrocinio.pendencia','operacao','Patrocínios','ref_key',NULL,'event_id','{id}','{}','{}',NULL),
 ('email_sale_links','linha','config.email_venda','operacao','Marketing','utm_content',NULL,NULL,'{utm_content}','{}','{}',NULL),
 ('app_secrets','linha','config.segredo','dados','Sistema','key',NULL,NULL,'{key}','{}','{value}',NULL),
 ('auditoria_tabelas','linha','config.auditoria','dados','Sistema','tabela',NULL,NULL,'{tabela}','{}','{}',NULL),
 ('ticket_sales','resumo','ingressos','integracao','Comercial',NULL,NULL,NULL,'{id}','{synced_at}','{}','Ingressos (Sympla)'),
 ('ticket_sales_details','resumo','ingressos.detalhes','integracao','Compradores',NULL,NULL,NULL,'{sympla_order_id}','{synced_at}','{}','Dados dos compradores (Sympla)'),
 ('ad_metrics','resumo','anuncios','integracao','Marketing',NULL,NULL,NULL,'{id}','{synced_at}','{}','Métricas de anúncios'),
 ('ga4_events','resumo','site.eventos','integracao','Marketing',NULL,NULL,NULL,'{id}','{synced_at}','{}','Eventos do site (Google Analytics)'),
 ('site_analytics','resumo','site.acessos','integracao','Marketing',NULL,NULL,NULL,'{id}','{synced_at}','{}','Acessos ao site (Google Analytics)'),
 ('email_campaigns','resumo','email.campanhas','integracao','Marketing',NULL,NULL,NULL,'{id}','{synced_at}','{}','Campanhas de e-mail (RD Station)'),
 ('deals','resumo','crm.negocios','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Negócios (Pipedrive)'),
 ('deal_products','resumo','crm.produtos_negocio','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Produtos dos negócios (Pipedrive)'),
 ('deal_installments','resumo','crm.parcelas','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Parcelas (Pipedrive)'),
 ('deal_stage_history','resumo','crm.etapas_historico','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{}','{}','Histórico de etapas (Pipedrive)'),
 ('deal_product_value_history','resumo','crm.valores_historico','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{}','{}','Histórico de valores (Pipedrive)'),
 ('crm_leads','resumo','crm.leads','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Leads (Pipedrive)'),
 ('crm_organizations','resumo','crm.organizacoes','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Organizações (Pipedrive)'),
 ('crm_pipelines','resumo','crm.funis','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Funis (Pipedrive)'),
 ('crm_stages','resumo','crm.etapas','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Etapas (Pipedrive)'),
 ('crm_products','resumo','crm.produtos','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Produtos (Pipedrive)'),
 ('crm_users','resumo','crm.usuarios','integracao','Patrocínios',NULL,NULL,NULL,'{id}','{synced_at}','{}','Usuários do CRM (Pipedrive)'),
 ('crm_sync_state','resumo','crm.sincronizacao','integracao','Integrações',NULL,NULL,NULL,'{crm_account}','{cursors,last_started_at,last_success_at,tokens_used_today,tokens_day}','{}','Controle da sincronização (Pipedrive)'),
 ('event_history','resumo','historico','integracao','Configurações › Eventos',NULL,NULL,NULL,'{id}','{}','{}','Histórico arquivado dos eventos');

SELECT public.auditoria_ligar(tabela) FROM public.auditoria_tabelas;

-- Registro novo aparece ao vivo na tela (só quem lê, o admin, recebe).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_atividade;
  END IF;
END $$;