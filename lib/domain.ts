export type SourceStatus =
  | 'available'
  | 'not_found'
  | 'temporarily_unavailable'
  | 'failed'
  | 'simulated';
export type FactClassification =
  | 'publicly_reported'
  | 'practitioner_asserted'
  | 'provider_confirmed'
  | 'document_extracted'
  | 'primary_source_verified';

export interface Address {
  purpose: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  phone?: string;
}
export interface Taxonomy {
  code: string;
  description: string;
  primary: boolean;
  state?: string;
  license?: string;
}
export interface ClinicianAffiliation {
  name?: string;
  specialty?: string;
  address?: string;
  medicalSchool?: string;
  graduationYear?: string;
}
export interface SourceResult<T> {
  source: string;
  status: SourceStatus;
  live: boolean;
  classification: FactClassification;
  retrievedAt: string;
  reference: string;
  facts: T;
  warning?: string;
}
export interface PractitionerLookup {
  npi: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  credential?: string;
  enumerationDate?: string;
  lastUpdated?: string;
  deactivated: boolean;
  addresses: Address[];
  taxonomies: Taxonomy[];
  nppes: SourceResult<{ factCount: number }>;
  cms: SourceResult<{ rows: ClinicianAffiliation[] }>;
  demoScenario?: 'fresh' | 'returning' | 'conflict' | 'complex' | 'manual';
}

export type ProfileField =
  | 'degree'
  | 'licenseState'
  | 'licenseNumber'
  | 'practiceAddress'
  | 'education'
  | 'graduationYear'
  | 'malpracticeCarrier'
  | 'hospitalAffiliation'
  | 'disclosure';

export interface ConflictOption {
  id: string;
  value: string;
  source: string;
  retrievedAt: string;
}
export interface DataConflict {
  id: string;
  fieldKey: ProfileField;
  label: string;
  explanation: string;
  options: ConflictOption[];
  selectedOptionId?: string;
  resolvedAt?: string;
  canonicalKey?: string;
  context?: string;
  historicalEvidence?: ConflictOption[];
}

export type CandidateStatus = 'pending' | 'accepted' | 'ignored';
export type CandidateKind =
  | 'identity'
  | 'degree'
  | 'education'
  | 'training'
  | 'employment'
  | 'license';
export interface ExtractedCandidate {
  id: string;
  canonicalKey: string;
  kind: CandidateKind;
  label: string;
  value: string;
  status: CandidateStatus;
  confidence: 'high' | 'medium';
  sourceDocumentId: string;
  details?: Record<string, string | boolean>;
}
export interface CareerEntry {
  id: string;
  category: 'employment' | 'residency' | 'fellowship';
  organization: string;
  title: string;
  address: string;
  startDate: string;
  endDate: string;
  current: boolean;
  source: string;
}
export interface CareerGap {
  id: string;
  startDate: string;
  endDate: string;
  explanation?: string;
  resolvedAt?: string;
}
export interface FactProvenance {
  id: string;
  canonicalKey: string;
  value: string;
  source: string;
  classification:
    | 'demo_imported'
    | 'document_extracted'
    | 'manual_entry'
    | 'provider_confirmed';
  recordedAt: string;
  sourceDocumentId?: string;
}
export interface AcquisitionEvent {
  id: string;
  type:
    | 'demo_import'
    | 'document_extraction'
    | 'manual_entry'
    | 'conflict_resolution'
    | 'record_reuse';
  canonicalKeys: string[];
  source: string;
  occurredAt: string;
}

export interface EducationHistory {
  id: string;
  institution: string;
  degree: string;
  graduationYear: string;
}
export interface LicenseHistory {
  id: string;
  state: string;
  licenseNumber: string;
  licenseType: string;
  expirationDate: string;
}
export interface PracticeHistory {
  id: string;
  organization: string;
  address: string;
  startYear: string;
  endYear: string;
  current: boolean;
}
export interface AffiliationHistory {
  id: string;
  hospital: string;
  startYear: string;
  endYear: string;
  current: boolean;
}
export interface ProviderHistories {
  education: EducationHistory[];
  licenses: LicenseHistory[];
  practices: PracticeHistory[];
  affiliations: AffiliationHistory[];
}

export type CaseStatus =
  | 'submitted'
  | 'intake_review'
  | 'information_requested'
  | 'verification'
  | 'credentialing_review'
  | 'approved'
  | 'denied';
export interface TimelineEvent {
  id: string;
  label: string;
  at: string;
  visibleToProvider: boolean;
  note?: string;
}
export interface InformationRequest {
  id: string;
  title: string;
  detail: string;
  status: 'open' | 'responded' | 'accepted';
  responseFile?: string;
  createdAt: string;
}
export interface CredentialingCase {
  id: string;
  organizationId: string;
  submissionId?: string;
  status: CaseStatus;
  events: TimelineEvent[];
  request?: InformationRequest;
}

