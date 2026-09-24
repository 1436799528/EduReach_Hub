export type ServiceGuideStep = {
  title: string;
  body: string;
  image: string;
  imageAlt: string;
};

export type ServiceGuide = {
  slug: string;
  eyebrow: string;
  summary: string;
  safetyNote: string;
  steps: ServiceGuideStep[];
};

/**
 * Plain-language guidance shown before every live service request form. The
 * copy is intentionally procedural: official portals and current institution
 * notices remain the authority when requirements change.
 */
export const serviceGuides: Record<string, ServiceGuide> = {
  'nelfund-loan': {
    slug: 'nelfund-loan',
    eyebrow: 'Financial aid guide',
    summary: 'Understand the student-loan process, prepare your details and use the official NELFUND portal before requesting guided support.',
    safetyNote: 'Never share your banking PIN, one-time password or account password with a helper. EduReach only needs the details required to organise your request.',
    steps: [
      { title: 'Confirm that you are eligible', body: 'Read the active NELFUND announcement and confirm your institution, programme and student status meet the current requirements.', image: '/news/photos/nelfund.webp', imageAlt: 'Student financial-aid guidance' },
      { title: 'Prepare your student details', body: 'Keep your JAMB or matriculation details, institution information, contact details and any required supporting documents together before starting.', image: '/news/photos/graduates.jpg', imageAlt: 'Graduates preparing documents' },
      { title: 'Complete the official application', body: 'Create or update your profile on the official portal, review every field and submit only after the name and institution details match your records.', image: '/news/photos/campus.jpg', imageAlt: 'Students on a university campus' },
      { title: 'Save the acknowledgement', body: 'Keep your application reference, confirmation page and any follow-up request. If you want us to guide you, submit the form below with a safe description of the help you need.', image: '/news/photos/nelfund.webp', imageAlt: 'Financial aid application reference' },
    ],
  },
  results: {
    slug: 'results',
    eyebrow: 'Result-checking guide',
    summary: 'Choose the correct examination body, prepare your candidate number and check results through the official checker without exposing your PIN.',
    safetyNote: 'Result-checking tokens are private. Do not paste a scratch-card PIN into a public chat or send it to an unverified person.',
    steps: [
      { title: 'Choose the examination body', body: 'Confirm whether the result is WAEC, NECO or another supported body. The checker, candidate number format and token rules can differ.', image: '/news/photos/waec-result.png', imageAlt: 'Examination result guidance' },
      { title: 'Keep your candidate details ready', body: 'Find the examination number, examination year and any required registration details before opening the official result-checking page.', image: '/news/photos/jamb-cbt.jpg', imageAlt: 'Computer-based examination preparation' },
      { title: 'Use the official checker', body: 'Open the examination body’s official result portal, enter the details carefully and keep the result page or PDF for your records.', image: '/news/photos/waec-result.png', imageAlt: 'Result-checking screen illustration' },
      { title: 'Ask for guided help only when needed', body: 'If you are unsure which checker or details to use, complete the support form below. We will return a reference code for your request.', image: '/news/photos/graduates.jpg', imageAlt: 'Student receiving academic guidance' },
    ],
  },
  'scratch-cards': {
    slug: 'scratch-cards',
    eyebrow: 'Examination token guide',
    summary: 'Understand which result-checking token you need, how to keep it private and how to request guidance before purchase or use.',
    safetyNote: 'EduReach does not need your confidential PIN for general guidance. Only enter a token into the official examination checker when you are ready to check your result.',
    steps: [
      { title: 'Confirm the body and year', body: 'Check whether you need a WAEC or NECO token and confirm the result year before buying anything. A wrong token may not work for your result.', image: '/news/photos/waec-result.png', imageAlt: 'WAEC and NECO result guidance' },
      { title: 'Use a trusted purchase channel', body: 'Buy from the examination body or an authorised channel. Check the receipt and product description before paying.', image: '/news/photos/campus.jpg', imageAlt: 'Student checking an official service' },
      { title: 'Keep the token private', body: 'Do not publish the serial or PIN in screenshots. Store the receipt and use the token only on the official result-checking portal.', image: '/news/photos/nelfund.webp', imageAlt: 'Secure student service information' },
      { title: 'Request our help if you are stuck', body: 'Tell us the examination body, year and the step where you need help. Do not include the private PIN in the request form.', image: '/news/photos/graduates.jpg', imageAlt: 'Student requesting support' },
    ],
  },
  'jamb-slip': {
    slug: 'jamb-slip',
    eyebrow: 'JAMB document guide',
    summary: 'Locate, verify and print your JAMB examination slip while protecting the login details on your profile.',
    safetyNote: 'Never share your JAMB profile password or one-time verification code. EduReach can explain the steps without taking control of your account.',
    steps: [
      { title: 'Open the official JAMB profile', body: 'Use the official JAMB website and sign in with the account connected to your registration. Avoid links sent from unknown accounts.', image: '/icons/brands/jamb.png', imageAlt: 'JAMB brand mark' },
      { title: 'Find the examination slip service', body: 'Choose the slip or reprint option shown for your registration and follow the portal prompts to retrieve the document.', image: '/news/photos/jamb-cbt.jpg', imageAlt: 'JAMB computer-based test centre' },
      { title: 'Check every detail', body: 'Confirm your name, registration number, centre, date and time before downloading or printing. Report an error through the official channel.', image: '/news/photos/campus.jpg', imageAlt: 'Students checking academic information' },
      { title: 'Keep a digital and printed copy', body: 'Save the PDF in a safe folder and print a readable copy if the examination instructions require one. Request guidance below if a portal step is unclear.', image: '/news/photos/graduates.jpg', imageAlt: 'Student preparing examination documents' },
    ],
  },
  'admission-letters': {
    slug: 'admission-letters',
    eyebrow: 'Admission document guide',
    summary: 'Understand the difference between an admission offer, a school letter and a deferment or supplementary request before asking for assistance.',
    safetyNote: 'Admission decisions come from the institution and official admission systems. EduReach can help organise information but cannot create an admission offer.',
    steps: [
      { title: 'Confirm the admission status', body: 'Check the official admission system and your institution’s portal. Save the status page and note any deadline for acceptance or clearance.', image: '/news/photos/campus.jpg', imageAlt: 'University campus admission guidance' },
      { title: 'Read your institution’s instructions', body: 'Different schools use different letter formats, payment steps and submission offices. Follow the current notice for your programme.', image: '/news/photos/graduates.jpg', imageAlt: 'Students reading admission guidance' },
      { title: 'Prepare the supporting details', body: 'Keep your admission number, programme, session, contact details and any required documents ready. Check spelling before sending a request.', image: '/news/photos/waec-result.png', imageAlt: 'Academic document preparation' },
      { title: 'Ask for a guided letter review', body: 'If you need help understanding the next step or drafting a request, complete the form below. Your reference code lets you return to the request from your dashboard.', image: '/news/photos/campus.jpg', imageAlt: 'Student admission support' },
    ],
  },
};

export function guideForService(slug: string): ServiceGuide | null {
  return serviceGuides[slug] || null;
}
