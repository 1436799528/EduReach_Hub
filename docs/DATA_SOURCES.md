# EduReach Data Sources

## University directory

The initial production university directory was seeded from the National Universities Commission (NUC) Nigerian University System directory on 20 September 2026.

- Source: https://enuc.nuc.edu.ng/nus
- Initial production rows: 329 universities in `public.institutions`
- These records are marked `is_verified = true` and `institution_type = 'university'`.
- Programme, department, faculty, course, fee, cutoff and admission data are intentionally not fabricated. Those datasets should be imported from the relevant official institution/regulator sources and then reviewed through the EduReach admin workflow.

## CBT

The production CBT schema is ready. Question-bank content should be loaded from EduReach-owned/licensed past-question material supplied by the project owner. Do not scrape or republish copyrighted question banks without permission.

## Service catalogue

The active service catalogue is seeded in Supabase. Service prices, official portal URLs, vouchers, payment credentials and other operational values remain configurable and should be entered only after they are verified.

## Operational WhatsApp

Submitted service requests are assigned a database reference code and the student is redirected to the EduReach WhatsApp handling number configured in the frontend workflow.
