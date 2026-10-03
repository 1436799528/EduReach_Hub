-- Verify and reconcile the two seeded opportunity records against their first-party sources.
-- Do not invent a deadline for the Dangote Foundation scholarship: the NUC source
-- says the programme is scheduled to commence in October 2026 but does not publish
-- an application deadline.

update public.opportunities
set source_name = 'National Universities Commission',
    eligibility = 'Undergraduate students of Nigerian Federal and State Universities in STEM and related disciplines; minimum CGPA 2.5 (Second Class Lower equivalent). Five percent of the first-phase quota is reserved for students living with disabilities.',
    last_verified_at = now(),
    updated_at = now()
where title = 'Aliko Dangote Foundation scholarship for Nigerian public university undergraduates';

-- The S-VCG current cycle closed on 30 September 2026, so it must not remain
-- presented as an active opportunity.
update public.opportunities
set source_name = 'Student Venture Capital Grant (S-VCG)',
    link_url = 'https://www.svcg.education.gov.ng/',
    deadline = '2026-09-30',
    eligibility = 'Students currently enrolled in Nigerian tertiary institutions; applicants must be at least 300 level or equivalent, or participate on a team led by a 300-level-or-above student. The current cycle requires a CAC-registered business and a project beyond proof of concept in STEMM areas.',
    last_verified_at = now(),
    is_active = false,
    closed_at = coalesce(closed_at, now()),
    updated_at = now()
where title = 'Student Venture Capital Grant (S-VCG)';
