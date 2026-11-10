# Demo guide

Use synthetic private data and demonstration documents only.

## Fresh provider

1. Start in Provider view and enter a valid individual Type 1 NPI.
2. Review live NPPES facts and the independent CMS source status.
3. Open **Action inbox**, fill only unresolved professional fields, and upload a demo license.
4. Select two or three fictional organizations. Notice incremental requirements for Evergreen.
5. Review the assembled application, acknowledge the demonstration attestation, and submit.

## Returning provider

Reload the page. The local demo restores the authorized profile and workflow. Add Evergreen under **Organizations**; existing canonical facts remain and only Evergreen-specific gaps appear.

## Multi-organization credentialing

After submission, **Credentialing** shows an independent case and actual event timeline for every selected organization.

## Reviewer journey and information request

1. Use the header role switch to enter **Reviewer**.
2. Begin intake on a submitted case.
3. Request information. Switch back to **Provider**.
4. Open **Credentialing**, upload a demo response, and return to **Reviewer**.
5. Accept the response, complete verification, then record a clearly simulated approval or denial.
6. Return to Provider to see the saved status and event history.

## Reset

Select **Reset demo** in the sidebar to clear device-local synthetic state.

## Real vs simulated

| Capability | Mode |
| --- | --- |
| NPPES lookup | Live public API |
| CMS Doctors & Clinicians | Live public API; may report unavailable independently |
| Practitioner-entered facts | Real interaction; synthetic demo values only |
| Organizations and requirements | Fictional persisted configuration model |
| CAQH, state licensing, NPDB | Not connected; never labeled live |
| Credentialing review and decisions | Working lifecycle, explicitly simulated |
| Identity proofing / e-signature | Not implemented; demonstration acknowledgement only |
| Document bytes | Private Supabase Storage, scoped to the authenticated user |
