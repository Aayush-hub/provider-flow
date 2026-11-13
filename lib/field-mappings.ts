import { organizations } from './domain';

export interface FieldMapping {
  canonicalConcept: string;
  sourceValue: string;
  organizationId: string;
  acceptedValue: string;
  relationship: 'exact' | 'approved_equivalent';
  version: number;
}

const degreeAliases: Record<string, string> = {
  md: 'doctor_of_medicine',
  'm.d.': 'doctor_of_medicine',
  'doctor of medicine': 'doctor_of_medicine',
  do: 'doctor_of_osteopathic_medicine',
  'd.o.': 'doctor_of_osteopathic_medicine',
  'doctor of osteopathic medicine': 'doctor_of_osteopathic_medicine',
  np: 'nurse_practitioner',
  'pa-c': 'physician_assistant_certified',
  dpm: 'doctor_of_podiatric_medicine',
  dds: 'doctor_of_dental_surgery',
  dmd: 'doctor_of_dental_medicine',
  phd: 'doctor_of_philosophy',
  psyd: 'doctor_of_psychology',
};

const acceptedDegreeValues: Record<string, Record<string, string>> = {
  doctor_of_medicine: {
    northstar: 'MD',
    evergreen: 'M.D.',
    horizon: 'Doctor of Medicine',
  },
  doctor_of_osteopathic_medicine: {
    northstar: 'DO',
    evergreen: 'D.O.',
    horizon: 'Doctor of Osteopathic Medicine',
  },
  nurse_practitioner: {
    northstar: 'NP',
    evergreen: 'NP',
    horizon: 'Nurse Practitioner',
  },
  physician_assistant_certified: {
    northstar: 'PA-C',
    evergreen: 'PA-C',
    horizon: 'Certified Physician Assistant',
  },
  doctor_of_podiatric_medicine: {
    northstar: 'DPM',
    evergreen: 'D.P.M.',
    horizon: 'Doctor of Podiatric Medicine',
  },
  doctor_of_dental_surgery: {
    northstar: 'DDS',
    evergreen: 'D.D.S.',
    horizon: 'Doctor of Dental Surgery',
  },
  doctor_of_dental_medicine: {
    northstar: 'DMD',
    evergreen: 'D.M.D.',
    horizon: 'Doctor of Dental Medicine',
  },
  doctor_of_philosophy: {
    northstar: 'PhD',
    evergreen: 'Ph.D.',
    horizon: 'Doctor of Philosophy',
  },
  doctor_of_psychology: {
    northstar: 'PsyD',
    evergreen: 'Psy.D.',
    horizon: 'Doctor of Psychology',
  },
};

export function canonicalDegreeConcept(value: string) {
  return degreeAliases[value.trim().toLowerCase()] ?? null;
}

export function degreeMapping(
  value: string,
  organizationId: string,
): FieldMapping | null {
  const canonicalConcept = canonicalDegreeConcept(value),
    acceptedValue = canonicalConcept
      ? acceptedDegreeValues[canonicalConcept]?.[organizationId]
      : undefined;
  if (!canonicalConcept || !acceptedValue) return null;
  return {
    canonicalConcept,
    sourceValue: value,
    organizationId,
    acceptedValue,
    relationship:
      value.toLowerCase().replaceAll('.', '') ===
      acceptedValue.toLowerCase().replaceAll('.', '')
        ? 'exact'
        : 'approved_equivalent',
    version: 1,
  };
}

export function degreeMappings(value: string, organizationIds: string[]) {
  return organizationIds
    .map((organizationId) => degreeMapping(value, organizationId))
    .filter((mapping): mapping is FieldMapping => Boolean(mapping));
}

export function organizationName(id: string) {
  return (
    organizations.find((organization) => organization.id === id)?.name ?? id
  );
}
