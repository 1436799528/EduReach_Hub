-- Site content: the parts of the public site an administrator owns.
--
-- Before this migration the footer, the brand line, the contact details and the
-- legal pages were JSX literals in src/components/HubLayout.tsx. That meant a
-- policy update needed a developer and a deploy, and the footer's Contact /
-- Privacy / Terms links went nowhere (`href="#"`). Nothing in the schema stored
-- site-wide content, so there was no source of truth for the admin portal to
-- edit.
--
-- Two tables:
--
--   site_settings    key/value JSON for brand, footer, contact and social
--                    links. Publicly readable because the footer renders it for
--                    every visitor; writable only by the server (service role),
--                    whose handlers check `site.update` before touching it.
--   site_pages       the legal and policy pages, one row per slug, with a
--                    draft/published state and a separate legal-review state.
--   site_page_revisions  an append-only snapshot of every saved version, so an
--                    edit can be inspected and restored.
--
-- Deliberate choices:
--   * Published pages are readable by `anon`. A policy a visitor must accept
--     cannot require a login.
--   * Draft pages are not readable by clients at all, including signed-in
--     students. Editors read them through the server.
--   * Revisions have no client grants whatsoever. They contain the same text as
--     the published page plus material that may be under review.
--   * The seeded policy text describes what this codebase actually does. It is
--     marked `review_state = 'pending'` and rendered with a visible draft
--     banner: nobody has claimed a lawyer approved it.

begin;

-- ---------------------------------------------------------------------------
-- 1. Settings ---------------------------------------------------------------
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint site_settings_key_known check (key in ('brand', 'footer', 'contact', 'social')),
  constraint site_settings_value_is_object check (jsonb_typeof(value) = 'object')
);

comment on table public.site_settings is
  'Public site-wide settings (brand, footer, contact, social). Only content that may be shown to every visitor belongs here; never staff or student data.';

alter table public.site_settings enable row level security;
revoke all on table public.site_settings from public, anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2. Pages ------------------------------------------------------------------
-- ---------------------------------------------------------------------------

create table if not exists public.site_pages (
  slug text primary key,
  title text not null,
  summary text not null default '',
  body text not null default '',
  status text not null default 'draft',
  review_state text not null default 'pending',
  revision int not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint site_pages_slug_shape check (slug ~ '^[a-z0-9-]{2,64}$'),
  constraint site_pages_status_known check (status in ('draft', 'published')),
  constraint site_pages_review_state_known check (review_state in ('pending', 'approved')),
  constraint site_pages_revision_positive check (revision >= 1)
);

comment on table public.site_pages is
  'Legal and policy pages. `status` controls public visibility; `review_state` records whether a lawyer has approved the text and drives the draft banner.';
comment on column public.site_pages.review_state is
  'pending = shown with a "draft pending legal review" banner. approved = the banner is removed. Changing this is a claim, not a formatting choice.';

create index if not exists site_pages_published_idx
  on public.site_pages (slug) where status = 'published';

alter table public.site_pages enable row level security;
revoke all on table public.site_pages from public, anon, authenticated;
grant select on table public.site_pages to anon, authenticated;
grant select, insert, update, delete on table public.site_pages to service_role;

drop policy if exists site_pages_public_read on public.site_pages;
create policy site_pages_public_read on public.site_pages
  for select to anon, authenticated
  using (status = 'published');

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at
before update on public.site_pages
for each row execute function public.set_student_portal_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Revisions --------------------------------------------------------------
-- ---------------------------------------------------------------------------

create table if not exists public.site_page_revisions (
  id bigserial primary key,
  slug text not null references public.site_pages(slug) on delete cascade,
  revision int not null,
  title text not null,
  summary text not null default '',
  body text not null,
  status text not null,
  review_state text not null,
  edited_by uuid references auth.users(id) on delete set null,
  edited_at timestamptz not null default now(),
  unique (slug, revision)
);

comment on table public.site_page_revisions is
  'Append-only history of saved policy text. Server-only: no client grants.';

create index if not exists site_page_revisions_slug_idx
  on public.site_page_revisions (slug, revision desc);

alter table public.site_page_revisions enable row level security;
revoke all on table public.site_page_revisions from public, anon, authenticated;
grant select, insert on table public.site_page_revisions to service_role;

