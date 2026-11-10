# SharedCred — Smart Provider Onboarding

An independent, production-shaped concept prototype for provider onboarding and credentialing. It is not an official CertifyOS implementation and must not be used for real credentialing decisions.

## What works

- Live, server-side CMS NPPES 2.1 lookup with NPI checksum validation, Type 1 enforcement, timeouts, retry, and honest error states.
- Independent CMS Doctors & Clinicians enrichment. A blocked or unavailable CMS source never discards successful NPPES data.
- Canonical degree mappings and dynamic, multi-organization gap evaluation.
- Adaptive provider action inbox, document metadata capture, application review, demonstration attestation, and immutable-snapshot semantics.
- Independent credentialing cases, reviewer/provider role switching, valid state transitions, additional-information request/response/acceptance, decisions, timelines, and audit history.
- Supabase PostgreSQL schema, private Storage bucket, tenant-aware RLS policies, seed data, and unit tests.

The zero-configuration local demonstration persists synthetic workflow state in browser storage so the product can be exercised immediately. The included Supabase migration is the production persistence contract; connect the server repository before handling non-demo data. Uploaded bytes are intentionally not retained in zero-config mode.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. The default valid NPI is only a convenience for testing the public API. Do not attach synthetic private histories to it.

To enable Supabase:

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`, then `supabase/seed.sql`.
3. Add the project URL and anon key to `.env.local`.
4. Create provider and reviewer users in Supabase Auth, then assign explicit access and organization memberships. Never grant private access because an entered NPI matches.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Deployment

This repository was initialized with the OpenAI Sites Next-compatible runtime and can be published with Sites. For a conventional Vercel deployment, use the same App Router source in a current stable Next.js application, retain `app`, `lib`, `public`, `supabase`, and documentation, add the Supabase environment variables in Vercel, and deploy. Server route `/api/npi/[npi]` requires outbound HTTPS to `npiregistry.cms.hhs.gov` and `data.cms.gov`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client code. Configure Supabase Auth redirect URLs for the production origin and keep `credentialing-documents` private.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
