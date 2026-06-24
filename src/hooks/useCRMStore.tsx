// Local CRM data store with localStorage persistence + demo data seeding
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import {
  isDemoMode,
  DEMO_ORG_ID, DEMO_USER_ID, DEMO_PROFILES, DEMO_COMPANIES,
  DEMO_CONTACTS, DEMO_DEALS, DEMO_ACTIVITIES, DEMO_PIPELINES,
  DEMO_STAGES,
} from "@/data/demoData";

const STORAGE_PREFIX = "flowcrm_";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return fallback;
}

function saveToStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {}
}

function generateId() {
  return "local-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

interface CRMStoreContextType {
  orgId: string;
  userId: string;
  contacts: any[];
  companies: any[];
  deals: any[];
  activities: any[];
  pipelines: any[];
  stages: any[];
  profiles: any[];
  // CRUD
  addContact: (c: any) => any;
  updateContact: (id: string, updates: any) => void;
  deleteContact: (id: string) => void;
  addCompany: (c: any) => any;
  updateCompany: (id: string, updates: any) => void;
  deleteCompany: (id: string) => void;
  addDeal: (d: any) => any;
  updateDeal: (id: string, updates: any) => void;
  deleteDeal: (id: string) => void;
  addActivity: (a: any) => any;
  updateActivity: (id: string, updates: any) => void;
  deleteActivity: (id: string) => void;
  addStage: (s: any) => any;
  updateStage: (id: string, updates: any) => void;
  deleteStage: (id: string) => void;
  refreshData: () => void;
}

const CRMStoreContext = createContext<CRMStoreContextType | null>(null);

function getInitialData<T>(key: string, demoData: T[]): T[] {
  const stored = loadFromStorage<T[]>(key, []);
  if (stored.length > 0) return stored;
  if (isDemoMode()) return demoData;
  return [];
}

export function CRMStoreProvider({ children }: { children: ReactNode }) {
  const orgId = DEMO_ORG_ID;
  const userId = DEMO_USER_ID;

  const [contacts, setContacts] = useState(() => getInitialData("contacts", DEMO_CONTACTS));
  const [companies, setCompanies] = useState(() => getInitialData("companies", DEMO_COMPANIES));
  const [deals, setDeals] = useState(() => getInitialData("deals", DEMO_DEALS));
  const [activities, setActivities] = useState(() => getInitialData("activities", DEMO_ACTIVITIES));
  const [pipelines] = useState(() => getInitialData("pipelines", DEMO_PIPELINES));
  const [stages, setStages] = useState(() => getInitialData("stages", DEMO_STAGES));
  const [profiles] = useState(() => getInitialData("profiles", DEMO_PROFILES));

  // Persist on change
  useEffect(() => { saveToStorage("contacts", contacts); }, [contacts]);
  useEffect(() => { saveToStorage("companies", companies); }, [companies]);
  useEffect(() => { saveToStorage("deals", deals); }, [deals]);
  useEffect(() => { saveToStorage("activities", activities); }, [activities]);
  useEffect(() => { saveToStorage("stages", stages); }, [stages]);

  const now = () => new Date().toISOString();

  // Contacts
  const addContact = useCallback((c: any) => {
    const newC = { id: generateId(), org_id: orgId, created_at: now(), updated_at: now(), ...c };
    setContacts((prev) => [newC, ...prev]);
    return newC;
  }, [orgId]);
  const updateContact = useCallback((id: string, updates: any) => {
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, ...updates, updated_at: now() } : c));
  }, []);
  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Companies
  const addCompany = useCallback((c: any) => {
    const newC = { id: generateId(), org_id: orgId, created_at: now(), updated_at: now(), ...c };
    setCompanies((prev) => [newC, ...prev]);
    return newC;
  }, [orgId]);
  const updateCompany = useCallback((id: string, updates: any) => {
    setCompanies((prev) => prev.map((c) => c.id === id ? { ...c, ...updates, updated_at: now() } : c));
  }, []);
  const deleteCompany = useCallback((id: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // Deals
  const addDeal = useCallback((d: any) => {
    const newD = { id: generateId(), org_id: orgId, created_at: now(), updated_at: now(), ...d };
    setDeals((prev) => [newD, ...prev]);
    return newD;
  }, [orgId]);
  const updateDeal = useCallback((id: string, updates: any) => {
    setDeals((prev) => prev.map((d) => d.id === id ? { ...d, ...updates, updated_at: now() } : d));
  }, []);
  const deleteDeal = useCallback((id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id));
  }, []);

  // Activities
  const addActivity = useCallback((a: any) => {
    const newA = { id: generateId(), org_id: orgId, created_at: now(), ...a };
    setActivities((prev) => [newA, ...prev]);
    return newA;
  }, [orgId]);
  const updateActivity = useCallback((id: string, updates: any) => {
    setActivities((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } : a));
  }, []);
  const deleteActivity = useCallback((id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Stages
  const addStage = useCallback((s: any) => {
    const newS = { id: generateId(), org_id: orgId, created_at: now(), ...s };
    setStages((prev) => [...prev, newS]);
    return newS;
  }, [orgId]);
  const updateStage = useCallback((id: string, updates: any) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, ...updates } : s));
  }, []);
  const deleteStage = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const refreshData = useCallback(() => {
    // Re-trigger renders - data is already reactive
  }, []);

  return (
    <CRMStoreContext.Provider value={{
      orgId, userId,
      contacts, companies, deals, activities, pipelines, stages, profiles,
      addContact, updateContact, deleteContact,
      addCompany, updateCompany, deleteCompany,
      addDeal, updateDeal, deleteDeal,
      addActivity, updateActivity, deleteActivity,
      addStage, updateStage, deleteStage,
      refreshData,
    }}>
      {children}
    </CRMStoreContext.Provider>
  );
}

export function useCRMStore() {
  const ctx = useContext(CRMStoreContext);
  if (!ctx) throw new Error("useCRMStore must be used within CRMStoreProvider");
  return ctx;
}
