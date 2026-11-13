import type { DataConflict, PractitionerLookup, ProfileField } from './domain';

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function makeConflict(
  id: string,
  fieldKey: ProfileField,
  label: string,
  explanation: string,
  values: { value?: string; source: string; retrievedAt: string }[],
  canonicalKey?: string,
  context?: string,
): DataConflict | null {
  const unique = values
    .filter(
      (item): item is { value: string; source: string; retrievedAt: string } =>
        Boolean(item.value?.trim()),
    )
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) => normalized(candidate.value) === normalized(item.value),
        ) === index,
    );
  if (unique.length < 2) return null;
  return {
    id,
    fieldKey,
    label,
    explanation,
    canonicalKey,
    context,
    options: unique.map((item, index) => ({
      id: `${id}-${index + 1}`,
      ...item,
    })),
  };
}

export function conflictsFromLookup(
  lookup: PractitionerLookup,
): DataConflict[] {
  const location = lookup.addresses.find(
      (address) => address.purpose === 'LOCATION',
    ),
    nppesAddress = location
      ? `${location.line1}, ${location.city}, ${location.state} ${location.postalCode}`
      : '',
    cmsRows = lookup.cms.facts.rows,
    conflicts = [
      makeConflict(
        'practice-address-source-conflict',
        'practiceAddress',
        'Primary practice address',
        'The available demonstration records report different addresses. Choose the address that is current.',
        [
          {
            value: nppesAddress,
            source: lookup.nppes.source,
            retrievedAt: lookup.nppes.retrievedAt,
          },
          ...cmsRows.map((row) => ({
            value: row.address,
            source: lookup.cms.source,
            retrievedAt: lookup.cms.retrievedAt,
          })),
        ],
        'practice.primary_address',
        'primary_practice',
      ),
      makeConflict(
        'education-source-conflict',
        'education',
        'Medical school',
        'The acquired CMS records contain different education values. Select the correct institution.',
        cmsRows.map((row) => ({
          value: row.medicalSchool,
          source: lookup.cms.source,
          retrievedAt: lookup.cms.retrievedAt,
        })),
        'education.medical_school',
        'medical_education',
      ),
    ];
  return conflicts.filter((item): item is DataConflict => Boolean(item));
}
