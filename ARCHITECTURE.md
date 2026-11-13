# Architecture

## Boundaries

The public acquisition boundary accepts an NPI but never authorizes private access. Authenticated users gain access only through `practitioner_access` or organization-scoped reviewer membership. Provider admins can prepare factual data but `can_attest` remains explicit and false by default.

## Data model

`practitioners` is the reusable professional identity. `practitioner_facts` stores canonical values with source, reference, classification, scope, acquisition time, and history linkage. Requirements and mappings are versioned per organization. `submission_snapshots` freeze each organization’s view at submission; later profile edits never mutate historical submissions. Every snapshot owns an independent `credentialing_case` and event history.

The provider workspace mirrors these production concepts in its persisted JSON contract. It stores repeatable education, license, practice, and affiliation histories; explicit source conflicts and provider selections; and one immutable snapshot per submitted organization. Existing workspaces are normalized on load so older single-value profiles and all-at-once submissions remain usable.

## Acquisition adapters

`NEXT_PUBLIC_DEMO_DATA_MODE` defaults to `true`. In this mode the NPI route uses only the fictional dataset in `lib/demo-data.ts`; it never calls NPPES, CMS, CAQH, NPDB, or an AI service. Unknown demonstration identifiers return a manual-entry option instead of a fabricated match. The live NPPES/CMS adapter remains available only when demo mode is explicitly disabled.

Text-based CV PDFs are read server-side with the serverless PDF.js build supplied by `unpdf`. Deterministic parsing emits candidate facts rather than profile facts. The provider must accept, correct, or ignore every candidate before submission. Confirmed values retain the provenance label `Extracted from uploaded CV — Provider Confirmed` and are never classified as primary-source verified.

The NPI route returns a consistent source result: source, status, live/simulated flag, classification, retrieval time, reference, facts, and warning. NPPES is live and authoritative only for its public directory record. CMS Doctors & Clinicians is live public reporting and preserves all returned enrollment/location rows. Neither is labeled primary-source credential verification. CAQH, licensing, and NPDB are intentionally not presented as live.

Failed optional adapters are isolated. NPPES data remains usable when CMS enrichment is missing, edge-blocked, or timed out.

When acquired sources disagree on a supported canonical field, the provider must select the current value before submission. The resolution records the selected source and time in the audit history and updates the reusable profile without changing earlier submission snapshots.

Career entries preserve employment, residency, and fellowship date ranges. Gap detection operates on the union of covered months, so concurrent positions are supported and training periods count as explained professional history. Gap explanations and unresolved candidate reviews participate in the same readiness calculation as other requirements.

## Requirement evaluation

`lib/requirements.ts` loads selected organization obligations, deduplicates only canonical equivalents, matches current facts/documents, and emits actionable gaps. Degree mappings are deterministic, versionable human-approved equivalents. Mailing, billing, practice, and service addresses are not merged by label.

Provider-facing acquisition metrics are calculated from stored provenance, acquisition events, and canonical requirement mappings. They do not use arbitrary percentages or count one canonical fact repeatedly merely because multiple organizations accept it.

## Credentialing state machine

Allowed transitions are explicit:

`submitted → intake_review → information_requested|verification → credentialing_review → approved|denied`

An accepted information response moves the case to verification. Invalid shortcuts are rejected by business logic. No timer changes case state.

## Persistence and authorization

The SQL migration defines normalized PostgreSQL tables, indexes, foreign keys, private Storage, and RLS. Practitioner facts and documents require explicit access. Case reads allow the practitioner relationship or a reviewer membership for that exact organization. Reviewer updates are organization-scoped. Provider-visible events are separated from internal notes.

The deployed application uses Supabase Auth for identity and a private Supabase Storage bucket for each user's workspace snapshot. The normalized Supabase PostgreSQL schema remains available for teams that want a relational rollout.

## Limitations

- No real CAQH, NPDB, state board, payer, e-signature, or identity-proofing integration.
- Document uploads store the file bytes in private Supabase Storage and retain the returned object path in workspace state.
- Text-based CV PDF extraction is enabled locally. Scanned-image OCR and DOCX extraction are not enabled; manual entry remains the fallback.
- Credentialing outcomes and organizations are fictional and simulated.
- Recredentialing tables and preserved-history model are present; the current UI focuses on the higher-priority initial lifecycle.
