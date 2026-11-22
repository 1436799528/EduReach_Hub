import type { Opportunity } from '../lib/api';

/**
 * The reviewed scholarships, for a deployment with no database configured.
 *
 * This is not invented sample content: it mirrors
 * `supabase/migrations/20261122121000_seed_verified_scholarships.sql`, which is
 * the production source. It exists because the local preview (and the browser
 * tests) run without a Supabase project, and an empty Scholarship page would
 * hide the layout, the lifecycle states and the archive from the people
 * reviewing the change.
 *
 * When Supabase is configured this list is never read: the API is the only
 * source, so an expired or corrected row cannot be shadowed by a stale copy
 * here.
 */
export const SCHOLARSHIP_SEED: Opportunity[] = [
  {
    id: 'nnpc-totalenergies-national-merit-scholarship-2026',
    slug: 'nnpc-totalenergies-national-merit-scholarship-2026',
    title: 'NNPC Limited / TotalEnergies National Merit Scholarship Scheme 2026/2027',
    organisation: 'NNPC Limited and TotalEnergies Upstream Nigeria Limited (TUPNI)',
    category: 'scholarship',
    subcategory: 'Undergraduate scholarship',
    description:
      'Annual scholarship grant for first-year and second-year full-time undergraduates at NUC-accredited Nigerian universities, irrespective of course of study. Applications are online only through the TotalEnergies scholarship portal and are free.',
    link_url: 'https://csr-ngscholarship.totalenergies.com/scholarships/nmss',
    deadline: '2026-12-07',
    locations: 'Nigeria',
    eligibility:
      'Nigerian student registered for full-time undergraduate study at an NUC-accredited Nigerian university; certified 100- or 200-level student at the time of application; UTME score of at least 200; 200-level applicants need a CGPA of at least 2.5 on a 5.0 scale. Not open to current beneficiaries of similar oil and gas industry awards.',
    study_level: 'Undergraduate (100 and 200 level)',
    award: 'An annual scholarship grant from the year of award to the completion of the undergraduate programme.',
    education_levels: ['Undergraduate'],
    disciplines: ['All disciplines'],
    published_at: '2026-11-10T08:00:00.000Z',
    expires_at: '2026-12-07T23:00:00.000Z',
    status: 'published',
    is_active: true,
    is_featured: true,
    source_name: 'TotalEnergies Scholarship Portal',
    last_verified_at: '2026-11-22T09:00:00.000Z',
    verified_at: '2026-11-22T09:00:00.000Z',
  },
  {
    id: 'nnpc-snepco-national-university-scholarship-2026',
    slug: 'nnpc-snepco-national-university-scholarship-2026',
    title: 'NNPC / SNEPCo National University Scholarship 2026',
    organisation: 'NNPC Limited and Shell Nigeria Exploration and Production Company (SNEPCo)',
    category: 'scholarship',
    subcategory: 'Undergraduate scholarship',
    description:
      'Yearly grant for Nigerian second-year undergraduates in NUC-accredited public universities, awarded from second year to the completion of the degree. Applications are free and submitted only through the Scholastica portal; female candidates are strongly encouraged to apply.',
    link_url: 'https://candidate.scholastica.ng/schemes/NNPCLTDSNEPCo26',
    deadline: '2026-11-30',
    locations: 'Nigeria',
    eligibility:
      'Nigerian citizen; currently in the second year of full-time study at a public Nigerian university accredited by the NUC; minimum CGPA of 3.5 on a 5-point scale or its equivalent; not a beneficiary of any other scholarship from an oil and gas organisation, national or international.',
    study_level: 'Undergraduate (200 level)',
    award: 'A yearly grant from second year to the completion of the undergraduate programme.',
    education_levels: ['Undergraduate'],
    disciplines: ['All disciplines'],
    published_at: '2026-11-01T08:00:00.000Z',
    expires_at: '2026-11-30T23:00:00.000Z',
    status: 'published',
    is_active: true,
    is_featured: true,
    source_name: 'SNEPCo scholarship application (Scholastica portal)',
    last_verified_at: '2026-11-22T09:05:00.000Z',
    verified_at: '2026-11-22T09:05:00.000Z',
  },
  {
    id: 'nnpc-totalenergies-international-scholarship-2027',
    slug: 'nnpc-totalenergies-international-scholarship-2027',
    title: 'NNPC Limited / TotalEnergies International Scholarship (TIS)',
    organisation: 'NNPC Limited and TotalEnergies',
    category: 'scholarship',
    subcategory: 'International scholarship',
    description:
      'International scholarship for young Nigerian graduates pursuing master’s study in France. The TotalEnergies scholarship portal lists this programme as open with a 31 January 2027 closing date; review the programme page for the current eligibility and document list before applying.',
    link_url: 'https://csr-ngscholarship.totalenergies.com/scholarships',
    deadline: '2027-01-31',
    locations: 'Nigeria / France',
    eligibility:
      'Young Nigerian graduates pursuing master’s study in France. Check the programme page for the full eligibility and document requirements; EduReach has not restated conditions the portal does not publish.',
    study_level: 'Postgraduate (master’s)',
    award: 'A full-board scholarship (as stated on the TotalEnergies scholarship portal).',
    education_levels: ['Postgraduate'],
    disciplines: ['All disciplines'],
    published_at: '2026-11-10T08:00:00.000Z',
    expires_at: '2027-01-31T23:00:00.000Z',
    status: 'published',
    is_active: true,
    is_featured: false,
    source_name: 'TotalEnergies Scholarship Portal',
    last_verified_at: '2026-11-22T09:10:00.000Z',
    verified_at: '2026-11-22T09:10:00.000Z',
  },
  {
    id: 'aliko-dangote-foundation-undergraduate-scholarship',
    slug: 'aliko-dangote-foundation-undergraduate-scholarship',
    title: 'Aliko Dangote Foundation Undergraduate Scholarship',
    organisation: 'Aliko Dangote Foundation',
    category: 'scholarship',
    subcategory: 'Undergraduate scholarship',
    description:
      'The Foundation has announced an undergraduate scholarship programme for students in Nigerian federal and state universities. An application portal and the full guidelines have not been published. EduReach lists it so students can watch the official source; no deadline or award is stated here because neither has been announced.',
    link_url: 'https://www.alikodangotefoundation.org/',
    deadline: null,
    locations: 'Nigeria',
    eligibility:
      'Not yet published by the Foundation. Public announcements describe a first phase across federal and state universities with priority for science, technology, engineering and medicine. Confirm every requirement on the Foundation’s own announcement before applying.',
    study_level: 'Undergraduate',
    award: null,
    education_levels: ['Undergraduate'],
    disciplines: ['Science', 'Technology', 'Engineering', 'Medicine'],
    published_at: '2026-11-22T09:15:00.000Z',
    expires_at: null,
    status: 'published',
    is_active: true,
    is_featured: false,
    source_name: 'Aliko Dangote Foundation',
    last_verified_at: '2026-11-22T09:15:00.000Z',
    verified_at: '2026-11-22T09:15:00.000Z',
  },
  {
    id: 'mtn-foundation-scholarship-2026',
    slug: 'mtn-foundation-scholarship-2026',
    title: 'MTN Foundation Scholarship 2026',
    organisation: 'MTN Foundation',
    category: 'scholarship',
    subcategory: 'Undergraduate scholarship',
    description:
      'The 2026 MTN Foundation scholarship cycle closed on 31 May 2026. This record is kept so students can see the scheme’s requirements and prepare for the next cycle; it is not an open opportunity.',
    link_url: 'https://apps.mtn.ng/scholarships/form',
    deadline: '2026-05-31',
    locations: 'Nigeria',
    eligibility:
      'Nigerian students in public tertiary institutions, in the levels and disciplines the Foundation publishes for each cycle. Requirements change between cycles; read the current scholarship page before applying.',
    study_level: 'Undergraduate (300 level science and technology; 200 and 300 level blind students)',
    award: 'Awards of ₦300,000 per academic year until graduation, for the categories the Foundation publishes each cycle.',
    education_levels: ['Undergraduate'],
    disciplines: ['Science', 'Technology', 'Engineering'],
    published_at: '2026-04-01T08:00:00.000Z',
    expires_at: '2026-06-01T00:00:00.000Z',
    status: 'archived',
    is_active: false,
    is_featured: false,
    source_name: 'MTN Foundation scholarship portal',
    last_verified_at: null,
    verified_at: null,
  },
];
