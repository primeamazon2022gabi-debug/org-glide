
-- =====================================================================
-- BAASI CRM - Vertical de Serviços Financeiros
-- =====================================================================

-- 1) ENUM tipo de serviço
DO $$ BEGIN
  CREATE TYPE public.service_type AS ENUM (
    'consulta_credito',
    'certificado_digital',
    'fampe',
    'pronampe',
    'bndes',
    'outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Colunas em COMPANIES (campos do setor)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS porte text,                       -- MEI/ME/EPP/Medio/Grande
  ADD COLUMN IF NOT EXISTS annual_revenue numeric,
  ADD COLUMN IF NOT EXISTS relationship_bank text,
  ADD COLUMN IF NOT EXISTS credit_score integer,
  ADD COLUMN IF NOT EXISTS credit_restrictions text,
  ADD COLUMN IF NOT EXISTS certificate_expiry date,
  ADD COLUMN IF NOT EXISTS certificate_type text,            -- A1/A3 e-CPF/e-CNPJ
  ADD COLUMN IF NOT EXISTS potential_tier text;              -- alto/medio/baixo (calculado)

CREATE INDEX IF NOT EXISTS idx_companies_certificate_expiry
  ON public.companies(certificate_expiry) WHERE certificate_expiry IS NOT NULL;

-- 3) Colunas em DEALS (campos do setor)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS service_type public.service_type,
  ADD COLUMN IF NOT EXISTS requested_amount numeric,
  ADD COLUMN IF NOT EXISTS credit_line text,
  ADD COLUMN IF NOT EXISTS interest_rate numeric,
  ADD COLUMN IF NOT EXISTS term_months integer,
  ADD COLUMN IF NOT EXISTS operating_bank text;

CREATE INDEX IF NOT EXISTS idx_deals_service_type
  ON public.deals(org_id, service_type) WHERE service_type IS NOT NULL;

-- 4) Função: calcular potencial da empresa
CREATE OR REPLACE FUNCTION public.calculate_company_potential(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revenue numeric;
  v_won_deals int;
  v_score numeric := 0;
BEGIN
  SELECT COALESCE(annual_revenue, revenue, 0) INTO v_revenue
  FROM public.companies WHERE id = p_company_id;

  SELECT COUNT(*) INTO v_won_deals
  FROM public.deals
  WHERE company_id = p_company_id AND status = 'won';

  -- Faturamento (peso 60%)
  IF v_revenue >= 10000000 THEN v_score := v_score + 60;
  ELSIF v_revenue >= 2000000 THEN v_score := v_score + 40;
  ELSIF v_revenue >= 360000 THEN v_score := v_score + 20;
  END IF;

  -- Negócios ganhos (peso 40%)
  v_score := v_score + LEAST(v_won_deals * 10, 40);

  IF v_score >= 70 THEN RETURN 'alto';
  ELSIF v_score >= 35 THEN RETURN 'medio';
  ELSE RETURN 'baixo';
  END IF;
END;
$$;

-- 5) Trigger: atualizar potential_tier quando deal muda
CREATE OR REPLACE FUNCTION public.refresh_company_potential()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  v_company_id := COALESCE(NEW.company_id, OLD.company_id);
  IF v_company_id IS NOT NULL THEN
    UPDATE public.companies
    SET potential_tier = public.calculate_company_potential(v_company_id)
    WHERE id = v_company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_refresh_potential ON public.deals;
CREATE TRIGGER trg_deals_refresh_potential
AFTER INSERT OR UPDATE OF status, company_id, value ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.refresh_company_potential();

-- 6) Trigger: cross-sell ao concluir negócio (status -> won)
CREATE OR REPLACE FUNCTION public.create_cross_sell_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.service_type;
  v_already public.service_type[];
  v_missing public.service_type[];
  v_company_name text;
  v_label text;
BEGIN
  -- Apenas dispara quando passa para 'won' e há company_id e service_type
  IF NEW.status <> 'won' OR (OLD.status IS NOT NULL AND OLD.status = 'won') THEN
    RETURN NEW;
  END IF;
  IF NEW.company_id IS NULL THEN RETURN NEW; END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = NEW.company_id;

  -- Serviços já contratados (ganhos) por essa empresa
  SELECT ARRAY_AGG(DISTINCT service_type) INTO v_already
  FROM public.deals
  WHERE company_id = NEW.company_id
    AND status = 'won'
    AND service_type IS NOT NULL;

  -- Serviços faltantes
  v_missing := ARRAY(
    SELECT s::public.service_type
    FROM unnest(ARRAY['consulta_credito','certificado_digital','fampe','pronampe','bndes']) s
    WHERE NOT (s::public.service_type = ANY(COALESCE(v_already, ARRAY[]::public.service_type[])))
  );

  -- Cria uma tarefa para cada serviço faltante (até 3)
  FOREACH v_service IN ARRAY v_missing[1:3]
  LOOP
    v_label := CASE v_service
      WHEN 'consulta_credito' THEN 'Consulta de Crédito'
      WHEN 'certificado_digital' THEN 'Certificado Digital'
      WHEN 'fampe' THEN 'FAMPE'
      WHEN 'pronampe' THEN 'Pronampe'
      WHEN 'bndes' THEN 'BNDES'
      ELSE 'Outro'
    END;

    INSERT INTO public.activities (org_id, type, title, body, due_date, deal_id, company_id, contact_id, user_id)
    VALUES (
      NEW.org_id,
      'task',
      'Cross-sell: oferecer ' || v_label || ' para ' || COALESCE(v_company_name, 'cliente'),
      'Cliente concluiu o serviço "' || NEW.title || '". Avaliar oferta de ' || v_label || '.',
      now() + interval '7 days',
      NULL, NEW.company_id, NEW.contact_id, NEW.owner_id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_cross_sell ON public.deals;
CREATE TRIGGER trg_deals_cross_sell
AFTER UPDATE OF status ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.create_cross_sell_tasks();

-- 7) Função: criar tarefas de renovação de certificado (chamada pelo cron via edge function)
CREATE OR REPLACE FUNCTION public.create_certificate_renewal_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  rec RECORD;
  v_owner uuid;
  v_days_left int;
