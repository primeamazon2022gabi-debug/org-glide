CREATE OR REPLACE FUNCTION public.seed_demo_financial_data(p_org_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_stage_lead uuid;
  v_stage_qual uuid;
  v_stage_prop uuid;
  v_stage_doc uuid;
  v_stage_anal uuid;
  v_stage_aprov uuid;
  v_stage_concl uuid;
  v_comp_ids uuid[] := ARRAY[]::uuid[];
  v_cont_ids uuid[] := ARRAY[]::uuid[];
  v_id uuid;
  i int;
  rec RECORD;
  v_inserted_companies int := 0;
  v_inserted_contacts int := 0;
  v_inserted_deals int := 0;
BEGIN
  -- Verifica permissão
  IF NOT public.user_belongs_to_org(p_user_id, p_org_id) THEN
    RAISE EXCEPTION 'Usuário não pertence à organização';
  END IF;

  -- Garante pipeline padrão
  PERFORM public.seed_financial_services_defaults(p_org_id);

  SELECT id INTO v_pipeline_id FROM pipelines
  WHERE org_id = p_org_id ORDER BY is_default DESC, created_at ASC LIMIT 1;

  SELECT id INTO v_stage_lead   FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 0;
  SELECT id INTO v_stage_qual   FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 1;
  SELECT id INTO v_stage_prop   FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 2;
  SELECT id INTO v_stage_doc    FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 3;
  SELECT id INTO v_stage_anal   FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 4;
  SELECT id INTO v_stage_aprov  FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 5;
  SELECT id INTO v_stage_concl  FROM pipeline_stages WHERE pipeline_id = v_pipeline_id AND "order" = 6;

  -- Empresas (idempotente por CNPJ)
  FOR rec IN SELECT * FROM (VALUES
    ('Padaria Estrela ME',         '12.345.678/0001-01', 'MEI',   180000.0,   650, 'Sicoob',          (CURRENT_DATE + 200)::date, 'A1 e-CNPJ'),
    ('TechSoft Soluções LTDA',     '23.456.789/0001-02', 'EPP',   2400000.0,  720, 'Itaú',            (CURRENT_DATE + 90)::date,  'A3 e-CNPJ'),
    ('Construtora Horizonte',      '34.567.890/0001-03', 'Médio', 8500000.0,  680, 'Bradesco',        (CURRENT_DATE + 300)::date, 'A1 e-CNPJ'),
    ('Mercado Bom Preço',          '45.678.901/0001-04', 'ME',    950000.0,   600, 'Caixa',           (CURRENT_DATE + 25)::date,  'A1 e-CPF'),
    ('Auto Peças Veloz',           '56.789.012/0001-05', 'EPP',   1800000.0,  710, 'Santander',       (CURRENT_DATE + 220)::date, 'A3 e-CNPJ'),
    ('Clínica Vida Saudável',      '67.890.123/0001-06', 'ME',    720000.0,   780, 'Banco do Brasil', (CURRENT_DATE + 180)::date, 'A1 e-CNPJ'),
    ('Restaurante Sabor Caseiro',  '78.901.234/0001-07', 'MEI',   240000.0,   590, 'Sicredi',         (CURRENT_DATE + 15)::date,  'A1 e-CPF'),
    ('Indústria Metalmáquina',     '89.012.345/0001-08', 'Grande',32000000.0, 750, 'Itaú',            (CURRENT_DATE + 400)::date, 'A3 e-CNPJ'),
    ('Transportes Rápido SA',      '90.123.456/0001-09', 'Médio', 6200000.0,  690, 'Bradesco',        (CURRENT_DATE + 120)::date, 'A1 e-CNPJ'),
    ('Loja Fashion Moda',          '01.234.567/0001-10', 'EPP',   1500000.0,  640, 'Santander',       (CURRENT_DATE + 70)::date,  'A1 e-CNPJ'),
    ('Farmácia Popular Bairro',    '11.222.333/0001-11', 'ME',    830000.0,   700, 'Caixa',           (CURRENT_DATE + 250)::date, 'A1 e-CPF'),
    ('AgroNegócios do Sul',        '22.333.444/0001-12', 'Médio', 11000000.0, 760, 'Banco do Brasil', (CURRENT_DATE + 320)::date, 'A3 e-CNPJ')
  ) AS t(c_name, c_cnpj, c_porte, c_rev, c_score, c_bank, c_exp, c_cert)
  LOOP
    SELECT id INTO v_id FROM companies WHERE org_id = p_org_id AND cnpj = rec.c_cnpj LIMIT 1;
    IF v_id IS NULL THEN
      INSERT INTO companies (org_id, owner_id, name, cnpj, porte, annual_revenue, credit_score, relationship_bank, certificate_expiry, certificate_type, industry)
      VALUES (p_org_id, p_user_id, rec.c_name, rec.c_cnpj, rec.c_porte, rec.c_rev, rec.c_score, rec.c_bank, rec.c_exp, rec.c_cert, 'Serviços Financeiros')
      RETURNING id INTO v_id;
      v_inserted_companies := v_inserted_companies + 1;
    END IF;
    v_comp_ids := array_append(v_comp_ids, v_id);
  END LOOP;

  -- Contatos (idempotente por email)
  FOR i IN 1..array_length(v_comp_ids, 1) LOOP
    DECLARE v_email text := 'contato' || i || '@empresa' || i || '.com.br';
    BEGIN
      SELECT id INTO v_id FROM contacts WHERE org_id = p_org_id AND email = v_email LIMIT 1;
      IF v_id IS NULL THEN
        INSERT INTO contacts (org_id, owner_id, company_id, first_name, last_name, email, phone, title, status, lead_score)
        VALUES (
          p_org_id, p_user_id, v_comp_ids[i],
          (ARRAY['João','Maria','Carlos','Ana','Pedro','Juliana','Roberto','Fernanda','Lucas','Patricia','Marcos','Camila'])[i],
          (ARRAY['Silva','Santos','Oliveira','Souza','Costa','Pereira','Almeida','Lima','Ferreira','Rodrigues','Martins','Barbosa'])[i],
          v_email,
          '+55 11 9' || lpad((10000000 + i*1234)::text, 8, '0'),
          (ARRAY['Sócio','Diretor Financeiro','CEO','Gerente Administrativo','Proprietário','Sócia-Diretora','CFO','Gerente Financeira','Diretor','Sócia','Gerente','Sócia'])[i],
          (ARRAY['lead','prospect','customer','prospect','customer','lead','prospect','customer','prospect','lead','customer','prospect'])[i]::contact_status,
          40 + (i * 5) % 60
        ) RETURNING id INTO v_id;
        v_inserted_contacts := v_inserted_contacts + 1;
      END IF;
      v_cont_ids := array_append(v_cont_ids, v_id);
    END;
  END LOOP;

  -- Deals (idempotente por title+org)
  FOR rec IN SELECT * FROM (VALUES
    ('Pronampe - Padaria Estrela',     50000,   v_stage_lead,  1,  'pronampe',           50000,   'Pronampe',           36,   6.5, 'Sicoob',          10,  'open', (CURRENT_DATE + 60)::date),
    ('Certificado A1 - Mercado',       350,     v_stage_lead,  4,  'certificado_digital', NULL,   NULL,                 NULL, NULL, NULL,             10,  'open', (CURRENT_DATE + 15)::date),
    ('FAMPE - TechSoft',               150000,  v_stage_qual,  2,  'fampe',              150000,  'FAMPE',              48,   7.2, 'Itaú',            25,  'open', (CURRENT_DATE + 45)::date),
    ('Consulta Crédito - Auto Peças',  500,     v_stage_qual,  5,  'consulta_credito',   NULL,    NULL,                 NULL, NULL, NULL,             25,  'open', (CURRENT_DATE + 10)::date),
    ('BNDES Giro - Construtora',       800000,  v_stage_prop,  3,  'bndes',              800000,  'BNDES Giro',         60,   8.5, 'Bradesco',        40,  'open', (CURRENT_DATE + 90)::date),
    ('Pronampe - Restaurante',         80000,   v_stage_prop,  7,  'pronampe',           80000,   'Pronampe',           36,   6.8, 'Sicredi',         40,  'open', (CURRENT_DATE + 30)::date),
    ('BNDES Investimento - Metalmáquina', 2500000, v_stage_doc, 8, 'bndes',              2500000, 'BNDES Investimento', 84,   7.8, 'Itaú',            55,  'open', (CURRENT_DATE + 75)::date),
    ('FAMPE - Clínica Vida',           120000,  v_stage_doc,   6,  'fampe',              120000,  'FAMPE',              48,   7.0, 'Banco do Brasil', 55,  'open', (CURRENT_DATE + 50)::date),
    ('Pronampe - Transportes Rápido',  600000,  v_stage_anal,  9,  'pronampe',           600000,  'Pronampe',           48,   7.5, 'Bradesco',        70,  'open', (CURRENT_DATE + 40)::date),
    ('BNDES Giro - AgroNegócios',      1500000, v_stage_anal, 12,  'bndes',              1500000, 'BNDES Giro',         60,   8.0, 'Banco do Brasil', 70,  'open', (CURRENT_DATE + 60)::date),
    ('FAMPE - Loja Fashion',           90000,   v_stage_aprov,10,  'fampe',              90000,   'FAMPE',              36,   7.2, 'Santander',       90,  'open', (CURRENT_DATE + 20)::date),
    ('Certificado A3 - Farmácia',      450,     v_stage_aprov,11,  'certificado_digital', NULL,   NULL,                 NULL, NULL, NULL,             90,  'open', (CURRENT_DATE + 7)::date),
    ('Pronampe TechSoft (concluído)',  100000,  v_stage_concl, 2,  'pronampe',           100000,  'Pronampe',           36,   6.5, 'Itaú',            100, 'won',  (CURRENT_DATE - 15)::date),
    ('Certificado Padaria (concluído)',350,     v_stage_concl, 1,  'certificado_digital', NULL,   NULL,                 NULL, NULL, NULL,             100, 'won',  (CURRENT_DATE - 30)::date),
    ('BNDES Construtora (concluído)',  1200000, v_stage_concl, 3,  'bndes',              1200000, 'BNDES Investimento', 72,   8.2, 'Bradesco',        100, 'won',  (CURRENT_DATE - 45)::date)
  ) AS d(d_title, d_value, d_stage, d_idx, d_service, d_req, d_line, d_term, d_rate, d_bank, d_prob, d_status, d_close)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM deals WHERE org_id = p_org_id AND title = rec.d_title) THEN
      INSERT INTO deals (org_id, owner_id, title, value, stage_id, contact_id, company_id, service_type, requested_amount, credit_line, term_months, interest_rate, operating_bank, probability, status, close_date)
      VALUES (p_org_id, p_user_id, rec.d_title, rec.d_value, rec.d_stage, v_cont_ids[rec.d_idx], v_comp_ids[rec.d_idx], rec.d_service::service_type, rec.d_req, rec.d_line, rec.d_term, rec.d_rate, rec.d_bank, rec.d_prob, rec.d_status::deal_status, rec.d_close);
      v_inserted_deals := v_inserted_deals + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'companies', v_inserted_companies,
    'contacts',  v_inserted_contacts,
    'deals',     v_inserted_deals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_financial_data(uuid, uuid) TO authenticated;