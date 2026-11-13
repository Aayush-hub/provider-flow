import type { PractitionerLookup } from './domain';

export const DEMO_DATA_MODE =
  process.env.NEXT_PUBLIC_DEMO_DATA_MODE !== 'false';

export const demoNpis = {
  maya: '1440001000',
  sarah: '1440001018',
  taylor: '1440001026',
  jordan: '1440001034',
  type2: '1440001042',
  noMatch: '1440001059',
} as const;

export function isDemoNpi(value: string) {
  return Object.values(demoNpis).includes(
    value as (typeof demoNpis)[keyof typeof demoNpis],
  );
}

const retrievedAt = '2026-11-01T12:00:00.000Z';
const source = 'CertifyOS fictional demonstration dataset';

function lookup(
  input: Omit<PractitionerLookup, 'nppes' | 'cms'> & {
    cmsRows?: PractitionerLookup['cms']['facts']['rows'];
  },
): PractitionerLookup {
  const { cmsRows = [], ...record } = input;
  return {
    ...record,
    nppes: {
      source,
      status: 'simulated',
      live: false,
      classification: 'publicly_reported',
      retrievedAt,
      reference: 'Fictional record for product demonstration only',
      facts: {
        factCount: 3 + record.addresses.length + record.taxonomies.length,
      },
      warning: 'Simulated data — not verified by NPPES or another authority.',
    },
    cms: {
      source: 'CertifyOS fictional clinician enrichment dataset',
      status: cmsRows.length ? 'simulated' : 'not_found',
      live: false,
      classification: 'publicly_reported',
      retrievedAt,
      reference: 'Fictional record for product demonstration only',
      facts: { rows: cmsRows },
      warning: 'Simulated data — not verified by CMS or another authority.',
    },
  };
}

const records: Record<string, PractitionerLookup> = {
  [demoNpis.maya]: lookup({
    npi: demoNpis.maya,
    firstName: 'Maya',
    lastName: 'Patel',
    credential: 'MD',
    enumerationDate: '2016-07-01',
    lastUpdated: '2026-10-15',
    deactivated: false,
    demoScenario: 'fresh',
    addresses: [
      {
        purpose: 'LOCATION',
        line1: '450 Harbor Avenue, Suite 210',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94107',
      },
    ],
    taxonomies: [
      {
        code: '207R00000X',
        description: 'Internal Medicine',
        primary: true,
        state: 'CA',
        license: 'A123456',
      },
    ],
  }),
  [demoNpis.sarah]: lookup({
    npi: demoNpis.sarah,
    firstName: 'Sarah',
    lastName: 'Lee',
    credential: 'Doctor of Medicine',
    enumerationDate: '2012-06-20',
    lastUpdated: '2026-09-02',
    deactivated: false,
    demoScenario: 'returning',
    addresses: [
      {
        purpose: 'LOCATION',
        line1: '88 Willow Park Drive',
        city: 'Seattle',
        state: 'WA',
        postalCode: '98109',
      },
    ],
    taxonomies: [
      {
        code: '207Q00000X',
        description: 'Family Medicine',
        primary: true,
        state: 'WA',
        license: 'MD60781234',
      },
    ],
    cmsRows: [
      {
        name: 'Willow Family Health',
        specialty: 'Family Medicine',
        address: '88 Willow Park Drive, Seattle, WA 98109',
        medicalSchool: 'Cascade University School of Medicine',
        graduationYear: '2012',
      },
    ],
  }),
  [demoNpis.taylor]: lookup({
    npi: demoNpis.taylor,
    firstName: 'Taylor',
    lastName: 'Reed',
    credential: 'MD',
    enumerationDate: '2015-08-10',
    lastUpdated: '2026-08-22',
    deactivated: false,
    demoScenario: 'conflict',
    addresses: [
      {
        purpose: 'LOCATION',
        line1: '1400 Westlake Boulevard',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
      {
        purpose: 'MAILING',
        line1: 'PO Box 810',
        city: 'Austin',
        state: 'TX',
        postalCode: '78767',
      },
    ],
    taxonomies: [
      {
        code: '207R00000X',
        description: 'Internal Medicine',
        primary: true,
        state: 'TX',
        license: 'T482911',
      },
    ],
    cmsRows: [
      {
        name: 'Capitol Internal Medicine',
        specialty: 'Internal Medicine',
        address: '725 Congress Avenue, Austin, TX 78701',
        medicalSchool: 'Lone Star Medical College',
        graduationYear: '2015',
      },
    ],
  }),
  [demoNpis.jordan]: lookup({
    npi: demoNpis.jordan,
    firstName: 'Jordan',
    lastName: 'Ellis',
    credential: 'Doctor of Medicine',
    enumerationDate: '2010-07-15',
    lastUpdated: '2026-10-01',
    deactivated: false,
    demoScenario: 'complex',
    addresses: [
      {
        purpose: 'LOCATION',
        line1: '920 Lakeshore Drive',
        city: 'Chicago',
        state: 'IL',
        postalCode: '60611',
      },
    ],
    taxonomies: [
      {
        code: '207Q00000X',
        description: 'Family Medicine',
        primary: true,
        state: 'IL',
        license: '036.145820',
      },
      {
        code: '207Q00000X',
        description: 'Family Medicine',
        primary: false,
        state: 'WI',
        license: '78954-20',
      },
    ],
    cmsRows: [
      {
        name: 'Lakeshore Primary Care',
        specialty: 'Family Medicine',
        address: '920 Lakeshore Drive, Chicago, IL 60611',
        medicalSchool: 'Midwest University College of Medicine',
        graduationYear: '2010',
      },
      {
        name: 'Connected Health Telemedicine',
        specialty: 'Telehealth',
        address: '320 North State Street, Chicago, IL 60654',
        medicalSchool: 'Midwest University College of Medicine',
        graduationYear: '2010',
      },
    ],
  }),
};

export function demoLookup(npi: string): PractitionerLookup | undefined {
  const record = records[npi];
  return record ? structuredClone(record) : undefined;
}
