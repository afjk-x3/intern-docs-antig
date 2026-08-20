# InternDocs — Homepage Design Plan

InternDocs is invitation-only and internal. There is no public marketing homepage. "Homepage" here means the unauthenticated entry surface: login, invitation acceptance, and password reset. The authenticated landing page is the intern checklist, already specified in `03-design-spec.md` section 1.

## Purpose

Get an invited user from an email link to a working session with the least friction, while making clear this is a closed system, not a public sign-up.

## Screens

### 1. Login

- Fields: work email, password
- No "create account" link anywhere on this screen — self-registration is disabled by design (FR-1), and offering the option would be misleading
- "Forgot password" link
- Error state on failed login is generic ("email or password is incorrect"), never confirms whether an email exists in the system
- Every failed login attempt is audit-logged (FR-24)

### 2. Accept invitation

- Reached only via the emailed invitation link, which is single-use and expires after 7 days
- Expired-link state: plain message, tells the user to ask their administrator to resend the invitation, no generic error
- Form: set password (12-character minimum enforced client-side and server-side), confirm password
- On success: user lands in exactly one assigned role and is routed to the privacy notice (see below), then to their role's landing page
- No role picker on this screen. Role is set by the admin at invite time, not chosen here.

### 3. Privacy notice acknowledgment

- Shown once, at first login, before any workflow surface is usable (FR-25)
- Plain-language summary of what data is collected, why, and the 30-day document retention rule
- Single acknowledgment action, recorded with a timestamp
- Cannot be dismissed without acknowledging; no skip option

### 4. Password reset

- Request screen: email field, generic confirmation message regardless of whether the email exists
- Reset screen: reached via emailed link, same password rules as invitation acceptance

## Visual treatment

- Centered single-column card layout, no navigation chrome, no marketing content
- Makerspace brand tokens from `07-design-system.md` applied to the card header and primary button only; everything else stays neutral so the form is easy to scan
- Works at 360px viewport width without horizontal scroll

## What this page is not

- Not a marketing site. Do not add feature lists, testimonials, or public-facing copy.
- Not a place to reveal which roles exist or how many users are in the system.
- Not indexed. Add `robots: noindex` at the route level.

## States checklist

- [ ] Login, empty
- [ ] Login, error (bad credentials)
- [ ] Login, submitting
- [ ] Invite acceptance, valid link
- [ ] Invite acceptance, expired link
- [ ] Invite acceptance, already-used link
- [ ] Privacy notice, unacknowledged
- [ ] Password reset request
- [ ] Password reset request, submitted confirmation
- [ ] Password reset, valid link
- [ ] Password reset, expired link