BEGIN
  FOR rec IN
    SELECT c.id, c.org_id, c.name, c.owner_id, c.certificate_expiry
    FROM public.companies c
    WHERE c.certificate_expiry IS NOT NULL
      AND c.certificate_expiry >= CURRENT_DATE
      AND c.certificate_expiry <= CURRENT_DATE + 30
  LOOP
    v_days_left := rec.certificate_expiry - CURRENT_DATE;
    v_owner := rec.owner_id;

    -- Evita duplicar: só cria se não houver tarefa pendente similar nos últimos 25 dias
    IF NOT EXISTS (
      SELECT 1 FROM public.activities
      WHERE company_id = rec.id
        AND type = 'task'
        AND completed_at IS NULL
        AND title ILIKE 'Renovar certificado%'
        AND created_at > now() - interval '25 days'
    ) THEN
      INSERT INTO public.activities (org_id, type, title, body, due_date, company_id, user_id)
      VALUES (
        rec.org_id,
        'task',
        'Renovar certificado de ' || rec.name,
        'Certificado digital vence em ' || v_days_left || ' dia(s) (' || rec.certificate_expiry || '). Entrar em contato com o cliente.',
        rec.certificate_expiry::timestamptz,
        rec.id,
        v_owner
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- 8) Função de seed: cria pipeline padrão e regras de risco para uma org
CREATE OR REPLACE FUNCTION public.seed_financial_services_defaults(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
BEGIN
  -- Pipeline padrão (só se ainda não existir nenhum)
  IF NOT EXISTS (SELECT 1 FROM public.pipelines WHERE org_id = p_org_id) THEN
    INSERT INTO public.pipelines (org_id, name, is_default, currency)
    VALUES (p_org_id, 'Serviços Financeiros', true, 'BRL')
    RETURNING id INTO v_pipeline_id;

    INSERT INTO public.pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability) VALUES
      (p_org_id, v_pipeline_id, 'Lead',             0, '#94a3b8', 5),
      (p_org_id, v_pipeline_id, 'Qualificação',     1, '#60a5fa', 15),
      (p_org_id, v_pipeline_id, 'Proposta',         2, '#f59e0b', 35),
      (p_org_id, v_pipeline_id, 'Documentação',     3, '#a855f7', 55),
      (p_org_id, v_pipeline_id, 'Análise Bancária', 4, '#ec4899', 75),
      (p_org_id, v_pipeline_id, 'Aprovado',         5, '#22c55e', 90),
      (p_org_id, v_pipeline_id, 'Concluído',        6, '#16a34a', 100);
  END IF;

  -- Regras de risco
  IF NOT EXISTS (SELECT 1 FROM public.risk_rules WHERE org_id = p_org_id) THEN
    INSERT INTO public.risk_rules (org_id, name, metric, threshold_days, risk_level, applies_to, is_active) VALUES
      (p_org_id, 'Cliente sem contato há 60 dias',  'inactivity', 60,  'medium', 'companies', true),
      (p_org_id, 'Cliente sem contato há 120 dias', 'inactivity', 120, 'high',   'companies', true);
  END IF;

  -- Motivos de perda padrão
  IF NOT EXISTS (SELECT 1 FROM public.loss_reasons WHERE org_id = p_org_id) THEN
    INSERT INTO public.loss_reasons (org_id, label) VALUES
      (p_org_id, 'Crédito negado pelo banco'),
      (p_org_id, 'Cliente desistiu'),
      (p_org_id, 'Documentação insuficiente'),
      (p_org_id, 'Optou por concorrente'),
      (p_org_id, 'Sem retorno');
  END IF;
END;
$$;

-- 9) Atualiza handle_new_user para chamar o seed depois de criar a org
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_name text;
  v_is_new_org boolean := false;
BEGIN
  v_user_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (NEW.id, NEW.email, v_user_name, NEW.raw_user_meta_data->>'avatar_url');

  SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, settings)
    VALUES ('Minha Empresa', 'minha-empresa', '{"timezone":"America/Sao_Paulo","currency":"BRL"}'::jsonb)
    RETURNING id INTO v_org_id;
    v_is_new_org := true;

    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, v_org_id, 'owner');
  ELSE
    INSERT INTO public.user_roles (user_id, org_id, role)
    VALUES (NEW.id, v_org_id, 'member');
  END IF;

  UPDATE public.profiles SET org_id = v_org_id WHERE id = NEW.id;

  -- Sempre tenta semear (idempotente)
  PERFORM public.seed_financial_services_defaults(v_org_id);

  RETURN NEW;
END;
$$;
