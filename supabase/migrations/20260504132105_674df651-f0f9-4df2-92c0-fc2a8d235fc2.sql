DO $$
DECLARE
  v_user_id uuid := 'f8daec27-b0f3-4b72-a761-99e84353a0d7';
  v_org_id uuid;
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
BEGIN
  SELECT org_id INTO v_org_id FROM profiles WHERE id = v_user_id;

  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, slug)
    VALUES ('Demo Financeira', 'demo-financeira-' || substr(md5(random()::text),1,6))
    RETURNING id INTO v_org_id;

    INSERT INTO profiles (id, org_id, email, name, onboarding_completed)
    VALUES (v_user_id, v_org_id, 'demo@flowcrm.app', 'Demo User', true)
    ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id, onboarding_completed = true;

    INSERT INTO user_roles (user_id, org_id, role) VALUES (v_user_id, v_org_id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Pipeline
  SELECT id INTO v_pipeline_id FROM pipelines WHERE org_id = v_org_id AND name = 'Serviços Financeiros' LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    INSERT INTO pipelines (org_id, name, is_default, currency)
    VALUES (v_org_id, 'Serviços Financeiros', true, 'BRL')
    RETURNING id INTO v_pipeline_id;
  END IF;

  -- Limpa stages antigas desse pipeline para repopular limpo
  DELETE FROM pipeline_stages WHERE pipeline_id = v_pipeline_id;

  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Lead', 0, '#94a3b8', 10) RETURNING id INTO v_stage_lead;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Qualificação', 1, '#3b82f6', 25) RETURNING id INTO v_stage_qual;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Proposta', 2, '#a855f7', 40) RETURNING id INTO v_stage_prop;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Documentação', 3, '#f59e0b', 55) RETURNING id INTO v_stage_doc;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Análise Bancária', 4, '#06b6d4', 70) RETURNING id INTO v_stage_anal;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Aprovado', 5, '#22c55e', 90) RETURNING id INTO v_stage_aprov;
  INSERT INTO pipeline_stages (org_id, pipeline_id, name, "order", color, win_probability)
    VALUES (v_org_id, v_pipeline_id, 'Concluído', 6, '#16a34a', 100) RETURNING id INTO v_stage_concl;

  -- Empresas
  FOR rec IN SELECT * FROM (VALUES
    ('Padaria Estrela ME',         '12.345.678/0001-01', 'MEI',   180000.0,   650, 'Sicoob',          '2026-08-15'::date, 'A1 e-CNPJ'),
    ('TechSoft Soluções LTDA',     '23.456.789/0001-02', 'EPP',   2400000.0,  720, 'Itaú',            '2025-12-20'::date, 'A3 e-CNPJ'),
    ('Construtora Horizonte',      '34.567.890/0001-03', 'Médio', 8500000.0,  680, 'Bradesco',        '2026-03-10'::date, 'A1 e-CNPJ'),
    ('Mercado Bom Preço',          '45.678.901/0001-04', 'ME',    950000.0,   600, 'Caixa',           '2025-11-30'::date, 'A1 e-CPF'),
    ('Auto Peças Veloz',           '56.789.012/0001-05', 'EPP',   1800000.0,  710, 'Santander',       '2026-09-05'::date, 'A3 e-CNPJ'),
    ('Clínica Vida Saudável',      '67.890.123/0001-06', 'ME',    720000.0,   780, 'Banco do Brasil', '2026-06-22'::date, 'A1 e-CNPJ'),
    ('Restaurante Sabor Caseiro',  '78.901.234/0001-07', 'MEI',   240000.0,   590, 'Sicredi',         '2025-12-05'::date, 'A1 e-CPF'),
    ('Indústria Metalmáquina',     '89.012.345/0001-08', 'Grande',32000000.0, 750, 'Itaú',            '2027-01-18'::date, 'A3 e-CNPJ'),
    ('Transportes Rápido SA',      '90.123.456/0001-09', 'Médio', 6200000.0,  690, 'Bradesco',        '2026-04-12'::date, 'A1 e-CNPJ'),
    ('Loja Fashion Moda',          '01.234.567/0001-10', 'EPP',   1500000.0,  640, 'Santander',       '2026-02-28'::date, 'A1 e-CNPJ'),
    ('Farmácia Popular Bairro',    '11.222.333/0001-11', 'ME',    830000.0,   700, 'Caixa',           '2026-07-19'::date, 'A1 e-CPF'),
    ('AgroNegócios do Sul',        '22.333.444/0001-12', 'Médio', 11000000.0, 760, 'Banco do Brasil', '2026-10-25'::date, 'A3 e-CNPJ')
  ) AS t(c_name, c_cnpj, c_porte, c_rev, c_score, c_bank, c_exp, c_cert)
  LOOP
    INSERT INTO companies (org_id, owner_id, name, cnpj, porte, annual_revenue, credit_score, relationship_bank, certificate_expiry, certificate_type, industry)
    VALUES (v_org_id, v_user_id, rec.c_name, rec.c_cnpj, rec.c_porte, rec.c_rev, rec.c_score, rec.c_bank, rec.c_exp, rec.c_cert, 'Serviços Financeiros')
    RETURNING id INTO v_id;
    v_comp_ids := array_append(v_comp_ids, v_id);
  END LOOP;

  -- Contatos
  FOR i IN 1..array_length(v_comp_ids, 1) LOOP
    INSERT INTO contacts (org_id, owner_id, company_id, first_name, last_name, email, phone, title, status, lead_score)
    VALUES (
      v_org_id, v_user_id, v_comp_ids[i],
      (ARRAY['João','Maria','Carlos','Ana','Pedro','Juliana','Roberto','Fernanda','Lucas','Patricia','Marcos','Camila'])[i],
      (ARRAY['Silva','Santos','Oliveira','Souza','Costa','Pereira','Almeida','Lima','Ferreira','Rodrigues','Martins','Barbosa'])[i],
      'contato' || i || '@empresa' || i || '.com.br',
      '+55 11 9' || lpad((10000000 + i*1234)::text, 8, '0'),
      (ARRAY['Sócio','Diretor Financeiro','CEO','Gerente Administrativo','Proprietário','Sócia-Diretora','CFO','Gerente Financeira','Diretor','Sócia','Gerente','Sócia'])[i],
      (ARRAY['lead','prospect','customer','prospect','customer','lead','prospect','customer','prospect','lead','customer','prospect'])[i]::contact_status,
      40 + (i * 5) % 60
    ) RETURNING id INTO v_id;
    v_cont_ids := array_append(v_cont_ids, v_id);
  END LOOP;

  -- Deals
  INSERT INTO deals (org_id, owner_id, title, value, stage_id, contact_id, company_id, service_type, requested_amount, credit_line, term_months, interest_rate, operating_bank, probability, status, close_date) VALUES
  (v_org_id, v_user_id, 'Pronampe - Padaria Estrela',     50000,  v_stage_lead, v_cont_ids[1], v_comp_ids[1], 'pronampe', 50000, 'Pronampe', 36, 6.5, 'Sicoob', 10, 'open', CURRENT_DATE + 60),
  (v_org_id, v_user_id, 'Certificado A1 - Mercado',       350,    v_stage_lead, v_cont_ids[4], v_comp_ids[4], 'certificado_digital', NULL, NULL, NULL, NULL, NULL, 10, 'open', CURRENT_DATE + 15),
  (v_org_id, v_user_id, 'FAMPE - TechSoft',               150000, v_stage_qual, v_cont_ids[2], v_comp_ids[2], 'fampe', 150000, 'FAMPE', 48, 7.2, 'Itaú', 25, 'open', CURRENT_DATE + 45),
  (v_org_id, v_user_id, 'Consulta Crédito - Auto Peças',  500,    v_stage_qual, v_cont_ids[5], v_comp_ids[5], 'consulta_credito', NULL, NULL, NULL, NULL, NULL, 25, 'open', CURRENT_DATE + 10),
  (v_org_id, v_user_id, 'BNDES Giro - Construtora',       800000, v_stage_prop, v_cont_ids[3], v_comp_ids[3], 'bndes', 800000, 'BNDES Giro', 60, 8.5, 'Bradesco', 40, 'open', CURRENT_DATE + 90),
  (v_org_id, v_user_id, 'Pronampe - Restaurante',         80000,  v_stage_prop, v_cont_ids[7], v_comp_ids[7], 'pronampe', 80000, 'Pronampe', 36, 6.8, 'Sicredi', 40, 'open', CURRENT_DATE + 30),
  (v_org_id, v_user_id, 'BNDES Investimento - Metalmáquina', 2500000, v_stage_doc, v_cont_ids[8], v_comp_ids[8], 'bndes', 2500000, 'BNDES Investimento', 84, 7.8, 'Itaú', 55, 'open', CURRENT_DATE + 75),
  (v_org_id, v_user_id, 'FAMPE - Clínica Vida',           120000, v_stage_doc, v_cont_ids[6], v_comp_ids[6], 'fampe', 120000, 'FAMPE', 48, 7.0, 'Banco do Brasil', 55, 'open', CURRENT_DATE + 50),
  (v_org_id, v_user_id, 'Pronampe - Transportes Rápido',  600000, v_stage_anal, v_cont_ids[9], v_comp_ids[9], 'pronampe', 600000, 'Pronampe', 48, 7.5, 'Bradesco', 70, 'open', CURRENT_DATE + 40),
  (v_org_id, v_user_id, 'BNDES Giro - AgroNegócios',      1500000, v_stage_anal, v_cont_ids[12], v_comp_ids[12], 'bndes', 1500000, 'BNDES Giro', 60, 8.0, 'Banco do Brasil', 70, 'open', CURRENT_DATE + 60),
  (v_org_id, v_user_id, 'FAMPE - Loja Fashion',           90000,  v_stage_aprov, v_cont_ids[10], v_comp_ids[10], 'fampe', 90000, 'FAMPE', 36, 7.2, 'Santander', 90, 'open', CURRENT_DATE + 20),
  (v_org_id, v_user_id, 'Certificado A3 - Farmácia',      450,    v_stage_aprov, v_cont_ids[11], v_comp_ids[11], 'certificado_digital', NULL, NULL, NULL, NULL, NULL, 90, 'open', CURRENT_DATE + 7),
  (v_org_id, v_user_id, 'Pronampe - TechSoft (concluído)', 100000, v_stage_concl, v_cont_ids[2], v_comp_ids[2], 'pronampe', 100000, 'Pronampe', 36, 6.5, 'Itaú', 100, 'won', CURRENT_DATE - 15),
  (v_org_id, v_user_id, 'Certificado - Padaria',          350,    v_stage_concl, v_cont_ids[1], v_comp_ids[1], 'certificado_digital', NULL, NULL, NULL, NULL, NULL, 100, 'won', CURRENT_DATE - 30),
  (v_org_id, v_user_id, 'BNDES - Construtora (concluído)', 1200000, v_stage_concl, v_cont_ids[3], v_comp_ids[3], 'bndes', 1200000, 'BNDES Investimento', 72, 8.2, 'Bradesco', 100, 'won', CURRENT_DATE - 45);

  -- Activities
  INSERT INTO activities (org_id, user_id, type, title, body, deal_id, contact_id, company_id, completed_at)
  SELECT v_org_id, v_user_id, 'note'::activity_type,
         'Primeiro contato realizado',
         'Cliente demonstrou interesse na linha de crédito.',
         d.id, d.contact_id, d.company_id, now() - (random()*interval '10 days')
  FROM deals d WHERE d.org_id = v_org_id LIMIT 8;

END $$;