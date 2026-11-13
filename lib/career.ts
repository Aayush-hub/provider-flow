import type { CareerEntry, CareerGap } from './domain';

function monthIndex(value: string) {
  const [year, month] = value.split('-').map(Number);
  return year * 12 + month - 1;
}

function fromMonthIndex(value: number) {
  const year = Math.floor(value / 12);
  const month = (value % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function detectCareerGaps(entries: CareerEntry[]): CareerGap[] {
  const dated = entries
    .filter((entry) => entry.startDate && (entry.endDate || entry.current))
    .map((entry) => ({
      ...entry,
      start: monthIndex(entry.startDate),
      end: entry.current ? Number.POSITIVE_INFINITY : monthIndex(entry.endDate),
    }))
    .sort((a, b) => a.start - b.start);
  if (dated.length < 2) return [];
  const gaps: CareerGap[] = [];
  let coveredThrough = dated[0].end;
  for (const entry of dated.slice(1)) {
    if (entry.start > coveredThrough + 1 && Number.isFinite(coveredThrough)) {
      const startDate = fromMonthIndex(coveredThrough + 1);
      const endDate = fromMonthIndex(entry.start);
      gaps.push({
        id: `gap-${startDate}-${endDate}`,
        startDate,
        endDate,
      });
    }
    coveredThrough = Math.max(coveredThrough, entry.end);
  }
  return gaps;
}

export function monthYear(value: string) {
  if (!value) return 'Present';
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
