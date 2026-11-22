-- Verified scholarship content for the 2026/2027 window.
--
-- Every row below was checked against the provider's own portal on 2026-11-22
-- (the `verified_at` value). Nothing here is estimated: an award, deadline or
-- eligibility line that could not be read on the provider's page is left NULL
-- and the card says so. The URLs are the providers' own application pages.
--
-- Two listings are currently open, one is an international postgraduate
-- opportunity, one is announced but has no published portal, and one 2026
-- scheme is kept in the archive on purpose: it proves that a closed listing
-- leaves the active feed instead of being deleted or shown as open.
--
-- `on conflict (slug) do nothing`: a replayed seed never overwrites a correction
-- an editor made through the console.

insert into public.opportunities (
  slug, title, organisation, category, description, link_url, deadline,
  locations, is_active, is_featured, published_at, expires_at, status,
  award, study_level, eligibility, source_name, last_verified_at, verified_at,
  education_levels, disciplines, subcategory
) values
  (
    'nnpc-totalenergies-national-merit-scholarship-2026',
    'NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027',
    'NNPC Limited and TotalEnergies Upstream Nigeria Limited (TUPNI)',
    'scholarship',
    'Annual scholarship grant for first-year and second-year full-time undergraduates at NUC-accredited Nigerian universities, irrespective of course of study. Applications are online only through the TotalEnergies scholarship portal and are free.',
    'https://csr-ngscholarship.totalenergies.com/scholarships/nmss',
    '2026-12-07',
    'Nigeria',
    true,
    true,
    timestamptz '2026-11-10 09:00:00+01',
    timestamptz '2026-12-08 00:00:00+01',
    'published',
    'An annual scholarship grant from the year of award to the completion of the undergraduate programme.',
    'Undergraduate (100 and 200 level)',
    'Nigerian student registered for full-time undergraduate study at an NUC-accredited Nigerian university; certified 100- or 200-level student at the time of application; UTME score of at least 200; 200-level applicants need a CGPA of at least 2.5 on a 5.0 scale. Not open to current beneficiaries of similar oil and gas industry awards.',
    'TotalEnergies Scholarship Portal',
    timestamptz '2026-11-22 10:00:00+01',
    timestamptz '2026-11-22 10:00:00+01',
    array['Undergraduate'],
    array['All disciplines'],
    'Undergraduate scholarship'
  ),
  (
    'nnpc-snepco-national-university-scholarship-2026',
    'NNPC / SNEPCo National University Scholarship 2026',
    'NNPC Limited and Shell Nigeria Exploration and Production Company (SNEPCo)',
    'scholarship',
    'Yearly grant for Nigerian second-year undergraduates in NUC-accredited public universities, awarded from second year to the completion of the degree. Applications are free and submitted only through the Scholastica portal; female candidates are strongly encouraged to apply.',
    'https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26',
    '2026-11-30',
    'Nigeria',
    true,
    true,
    timestamptz '2026-11-01 09:00:00+01',
    timestamptz '2026-12-01 00:00:00+01',
    'published',
    'A yearly grant from second year to the completion of the undergraduate programme.',
    'Undergraduate (200 level)',
    'Nigerian citizen; currently in the second year of full-time study at a public Nigerian university accredited by the NUC; minimum CGPA of 3.5 on a 5-point scale or its equivalent; not a beneficiary of any other scholarship from an oil and gas organisation, national or international.',
    'SNEPCo scholarship application (Scholastica portal)',
    timestamptz '2026-11-22 10:05:00+01',
    timestamptz '2026-11-22 10:05:00+01',
    array['Undergraduate'],
    array['All disciplines'],
    'Undergraduate scholarship'
  ),
  (
    'nnpc-totalenergies-international-scholarship-2027',
    'NNPC Limited / TotalEnergies International Scholarship (TIS)',
    'NNPC Limited and TotalEnergies',
    'scholarship',
    'International scholarship for young Nigerian graduates pursuing master''s study in France. The TotalEnergies scholarship portal lists this programme as open with a 31 January 2027 closing date; review the programme page for the current eligibility and document list before applying.',
    'https://csr-ngscholarship.totalenergies.com/scholarships',
    '2027-01-31',
    'Nigeria / France',
    true,
    false,
    timestamptz '2026-11-10 09:00:00+01',
    timestamptz '2027-02-01 00:00:00+01',
    'published',
    'A full-board scholarship (as stated on the TotalEnergies scholarship portal).',
    'Postgraduate (master''s)',
    'Young Nigerian graduates pursuing master''s study in France. Check the programme page for the full eligibility and document requirements; EduReach has not restated conditions the portal does not publish.',
    'TotalEnergies Scholarship Portal',
    timestamptz '2026-11-22 10:10:00+01',
    timestamptz '2026-11-22 10:10:00+01',
    array['Postgraduate'],
    array['All disciplines'],
    'International scholarship'
  ),
  (
    'aliko-dangote-foundation-undergraduate-scholarship',
    'Aliko Dangote Foundation Undergraduate Scholarship',
    'Aliko Dangote Foundation',
    'scholarship',
    'The Foundation has announced an undergraduate scholarship programme for students in Nigerian federal and state universities. An application portal and the full guidelines have not been published. EduReach lists it so students can watch the official source; no deadline or award is stated here because neither has been announced.',
    'https://www.alikodangotefoundation.org/',
    null,
    'Nigeria',
    true,
    false,
    timestamptz '2026-11-22 10:15:00+01',
    null,
    'published',
    null,
    'Undergraduate',
    'Not yet published by the Foundation. Public announcements describe a first phase across federal and state universities with priority for science, technology, engineering and medicine. Confirm every requirement on the Foundation''s own announcement before applying.',
    'Aliko Dangote Foundation',
    timestamptz '2026-11-22 10:15:00+01',
    timestamptz '2026-11-22 10:15:00+01',
    array['Undergraduate'],
    array['Science', 'Technology', 'Engineering', 'Medicine'],
    'Undergraduate scholarship'
  ),
  (
    'mtn-foundation-scholarship-2026',
    'MTN Foundation Scholarship 2026',
    'MTN Foundation',
    'scholarship',
    'The 2026 MTN Foundation scholarship cycle closed on 31 May 2026. This record is kept so students can see the scheme''s requirements and prepare for the next cycle; it is not an open opportunity.',
    'https://apps.mtn.ng/scholarships/form',
    '2026-05-31',
    'Nigeria',
    false,
    false,
    timestamptz '2026-04-01 09:00:00+01',
    timestamptz '2026-06-01 00:00:00+01',
    'archived',
    'Awards of ₦300,000 per academic year until graduation, for the categories the Foundation publishes each cycle.',
    'Undergraduate (300 level science and technology; 200 and 300 level blind students)',
    'Nigerian students in public tertiary institutions, in the levels and disciplines the Foundation publishes for each cycle. Requirements change between cycles; read the current scholarship page before applying.',
    'MTN Foundation scholarship portal',
    null,
    null,
    array['Undergraduate'],
    array['Science', 'Technology', 'Engineering'],
    'Undergraduate scholarship'
  )
on conflict (slug) do nothing;
