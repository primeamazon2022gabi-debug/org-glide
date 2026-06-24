import { useAuth } from "@/contexts/AuthContext";
import { DEMO_ORG_ID } from "@/data/demoData";

export function useOrg() {
  const { profile } = useAuth();
  return { orgId: profile?.org_id ?? DEMO_ORG_ID };
}