-- ---------------------------------------------------------------------------
-- 4. Seed: settings ---------------------------------------------------------
-- ---------------------------------------------------------------------------

insert into public.site_settings (key, value) values
  ('brand', jsonb_build_object(
    'name', 'EduReach Hub',
    'tagline', 'CBT practice, past questions and student services for Nigerian students.'
  )),
  ('footer', jsonb_build_object(
    'about', 'Practice for JAMB, WAEC, NECO and Post-UTME, and help with the student services that are hardest to navigate.'
  )),
  ('contact', jsonb_build_object(
    'whatsapp', '2349130134969',
    'email', '',
    'note', 'Message us on WhatsApp. If you are signed in, you can also reply to the notification on your request in the dashboard.'
  )),
  ('social', jsonb_build_object('links', jsonb_build_array()))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Seed: policy pages -----------------------------------------------------
-- ---------------------------------------------------------------------------
-- Seeded as published so the pages exist and are readable without a login, and
-- as review_state='pending' so every one of them says, on the page, that a
-- lawyer has not signed it off yet. The text below is a description of what the
-- software in this repository does; it invents no registration number, no
-- postal address and no certification.

insert into public.site_pages (slug, title, summary, body, status, review_state) values
(
  'privacy',
  'Privacy notice',
  'What EduReach Hub collects, why it collects it, where it is stored and what you can ask us to do with it.',
  $privacy$<p>EduReach Hub is a study and student-services platform for people applying to, studying at, or preparing for Nigerian secondary and tertiary institutions. This notice explains what we hold about you and why. It is written to be read, not to protect us.</p>
<h2>What we collect</h2>
<ul>
<li><strong>Your account:</strong> your name and email address, and a password that is stored only as a hash by our authentication provider.</li>
<li><strong>Your academic profile:</strong> school, faculty, department, level, session, and, if you choose to add them, your matriculation or JAMB registration number.</li>
<li><strong>Service requests:</strong> the details you type into a request and any document you upload so we can act on it.</li>
<li><strong>CBT activity:</strong> the papers you start, the answers you submit, your score and the time you took.</li>
<li><strong>Your saved items and CGPA entries:</strong> pages you shortlist and results you enter in the calculators.</li>
<li><strong>Technical data:</strong> the page path you visited, the site that referred you, a rough browser description, and a random identifier kept for one browsing session so repeat page views are not counted twice.</li>
</ul>
<h2>What we do not collect</h2>
<p>We do not run advertising or third-party analytics scripts. We do not sell your data. We do not record what you type into a search box: the search screen sends the length of the term and how many results appeared, never the term itself.</p>
<h2>Why we hold it</h2>
<p>To sign you in, keep your practice history, run and mark a paper, process a service request you submitted, show you the status of that request, and understand which pages are working. Each of those is a reason you would expect; if a use is not obvious from the screen where the data is entered, we do not make it.</p>
<h2>Where it is stored</h2>
<p>Account, profile, request, CBT and saved-item data are stored in a Supabase (PostgreSQL) database and file storage, and the site is served by Netlify. Access is restricted row by row: a signed-in student can read their own rows and no one else's, and staff access to student records is limited by role.</p>
<h2>Who we share it with</h2>
<p>We share personal data with the infrastructure providers that host and run the service, and, where a request you submitted requires it, with the institution or agency you asked us to deal with. We do not sell it and we do not hand it to advertisers.</p>
<h2>How long we keep it</h2>
<p>A CBT result stays on your account until you delete it or close your account. A service request stays while the request is open and afterwards for as long as we may need it to answer a question or resolve a dispute about that request. If you want a record removed sooner, ask us and we will tell you what we can delete and what we are required to keep.</p>
<h2>Your rights</h2>
<p>The Nigeria Data Protection Act 2023 gives you the right to be told what we hold, to see it, to have mistakes corrected, to have data deleted where there is no lawful reason to keep it, to object to a use, and to complain to the Nigeria Data Protection Commission. You can exercise these rights by contacting us through the details on the contact page. We will ask you to prove you are the account holder before we act, because otherwise we would be giving your data to someone else.</p>
<h2>Children</h2>
<p>The service is intended for students aged 16 and above. If you are younger, use it with a parent or guardian.</p>
<h2>Changes</h2>
<p>When this notice changes, the new version replaces this page and the revision history records what changed and when. This version is a draft that has not yet been reviewed by a lawyer, and the page says so.</p>$privacy$,
  'published',
  'pending'
),
(
  'terms',
  'Terms of use',
  'The rules for using EduReach Hub, what the practice material is and is not, and what we are responsible for.',
  $terms$<p>These terms are the agreement between you and EduReach Hub when you use this site. By using it, you accept them. If you do not, please stop using the site.</p>
<h2>Your account</h2>
<p>Give accurate details, keep your password to yourself, and tell us if you think someone else has used your account. You are responsible for what is done through your account while it is in your hands. One person, one account: do not share a login to work around a limit.</p>
<h2>Practice material</h2>
<p>The questions in the CBT simulator are practice material. They are not the live examination, they are not leaked papers, and a score here is not a score from JAMB, WAEC, NECO or any university. Exam formats, subjects and rules change; always check the current requirements with the examination body or the institution itself.</p>
<h2>Service requests</h2>
<p>When you ask us to help with a service, you are asking us to act as an assistant, not as the institution. We do not decide admissions, results or fees, and we cannot promise an outcome. Give us complete and truthful information and the documents the service asks for; a request built on altered documents will be refused.</p>
<h2>What you must not do</h2>
<ul>
<li>Upload a document that is not yours or that you have altered.</li>
<li>Try to reach another student's data, or test the site's security without written permission.</li>
<li>Scrape the question bank, resell the material, or automate the simulator.</li>
<li>Use the site to harass anyone, or to submit a request that is fraudulent.</li>
</ul>
<h2>Content and ownership</h2>
<p>The site, its design and its written material belong to EduReach Hub. You keep ownership of what you upload, and you give us permission to store and use it for the purpose of the request you submitted. Practice questions drawn from public examination syllabi remain the work of their authors.</p>
<h2>Availability and liability</h2>
<p>We work to keep the site available, but we do not promise uninterrupted service. We are not liable for indirect losses, for an examination outcome, or for a decision made by an institution. Nothing in these terms removes a right the law gives you.</p>
<h2>Ending your access</h2>
<p>You may stop using the site at any time and ask us to close your account. We may suspend an account that breaks these terms, and we will tell you why.</p>
<h2>Law</h2>
<p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
<h2>Changes</h2>
<p>We will update this page when the terms change, and the revision history records each version. This version is a draft that has not yet been reviewed by a lawyer.</p>$terms$,
  'published',
  'pending'
),
(
  'cookies',
  'Cookies and browser storage',
  'The short version: no advertising cookies, no third-party trackers, and how to clear what we do keep.',
  $cookies$<p>This page describes what this site stores in your browser. It is short because there is not much.</p>
<h2>Advertising and tracking cookies</h2>
<p>None. There is no advertising network, no social media pixel and no third-party analytics script on this site.</p>
<h2>Sign-in storage</h2>
<p>When you sign in, our authentication provider stores a session token in your browser's local storage so you stay signed in between pages and can return later. Signing out removes it. Clearing site data in your browser also removes it, and you will be signed out.</p>
<h2>One session identifier</h2>
<p>To count page views without counting the same visit twice, the site creates a random identifier and keeps it in <strong>sessionStorage</strong> for that tab only. It is not a cookie, it is not shared with any other site, and it disappears when the tab closes. It is not linked to your name or your account.</p>
<h2>What is sent with a page view</h2>
<p>The page path, the site that referred you (without its query string), a rough browser description and that random identifier. Never what you typed into a form or a search box.</p>
<h2>Clearing what is stored</h2>
<p>Your browser's site-data settings let you remove everything this site has stored. Doing so signs you out but does not delete your account or your saved work, which live on the server.</p>
<h2>Changes</h2>
<p>If we ever add a cookie, this page will name it, say what it is for and ask for consent where the law requires it before it is set. This version is a draft pending legal review.</p>$cookies$,
  'published',
  'pending'
),
(
  'accessibility',
  'Accessibility',
  'What we have built for keyboard, screen-reader, low-vision and reduced-motion users, and how to tell us when it fails you.',
  $accessibility$<p>EduReach Hub is used by students on phones, in shared computer rooms and with assistive technology. Accessibility is part of the build, not a later pass.</p>
<h2>What is in place</h2>
<ul>
<li>Every page has one main heading, a skip link to the content, and landmarks a screen reader can jump between.</li>
<li>Keyboard focus is always visible, with a two-tone ring that works on light and dark surfaces.</li>
<li>Primary controls are at least 44 pixels tall on touch screens.</li>
<li>Status is never carried by colour alone: a badge says what it means in words.</li>
<li>Animations stop when your device asks for reduced motion.</li>
<li>Text contrast is checked against WCAG 2.2 AA and the measured pairs are recorded in the project documentation. Disabled controls are the one exception, which the standard exempts.</li>
<li>The site works at 320 pixels wide, the narrowest phone width in common use, without horizontal scrolling.</li>
</ul>
<h2>Where we know we fall short</h2>
<p>We test with automated checks, a keyboard and a small set of screen readers, not with every assistive technology in use. A PDF you download from a service page may have been supplied by an institution and may not be tagged for screen readers. If a document you need is not accessible, ask us and we will send the information in another form.</p>
<h2>Telling us about a barrier</h2>
<p>Contact us through the contact page and say what you were trying to do, what happened and which browser or assistive technology you were using. We will reply, and we will not ask you to prove that the barrier was real.</p>
<h2>Changes</h2>
<p>This page is a draft pending legal review.</p>$accessibility$,
  'published',
  'pending'
),
(
  'disclaimer',
  'Disclaimer',
  'EduReach Hub is a study and assistance service. It is not JAMB, WAEC, NECO, a university or a government agency.',
  $disclaimer$<p>EduReach Hub is an independent study and student-services platform. We are not JAMB, WAEC, NECO, NABTEB, the Joint Admissions and Matriculation Board, any university, polytechnic or college of education, or any government agency, and we do not speak for them.</p>
<h2>Examination information</h2>
<p>Dates, fees, subject combinations, cut-off marks and admission rules change, and they are set by the examination body or the institution, not by us. We point you to the official source where we can. Before you rely on a date or a requirement, confirm it with the body that sets it.</p>
<h2>Practice questions</h2>
<p>Practice questions are study material. They are not live examination questions and they are not leaked papers. Where a question's provenance has not been verified, the bank says so; where an editor has rejected a question, it is not served at all.</p>
<h2>Service outcomes</h2>
<p>We help you prepare and submit a request. We do not decide the result, and we cannot promise that an application will succeed.</p>
<h2>External links</h2>
<p>Where we link to another site, that site's content and privacy practices are its own.</p>
<h2>Changes</h2>
<p>This page is a draft pending legal review.</p>$disclaimer$,
  'published',
  'pending'
),
(
  'contact',
  'Contact EduReach',
  'How to reach a person, and what to include so your message can be answered on the first reply.',
  $contact$<p>We answer messages from students, parents and school staff. The contact details configured for this site are shown on this page, and WhatsApp is the fastest channel.</p>
<h2>What to include</h2>
<ul>
<li>What you were trying to do, and the page you were on.</li>
<li>The reference number of a service request, if your question is about one.</li>
<li>What happened, in your own words. A screenshot helps if the problem is on screen.</li>
<li>For an accessibility problem, the browser or assistive technology you were using.</li>
</ul>
<h2>What we will not ask for</h2>
<p>We will never ask for your password, your card details or a one-time code in a chat. If someone claiming to be from EduReach asks for any of those, stop and report it to us through the details on this page.</p>
<h2>Data requests</h2>
<p>To see, correct or delete the data on your account, say so in your message. We will confirm you are the account holder before we act.</p>
<h2>Changes</h2>
<p>This page is a draft pending legal review.</p>$contact$,
  'published',
  'pending'
)
on conflict (slug) do nothing;

-- Seed the first revision of each page so the history is complete from day one.
insert into public.site_page_revisions (slug, revision, title, summary, body, status, review_state)
select slug, revision, title, summary, body, status, review_state
from public.site_pages
where not exists (
  select 1 from public.site_page_revisions r where r.slug = public.site_pages.slug
);

commit;
