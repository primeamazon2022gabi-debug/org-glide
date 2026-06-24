CREATE OR REPLACE FUNCTION public.seed_demo_financial_data_auto()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma organização encontrada';
  END IF;

  SELECT id INTO v_user_id FROM profiles WHERE org_id = v_org_id ORDER BY created_at ASC LIMIT 1;
  IF v_user_id IS NULL THEN
    SELECT user_id INTO v_user_id FROM user_roles WHERE org_id = v_org_id LIMIT 1;
  END IF;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado na organização';
  END IF;

  RETURN public.seed_demo_financial_data(v_org_id, v_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_financial_data_auto() TO anon, authenticated;