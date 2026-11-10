# Architecture

## Boundaries

The public acquisition boundary accepts an NPI but never authorizes private access. Authenticated users gain access only through `practitioner_access` or organization-scoped reviewer membership. Provider admins can prepare factual data but `can_attest` remains explicit and false by default.

## Data model

`practitioners` is the reusable professional identity. `practitioner_facts` stores canonical values with source, reference, classification, scope, acquisition time, and history linkage. Requirements and mappings are versioned per organization. `submission_snapshots` freeze each organization’s view at submission; later profile edits never mutate historical submissions. Every snapshot owns an independent `credentialing_case` and event history.

## Acquisition adapters

The NPI route returns a consistent source result: source, status, live/simulated flag, classification, retrieval time, reference, facts, and warning. NPPES is live and authoritative only for its public directory record. CMS Doctors & Clinicians is live public reporting and preserves all returned enrollment/location rows. Neither is labeled primary-source credential verification. CAQH, licensing, and NPDB are intentionally not presented as live.

Failed optional adapters are isolated. NPPES data remains usable when CMS enrichment is missing, edge-blocked, or timed out.

## Requirement evaluation

`lib/requirements.ts` loads selected organization obligations, deduplicates only canonical equivalents, matches current facts/documents, and emits actionable gaps. Degree mappings are deterministic, versionable human-approved equivalents. Mailing, billing, practice, and service addresses are not merged by label.

## Credentialing state machine

Allowed transitions are explicit:

`submitted → intake_review → information_requested|verification → credentialing_review → approved|denied`

An accepted information response moves the case to verification. Invalid shortcuts are rejected by business logic. No timer changes case state.

## Persistence and authorization

The SQL migration defines normalized PostgreSQL tables, indexes, foreign keys, private Storage, and RLS. Practitioner facts and documents require explicit access. Case reads allow the practitioner relationship or a reviewer membership for that exact organization. Reviewer updates are organization-scoped. Provider-visible events are separated from internal notes.

The browser-backed demo is deliberately synthetic and local. It exercises state transitions without pretending to be production persistence. The Supabase schema is the intended deployed source of truth.

## Limitations

- No real CAQH, NPDB, state board, payer, e-signature, or identity-proofing integration.
- Document upload in zero-config mode records metadata only; Supabase Storage is required for bytes.
- Document extraction/OCR is not enabled. Manual entry is the fallback.
- Credentialing outcomes and organizations are fictional and simulated.
- Recredentialing tables and preserved-history model are present; the current UI focuses on the higher-priority initial lifecycle.
