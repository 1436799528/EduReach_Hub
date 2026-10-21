export type ServiceGuideStep = {
  title: string;
  body: string;
  image: string;
  imageAlt: string;
  /**
   * What the image actually is. Only 'screenshot' / 'official-document' may be
   * presented as a real portal source. Screenshots were taken from the public
   * tutorials the owner supplied, visually checked against the live official
   * portals on 2026-10-21, and contain no candidate data. Steps whose screen
   * could not be verified use a labelled placeholder - never a mockup dressed
   * up as an official screenshot.
   */
  imageKind: 'screenshot' | 'official-document' | 'illustration' | 'photo' | 'placeholder';
  imageSource: string;
  /** Optional variant heading (e.g. WAEC vs NECO inside the results guide). */
  section?: string;
};

export type ServiceGuide = {
  slug: string;
  eyebrow: string;
  summary: string;
  safetyNote: string;
  steps: ServiceGuideStep[];
};

const PH = 'Placeholder — official screenshot pending verification';

export const serviceGuides: Record<string, ServiceGuide> = {
  'nelfund-loan': {
    slug: 'nelfund-loan',
    eyebrow: 'Financial aid guide',
    summary: 'Understand the student-loan process, prepare your details and use the official NELFUND portal (portal.nelf.gov.ng) before requesting guided support.',
    safetyNote: 'Never share your banking PIN, one-time password or account password with a helper. EduReach only needs the details required to organise your request.',
    steps: [
      { title: 'Confirm that you are eligible', body: 'Read the active NELFUND announcement and confirm your institution, programme and student status meet the current requirements.', image: '/news/photos/nelfund.webp', imageAlt: 'Official NELFUND public notice about student loan disbursement', imageKind: 'official-document', imageSource: 'NELFUND public notice (official document)' },
      { title: 'Start on the official portal', body: 'Open portal.nelf.gov.ng and choose "Get Started". The welcome page describes the loan as interest-free and the application as a 15–30 minute process.', image: '/images/service-guides/nelfund-portal-start.webp', imageAlt: 'Placeholder panel for the NELFUND portal welcome page with its Get Started option', imageKind: 'placeholder', imageSource: PH },
      { title: 'Create your account', body: 'Registration first asks whether you are a Nigerian, then asks you to verify your educational information. Answer with the details on your admission record.', image: '/images/service-guides/nelfund-register.webp', imageAlt: 'Placeholder panel for the NELFUND account registration questions', imageKind: 'placeholder', imageSource: PH },
      { title: 'Verify your student status with JAMB', body: 'The portal verifies your student status with JAMB as part of registration. Complete that verification, then review and submit the loan request inside your account and keep the acknowledgement.', image: '/images/service-guides/nelfund-verify-jamb.webp', imageAlt: 'Placeholder panel for the JAMB student-status verification step on the NELFUND portal', imageKind: 'placeholder', imageSource: PH },
    ],
  },
  results: {
    slug: 'results',
    eyebrow: 'Result-checking guide',
    summary: 'WAEC and NECO use different checkers, different fields and different buttons. Follow the sequence for your examination body and never share your PIN or token publicly.',
    safetyNote: 'Result-checking access details are private. Do not paste them into a public chat or send them to an unverified person.',
    steps: [
      { section: 'WAEC — waecdirect.org', title: 'Open the WAEC result checker', body: 'Go to waecdirect.org. The checker form is on the home page; the browser address should show waecdirect.org before you type anything.', image: '/images/service-guides/waec-checker-open.webp', imageAlt: 'WAECDIRECT result checker form on waecdirect.org with empty Examination Number, Examination Year, Examination, PIN and Serial No fields', imageKind: 'screenshot', imageSource: 'Portal screenshot via masterwaec.com (verified 2026-10-21)' },
      { section: 'WAEC — waecdirect.org', title: 'Identify the five fields', body: 'The form asks for: Examination Number (10 digits — 7-digit centre number + 3-digit candidate number), Examination Year, Examination (School or Private Candidate Results), PIN, and Serial No from your e-PIN voucher.', image: '/images/service-guides/waec-checker-fields.webp', imageAlt: 'Close view of the WAECDIRECT fields: Examination Number, Examination Year, Examination, PIN and Serial No', imageKind: 'screenshot', imageSource: 'Portal screenshot via masterwaec.com (verified 2026-10-21)' },
      { section: 'WAEC — waecdirect.org', title: 'Enter your details and Submit', body: 'Type the details exactly as they appear on your voucher, then click Submit once and wait for the result window. Do not keep resubmitting — an exhausted voucher needs a new e-PIN.', image: '/images/service-guides/waec-checker-submit.webp', imageAlt: 'Close view of the WAECDIRECT Serial No field and the Submit button', imageKind: 'screenshot', imageSource: 'Portal screenshot via masterwaec.com (verified 2026-10-21)' },
      { section: 'WAEC — waecdirect.org', title: 'View and keep your result', body: 'Your result opens in a results window. Save or print it for your records. If the page says there is no result for that year, re-check the examination year and number before buying another voucher.', image: '/images/service-guides/waec-result-view.webp', imageAlt: 'Placeholder panel for the WAEC result window that opens after submitting the checker', imageKind: 'placeholder', imageSource: PH },
      { section: 'NECO — results.neco.gov.ng', title: 'Open the NECO results portal', body: 'Go to results.neco.gov.ng. The Check Result form has four parts: Examination Year, Examination Type, Token and Registration number.', image: '/images/service-guides/neco-check-open.webp', imageAlt: 'NECO Results portal Check Result form with Examination Year, Examination Type, Token and Registration number fields', imageKind: 'screenshot', imageSource: 'Portal screenshot via technext24.com (verified 2026-10-21)' },
      { section: 'NECO — results.neco.gov.ng', title: 'Select the examination year and type', body: 'Choose your Examination Year, then the Examination Type — for example SSCE Internal or SSCE External. Pick the sitting you actually wrote.', image: '/images/service-guides/neco-year-type.webp', imageAlt: 'Close view of the NECO Examination Year and Examination Type selectors', imageKind: 'screenshot', imageSource: 'Portal screenshot via technext24.com (verified 2026-10-21)' },
      { section: 'NECO — results.neco.gov.ng', title: 'Enter your token and registration number', body: 'Type your Token (shown in the form as 0000 0000 0000) and your Registration number. No token yet? The portal sells one with the "Purchase token" button — never buy from a stranger in a chat.', image: '/images/service-guides/neco-token-reg.webp', imageAlt: 'Close view of the NECO Token and Registration number fields', imageKind: 'screenshot', imageSource: 'Portal screenshot via technext24.com (verified 2026-10-21)' },
      { section: 'NECO — results.neco.gov.ng', title: 'Click "Check my result"', body: 'Press the green Check Result button once and wait. Your result opens on the portal; save or print it. For help, the portal lists support@neco.gov.ng.', image: '/images/service-guides/neco-submit.webp', imageAlt: 'Close view of the green Check Result button on the NECO results portal', imageKind: 'screenshot', imageSource: 'Portal screenshot via technext24.com (verified 2026-10-21)' },
    ],
  },
  'jamb-slip': {
    slug: 'jamb-slip',
    eyebrow: 'JAMB document guide',
    summary: 'Locate, verify and print your JAMB examination slip from the official e-Facility (efacility.jamb.gov.ng) while protecting the login details on your profile.',
    safetyNote: 'Never share your JAMB profile password or one-time verification code. EduReach can explain the steps without taking control of your account.',
    steps: [
      { title: 'Open JAMB e-Facility and sign in', body: 'Go to efacility.jamb.gov.ng and log in with the email address and password connected to your registration. Avoid links sent from unknown accounts.', image: '/images/service-guides/jamb-efacility-login.webp', imageAlt: 'JAMB e-Facility login page with the JAMB crest and Login to your account heading', imageKind: 'screenshot', imageSource: 'Portal screenshot via smartjamb.com, checked against efacility.jamb.gov.ng on 2026-10-21' },
      { title: 'Open the examination-slip service', body: 'From your candidate dashboard, open the examination-slip service. The services available to you can differ by candidate profile and by JAMB service cycle, so follow the option your dashboard actually shows.', image: '/images/service-guides/jamb-slip-service.webp', imageAlt: 'Examination slip screen with an Enter Reg. Number, GSM No or email field and a Generate Examination Slip button', imageKind: 'screenshot', imageSource: 'Slip service screenshot via myschool.ng, checked on 2026-10-21' },
      { title: 'Enter your registration number and generate the slip', body: 'Enter your Reg. Number, GSM No or email as the screen asks, then choose "Generate Examination Slip". Confirm the name, centre, date and time on the slip are yours before you rely on it; report an error through the official channel.', image: '/images/service-guides/jamb-slip-enter-reg.webp', imageAlt: 'Close view of the Enter Reg. Number, GSM No or email field and the Generate Examination Slip button', imageKind: 'screenshot', imageSource: 'Slip service screenshot via myschool.ng, checked on 2026-10-21' },
      { title: 'View or print the slip', body: 'Save the PDF in a safe folder and print a readable copy if the examination instructions require one. Request guidance below if a portal step is unclear.', image: '/images/service-guides/jamb-slip-print.webp', imageAlt: 'Placeholder panel for viewing or printing the generated examination slip', imageKind: 'placeholder', imageSource: PH },
    ],
  },
  'admission-letters': {
    slug: 'admission-letters',
    eyebrow: 'Admission document guide',
    summary: 'Check your admission status on JAMB CAPS first, then use the Print Admission Letter service on e-Facility. EduReach can help organise information but cannot create an admission offer.',
    safetyNote: 'Admission decisions come from the institution and official admission systems. EduReach can help organise information but cannot create an admission offer.',
    steps: [
      { title: 'Sign in and check your admission status', body: 'Log in at efacility.jamb.gov.ng and check your admission status (CAPS) before paying for any letter. Save the status page and note any deadline for acceptance or clearance.', image: '/images/service-guides/jamb-efacility-login.webp', imageAlt: 'JAMB e-Facility login page with the JAMB crest and Login to your account heading', imageKind: 'screenshot', imageSource: 'Portal screenshot via smartjamb.com, checked against efacility.jamb.gov.ng on 2026-10-21' },
      { title: 'Open Print Admission Letter', body: 'From the services on your dashboard, select "Print Admission Letter". Different schools also publish their own letter instructions — follow the current notice for your programme.', image: '/images/service-guides/admission-letter-menu.webp', imageAlt: 'Placeholder panel for the Print Admission Letter service on JAMB e-Facility', imageKind: 'placeholder', imageSource: PH },
      { title: 'Enter and verify your details', body: 'Enter the examination year and registration number where the service asks, review the transaction shown, and check every detail before paying or printing. Check spelling before sending any request.', image: '/images/service-guides/admission-letter-details.webp', imageAlt: 'Placeholder panel for entering the examination year and registration number for an admission letter', imageKind: 'placeholder', imageSource: PH },
      { title: 'Save or print the letter', body: 'Save the PDF and print a clear copy for your records. If you need help understanding the next step, complete the form below — your reference code lets you return to the request from your dashboard.', image: '/images/service-guides/admission-letter-print.webp', imageAlt: 'Placeholder panel for saving or printing the admission letter', imageKind: 'placeholder', imageSource: PH },
    ],
  },
};

export function guideForService(slug: string): ServiceGuide | null {
  return serviceGuides[slug] || null;
}
