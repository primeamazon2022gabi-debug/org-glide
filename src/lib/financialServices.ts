// Tipos de serviço financeiro oferecidos
export type ServiceType =
  | "consulta_credito"
  | "certificado_digital"
  | "fampe"
  | "pronampe"
  | "bndes"
  | "outro";

export const SERVICE_TYPES: { value: ServiceType; label: string; color: string }[] = [
  { value: "consulta_credito",   label: "Consulta de Crédito",  color: "#3b82f6" },
  { value: "certificado_digital", label: "Certificado Digital", color: "#a855f7" },
  { value: "fampe",              label: "FAMPE",                 color: "#22c55e" },
  { value: "pronampe",           label: "Pronampe",              color: "#f59e0b" },
  { value: "bndes",              label: "BNDES",                 color: "#ec4899" },
  { value: "outro",              label: "Outro",                 color: "#94a3b8" },
];

export const serviceLabel = (v?: string | null) =>
  SERVICE_TYPES.find((s) => s.value === v)?.label ?? "—";

export const serviceColor = (v?: string | null) =>
  SERVICE_TYPES.find((s) => s.value === v)?.color ?? "#94a3b8";

// Porte da empresa
export const COMPANY_PORTE = ["MEI", "ME", "EPP", "Médio", "Grande"] as const;

// Tipo de certificado digital
export const CERTIFICATE_TYPES = [
  "A1 e-CPF",
  "A1 e-CNPJ",
  "A3 e-CPF",
  "A3 e-CNPJ",
] as const;

// Linhas de crédito comuns
export const CREDIT_LINES = [
  "FAMPE",
  "Pronampe",
  "BNDES Giro",
  "BNDES Investimento",
  "Capital de Giro",
  "Antecipação de Recebíveis",
  "Crédito Consignado",
  "Outro",
] as const;

// Potencial do cliente
export const POTENTIAL_LABELS: Record<string, { label: string; color: string }> = {
  alto:  { label: "Alto potencial",  color: "#22c55e" },
  medio: { label: "Médio potencial", color: "#f59e0b" },
  baixo: { label: "Baixo potencial", color: "#94a3b8" },
};