export interface SubmissionSnapshot {
  id: string;
  organizationId: string;
  requirementVersion: number;
  submittedAt: string;
  attestedBy: string;
  profile: DemoState['profile'];
  histories: ProviderHistories;
  documentIds: string[];
}

export interface DemoState {
  role: 'provider' | 'reviewer';
  practitioner?: PractitionerLookup;
  selectedOrganizations: string[];
  profile: {
    degree: string;
    licenseState: string;
    licenseNumber: string;
    practiceAddress: string;
    education: string;
    graduationYear: string;
    malpracticeCarrier: string;
    hospitalAffiliation: string;
    disclosure: string;
  };
  histories?: ProviderHistories;
  dataConflicts?: DataConflict[];
  extractedCandidates?: ExtractedCandidate[];
  careerTimeline?: CareerEntry[];
  careerGaps?: CareerGap[];
  factProvenance?: FactProvenance[];
  acquisitionEvents?: AcquisitionEvent[];
  submissions?: SubmissionSnapshot[];
  documents: {
    id: string;
    name: string;
    type: string;
    status: string;
    storagePath?: string;
    size?: number;
    extractionStatus?: 'not_requested' | 'pending_review' | 'confirmed';
  }[];
  attested: boolean;
  submittedAt?: string;
  cases: CredentialingCase[];
  audit: { action: string; at: string }[];
}

export interface ManagedPractitioner extends DemoState {
  id: string;
  contactEmail: string;
  caqhId: string;
  attestedBy?: string;
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
  {
    id: 'northstar',
    name: 'Northstar Health Network',
    subtitle: 'Core profile + work history',
    accent: '#287a78',
  },
  {
    id: 'evergreen',
    name: 'Evergreen Medical Group',
    subtitle: 'Affiliations + malpractice',
    accent: '#47724d',
  },
  {
    id: 'horizon',
    name: 'Horizon Care Partners',
    subtitle: 'Billing + conditional history',
    accent: '#385f83',
  },
] as const;

function fallbackHistories(state: DemoState): ProviderHistories {
  return {
    education:
      state.profile.education || state.profile.graduationYear
        ? [
            {
              id: `education-${state.profile.education || 'primary'}`,
              institution: state.profile.education,
              degree: state.profile.degree,
              graduationYear: state.profile.graduationYear,
            },
          ]
        : [],
    licenses:
      state.profile.licenseState || state.profile.licenseNumber
        ? [
            {
              id: `license-${state.profile.licenseNumber || 'primary'}`,
              state: state.profile.licenseState,
              licenseNumber: state.profile.licenseNumber,
              licenseType: state.profile.degree,
              expirationDate: '',
            },
          ]
        : [],
    practices: state.profile.practiceAddress
      ? [
          {
            id: 'practice-primary',
            organization: '',
            address: state.profile.practiceAddress,
            startYear: '',
            endYear: '',
            current: true,
          },
        ]
      : [],
    affiliations: state.profile.hospitalAffiliation
      ? [
          {
            id: 'affiliation-primary',
            hospital: state.profile.hospitalAffiliation,
            startYear: '',
            endYear: '',
            current: true,
          },
        ]
      : [],
  };
}

export function historiesFor(state: DemoState): ProviderHistories {
  return state.histories ?? fallbackHistories(state);
}

export function submittedOrganizationIds(state: DemoState): string[] {
  const ids = new Set(
    (state.submissions ?? []).map((item) => item.organizationId),
  );
  if (!ids.size && state.submittedAt) {
    state.cases.forEach((item) => ids.add(item.organizationId));
  }
  return [...ids];
}

export function pendingOrganizationIds(state: DemoState): string[] {
  const submitted = new Set(submittedOrganizationIds(state));
  return state.selectedOrganizations.filter((id) => !submitted.has(id));
}

export function normalizePractitioner(
  practitioner: ManagedPractitioner,
): ManagedPractitioner {
  const histories = historiesFor(practitioner);
  const submissions =
    practitioner.submissions ??
    (practitioner.submittedAt
      ? practitioner.cases.map((item) => ({
          id: item.submissionId ?? `legacy-${item.id}`,
          organizationId: item.organizationId,
          requirementVersion: 1,
          submittedAt:
            item.events.find((entry) => entry.label.includes('submitted'))
              ?.at ?? practitioner.submittedAt!,
          attestedBy: practitioner.attestedBy ?? 'Provider',
          profile: { ...practitioner.profile },
          histories,
          documentIds: practitioner.documents.map((document) => document.id),
        }))
      : []);
  return {
    ...practitioner,
    histories,
    dataConflicts: practitioner.dataConflicts ?? [],
    extractedCandidates: practitioner.extractedCandidates ?? [],
    careerTimeline: practitioner.careerTimeline ?? [],
    careerGaps: practitioner.careerGaps ?? [],
    factProvenance: practitioner.factProvenance ?? [],
    acquisitionEvents: practitioner.acquisitionEvents ?? [],
    submissions,
  };
}
