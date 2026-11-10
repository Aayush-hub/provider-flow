import { describe, expect, it } from 'vitest';
import { conflictsFromLookup } from '../lib/acquisition';
import {
  normalizePractitioner,
  pendingOrganizationIds,
  submittedOrganizationIds,
  type ManagedPractitioner,
  type PractitionerLookup,
} from '../lib/domain';
import { createIncrementalSubmission } from '../lib/submissions';

const lookup: PractitionerLookup = {
  npi: '1003000126',
  firstName: 'Kellie',
  lastName: 'Aarons',
  credential: 'MD',
  deactivated: false,
  addresses: [
    {
      purpose: 'LOCATION',
      line1: '100 Main St',
      city: 'Boston',
      state: 'MA',
      postalCode: '02110',
    },
  ],
  taxonomies: [],
  nppes: {
    source: 'NPPES NPI Registry',
    status: 'available',
    live: true,
    classification: 'publicly_reported',
    retrievedAt: '2026-11-10T10:00:00.000Z',
    reference: 'nppes-test',
    facts: { factCount: 8 },
  },
  cms: {
    source: 'CMS Doctors and Clinicians',
    status: 'available',
    live: true,
    classification: 'publicly_reported',
    retrievedAt: '2026-11-10T10:01:00.000Z',
    reference: 'cms-test',
    facts: {
      rows: [
        {
          address: '200 Clinic Ave, Boston, MA 02111',
          medicalSchool: 'Example Medical School',
        },
      ],
    },
  },
};

function legacyPractitioner(): ManagedPractitioner {
  return {
    id: 'practitioner-1',
    role: 'provider',
    practitioner: lookup,
    contactEmail: 'provider@example.com',
    caqhId: '',
    selectedOrganizations: ['northstar', 'evergreen'],
    profile: {
      degree: 'MD',
      licenseState: 'MA',
      licenseNumber: '12345',
      practiceAddress: '100 Main St, Boston, MA 02110',
      education: 'Example Medical School',
      graduationYear: '2012',
      malpracticeCarrier: '',
      hospitalAffiliation: '',
      disclosure: '',
    },
    documents: [],
    attested: true,
    submittedAt: '2026-11-10T11:00:00.000Z',
    attestedBy: 'Kellie Aarons',
    cases: [
      {
        id: 'case-1',
        organizationId: 'northstar',
        status: 'submitted',
        events: [
          {
            id: 'event-1',
            label: 'Application submitted',
            at: '2026-11-10T11:00:00.000Z',
            visibleToProvider: true,
          },
        ],
      },
    ],
    audit: [],
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T11:00:00.000Z',
  };
}

describe('provider data acquisition', () => {
  it('creates a provider-review conflict when public sources disagree', () => {
    const conflicts = conflictsFromLookup(lookup);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].fieldKey).toBe('practiceAddress');
    expect(conflicts[0].options).toHaveLength(2);
  });

  it('does not create a conflict when public values match', () => {
    const matching = {
      ...lookup,
      cms: {
        ...lookup.cms,
        facts: {
          rows: [
            {
              address: '100 Main St, Boston, MA 02110',
              medicalSchool: 'Example Medical School',
            },
          ],
        },
      },
    };
    expect(conflictsFromLookup(matching)).toEqual([]);
  });
});

describe('incremental organization submissions', () => {
  it('migrates a legacy submission into an immutable organization snapshot', () => {
    const normalized = normalizePractitioner(legacyPractitioner());
    expect(normalized.submissions).toHaveLength(1);
    expect(normalized.submissions?.[0].organizationId).toBe('northstar');
    expect(normalized.submissions?.[0].profile.degree).toBe('MD');
  });

  it('keeps newly selected organizations pending without reopening old ones', () => {
    const normalized = normalizePractitioner(legacyPractitioner());
    expect(submittedOrganizationIds(normalized)).toEqual(['northstar']);
    expect(pendingOrganizationIds(normalized)).toEqual(['evergreen']);
  });

  it('appends only new organization snapshots and preserves prior snapshots', () => {
    const normalized = normalizePractitioner(legacyPractitioner());
    let sequence = 0;
    const submitted = createIncrementalSubmission(
      normalized,
      '2026-11-10T12:00:00.000Z',
      () => `generated-${++sequence}`,
    );
    expect(submitted.submissions).toHaveLength(2);
    expect(submitted.submissions?.map((item) => item.organizationId)).toEqual([
      'northstar',
      'evergreen',
    ]);
    expect(submitted.cases).toHaveLength(2);
    expect(submitted.attested).toBe(false);
    expect(submitted.attestedBy).toBe('');

    submitted.histories!.education[0].institution = 'Updated later';
    expect(submitted.submissions?.[1].histories.education[0].institution).toBe(
      'Example Medical School',
    );
    expect(normalized.submissions?.[0].organizationId).toBe('northstar');
  });
});
