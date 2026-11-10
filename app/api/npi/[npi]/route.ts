import { NextResponse } from "next/server";
import { formatPostalCode, isValidNpi } from "@/lib/npi";
import type { Address, ClinicianAffiliation, PractitionerLookup, Taxonomy } from "@/lib/domain";

type NppesResult = {
  number: number; enumeration_type: string;
  basic: { first_name?: string; middle_name?: string; last_name?: string; name_suffix?: string; credential?: string; enumeration_date?: string; last_updated?: string; status?: string; deactivation_date?: string };
  addresses?: Array<{ address_purpose?: string; address_1?: string; address_2?: string; city?: string; state?: string; postal_code?: string; telephone_number?: string }>;
  taxonomies?: Array<{ code?: string; desc?: string; primary?: boolean; state?: string; license?: string }>;
};

async function fetchJson(url: string, attempts = 2): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "CertifyOS-Provider-Portal/1.0" }, signal: AbortSignal.timeout(9000), next: { revalidate: 3600 } });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`Upstream returned ${response.status}`);
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

export async function GET(_request: Request, context: { params: Promise<{ npi: string }> }) {
  const { npi } = await context.params;
  if (!isValidNpi(npi)) return NextResponse.json({ error: "Enter a valid 10-digit NPI with a correct checksum." }, { status: 400 });
  try {
    const nppesResponse = await fetchJson(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`);
    if (!nppesResponse.ok) return NextResponse.json({ error: "The NPI Registry is temporarily unavailable. Please try again." }, { status: 502 });
    const payload = await nppesResponse.json() as { result_count?: number; results?: NppesResult[]; Errors?: Array<{ description?: string }> };
    if (!payload.result_count || !payload.results?.[0]) return NextResponse.json({ error: payload.Errors?.[0]?.description ?? "No public NPI record was found." }, { status: 404 });
    const record = payload.results[0];
    if (record.enumeration_type !== "NPI-1") return NextResponse.json({ error: "This is a Type 2 organization NPI. CertifyOS onboarding currently supports individual practitioners (Type 1).", kind: "type_2" }, { status: 422 });
    const addresses: Address[] = (record.addresses ?? []).map((item) => ({ purpose: item.address_purpose ?? "LOCATION", line1: item.address_1 ?? "", line2: item.address_2, city: item.city ?? "", state: item.state ?? "", postalCode: formatPostalCode(item.postal_code), phone: item.telephone_number }));
    const taxonomies: Taxonomy[] = (record.taxonomies ?? []).map((item) => ({ code: item.code ?? "", description: item.desc ?? "", primary: Boolean(item.primary), state: item.state, license: item.license }));
    let cmsRows: ClinicianAffiliation[] = [];
    let cmsStatus: "available" | "not_found" | "temporarily_unavailable" = "not_found";
    let cmsWarning: string | undefined;
    try {
      const cmsUrl = new URL("https://data.cms.gov/provider-data/api/1/datastore/query/mj5m-pzi6/0");
      cmsUrl.searchParams.set("size", "100"); cmsUrl.searchParams.set("conditions[0][property]", "NPI"); cmsUrl.searchParams.set("conditions[0][value]", npi); cmsUrl.searchParams.set("conditions[0][operator]", "=");
      const cmsResponse = await fetchJson(cmsUrl.toString(), 1);
      if (cmsResponse.ok) {
        const cmsPayload = await cmsResponse.json() as { results?: Array<Record<string, string>>; data?: Array<Record<string, string>> };
        const rows = cmsPayload.results ?? cmsPayload.data ?? [];
        cmsRows = rows.map((row) => ({ name: row["Facility Name"], specialty: row.pri_spec, medicalSchool: row.Med_sch, graduationYear: row.Grd_yr, address: [row.adr_ln_1, row.adr_ln_2, row["City/Town"], row.State, row["ZIP Code"]].filter(Boolean).join(", ") }));
        cmsStatus = cmsRows.length ? "available" : "not_found";
      } else { cmsStatus = "temporarily_unavailable"; cmsWarning = `CMS clinician enrichment returned ${cmsResponse.status}.`; }
    } catch { cmsStatus = "temporarily_unavailable"; cmsWarning = "CMS clinician enrichment could not be reached; NPPES data was retained."; }
    const factCount = 3 + addresses.length + taxonomies.length + [record.basic.credential, record.basic.enumeration_date, record.basic.last_updated].filter(Boolean).length;
    const result: PractitionerLookup = {
      npi, firstName: record.basic.first_name ?? "", middleName: record.basic.middle_name, lastName: record.basic.last_name ?? "", suffix: record.basic.name_suffix, credential: record.basic.credential,
      enumerationDate: record.basic.enumeration_date, lastUpdated: record.basic.last_updated, deactivated: Boolean(record.basic.deactivation_date || record.basic.status === "D"), addresses, taxonomies,
      nppes: { source: "CMS NPPES NPI Registry", status: "available", live: true, classification: "publicly_reported", retrievedAt: new Date().toISOString(), reference: `https://npiregistry.cms.hhs.gov/provider-view/${npi}`, facts: { factCount } },
      cms: { source: "CMS Doctors & Clinicians", status: cmsStatus, live: true, classification: "publicly_reported", retrievedAt: new Date().toISOString(), reference: "https://data.cms.gov/provider-data/dataset/mj5m-pzi6", facts: { rows: cmsRows }, warning: cmsWarning },
    };
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "The public registry request timed out or failed. No stored information was changed." }, { status: 504 });
  }
}
