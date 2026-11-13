# Demo guide

Use synthetic private data and demonstration documents only. Keep `NEXT_PUBLIC_DEMO_DATA_MODE=true` for this walkthrough. In that mode CertifyOS never sends an NPI to NPPES, CMS, CAQH, NPDB, or an AI service.

## Fictional demonstration identifiers

| NPI | Scenario |
| --- | --- |
| `1440001000` | Dr. Maya Patel — fresh practitioner and CV walkthrough |
| `1440001018` | Dr. Sarah Lee — returning provider with reusable information |
| `1440001026` | Dr. Taylor Reed — conflicting primary practice addresses |
| `1440001034` | Dr. Jordan Ellis — complex history and multiple licenses |
| `1440001042` | Fictional medical group — Type 2 rejection |
| `1440001059` | No match — manual-entry fallback |

These identifiers are fictional demonstration keys, not real NPI Registry identities.

## Demo 1: Fresh practitioner with CV

1. Add Dr. Maya Patel with `1440001000` and select Northstar and Evergreen.
2. Confirm that the source is labeled as fictional demonstration data.
3. Open **Smart Onboarding** and upload a text-based PDF CV containing her MD degree, medical school, residency, two employment periods, and license.
4. Accept, correct, or ignore every extracted candidate. Nothing is added automatically.
5. Open **Practice**. Explain the detected January–August 2022 career gap.
6. Upload a demonstration license document, complete organization-specific items, review, attest, and submit.

CV extraction reads the actual uploaded PDF text locally. It does not recognize a filename, call AI, or classify extracted information as verified.

## Demo 2: Equivalent dropdown values

1. Confirm Maya Patel's degree as MD.
2. Add Horizon Care Partners.
3. The one canonical Doctor of Medicine fact satisfies Northstar (`MD`), Evergreen (`M.D.`), and Horizon (`Doctor of Medicine`) without asking for the degree again.

## Demo 3: Conflict resolution

1. Add Dr. Taylor Reed with `1440001026`.
2. Open **Resolve conflicts** and compare the two fictional primary-practice addresses.
3. Select one value or enter a different current address.
4. The task disappears, historical evidence remains, and readiness recalculates.

Mailing and primary-practice addresses are intentionally not compared as equivalent fields.

## Demo 4: Complex history

1. Add Dr. Jordan Ellis with `1440001034`.
2. Confirm that both Illinois and Wisconsin licenses are preserved.
3. Upload a text-based complex CV and confirm the clinic and telehealth employment candidates.
4. Concurrent employment remains visible and does not create a false gap.
5. A different current primary-practice address is routed to conflict review rather than silently replacing the stored value.

## Demo 5: Returning provider and incremental readiness

1. Add Dr. Sarah Lee with `1440001018` and complete an initial organization submission.
2. Reload to confirm the private Supabase workspace restores the profile and submission.
3. Add another organization under **Organization readiness**.
4. Review the calculated coverage summary and complete only the incremental gaps. Earlier snapshots and credentialing cases remain unchanged.

## Demo 6: Existing credentialing lifecycle

1. Submit a completed application.
2. Open **Credentialing** and advance the clearly simulated workflow.
3. Trigger an information request, upload a demonstration response, and confirm that the persisted timeline resumes.

## Next best action and acquisition impact

The existing Overview displays one deterministic **Your next step** card and a secondary list of all outstanding actions. Expand **How we simplified your application** to see values calculated from stored provenance, acquisition events, and current requirements—not arbitrary savings claims.

## Real versus simulated

| Capability | Mode |
| --- | --- |
| Fictional NPI acquisition | Deterministic local dataset; no healthcare API call |
| Text-based CV extraction | Actual uploaded PDF text parsed locally |
| Extracted candidate review | Provider-controlled; not primary-source verified |
| Organizations and requirements | Fictional persisted configuration model |
| CAQH, state licensing, NPDB | Not connected; never labeled live |
| Credentialing review and decisions | Working lifecycle, explicitly simulated |
| Identity proofing / e-signature | Not implemented; demonstration acknowledgement only |
| Document bytes | Private Supabase Storage, scoped to the authenticated user |
