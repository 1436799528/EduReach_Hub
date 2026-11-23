-- Homepage engagement: editable reviews, database-backed FAQ, and social/contact settings.
--
-- Extends the review system added in 20261122120000 instead of creating a second
-- table. Reviews become editorially managed (display name, avatar, description,
-- ordering, feature flag, placeholder marker), while the public rating still
-- counts only approved rows and never counts a placeholder as a real opinion.
--
-- FAQ content moves from src/data/faq.ts into two tables so an administrator can
-- add, reorder, publish and hide questions without a deploy. The seed below is
-- the same copy the Help page shipped with, plus the general and support
-- answers the homepage needs.
--
-- No client role receives access to any of these tables or functions. The API
-- uses the service role after capability checks, and records an audit row for
-- every privileged change.

-- ---------------------------------------------------------------------------
-- 1. Reviews become editorially managed
-- ---------------------------------------------------------------------------

alter table public.reviews
  alter column user_id drop not null,
  add column if not exists display_name text,
  add column if not exists profile_image text,
  add column if not exists student_description text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists display_order integer not null default 0;

do $reviews_columns$
begin
  if not exists (select 1 from pg_constraint where conname = 'reviews_display_name_length') then
    alter table public.reviews
      add constraint reviews_display_name_length
      check (display_name is null or char_length(btrim(display_name)) between 2 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_description_length') then
    alter table public.reviews
      add constraint reviews_description_length
      check (student_description is null or char_length(btrim(student_description)) between 2 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_profile_image_https') then
    alter table public.reviews
      add constraint reviews_profile_image_https
      check (profile_image is null or profile_image ~ '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_display_order_range') then
    alter table public.reviews
      add constraint reviews_display_order_range
      check (display_order between 0 and 10000);
  end if;
end
$reviews_columns$;

-- The homepage carousel reads featured first, then the editor's order, then
-- newest. The partial index keeps that plan cheap without indexing hidden rows.
create index if not exists reviews_public_order_idx
  on public.reviews (is_featured desc, display_order asc, created_at desc)
  where status = 'approved';

comment on column public.reviews.display_name is
  'The name shown publicly. For a student submission it is normally empty and the profile name is used; an editor may set a display name without changing the account.';
comment on column public.reviews.profile_image is
  'An HTTPS avatar URL stored by the admin upload endpoint. NULL renders a neutral default avatar; no stock face is used.';
comment on column public.reviews.is_placeholder is
  'A sample row seeded to keep the homepage honest and non-empty during setup. Excluded from the rating average and labelled as a sample wherever it is shown.';
comment on column public.reviews.is_featured is
  'Featured reviews lead the homepage carousel. It is an editorial choice, not a rating bonus.';

-- Keep the moderation view readable and include the editorial fields. The
-- COALESCE gives a row a name without ever selecting an email address.
-- Postgres cannot reorder or insert columns in CREATE OR REPLACE VIEW, so the
-- view is replaced rather than altered; its grants are restored below.
drop view if exists public.review_moderation_queue;
create view public.review_moderation_queue as
  select
    r.id,
    r.user_id,
    r.rating,
    r.review_text,
    r.exam_type,
    r.status,
    r.moderation_note,
    r.created_at,
    r.updated_at,
    r.profile_image,
    r.student_description,
    r.is_featured,
    r.is_placeholder,
    r.display_order,
    coalesce(
      nullif(btrim(coalesce(r.display_name, '')), ''),
      nullif(btrim(coalesce(p.full_name, '')), ''),
      'EduReach student'
    ) as display_name
  from public.reviews r
  left join public.profiles p on p.id = r.user_id;

revoke all on public.review_moderation_queue from public, anon, authenticated;
grant select on public.review_moderation_queue to service_role;

-- Placeholders keep the homepage from looking abandoned before real feedback
-- exists, but they must never inflate the published rating. The count and the
-- average both ignore them.
create or replace function public.review_rating_summary()
returns table(review_count bigint, average_rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint,
         case when count(*) = 0 then null else round(avg(rating)::numeric, 2) end
  from public.reviews
  where status = 'approved' and is_placeholder = false;
$$;

revoke all on function public.review_rating_summary() from public, anon, authenticated, service_role;
grant execute on function public.review_rating_summary() to service_role;

-- Three editable sample rows. They say what they are, they carry the
-- placeholder flag the console shows, and they are excluded from the average.
insert into public.reviews
  (user_id, rating, review_text, status, display_name, student_description, is_placeholder, display_order, is_featured)
select null, v.rating, v.review_text, 'approved', v.display_name, v.student_description, true, v.ord, false
  from (values
    (5, 'Sample review — replace this with the words of a student who has used EduReach Hub.', 'Sample student', 'Replace this sample from Reviews Management', 1),
    (4, 'This is a placeholder review. Publish real student feedback from Reviews Management when it is available.', 'Sample candidate', 'Placeholder — not a real testimonial', 2),
    (5, 'Placeholder entry. Use Reviews Management to edit, replace, hide or delete this sample.', 'Sample learner', 'Placeholder — not a real testimonial', 3)
  ) as v(rating, review_text, display_name, student_description, ord)
where not exists (select 1 from public.reviews where is_placeholder = true);

-- ---------------------------------------------------------------------------
-- 2. FAQ categories and questions
-- ---------------------------------------------------------------------------

create table if not exists public.faq_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  label text not null check (char_length(btrim(label)) between 2 and 60),
  description text not null default '' check (char_length(description) <= 200),
  display_order integer not null default 0 check (display_order between 0 and 1000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.faq_categories(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 8 and 200),
  answer text not null check (char_length(btrim(answer)) between 20 and 4000),
  display_order integer not null default 0 check (display_order between 0 and 10000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, question)
);

create index if not exists faq_items_public_idx
  on public.faq_items (category_id, display_order asc)
  where is_published = true;

alter table public.faq_categories enable row level security;
alter table public.faq_items enable row level security;
revoke all on public.faq_categories, public.faq_items from public, anon, authenticated;
grant select, insert, update, delete on public.faq_categories, public.faq_items to service_role;

create or replace function public.faq_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all on function public.faq_touch_updated_at() from public, anon, authenticated, service_role;

drop trigger if exists faq_categories_touch_updated_at on public.faq_categories;
create trigger faq_categories_touch_updated_at
  before update on public.faq_categories
  for each row execute function public.faq_touch_updated_at();

drop trigger if exists faq_items_touch_updated_at on public.faq_items;
create trigger faq_items_touch_updated_at
  before update on public.faq_items
  for each row execute function public.faq_touch_updated_at();

comment on table public.faq_categories is
  'Editable help-centre categories, ordered for the homepage and the Help page. Server-only: the public API reads published rows.';
comment on table public.faq_items is
  'Editable questions and answers. Only published rows reach a visitor.';

insert into public.faq_categories (display_order, slug, label, description, is_published) values
  (1, 'general', 'General questions', 'What EduReach Hub is and how to reach a person.', true),
  (2, 'account', 'Account registration and login', 'Creating an account, signing in and recovering access.', true),
  (3, 'cbt', 'CBT simulators', 'How a timed practice paper behaves.', true),
  (4, 'exams', 'JAMB, WAEC, NECO and Post-UTME', 'Subjects, paper structure and what the simulator copies.', true),
  (5, 'past-questions', 'Past questions', 'Where the papers come from and how they become practice questions.', true),
  (6, 'scholarships', 'Scholarships and opportunities', 'Finding, checking and applying for funding.', true),
  (7, 'payments', 'Payments and subscriptions', 'Requesting a paid service and what happens after payment.', true),
  (8, 'support', 'Technical support', 'Reporting a problem and keeping your work safe.', true)
on conflict (slug) do update set label = excluded.label, description = excluded.description where public.faq_categories.label is distinct from excluded.label or public.faq_categories.description is distinct from excluded.description;

insert into public.faq_items (category_id, display_order, question, answer, is_published)
select c.id, v.ord, v.question, v.answer, true
  from (values
  ('general', 1, 'What is EduReach Hub?', 'EduReach Hub is a Nigerian study platform for CBT practice, past questions and guided student services. You can practise JAMB, WAEC, NECO and Post-UTME papers, read verified education news, find scholarships and request help with services such as result checking or admission letters. Browsing and a short practice paper do not need an account; timed exams, saved results, service requests and reviews do.'),
  ('general', 2, 'How do I contact EduReach Hub support?', 'Use the contact page or the email and WhatsApp details shown in the footer. Signed-in students can also reply on a service request from the dashboard. Never send your password, a one-time code or full payment card details.'),
  ('account', 1, 'How do I create an account?', 'Open /register, enter your name, email and a password, then confirm your email address from the message we send. You can browse most of the site without an account; one is needed to sit a timed exam, save results, request a service or submit a review.'),
  ('account', 2, 'How do I reset my password?', 'Use “Forgot password” on the sign-in page. We email a recovery link to the address on your account; the link expires, so use it promptly. If the email does not arrive, check the spam folder before contacting us.'),
  ('account', 3, 'How do I update my profile?', 'Sign in and open Dashboard → Profile. Your school, department, level and matric number are used to match practice papers and past questions to your programme, so keep them accurate. Changes save to your account, not just to this browser.'),
  ('account', 4, 'How do I upload or change my profile photo?', 'Open Dashboard → Profile → Photo. The image must be a JPG, PNG or WebP under the size limit shown beside the control. The photo is stored on our media service and appears on your profile; you can replace it at any time.'),
  ('cbt', 1, 'How does the CBT simulator work?', 'Choose an exam body (JAMB, WAEC, NECO or Post-UTME), pick your subjects and start a paper. The timer counts down from the duration set for that paper. Questions come from the reviewed question bank for the subjects you selected; you answer, navigate between questions, and submit before time runs out.'),
  ('cbt', 2, 'Can I practise without taking a “real” exam?', 'Yes. Practice mode gives you immediate feedback after you submit and does not pretend to be an official examination. Guest practice is available for a short paper without an account; a signed-in attempt is saved to your results so you can compare later.'),
  ('cbt', 3, 'How are questions selected?', 'The server builds each paper from approved questions in the selected exam body and subjects, following the paper rules for that exam (number of questions and duration). The same request decides the paper for every student, so refreshing the page does not reroll your questions.'),
  ('cbt', 4, 'Can I change my answers?', 'Yes, while the paper is open. Select another option and the previous answer for that question is replaced. Answers are locked when you submit or when the timer reaches zero.'),
  ('cbt', 5, 'What happens if my internet connection drops?', 'Your answers and the paper are kept on this device, and the page tries to resync when the connection returns. If the connection stays down until time expires, the paper is sealed locally and submitted on reconnect; you do not lose answers you had already selected. Do not clear browser data or use private browsing during an exam.'),
  ('cbt', 6, 'Are my answers saved automatically?', 'Yes. Each selection is written to local storage first and sent to the server as you go. The status line on the exam screen tells you whether the latest answer has reached the server, so you are not guessing.'),
  ('cbt', 7, 'How do I submit an examination?', 'Use “Submit” on the exam screen and confirm. You will see a summary of answered and unanswered questions before the paper closes. Submitting early is allowed; the remaining time is not added to your score.'),
  ('cbt', 8, 'Can I review previous questions?', 'Yes. The question navigator lists every question and its state (answered, unanswered, flagged). Move back to any question while the paper is still open, or review the whole paper from the result screen after submission.'),
  ('cbt', 9, 'How is my score calculated?', 'Each correct answer adds the marks set for that question (one mark unless stated otherwise). The score is the total marks earned out of the total marks available, shown as a percentage. Unanswered questions earn nothing and are not penalised further.'),
  ('exams', 1, 'How do I select subjects?', 'On the practice setup screen, choose the subjects listed for that exam body. JAMB papers use Use of English plus your other chosen subjects. A paper needs at least one subject with approved questions available.'),
  ('exams', 2, 'Is English automatically included where required?', 'For JAMB, Use of English is part of the paper structure and is selected with the exam rather than left out by accident. For WAEC, NECO and Post-UTME, choose the subjects you are preparing for; the setup screen tells you when a subject has no approved questions yet.'),
  ('exams', 3, 'How many questions are available?', 'It depends on the bank. The admin console shows the real number per exam body, and the setup screen only offers subjects that have approved questions. We do not pad a subject with placeholder questions to make the number look larger.'),
  ('exams', 4, 'Does the simulator follow the actual exam structure?', 'It follows the paper structure we have verified for the selected exam body, and the console records whether that structure is verified, partially verified or unverified. JAMB, WAEC and NECO have changed formats over the years, so always check the exam body’s current instructions for the real examination.'),
  ('exams', 5, 'Can I practise past questions?', 'Yes. Past-question papers are listed on /past-questions, and questions extracted from a paper can be sat in the simulator once an editor has reviewed and approved them. A PDF on its own is a document, not a live question.'),
  ('past-questions', 1, 'Where do the past questions come from?', 'From papers uploaded by the EduReach team and, where allowed, from official exam-body material. Each resource records its source and year. We do not label a paper as official when we cannot show where it came from.'),
  ('past-questions', 2, 'How are questions added?', 'An administrator uploads a PDF, the text is extracted, and the parsed questions wait in a review queue. An editor checks the wording, the options and the answer key, corrects what the parser got wrong, and only then approves. Extraction alone never publishes a question.'),
  ('past-questions', 3, 'Can I practise questions from previous years?', 'Yes, when that paper has been uploaded and its questions approved. The past-question library lists the year for each resource, and approved questions keep a link to the paper they came from so a wrong item can be traced and corrected.'),
  ('past-questions', 4, 'How are answer keys verified?', 'A reviewer compares each key against the source paper before approval. When a key is wrong after publication, a correction is made in the console and affected submitted attempts can be regraded from the answers those students stored. A student can also report a problem from the review screen.'),
  ('scholarships', 1, 'How do I apply for a scholarship?', 'Open the scholarship card, read the eligibility and deadline, then use “Apply” to reach the provider’s own application page. EduReach does not submit applications on your behalf and is not part of the selection process.'),
  ('scholarships', 2, 'Does EduReach Hub collect scholarship application fees?', 'No. We do not collect money for a scholarship application, and no one at EduReach will ask you to pay to be shortlisted. If a provider charges a fee, that is between you and the provider and should be stated on their official page.'),
  ('scholarships', 3, 'How do I verify a scholarship?', 'Each card shows who offers it, the date EduReach last checked the provider’s page, and a link to that page. Follow the link and confirm the deadline and requirements there before you share personal documents. A listing marked “Not yet checked” has not been verified by us.'),
  ('scholarships', 4, 'What happens when a scholarship deadline passes?', 'The listing leaves the active list automatically and moves to the archive, where it stays readable for reference. It is never shown as “Open” or “Closing Soon” after the deadline.'),
  ('payments', 1, 'What happens after payment?', 'A paid service request moves into the queue with a reference code you can see in your dashboard. If a payment is still being confirmed, the request says so rather than showing a false success. Keep the reference code when you contact support.'),
  ('payments', 2, 'How do I access purchased content?', 'Sign in with the same account you used to pay. Purchased or granted access is attached to that account, not to the device, so it is available in Dashboard → Tools and in the relevant service or practice page.'),
  ('payments', 3, 'What should I do if payment succeeds but access is not granted?', 'Do not pay twice. Open the request in your dashboard and send us the reference code and the payment time through the contact page, and we will reconcile it against the payment record.'),
  ('support', 1, 'How is my information protected?', 'Signed-in reads and writes are checked on the server against your account, and database row-level security stops a student session from reading another student’s rows. Sensitive operations run through server endpoints that verify your session before doing anything.'),
  ('support', 2, 'Can I delete my account?', 'Account deletion is handled by the EduReach team at the moment: contact us from the email address on the account. Some records, such as payment and audit history, may be kept where the law or fraud prevention requires it; the privacy notice explains the retention position.'),
  ('support', 3, 'What happens to my exam history?', 'Submitted attempts are kept so you can review your results and see progress. Practice history is yours; staff can see attempt metadata for support and question-quality work, but not to sell or publish it. You can ask us about your data using the contact page.'),
  ('support', 4, 'What should I do if a question or answer appears incorrect?', 'Open the result review screen and use the report control on the question, or contact support with the exam, subject and question text. A reviewer checks the answer key against the source paper. If the key is wrong, it is corrected and affected submitted attempts can be regraded from the answers those students stored.'),
  ('support', 5, 'How do I report a technical problem?', 'Tell us the page, what you expected and what happened, and roughly when it happened. Do not send your password or payment card details. If the problem happens during an exam, keep the page open and do not clear browser data, so answers already saved on the device can be recovered.'),
  ('support', 6, 'Which devices can I use?', 'EduReach Hub works in current versions of Chrome, Edge, Firefox and Safari on phones, tablets and computers. A stable connection is recommended for timed papers; practice answers are kept on the device if the connection drops.')
  ) as v(slug, ord, question, answer)
  join public.faq_categories c on c.slug = v.slug
on conflict (category_id, question) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Social platforms are configurable, but no profile URL is invented
-- ---------------------------------------------------------------------------
-- The footer already reads the `social` settings group. Seed the eight
-- supported platforms with no URL so the icons exist and are visibly
-- unconfigured; an administrator supplies the real profile addresses. An
-- existing list is never overwritten, so a deployment cannot erase links the
-- team has already entered.

update public.site_settings
   set value = jsonb_build_object(
         'links',
         jsonb_build_array(
           jsonb_build_object('platform', 'facebook',  'label', 'Facebook',     'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'instagram', 'label', 'Instagram',    'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'tiktok',    'label', 'TikTok',       'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'youtube',   'label', 'YouTube',      'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'x',         'label', 'X (Twitter)',  'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'whatsapp',  'label', 'WhatsApp',     'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'linkedin',  'label', 'LinkedIn',     'handle', '', 'url', '', 'visible', true),
           jsonb_build_object('platform', 'telegram',  'label', 'Telegram',     'handle', '', 'url', '', 'visible', true)
         )
       ),
       updated_at = now()
 where key = 'social'
   and (value->'links' is null or value->'links' = '[]'::jsonb);
