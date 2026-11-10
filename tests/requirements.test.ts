import { describe, expect, it } from 'vitest';
import {
  allowedTransitions,
  canTransition,
  canonicalDegree,
  evaluateRequirements,
  isOnboardingSectionComplete,
  onboardingSectionForRequirement,
  onboardingSections,
} from '../lib/requirements';
import type { DemoState } from '../lib/domain';

const state: DemoState = {
  role: 'provider',
  selectedOrganizations: ['northstar', 'evergreen', 'horizon'],
  profile: {
    degree: 'MD',
    licenseState: 'CA',
    licenseNumber: 'A123',
    practiceAddress: '1 Demo St',
    education: 'Demo University',
    graduationYear: '2010',
    malpracticeCarrier: '',
    hospitalAffiliation: '',
    disclosure: '',
  },
  documents: [],
  attested: false,
  cases: [],
  audit: [],
  practitioner: undefined,
};

describe('CertifyOS requirement engine', () => {
  it('maps approved degree equivalents deterministically', () => {
    expect(canonicalDegree('M.D.')).toBe('MD');
    expect(canonicalDegree('Doctor of Medicine')).toBe('MD');
    expect(canonicalDegree('DNP')).toBe('DNP');
  });
  it('deduplicates shared requirements and preserves org-specific gaps', () => {
    const results = evaluateRequirements(state);
    expect(results.filter((r) => r.id === 'degree')).toHaveLength(1);
    expect(
      results.find((r) => r.id === 'degree')?.organizationIds,
    ).toHaveLength(3);
    expect(results.find((r) => r.id === 'hospital')?.satisfied).toBe(false);
    expect(results.find((r) => r.id === 'billing')?.satisfied).toBe(true);
  });

  it('only shows organization-specific onboarding sections when they apply', () => {
    expect(
      onboardingSections({ ...state, selectedOrganizations: ['northstar'] }),
    ).toEqual([
      'Professional details',
      'Education',
      'License',
      'Practice',
      'Documents',
    ]);
    expect(onboardingSections(state)).toEqual(
      expect.arrayContaining(['Affiliations', 'Coverage', 'Disclosures']),
    );
  });

  it('does not reopen submitted organization sections for an incremental application', () => {
    expect(
      onboardingSections({
        ...state,
        submissions: [
          {
            id: 'submission-evergreen',
            organizationId: 'evergreen',
            requirementVersion: 1,
            submittedAt: '2026-11-10T10:00:00.000Z',
            attestedBy: 'Provider',
            profile: { ...state.profile },
            histories: {
              education: [],
              licenses: [],
              practices: [],
              affiliations: [],
            },
            documentIds: [],
          },
        ],
      }),
    ).not.toEqual(
      expect.arrayContaining(['Affiliations', 'Coverage', 'Disclosures']),
    );
  });

  it('routes outstanding actions to their exact onboarding section', () => {
    expect(onboardingSectionForRequirement('Conflicts')).toBe(
      'Resolve conflicts',
    );
    expect(onboardingSectionForRequirement('Licensure')).toBe('License');
    expect(onboardingSectionForRequirement('Affiliations')).toBe(
      'Affiliations',
    );
    expect(onboardingSectionForRequirement('Identity')).toBe(
      'Professional details',
    );
  });

  it('blocks readiness until a detected source conflict is resolved', () => {
    const withConflict: DemoState = {
      ...state,
      dataConflicts: [
        {
          id: 'conflict-1',
          fieldKey: 'practiceAddress',
          label: 'Practice address',
          explanation: 'Sources disagree',
          options: [
            {
              id: 'option-1',
              value: '1 Main St',
              source: 'NPPES',
              retrievedAt: '2026-11-10T10:00:00.000Z',
            },
            {
              id: 'option-2',
              value: '2 Main St',
              source: 'CMS',
              retrievedAt: '2026-11-10T10:00:00.000Z',
            },
          ],
        },
      ],
    };
    expect(
      evaluateRequirements(withConflict).find(
        (requirement) => requirement.id === 'source_conflicts',
      )?.satisfied,
    ).toBe(false);
    withConflict.dataConflicts![0].resolvedAt = '2026-11-10T10:05:00.000Z';
    expect(
      evaluateRequirements(withConflict).find(
        (requirement) => requirement.id === 'source_conflicts',
      )?.satisfied,
    ).toBe(true);
  });

  it('does not mark empty onboarding sections complete', () => {
    expect(isOnboardingSectionComplete(state, 'Affiliations')).toBe(false);
    expect(isOnboardingSectionComplete(state, 'Coverage')).toBe(false);
    expect(isOnboardingSectionComplete(state, 'License')).toBe(true);

    const completed = {
      ...state,
      profile: {
        ...state.profile,
        hospitalAffiliation: 'Mercy General Hospital',
        malpracticeCarrier: 'The Doctors Company',
      },
    };
    expect(isOnboardingSectionComplete(completed, 'Affiliations')).toBe(true);
    expect(isOnboardingSectionComplete(completed, 'Coverage')).toBe(true);
  });
});

describe('credentialing state machine', () => {
  it('allows configured transitions and rejects shortcuts', () => {
    expect(canTransition('submitted', 'intake_review')).toBe(true);
    expect(canTransition('submitted', 'approved')).toBe(false);
    expect(allowedTransitions.approved).toEqual([]);
  });
});
