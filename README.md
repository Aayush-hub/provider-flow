# SharedCred — Smart Provider Onboarding

An independent, production-shaped concept prototype for provider onboarding and credentialing. It is not an official CertifyOS implementation and must not be used for real credentialing decisions.

## What works

- Live, server-side CMS NPPES 2.1 lookup with NPI checksum validation, Type 1 enforcement, timeouts, retry, and honest error states.
- Independent CMS Doctors & Clinicians enrichment. A blocked or unavailable CMS source never discards successful NPPES data.
- Canonical degree mappings and dynamic, multi-organization gap evaluation.
- Adaptive provider action inbox, document metadata capture, application review, demonstration attestation, and immutable-snapshot semantics.
- Independent provider-facing credentialing simulations, additional-information request/response flows, decisions, timelines, and audit history.
- Supabase email/password authentication, cookie-based SSR sessions, private workspace persistence, private document uploads, PostgreSQL schema, RLS policies, seed data, and unit tests.

Authenticated workspace state and uploaded demonstration documents are persisted in the private `sharedcred-private` Supabase Storage bucket. Every server operation resolves the cookie-backed Supabase user before accessing the user-specific object path. The included normalized PostgreSQL migration remains the target model for a full relational rollout.

## Local setup

```bash
npm install
# Populate .env.local from the sanitized .env.example keys.
npm run dev
```

Open `http://localhost:3000`. The default valid NPI is only a convenience for testing the public API. Do not attach synthetic private histories to it.

Supabase setup:

1. Add the project URL, anon/publishable key, and server-only service-role key to `.env.local`.
2. Create a private Storage bucket named `sharedcred-private` with a 10 MB limit for JSON, PDF, DOCX, PNG, and JPG files.
3. For the normalized relational model, run `supabase/migrations/001_initial_schema.sql`, then `supabase/seed.sql` in the Supabase SQL editor.
4. Add `http://localhost:3000/auth/callback` and the production Vercel callback URL to Supabase Auth redirect URLs.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

## Deployment

This is a standard Next.js 16 App Router project and deploys to Vercel with zero framework configuration:

1. Import the repository into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_APP_URL` to Production and Preview environments.
3. Set `NEXT_PUBLIC_APP_URL` to the production Vercel origin.
4. Add `https://YOUR-VERCEL-DOMAIN/auth/callback` to Supabase Auth redirect URLs.
5. Deploy. The build command is `npm run build`; output detection is automatic.

The NPI route requires outbound HTTPS to `npiregistry.cms.hhs.gov` and `data.cms.gov`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client code. It is used only by authenticated server routes for explicitly user-scoped private Storage paths.

Security note: the configured values were moved from the ignored local `.env.example` into the ignored `.env.local`; the committed `.env.example` now contains placeholders only. Rotate the service-role key if the original file was ever shared outside this machine.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
