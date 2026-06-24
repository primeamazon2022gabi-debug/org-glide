import { createContext, useContext, useState, ReactNode } from "react";
import { DEMO_USER_ID, DEMO_ORG_ID } from "@/data/demoData";

interface FakeUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: FakeUser | null;
  session: any;
  profile: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<FakeUser>({
    id: DEMO_USER_ID,
    email: "usuario@flowcrm.app",
  });

  const [profile] = useState({
    id: DEMO_USER_ID,
    name: "Usuário",
    email: "usuario@flowcrm.app",
    org_id: DEMO_ORG_ID,
    avatar_url: null,
    title: "Gerente",
    timezone: "America/Sao_Paulo",
    onboarding_completed: true,
    onboarding_step: 7,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const signOut = async () => {
    // No-op in local mode
  };

  const refreshProfile = async () => {
    // No-op in local mode
  };

  return (
    <AuthContext.Provider value={{ user, session: {}, profile, loading: false, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
