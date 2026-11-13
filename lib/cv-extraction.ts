import type { ExtractedCandidate } from './domain';

export interface CvExtractionResult {
  candidates: ExtractedCandidate[];
  warnings: string[];
}

const monthNumbers: Record<string, string> = {
  jan: '01',
  january: '01',
  feb: '02',
  february: '02',
  mar: '03',
  march: '03',
  apr: '04',
  april: '04',
  may: '05',
  jun: '06',
  june: '06',
  jul: '07',
  july: '07',
  aug: '08',
  august: '08',
  sep: '09',
  sept: '09',
  september: '09',
  oct: '10',
  october: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function normalizeDate(value: string) {
  const cleaned = value.trim().toLowerCase();
  if (/^(present|current|now)$/.test(cleaned)) return '';
  const numeric = cleaned.match(/(\d{1,2})[/-](\d{4})/);
  if (numeric) return `${numeric[2]}-${numeric[1].padStart(2, '0')}`;
  const named = cleaned.match(/([a-z]+)\.?\s+(\d{4})/);
  if (named && monthNumbers[named[1]])
    return `${named[2]}-${monthNumbers[named[1]]}`;
  const year = cleaned.match(/\b(19|20)\d{2}\b/);
  return year ? `${year[0]}-01` : '';
}

export function parseDateRange(line: string) {
  const range = line.match(
    /((?:[A-Za-z]+\.?\s+)?(?:\d{1,2}[/-])?\d{4})\s*(?:-|–|—|to)\s*(Present|Current|Now|(?:[A-Za-z]+\.?\s+)?(?:\d{1,2}[/-])?\d{4})/i,
  );
  if (!range) return null;
  const current = /present|current|now/i.test(range[2]);
  return {
    startDate: normalizeDate(range[1]),
    endDate: current ? '' : normalizeDate(range[2]),
    current,
    raw: range[0],
  };
}

function candidate(
  index: number,
  input: Omit<ExtractedCandidate, 'id' | 'status' | 'sourceDocumentId'>,
  sourceDocumentId: string,
): ExtractedCandidate {
  return {
    id: `cv-${sourceDocumentId}-${index}`,
    status: 'pending',
    sourceDocumentId,
    ...input,
  };
}

function sectionFor(line: string) {
  const normalized = line
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .trim();
  if (/^(education|academic background)$/.test(normalized)) return 'education';
  if (
    /^(postgraduate training|training|residency|fellowship)$/.test(normalized)
  )
    return 'training';
  if (
    /^(professional experience|employment|work experience|experience)$/.test(normalized)
  )
    return 'employment';
  if (
    /^(licenses|licensure|medical licenses|professional licensure)$/.test(
      normalized,
    )
  )
    return 'license';
  if (/^(practice locations|practice location)$/.test(normalized))
    return 'practice';
  if (
    /^(professional summary|additional information|document status)$/.test(
      normalized,
    )
  )
    return 'other';
  return null;
}

export function extractCvCandidates(
  rawText: string,
  sourceDocumentId: string,
): CvExtractionResult {
  const lines = rawText
    .replaceAll('\u00a0', ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const candidates: ExtractedCandidate[] = [];
  const warnings: string[] = [];
  let section = '';
  let index = 0;

  const nameLine = lines.slice(0, 8).find(
    (line) =>
      /(?:,|\s)(?:M\.?D\.?|D\.?O\.?)\b/i.test(line) ||
      /^(?:Dr\.?\s+)?[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3}$/.test(
        line,
      ),
  );
  if (nameLine) {
    const name = nameLine
      .replace(/^Dr\.?\s+/i, '')
      .replace(/,?\s+(?:M\.?D\.?|D\.?O\.?).*$/i, '')
      .trim();
    if (name.split(' ').length >= 2) {
      candidates.push(
        candidate(
          index++,
          {
            canonicalKey: 'identity.name',
            kind: 'identity',
            label: 'Practitioner name',
            value: name,
            confidence: 'high',
          },
          sourceDocumentId,
        ),
      );
    }
  }

  const degreeMatch = rawText.match(
    /\b(M\.?D\.?|Doctor of Medicine|D\.?O\.?|Doctor of Osteopathic Medicine)\b/i,
  );
  if (degreeMatch) {
    const isOsteopathic = /osteopathic|\bD\.?O\.?\b/i.test(degreeMatch[0]);
    candidates.push(
      candidate(
        index++,
        {
          canonicalKey: 'professional.degree',
          kind: 'degree',
          label: 'Professional degree',
          value: isOsteopathic ? 'DO' : 'MD',
          confidence: 'high',
        },
        sourceDocumentId,
      ),
    );
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const nextSection = sectionFor(line);
    if (nextSection) {
      section = nextSection;
      continue;
    }
    const range = parseDateRange(line);

    if (section === 'education') {
      const previousLine = lines[lineIndex - 1] ?? '';
      const nextLine = lines[lineIndex + 1] ?? '';
      const institutionLine = /\b(school|college|university)\b/i.test(line);
      const medicalContext = [previousLine, line, nextLine].some((value) =>
        /\b(medicine|medical|M\.?D\.?|D\.?O\.?)\b/i.test(value),
      );
      if (institutionLine && medicalContext) {
        const degreeLine = [previousLine, line, nextLine].find((value) =>
          /\b(Doctor of Medicine|Doctor of Osteopathic Medicine|M\.?D\.?|D\.?O\.?)\b/i.test(
            value,
          ),
        );
        const graduationYears = (degreeLine ?? line).match(/\b(?:19|20)\d{2}\b/g);
        const graduationYear = graduationYears?.at(-1) ?? '';
        const institution = line
          .replace(
            /\s*[|,]\s*(?:M\.?D\.?|Doctor of Medicine|D\.?O\.?|Doctor of Osteopathic Medicine).*$/i,
            '',
          )
          .trim();
        candidates.push(
          candidate(
            index++,
            {
              canonicalKey: 'education.medical_school',
              kind: 'education',
              label: 'Medical school',
              value: institution,
              confidence: 'high',
              details: {
                institution,
                degree: /\bD\.?O\.?\b|osteopathic/i.test(degreeLine ?? line)
                  ? 'DO'
                  : 'MD',
                graduationYear,
              },
            },
            sourceDocumentId,
          ),
        );
      }
    }

    if ((section === 'training' || section === 'employment') && range) {
      const withoutDates = line
        .replace(range.raw, '')
        .replace(/[|•;,]+\s*$/, '')
        .trim();
      const parts = withoutDates
        .split(/\s*[|–—]\s*|\s+at\s+|,\s+(?=[A-Z])/)
        .map((part) => part.trim())
        .filter(Boolean);
      const trainingType = /fellow/i.test(line)
        ? 'fellowship'
        : /residen/i.test(line)
          ? 'residency'
          : 'employment';
      const category = section === 'training' ? trainingType : 'employment';
      const title =
        parts[0] ?? (category === 'employment' ? 'Position' : category);
      const followingLine = lines[lineIndex + 1] ?? '';
      const followingOrganization =
        /\b(center|clinic|hospital|medicine|medical|practice|group)\b/i.test(
          followingLine,
        )
          ? followingLine.split(/\.\s/)[0]
          : '';
      const organization =
        followingOrganization || parts[1] || parts[0] || '';
      const possibleAddress = lines[lineIndex + 1] ?? '';
      const address = /\d+\s+.+\b[A-Z]{2}\s+\d{5}\b/.test(possibleAddress)
        ? possibleAddress
        : '';
      candidates.push(
        candidate(
          index++,
          {
            canonicalKey: `career.${category}.${candidates.filter((item) => item.kind === 'employment' || item.kind === 'training').length + 1}`,
            kind: category === 'employment' ? 'employment' : 'training',
            label:
              category === 'employment'
                ? 'Employment period'
                : category === 'residency'
                  ? 'Residency'
                  : 'Fellowship',
            value: `${title} · ${organization} · ${range.raw}`,
            confidence: organization ? 'high' : 'medium',
            details: {
              category,
              title,
              organization,
              address,
              startDate: range.startDate,
              endDate: range.endDate,
              current: range.current,
            },
          },
          sourceDocumentId,
        ),
      );
    }

    if (section === 'license') {
      const licenseContext = `${line} ${lines[lineIndex + 1] ?? ''}`;
      const state = licenseContext.match(
        /\b([A-Z]{2}|California|Illinois|Wisconsin|Texas|Washington)\b/,
      );
      const number =
        licenseContext.match(
          /(?:license|licence)\s*(?:number|#)\s*[:#-]?\s*([A-Z0-9.-]{5,})/i,
        ) ??
        licenseContext.match(
          /(?:number|#)\s*[:#-]?\s*([A-Z0-9.-]{5,})/i,
        ) ??
        line.match(
          /(?:medical\s+)?(?:license|licence)\s*[:#-]?\s*([A-Z0-9.-]{5,})/i,
      );
      if (state && number) {
        const stateMap: Record<string, string> = {
          California: 'CA',
          Illinois: 'IL',
          Wisconsin: 'WI',
          Texas: 'TX',
          Washington: 'WA',
        };
        const stateCode = stateMap[state[1]] ?? state[1];
        const licenseNumber = number[1].replace(/\.+$/, '');
        if (
          candidates.some(
            (item) =>
              item.kind === 'license' && item.value === licenseNumber,
          )
        )
          continue;
        candidates.push(
          candidate(
            index++,
            {
              canonicalKey: `license.${stateCode.toLowerCase()}`,
              kind: 'license',
              label: `${stateCode} medical license`,
              value: licenseNumber,
              confidence: 'high',
              details: {
                state: stateCode,
                licenseNumber,
                licenseType: 'MD',
                expirationDate: '',
              },
            },
            sourceDocumentId,
          ),
        );
      }
    }
  }

  if (!candidates.length)
    warnings.push(
      'No reliable structured facts were found. You can continue with manual entry.',
    );
  if (!candidates.some((item) => item.kind === 'employment'))
    warnings.push('No clearly dated employment history was identified.');
  return { candidates, warnings };
}
