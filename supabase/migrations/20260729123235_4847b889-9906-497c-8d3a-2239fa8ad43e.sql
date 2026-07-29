
-- 1. integration_configs: restrict to admin/owner
DROP POLICY IF EXISTS "Org members can manage integrations" ON public.integration_configs;
CREATE POLICY "Admins can view integrations" ON public.integration_configs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'));
CREATE POLICY "Admins can modify integrations" ON public.integration_configs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'));

-- 2. org_secrets: explicit deny for non-service-role (defense in depth)
-- RLS already blocks all — add an explicit admin-only policy just in case future policies are added.
-- (No policy created; keep default deny. Service role bypasses RLS.)

-- 3. profiles: remove org_id IS NULL branch
DROP POLICY IF EXISTS "Users can view profiles in own org" ON public.profiles;
CREATE POLICY "Users can view profiles in own org" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (org_id IS NOT NULL AND public.user_belongs_to_org(auth.uid(), org_id)));

-- 4. webhooks: restrict to admin/owner (they contain signing secrets)
DROP POLICY IF EXISTS "Org members can manage webhooks" ON public.webhooks;
CREATE POLICY "Admins can view webhooks" ON public.webhooks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'));
CREATE POLICY "Admins can modify webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'))
  WITH CHECK (public.has_role(auth.uid(), org_id, 'admin') OR public.has_role(auth.uid(), org_id, 'owner'));

-- 5. whatsapp_instances: drop plaintext api_key column (secrets live in whatsapp_instance_secrets)
ALTER TABLE public.whatsapp_instances DROP COLUMN IF EXISTS api_key;

-- 6. whatsapp-media storage
DROP POLICY IF EXISTS "Public can read whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload whatsapp media" ON storage.objects;
CREATE POLICY "Org members can upload whatsapp media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'whatsapp-media'
    AND public.user_belongs_to_org(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 7. tracking_events: replace with_check true with org scope
DROP POLICY IF EXISTS "Public can insert tracking events" ON public.tracking_events;
CREATE POLICY "Org members can insert tracking events" ON public.tracking_events
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_org(auth.uid(), org_id));

-- 8. Revoke EXECUTE on SECURITY DEFINER functions from anon/public; keep authenticated where needed.
REVOKE EXECUTE ON FUNCTION public.calculate_company_potential(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_certificate_renewal_tasks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_cross_sell_tasks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization_for_user(uuid, text, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.initialize_org_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_invitation_accepted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_company_potential() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_financial_data(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_financial_data_auto() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_financial_services_defaults(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_belongs_to_org(uuid, uuid) FROM PUBLIC, anon;
