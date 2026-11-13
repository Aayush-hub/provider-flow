import { historiesFor, pendingOrganizationIds, type DemoState } from './domain';
import { degreeMappings } from './field-mappings';

export type OnboardingSection =
  | 'Resolve conflicts'
  | 'Professional details'
  | 'Education'
  | 'License'
  | 'Practice'
  | 'Documents'
  | 'Affiliations'
  | 'Coverage'
  | 'Disclosures';

export function onboardingSectionForRequirement(
  category: string,
): OnboardingSection {
  if (category === 'Conflicts') return 'Resolve conflicts';
  if (category === 'CV Review') return 'Documents';
  if (category === 'Career History') return 'Practice';
  if (category === 'Licensure') return 'License';
  if (category === 'Identity') return 'Professional details';

  const sections: OnboardingSection[] = [
    'Resolve conflicts',
    'Professional details',
    'Education',
    'License',
    'Practice',
    'Documents',
    'Affiliations',
    'Coverage',
    'Disclosures',
  ];
  return sections.includes(category as OnboardingSection)
    ? (category as OnboardingSection)
    : 'Professional details';
}

export function onboardingSections(state: DemoState): OnboardingSection[] {
  const sections: OnboardingSection[] = [
      'Professional details',
      'Education',
      'License',
      'Practice',
      'Documents',
    ],
    pending = pendingOrganizationIds(state),
    activeOrganizations = pending.length
      ? pending
      : state.selectedOrganizations;
  if (state.dataConflicts?.length) sections.unshift('Resolve conflicts');
  if (activeOrganizations.includes('evergreen')) {
    sections.push('Affiliations', 'Coverage', 'Disclosures');
  }
  return sections;
}

export function isOnboardingSectionComplete(
  state: DemoState,
  section: OnboardingSection,
): boolean {
  switch (section) {
    case 'Resolve conflicts':
      return Boolean(
        state.dataConflicts?.length &&
        state.dataConflicts.every((conflict) => conflict.resolvedAt),
      );
    case 'Professional details':
      return Boolean(state.profile.degree);
    case 'Education':
      return (
        historiesFor(state).education.length > 0 &&
        historiesFor(state).education.every(
          (item) => item.institution && item.graduationYear,
        )
      );
    case 'License':
      return (
        historiesFor(state).licenses.length > 0 &&
        historiesFor(state).licenses.every(
          (item) => item.state && item.licenseNumber,
        )
      );
    case 'Practice':
      return (
        historiesFor(state).practices.every((item) => item.address) &&
        historiesFor(state).practices.some((item) => item.current)
      );
    case 'Documents':
      return state.documents.some((document) => document.type === 'license');
    case 'Affiliations':
      return (
        historiesFor(state).affiliations.length > 0 &&
        historiesFor(state).affiliations.every((item) => item.hospital)
      );
    case 'Coverage':
      return Boolean(state.profile.malpracticeCarrier);
    case 'Disclosures':
      return Boolean(state.profile.disclosure);
  }
}

export interface Requirement {
  id: string;
  label: string;
  category: string;
  organizationIds: string[];
  satisfied: boolean;
  field?: keyof DemoState['profile'];
  documentType?: string;
  canonicalKey?: string;
}

