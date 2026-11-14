# AUTH-1 · Simple entry: email, phone, Google and Apple

**Status:** implemented in the client, ready for provider configuration
**Surfaces:** `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/verify-email`, the Cookie choices panel.
**Files:** `pages/AuthPageV2.tsx`, `src/lib/authProviders.ts`,
`src/lib/legalConsent.ts`, `src/auth-page.css`,
`src/components/CookieConsent.tsx`, `src/components/CookieConsent.css`,
`tests/auth-entry.test.ts`, `tests/privacy-preferences.test.ts`.

---

## 1. What the page offers

| Method | Sign in | Create account | What happens |
|---|---|---|---|
| Email + password | Yes | Yes | Supabase email/password. New accounts receive a verification email. |
| Phone + one-time code | Yes | Yes | `signInWithOtp` with `shouldCreateUser` set by intent, then `verifyOtp({ type: 'sms' })`. |
| Google | Yes | Yes | `signInWithOAuth({ provider: 'google' })`, returning to `/login` so the consent marker can be settled. |
| Apple | Yes | Yes | The same flow with `provider: 'apple'`. |

The page is one card. Social buttons sit above a divider, then an Email / Phone
switch, then only the fields that method needs. The "Welcome back" heading and
its one-line explanation are centred. A single **Back** control sits above the
logo; the logo is no longer a second link home, and the footer no longer carries
"Back to home". Sign-up asks for first and last
name, the contact method, and an optional password for email accounts. Academic
details are optional and can be completed later.

### Phone normalisation

`normalizePhone` accepts E.164, converts Nigerian local `0…` numbers to
`+234…`, and rejects a bare national number without a country code rather than
guessing one. The hint tells the person to include the country code.

### Provider configuration required

The UI cannot enable a provider in the Supabase project. Before these buttons
can succeed:

1. **Google** — enable Google in Supabase Authentication → Providers and add the
   project's `/login` origin plus the deployed origin to the redirect allow list.
2. **Apple** — enable Apple with the Apple Developer Service ID, key and team ID.
3. **Phone** — configure an SMS provider (Twilio, MessageBird, Vonage, etc.) and
   the message template. Phone sign-up must also be enabled.
4. Add both the preview and production origins to the auth redirect allow list.

Until then the buttons fail honestly: they name the provider and point to email
or phone. They are never hidden or silently inert.

---

## 2. Parent and teacher accounts: not open yet

The database already has `profiles.account_type` with
`student | parent | teacher`, but there is no parent or teacher dashboard,
permission model, linkage to a student, or service flow behind those roles.
Creating those accounts now would produce a working login with nothing useful
inside — and would collect personal data for a feature that does not exist.

The sign-up card now shows the three roles and marks Parent/Guardian and
Teacher as **Not open yet** (disabled, with an explanation and a `/contact`
link). Only Student can be created. The account type written to metadata is
always `student`.

To open them later, decide and build, in this order:

1. **Link model** — a parent needs a verified, revocable link to a student
   (invite code or student approval). A teacher needs an institution/class
   relationship. Neither should be inferred from a form field.
2. **Permission model** — parent: read-only progress and service status, no
   private messages or account settings. Teacher: class-level aggregates, not
   individual student records unless explicitly shared.
3. **Consent** — the student must approve any adult who can see their progress.
4. **Separate dashboards** — parent and teacher navigation cannot reuse the
   student dashboard with hidden cards; they need their own information model.
5. **Data minimisation** — collect only what the new dashboard displays, and add
   retention/deletion rules before launch.

Until that exists, the disabled cards are the honest answer. Closing the gap is
a product decision, not a styling one.

---

## 3. What we collect and why

The sign-up card includes an expandable, readable disclosure:

| Category | Details | Purpose |
|---|---|---|
| Account | Name, email and/or phone, password or one-time code | Sign-in, verification, account recovery, security notices |
| Study profile (optional) | Institution, programme, level, interests | Dashboard context, recommendations, eligibility checks |
| Activity | Practice results, saved schools, service requests | Progress view, saved items, request tracking |
| Preferences | Notification choices, optional analytics if allowed | Deliver the channels the student chose; consent is separate |

The disclosure stops at what we collect and states that we do not sell data.
The NIN/BVN reassurance was removed from the sign-up card in the follow-up
pass: it read as generic boilerplate and the user asked for it not to be
repeated on every login. Those boundaries remain in the Privacy Notice, which
the disclosure links to.

---

## 4. Privacy and terms before registration

- The checkbox is **required** and appears before the social buttons and the
  form, so every route to a new account passes through it.
- Google/Apple cannot carry form state through the redirect. The timestamp is
  written to session/local storage before the provider redirect
  (`markPendingTermsAcceptance`) and settled into `terms_agreed_at` when the
  session returns (`settlePendingTermsAcceptance`). If storage is unavailable,
  social sign-up is blocked rather than claiming consent that was not recorded.
- A failed gate focuses the checkbox and says what is missing.
- A new OAuth account can arrive through the “Sign in” tab, where there was no
  sign-up checkbox. On return the page reads `profiles.terms_agreed_at`; if it is
  empty, the dashboard is held behind the same readable consent gate. A failed
  read navigates normally rather than trapping the account.
- The Privacy Notice and Terms open in a new tab so reading them does not
  destroy a half-completed form.

**Not implemented, deliberately:** tiny or low-contrast legal copy intended to
discourage reading. That is a dark pattern, undermines informed consent under
the NDPR and comparable privacy law, fails WCAG contrast/readability, and makes
the agreement harder to defend. Legal copy is 12.5px with a plain-language
summary and explicit links.

---

## 5. Cookie panel repair

The old panel had three practical faults:

1. **A dead primary button.** “Accept optional” was disabled whenever optional
   analytics were suspended, which is currently always. A disabled navy button
   looks broken. It is now absent in that state; “Reject optional” records the
   only valid choice, and “Allow analytics” appears only when the option exists.
2. **A failed save looked like a dead click.** Storage can be blocked in iframes
   and privacy modes. The panel now shows the error beside the actions and adds
   **Continue for this visit**, which dismisses the panel without pretending the
   choice was saved. Analytics remain off.
3. **A wall over the page.** The panel is now a compact bottom-left card (430px
   maximum), with the actions immediately below the copy. Text is lighter
   (400), body copy is 12.5px, headings 620 and buttons 500–620. It is not a
   full-width marketing banner.

`tests/privacy-preferences.test.ts` now proves the panel closes on a saved
choice, reopens from Cookie settings, and can be dismissed after a blocked save.

---

## 6. Palette and icon colour

The page uses the wordmark palette rather than the old green: logo navy
`#0A3E83` for actions, logo-blue ink `#0F6BAA` for field and section icons, and
the bright logo blue `#1D9BE0` only for large fills and gradients. The same
primary tokens drive the rest of the site, so buttons, selected states and
links stay consistent across public, student and admin surfaces. Semantic
success green is still green; it is no longer the brand colour.

---

## 7. Verification

- `npx tsc --noEmit` — clean.
- `node --import tsx --test tests/auth-entry.test.ts tests/privacy-preferences.test.ts` — pass.
- `npm test` — 1035 pass, 0 fail.
- `npm run a11y:audit` — no blocking findings; the legal copy keeps AA contrast
  and readability.

Provider sign-in itself cannot be exercised without a configured Supabase
project and SMS/OAuth credentials. That is the remaining external verification,
not a client-code gap.
