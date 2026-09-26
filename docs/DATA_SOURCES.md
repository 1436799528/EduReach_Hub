# EduReach Data Sources

## University directory

The initial production university directory was seeded from the National Universities Commission (NUC) Nigerian University System directory on 20 September 2026.

- Source: https://enuc.nuc.edu.ng/nus
- Initial production rows: 329 universities in `public.institutions`
- These records are marked `is_verified = true` and `institution_type = 'university'`.
- Programme, department, faculty, course, fee, cutoff and admission data are intentionally not fabricated. Those datasets should be imported from the relevant official institution/regulator sources and then reviewed through the EduReach admin workflow.

## News (Newsroom CMS)

`public.news_articles` is the single source of truth for the public News page, the homepage “Latest Educational News”, the Featured block and search results. There is **no** static or fallback news dataset anywhere in the frontend.

- Every row is authored through **Admin → Newsroom CMS**: title, slug, excerpt, category, featured image, rich body, source name, source URL, publication date, draft/published state, featured state and tags.
- Images are uploaded to Supabase Storage (`admin-content` bucket) and the resulting URL is stored on the article row; each article renders its own image. Articles without an image render an intentional neutral placeholder — never a shared stock photo.
- Unpublished rows are drafts; the public only ever reads `published = true`, ordered by `published_at`.
- The three prototype rows seeded by `20260915_application_integration_seed.sql` are removed by `20260927000000_postmerge_data_control.sql`. If the news feed is empty, the site shows an honest empty state, not invented stories.

## CBT

The production CBT schema (`cbt_exams`, `exam_questions`, `cbt_attempts`, `cbt_answers`) is the single source of truth for the `/cbt` question banks, `/cbt/setup/*` default durations and the practice hall.

- Exams and their questions are managed in **Admin → CBT Manager**. Approved/licensed question sets are attached to the matching exam there; the public CBT page reads the same catalogue. Do not scrape or republish copyrighted question banks without permission.
- The seeded “EduReach General Practice Demo” bank is deactivated by `20260927000000_postmerge_data_control.sql` so a prototype question set is not presented as production content.
- Durations: the exam's `duration_minutes` is the default shown on the setup page; cards never show a time, and the live countdown only appears once a session starts.
- Local (unconfigured) preview keeps a documented in-memory practice set so the CBT flow can be exercised without a backend; it never renders when Supabase is configured.

## Past questions & study materials

Scribd was removed entirely on 2026-09-27. Material cards no longer link to any third-party reading platform; they route into first-party CBT practice where a bank is configured, or into EduReach's own WhatsApp request channel. `edureach_material_notes` remains student-owned notes, not staff content.

## Service catalogue

The active service catalogue is seeded in Supabase. Service descriptions, official portal URLs and other operational values remain configurable and should be entered only after they are verified. Legacy scratch-card inventory is retired from the active catalogue.

## Operational WhatsApp

Submitted service requests are assigned a database reference code and the student is redirected to the EduReach WhatsApp handling number configured in the frontend workflow.
