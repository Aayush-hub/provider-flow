import type { ManagedPractitioner } from './domain';
import type { Requirement } from './requirements';
import { onboardingSectionForRequirement } from './requirements';

export interface NextBestAction {
  label: string;
  detail: string;
  section?: ReturnType<typeof onboardingSectionForRequirement>;
  kind:
    | 'candidate_review'
    | 'career_gap'
    | 'conflict'
    | 'missing_fact'
    | 'missing_document'
    | 'disclosure'
    | 'review';
}

export function nextBestAction(
  practitioner: ManagedPractitioner,
  missing: Requirement[],
): NextBestAction {
  const pendingCandidates = (practitioner.extractedCandidates ?? []).filter(
    (item) => item.status === 'pending',
  );
  if (pendingCandidates.length)
    return {
      label: 'Review the details extracted from your CV.',
      detail: `${pendingCandidates.length} candidate fact${pendingCandidates.length === 1 ? '' : 's'} need your confirmation.`,
      section: 'Documents',
      kind: 'candidate_review',
    };
  const conflict = (practitioner.dataConflicts ?? []).find(
    (item) => !item.resolvedAt,
  );
  if (conflict)
    return {
      label: `Confirm your ${conflict.label.toLowerCase()}.`,
      detail:
        'Two records report different values. You decide which is current.',
      section: 'Resolve conflicts',
      kind: 'conflict',
    };
  const gap = (practitioner.careerGaps ?? []).find((item) => !item.resolvedAt);
  if (gap)
    return {
      label: 'Explain one employment-history gap.',
      detail: 'A short explanation will complete your professional timeline.',
      section: 'Practice',
      kind: 'career_gap',
    };
  const fact = missing.find(
    (item) => !item.documentType && item.category !== 'Disclosures',
  );
  if (fact)
    return {
      label: fact.label,
      detail: 'This required fact is needed before submission.',
      section: onboardingSectionForRequirement(fact.category),
      kind: 'missing_fact',
    };
  const document = missing.find((item) => item.documentType);
  if (document)
    return {
      label: document.label,
      detail: 'Add the supporting document to continue.',
      section: 'Documents',
      kind: 'missing_document',
    };
  const disclosure = missing.find((item) => item.category === 'Disclosures');
  if (disclosure)
    return {
      label: disclosure.label,
      detail: 'This question requires a response from the practitioner.',
      section: 'Disclosures',
      kind: 'disclosure',
    };
  return {
    label: 'Review and submit your application.',
    detail:
      'Everything required is ready for one final review and attestation.',
    kind: 'review',
  };
}

export function acquisitionImpact(
  practitioner: ManagedPractitioner,
  requirements: Requirement[],
) {
  const events = practitioner.acquisitionEvents ?? [],
    provenance = practitioner.factProvenance ?? [],
    unique = (values: string[]) => new Set(values).size,
    reused = unique(
      events
        .filter((event) => event.type === 'record_reuse')
        .flatMap((event) => event.canonicalKeys),
    ),
    imported = unique(
      provenance
        .filter((item) => item.classification === 'demo_imported')
        .map((item) => item.canonicalKey),
    ),
    extracted = unique(
      provenance
        .filter((item) => item.classification === 'document_extracted')
        .map((item) => item.canonicalKey),
    ),
    manual = unique(
      provenance
        .filter((item) => item.classification === 'manual_entry')
        .map((item) => item.canonicalKey),
    ),
    conflictsResolved = (practitioner.dataConflicts ?? []).filter(
      (item) => item.resolvedAt,
    ).length,
    outstanding = new Set(
      requirements
        .filter((item) => !item.satisfied)
        .map((item) => item.canonicalKey ?? item.id),
    ).size,
    duplicateRequestsAvoided = requirements.reduce(
      (count, item) =>
        count +
        (item.satisfied ? Math.max(0, item.organizationIds.length - 1) : 0),
      0,
    ),
    baselineQuestions = requirements.reduce(
      (count, item) => count + Math.max(1, item.organizationIds.length),
      0,
    ),
    satisfiedWithoutNewEntry = requirements.reduce((count, item) => {
      if (!item.satisfied) return count;
      const key = item.canonicalKey ?? item.id;
      const manuallyEntered = provenance.some(
        (fact) =>
          fact.canonicalKey === key && fact.classification === 'manual_entry',
      );
      return (
        count + (manuallyEntered ? 0 : Math.max(1, item.organizationIds.length))
      );
    }, 0);
  return {
    reused,
    imported,
    extracted,
    manual,
    conflictsResolved,
    outstanding,
    duplicateRequestsAvoided,
    baselineQuestions,
    satisfiedWithoutNewEntry,
    remainingProviderQuestions: Math.max(
      0,
      baselineQuestions - satisfiedWithoutNewEntry,
    ),
  };
}
