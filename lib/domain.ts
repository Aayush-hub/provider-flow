export type SourceStatus = "available" | "not_found" | "temporarily_unavailable" | "failed" | "simulated";
export type FactClassification = "publicly_reported" | "practitioner_asserted" | "provider_confirmed" | "document_extracted" | "primary_source_verified";

export interface Address { purpose: string; line1: string; line2?: string; city: string; state: string; postalCode: string; phone?: string }
export interface Taxonomy { code: string; description: string; primary: boolean; state?: string; license?: string }
export interface ClinicianAffiliation { name?: string; specialty?: string; address?: string; medicalSchool?: string; graduationYear?: string }
export interface SourceResult<T> { source: string; status: SourceStatus; live: boolean; classification: FactClassification; retrievedAt: string; reference: string; facts: T; warning?: string }
export interface PractitionerLookup {
  npi: string; firstName: string; middleName?: string; lastName: string; suffix?: string; credential?: string;
  enumerationDate?: string; lastUpdated?: string; deactivated: boolean; addresses: Address[]; taxonomies: Taxonomy[];
  nppes: SourceResult<{ factCount: number }>; cms: SourceResult<{ rows: ClinicianAffiliation[] }>;
}

export type CaseStatus = "submitted" | "intake_review" | "information_requested" | "verification" | "credentialing_review" | "approved" | "denied";
export interface TimelineEvent { id: string; label: string; at: string; visibleToProvider: boolean; note?: string }
export interface InformationRequest { id: string; title: string; detail: string; status: "open" | "responded" | "accepted"; responseFile?: string; createdAt: string }
export interface CredentialingCase { id: string; organizationId: string; status: CaseStatus; events: TimelineEvent[]; request?: InformationRequest }

export interface DemoState {
  role: "provider" | "reviewer"; practitioner?: PractitionerLookup; selectedOrganizations: string[];
  profile: { degree: string; licenseState: string; licenseNumber: string; practiceAddress: string; education: string; graduationYear: string; malpracticeCarrier: string; hospitalAffiliation: string; disclosure: string };
  documents: { id: string; name: string; type: string; status: string }[]; attested: boolean; submittedAt?: string; cases: CredentialingCase[]; audit: { action: string; at: string }[];
}

export interface ManagedPractitioner extends DemoState {
  id: string;
  contactEmail: string;
  caqhId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountState {
  authenticated: boolean;
  user: { fullName: string; email: string } | null;
  practitioners: ManagedPractitioner[];
  notifications: string[];
}

export const organizations = [
  { id: "northstar", name: "Northstar Health Network", subtitle: "Core profile + work history", accent: "#287a78" },
  { id: "evergreen", name: "Evergreen Medical Group", subtitle: "Affiliations + malpractice", accent: "#47724d" },
  { id: "horizon", name: "Horizon Care Partners", subtitle: "Billing + conditional history", accent: "#385f83" },
] as const;