export function evaluateRequirements(
  state: DemoState,
  organizationIds = state.selectedOrganizations,
): Requirement[] {
  const selected = organizationIds;
  if (!selected.length) return [];
  const histories = historiesFor(state),
    shared: Requirement[] = [
      {
        id: 'identity',
        label: 'Public identity confirmed',
        category: 'Identity',
        organizationIds: selected,
        satisfied: Boolean(state.practitioner),
        canonicalKey: 'identity.npi',
      },
      {
        id: 'degree',
        label: 'Professional degree',
        category: 'Professional details',
        organizationIds: selected,
        field: 'degree',
        satisfied: Boolean(state.profile.degree),
        canonicalKey: 'professional.degree',
      },
      {
        id: 'education',
        label: 'Medical school and graduation year',
        category: 'Education',
        organizationIds: selected,
        field: 'education',
        satisfied:
          histories.education.length > 0 &&
          histories.education.every(
            (item) => item.institution && item.graduationYear,
          ),
        canonicalKey: 'education.medical_school',
      },
      {
        id: 'license',
        label: 'Active state license',
        category: 'Licensure',
        organizationIds: selected,
        field: 'licenseNumber',
        satisfied:
          histories.licenses.length > 0 &&
          histories.licenses.every((item) => item.state && item.licenseNumber),
        canonicalKey: 'license.active',
      },
      {
        id: 'practice',
        label: 'Primary practice address',
        category: 'Practice',
        organizationIds: selected,
        field: 'practiceAddress',
        satisfied:
          histories.practices.every((item) => item.address) &&
          histories.practices.some((item) => item.current),
        canonicalKey: 'practice.primary_address',
      },
      {
        id: 'license_document',
        label: 'License supporting document',
        category: 'Documents',
        organizationIds: selected,
        documentType: 'license',
        satisfied: state.documents.some((d) => d.type === 'license'),
        canonicalKey: 'document.license',
      },
    ];
  if (
    state.profile.degree &&
    degreeMappings(state.profile.degree, selected).length !== selected.length
  )
    shared.push({
      id: 'degree_mapping_clarification',
      label: 'Confirm how your degree should be represented',
      category: 'Professional details',
      organizationIds: selected,
      satisfied: false,
      canonicalKey: 'professional.degree_mapping',
    });
  if (
    (state.extractedCandidates ?? []).some((item) => item.status === 'pending')
  )
    shared.unshift({
      id: 'cv_candidate_review',
      label: 'Review details extracted from your CV',
      category: 'CV Review',
      organizationIds: selected,
      satisfied: false,
      canonicalKey: 'cv.candidate_review',
    });
  if ((state.careerGaps ?? []).some((item) => !item.resolvedAt))
    shared.unshift({
      id: 'career_gap_explanation',
      label: 'Explain the gap in your professional history',
      category: 'Career History',
      organizationIds: selected,
      satisfied: false,
      canonicalKey: 'career.gap_explanation',
    });
  if (state.dataConflicts?.length) {
    shared.unshift({
      id: 'source_conflicts',
      label: 'Review conflicting source data',
      category: 'Conflicts',
      organizationIds: selected,
      satisfied: state.dataConflicts.every((conflict) => conflict.resolvedAt),
      canonicalKey: 'conflict.required_fact',
    });
  }
  if (selected.includes('evergreen')) {
    shared.push(
      {
        id: 'hospital',
        label: 'Hospital affiliations',
        category: 'Affiliations',
        organizationIds: ['evergreen'],
        field: 'hospitalAffiliation',
        satisfied:
          histories.affiliations.length > 0 &&
          histories.affiliations.every((item) => item.hospital),
        canonicalKey: 'affiliation.hospital',
      },
      {
        id: 'malpractice',
        label: 'Malpractice coverage',
        category: 'Coverage',
        organizationIds: ['evergreen'],
        field: 'malpracticeCarrier',
        satisfied: Boolean(state.profile.malpracticeCarrier),
        canonicalKey: 'coverage.malpractice',
      },
      {
        id: 'disclosure',
        label: 'Evergreen professional disclosure',
        category: 'Disclosures',
        organizationIds: ['evergreen'],
        field: 'disclosure',
        satisfied: Boolean(state.profile.disclosure),
        canonicalKey: 'disclosure.evergreen',
      },
    );
  }
  if (selected.includes('horizon'))
    shared.push({
      id: 'billing',
      label: 'Billing address confirmation',
      category: 'Practice',
      organizationIds: ['horizon'],
      satisfied:
        histories.practices.every((item) => item.address) &&
        histories.practices.some((item) => item.current),
      field: 'practiceAddress',
      canonicalKey: 'practice.billing_address',
    });
  return shared;
}

export function canonicalDegree(value: string): string | null {
  const normalized = value.trim().toLowerCase().replaceAll('.', '');
  if (['md', 'doctor of medicine'].includes(normalized)) return 'MD';
  if (['do', 'doctor of osteopathic medicine'].includes(normalized))
    return 'DO';
  return value.trim() || null;
}

export const allowedTransitions: Record<string, string[]> = {
  submitted: ['intake_review'],
  intake_review: ['information_requested', 'verification'],
  information_requested: ['verification'],
  verification: ['credentialing_review'],
  credentialing_review: ['approved', 'denied'],
  approved: [],
  denied: [],
};

export function canTransition(from: string, to: string) {
  return (allowedTransitions[from] ?? []).includes(to);
}
