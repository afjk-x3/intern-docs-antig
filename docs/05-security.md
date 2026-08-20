# InternDocs — Security

This document consolidates every security-relevant requirement from the PRD into one reference. Treat it as binding, not advisory. The detailed backend rules live in `12-backend-security-rules.md`; this doc is the why and the compliance framing.

## 1. Threat model, in one paragraph

The system holds personal and sensitive data (evaluation papers, DTRs, signature images) for 50–100 interns, accessed by a small number of approvers and admins. The realistic attack surface is not a sophisticated external attacker; it is authorization bugs written by developers who are learning, an API left open while the UI looks locked down, and a signature image that leaks and gets reused to forge an approval. Every control below is aimed at one of those three.

## 2. Access control (FR-1, FR-2, FR-13)

- Invitation-only. No self-registration path exists anywhere in the app.
- Role is assigned at invite time. One role per user, never inferred or self-selected.
- Every authorization check lives in the database via row-level security, not only in application code or the UI. The UI hiding a button is a usability convenience, never the security boundary.
- State transitions are validated server-side against Appendix A. An illegal transition returns 409 and writes a denied-attempt audit entry. No client can move a submission's state by a direct write.

## 3. File and signature protection (FR-6, FR-9, FR-11, FR-25, Appendix B)

- No permanent public URL is ever issued for any stored file.
- Downloads use signed URLs, expiring within 5 minutes, issued only after a server-side permission check, single-purpose.
- The signature image is the single most dangerous asset in the system. It is stored in a bucket with no client-readable policy at all. It is composited onto PDFs server-side only. It is never sent to the browser except on the owner's own settings page. It is deleted when the approver is offboarded.
- The attestation record, not the stamped image, is the artefact of record. The image is a visual convenience and must never be represented to users as a certified electronic signature (Risk R2). InternDocs is explicitly not RA 8792 certified e-signature.

## 4. Data protection and RA 10173 (Philippine Data Privacy Act)

- Lawful basis and a privacy notice are required before any workflow surface is usable; acknowledgment is recorded per user.
- Data minimization: no government ID numbers or documents are collected. Adding an ID requirement later is a change-control item, not a config change, because it raises the sensitivity classification.
- 30-day retention on document file bytes after approval (or after internship end for never-approved items), enforced by an automated job, not a manual process.
- Approval records, hashes, comments, and audit entries survive file deletion and are retained at least 3 years — this is what settles a dispute after the file is gone.
- Breach-response procedure with 72-hour notification capability must exist before go-live (NFR privacy/compliance). This is a process document for Makerspace to hold, produced at handover, not application code.

## 5. Encryption and transport

- TLS 1.2 or higher in transit, everywhere, no exceptions for internal traffic.
- AES-256 at rest (Supabase default; confirm it is enabled, do not assume).
- Passwords hashed with bcrypt or Argon2 (Supabase Auth default; confirm the configured algorithm).
- Session idle timeout: 60 minutes.

## 6. Secrets

- The Supabase service-role key never reaches the client bundle, is never committed, and is never used to bypass a policy for convenience, including during development.
- Only `.env.example` is committed. Real secrets live in the platform's encrypted store or Supabase Vault.
- Pre-commit secret scanning runs locally and in CI. A scan failure blocks the commit and the PR.

## 7. Audit logging (FR-24)

- Logged at minimum: login, failed login, invitation, role change, internship-date change, upload, download, state transition, denied transition, permission denial, signature enrollment or replacement, reassignment, export, deletion.
- Every entry: actor, action, target, UTC timestamp, source IP.
- No application role can update or delete an audit entry. Enforce with database grants, not application logic alone.
- Queryable by actor and by target for incident reconstruction.

## 8. Adversarial test suite (FR-26) — mandatory, blocks merge

CI must fail closed on all seven of these, every pull request:

1. Intern reads another intern's submission
2. Approver acts on a step not assigned to them
3. Approver acts after being reassigned away from a step
4. Intern calls an admin-only endpoint
5. Attempt to edit an approved submission
6. Direct storage access bypassing a signed URL
7. Client-side fetch of a stored signature image

If any of these seven passes when it should fail, do not merge, regardless of what else is green.

## 9. Known residual risks (from PRD §12, security-relevant subset)

- R2: signature image mistaken for a certified e-signature — mitigated by Appendix B language everywhere the image appears in the UI
- R4: signature image leak and reuse — mitigated by section 3 above plus the dedicated adversarial test
- R5: authorization implemented only in the UI — mitigated by RLS-first architecture, FR-26 in CI
- R9: secrets committed to the repo — mitigated by section 6 above

## 10. Definition of secure-enough for release

- FR-26 suite green in CI
- RLS present and deny-by-default on 100% of tables holding user data
- 0 secrets in the repository or client bundle, verified by scan
- Privacy notice acknowledgment at 100% for active users
- Retention job running daily with warnings verified sent before any deletion
