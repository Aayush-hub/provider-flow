import { describe, expect, it } from 'vitest';
import { ownsPrivateDocumentPath } from '../lib/access';
import { nextBestAction } from '../lib/acquisition-insights';
import { detectCareerGaps } from '../lib/career';
import { extractCvCandidates } from '../lib/cv-extraction';
import { demoLookup, demoNpis } from '../lib/demo-data';
import { degreeMapping } from '../lib/field-mappings';
import {
  normalizePractitioner,
  type CareerEntry,
  type ManagedPractitioner,
} from '../lib/domain';
import { evaluateRequirements } from '../lib/requirements';

const mayaCv = `
Maya Patel, MD

EDUCATION
Pacific Crest University School of Medicine
Doctor of Medicine, 2016

POSTGRADUATE TRAINING
Internal Medicine Residency, Bayview Medical Center | 07/2016 - 06/2019

PROFESSIONAL EXPERIENCE
Attending Physician, Lakeside Internal Medicine | 07/2019 - 12/2021
100 Oak Street, San Francisco, CA 94102
Staff Physician, Harborview Primary Care | 08/2022 - Present
450 Harbor Avenue, San Francisco, CA 94107

LICENSES
California Medical License A123456
`;

function practitioner(): ManagedPractitioner {
  const lookup = demoLookup(demoNpis.maya)!;
  return normalizePractitioner({
    id: 'p1',
    role: 'provider',
    practitioner: lookup,
    contactEmail: 'maya@example.test',
    caqhId: '',
    selectedOrganizations: ['northstar', 'evergreen', 'horizon'],
    profile: {
      degree: 'MD',
      licenseState: 'CA',
      licenseNumber: 'A123456',
      practiceAddress: '450 Harbor Avenue, San Francisco, CA 94107',
      education: 'Pacific Crest University School of Medicine',
      graduationYear: '2016',
      malpracticeCarrier: 'MedPro Group',
      hospitalAffiliation: 'Northstar Community Hospital',
      disclosure: 'No — no reportable events',
    },
    histories: {
      education: [
        {
          id: 'e1',
          institution: 'Pacific Crest University School of Medicine',
          degree: 'MD',
          graduationYear: '2016',
        },
      ],
      licenses: [
        {
          id: 'l1',
          state: 'CA',
          licenseNumber: 'A123456',
          licenseType: 'MD',
          expirationDate: '',
        },
      ],
      practices: [
        {
          id: 'pr1',
          organization: 'Harborview Primary Care',
          address: '450 Harbor Avenue, San Francisco, CA 94107',
          startYear: '2022',
          endYear: '',
          current: true,
        },
      ],
      affiliations: [
        {
          id: 'a1',
          hospital: 'Northstar Community Hospital',
          startYear: '2022',
          endYear: '',
          current: true,
        },
      ],
    },
    documents: [
      { id: 'd1', name: 'license.pdf', type: 'license', status: 'supplied' },
    ],
    attested: false,
    cases: [],
    audit: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

describe('deterministic CV extraction', () => {
  it('extracts Maya Patel degree, school, residency, two jobs, and license', () => {
    const result = extractCvCandidates(mayaCv, 'maya-cv');
    expect(
      result.candidates.some(
        (item) => item.kind === 'degree' && item.value === 'MD',
      ),
    ).toBe(true);
    expect(
      result.candidates.some(
        (item) =>
          item.kind === 'education' && item.value.includes('Pacific Crest'),
      ),
    ).toBe(true);
    expect(
      result.candidates.filter((item) => item.kind === 'training'),
    ).toHaveLength(1);
    expect(
      result.candidates.filter((item) => item.kind === 'employment'),
    ).toHaveLength(2);
    expect(
      result.candidates.some(
        (item) => item.kind === 'license' && item.value === 'A123456',
      ),
    ).toBe(true);
  });
});

describe('career gap detection', () => {
  it('finds Maya Patel’s January through August 2022 gap', () => {
    const entries: CareerEntry[] = [
      {
        id: '1',
        category: 'employment',
        organization: 'A',
        title: 'Physician',
        address: '',
        startDate: '2019-07',
        endDate: '2021-12',
        current: false,
        source: 'test',
      },
      {
        id: '2',
        category: 'employment',
        organization: 'B',
        title: 'Physician',
        address: '',
        startDate: '2022-08',
        endDate: '',
        current: true,
        source: 'test',
      },
    ];
    expect(detectCareerGaps(entries)).toEqual([
      expect.objectContaining({ startDate: '2022-01', endDate: '2022-08' }),
    ]);
  });

  it('supports overlapping clinic and telehealth work without a false gap', () => {
    const entries: CareerEntry[] = [
      {
        id: '1',
        category: 'employment',
        organization: 'Clinic',
        title: 'Physician',
        address: '',
        startDate: '2020-01',
        endDate: '',
        current: true,
        source: 'test',
      },
      {
        id: '2',
        category: 'employment',
        organization: 'Telehealth',
        title: 'Physician',
        address: '',
        startDate: '2021-06',
        endDate: '',
        current: true,
        source: 'test',
      },
    ];
    expect(detectCareerGaps(entries)).toEqual([]);
  });
});

describe('canonical mapping and recalculation', () => {
  it('maps one MD fact into all organization representations', () => {
    expect(
      degreeMapping('Doctor of Medicine', 'northstar')?.acceptedValue,
    ).toBe('MD');
    expect(degreeMapping('MD', 'evergreen')?.acceptedValue).toBe('M.D.');
    expect(degreeMapping('M.D.', 'horizon')?.acceptedValue).toBe(
      'Doctor of Medicine',
    );
    const degree = evaluateRequirements(practitioner()).find(
      (item) => item.id === 'degree',
    );
    expect(degree?.satisfied).toBe(true);
  });

  it('adds and removes candidate-review and career-gap blockers deterministically', () => {
    const base = practitioner(),
      pending = {
        ...base,
        extractedCandidates: [
          {
            id: 'c1',
            canonicalKey: 'professional.degree',
            kind: 'degree' as const,
            label: 'Degree',
            value: 'MD',
            status: 'pending' as const,
            confidence: 'high' as const,
            sourceDocumentId: 'd1',
          },
        ],
      },
      withGap = {
        ...base,
        careerGaps: [{ id: 'g1', startDate: '2022-01', endDate: '2022-08' }],
      };
    expect(
      evaluateRequirements(pending).some(
        (item) => item.id === 'cv_candidate_review' && !item.satisfied,
      ),
    ).toBe(true);
    expect(
      evaluateRequirements(withGap).some(
        (item) => item.id === 'career_gap_explanation' && !item.satisfied,
      ),
    ).toBe(true);
    expect(
      evaluateRequirements({
        ...withGap,
        careerGaps: [
          {
            ...withGap.careerGaps![0],
            explanation: 'Leave',
            resolvedAt: '2026-01-01',
          },
        ],
      }).some((item) => item.id === 'career_gap_explanation'),
    ).toBe(false);
  });
});

describe('next action and authorization', () => {
  it('prioritizes CV review over other application gaps', () => {
    const p = practitioner();
    p.extractedCandidates = [
      {
        id: 'c1',
        canonicalKey: 'professional.degree',
        kind: 'degree',
        label: 'Degree',
        value: 'MD',
        status: 'pending',
        confidence: 'high',
        sourceDocumentId: 'd1',
      },
    ];
    expect(
      nextBestAction(
        p,
        evaluateRequirements(p).filter((item) => !item.satisfied),
      ).kind,
    ).toBe('candidate_review');
  });

  it('allows document deletion only inside the authenticated user and practitioner prefix', () => {
    expect(
      ownsPrivateDocumentPath(
        'user-1',
        'p-1',
        'users/user-1/documents/p-1/a.pdf',
      ),
    ).toBe(true);
    expect(
      ownsPrivateDocumentPath(
        'user-1',
        'p-1',
        'users/user-2/documents/p-1/a.pdf',
      ),
    ).toBe(false);
    expect(
      ownsPrivateDocumentPath(
        'user-1',
        'p-1',
        'users/user-1/documents/p-2/a.pdf',
      ),
    ).toBe(false);
  });
});
