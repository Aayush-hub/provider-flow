import {
  historiesFor,
  pendingOrganizationIds,
  type ManagedPractitioner,
  type ProviderHistories,
} from './domain';

function cloneHistories(histories: ProviderHistories): ProviderHistories {
  return {
    education: histories.education.map((item) => ({ ...item })),
    licenses: histories.licenses.map((item) => ({ ...item })),
    practices: histories.practices.map((item) => ({ ...item })),
    affiliations: histories.affiliations.map((item) => ({ ...item })),
  };
}

export function createIncrementalSubmission(
  practitioner: ManagedPractitioner,
  submittedAt: string,
  createId: () => string,
): ManagedPractitioner {
  const pendingOrganizations = pendingOrganizationIds(practitioner),
    attestedBy = practitioner.attestedBy?.trim();
  if (!pendingOrganizations.length || !practitioner.attested || !attestedBy) {
    return practitioner;
  }

  const histories = historiesFor(practitioner),
    snapshots = pendingOrganizations.map((organizationId) => ({
      id: createId(),
      organizationId,
      requirementVersion: 1,
      submittedAt,
      attestedBy,
      profile: { ...practitioner.profile },
      histories: cloneHistories(histories),
      documentIds: practitioner.documents.map((document) => document.id),
    })),
    cases = snapshots.map((snapshot) => ({
      id: createId(),
      submissionId: snapshot.id,
      organizationId: snapshot.organizationId,
      status: 'submitted' as const,
      events: [
        {
          id: createId(),
          label: 'Application submitted',
          at: submittedAt,
          visibleToProvider: true,
          note: 'Credentialing simulation ready to begin.',
        },
      ],
    }));

  return {
    ...practitioner,
    submittedAt,
    submissions: [...(practitioner.submissions ?? []), ...snapshots],
    cases: [...practitioner.cases, ...cases],
    attested: false,
    attestedBy: '',
    audit: [
      ...practitioner.audit,
      {
        action: `Submitted immutable application snapshot to ${pendingOrganizations.length} organization${pendingOrganizations.length > 1 ? 's' : ''}`,
        at: submittedAt,
      },
    ],
    updatedAt: submittedAt,
  };
}
