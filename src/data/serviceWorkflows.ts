export type ServiceField = { name: string; label: string; placeholder?: string; type?: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select'; required?: boolean; options?: string[] };
export type ServiceWorkflow = {
  overview: string;
  steps: string[];
  requirements: string[];
  notes: string[];
  fields: ServiceField[];
};

export const serviceWorkflows: Record<string, ServiceWorkflow> = {
  'nelfund-loan': {
    overview: 'Get organised help preparing your student-loan request and checking that the information you submit is complete before using the official NELFUND process.',
    steps: ['Confirm the current official application window and eligibility information.', 'Prepare your personal, school and programme details.', 'Review the request carefully before following the official application channel.'],
    requirements: ['Full name and contact number', 'Institution, faculty and department', 'Level and programme information', 'Any supporting information requested by the official portal'],
    notes: ['Application windows and requirements can change.', 'EduReach does not replace the official NELFUND portal.', 'Never send passwords, OTPs, card PINs or banking credentials in a request form.'],
    fields: [
      { name: 'fullName', label: 'Full name', placeholder: 'Enter your full name', required: true },
      { name: 'school', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'level', label: 'Level', type: 'select', required: true, options: ['100','200','300','400','500'] },
      { name: 'faculty', label: 'Faculty', placeholder: 'Enter your faculty', required: true },
      { name: 'department', label: 'Department', placeholder: 'Enter your department', required: true },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: 'Enter your WhatsApp number', required: true },
    ],
  },
  results: {
    overview: 'Get guided support for checking WAEC or NECO results while keeping result-checking credentials private.',
    steps: ['Choose the examination body.', 'Prepare the candidate or examination details required by the official checker.', 'Complete final verification on the official result-checking channel.'],
    requirements: ['Examination body', 'Examination number or candidate details', 'Result-checking token or PIN when officially required'],
    notes: ['Never post result PINs or tokens publicly.', 'EduReach guidance does not replace the official checker.'],
    fields: [
      { name: 'fullName', label: 'Full name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination body', type: 'select', required: true, options: ['WAEC','NECO'] },
      { name: 'examNumber', label: 'Examination number', placeholder: 'Enter your examination number', required: true },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: 'Enter your WhatsApp number', required: true },
      { name: 'details', label: 'Request details', type: 'textarea', placeholder: 'Tell us what support you need', required: true },
    ],
  },
  'scratch-cards': {
    overview: 'Request guidance around choosing the correct WAEC or NECO result-checking card or token before purchase or activation.',
    steps: ['Select the examination body.', 'Confirm the correct card or token type.', 'Keep the PIN private and use it only on the official result channel.'],
    requirements: ['Examination body', 'Quantity', 'Secure contact information'],
    notes: ['Never share scratch-card PINs publicly.', 'Confirm the official examination body before payment.'],
    fields: [
      { name: 'fullName', label: 'Full name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination body', type: 'select', required: true, options: ['WAEC','NECO'] },
      { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '1', required: true },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: 'Enter your WhatsApp number', required: true },
      { name: 'details', label: 'Request details', type: 'textarea', placeholder: 'Tell us what card support you need', required: true },
    ],
  },
  'jamb-slip': {
    overview: 'Get structured help locating, checking and printing your JAMB examination slip.',
    steps: ['Confirm your JAMB profile and registration details.', 'Locate the examination slip from the appropriate official candidate channel.', 'Save or print it and verify your date, venue and candidate information.'],
    requirements: ['JAMB registration number', 'Candidate contact information', 'Access to the profile or email used during registration'],
    notes: ['Recheck the examination centre and date before exam day.', 'Keep both digital and printed copies where possible.'],
    fields: [
      { name: 'fullName', label: 'Full name', placeholder: 'Enter your full name', required: true },
      { name: 'jambNumber', label: 'JAMB registration number', placeholder: 'Enter your JAMB registration number', required: true },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: 'Enter your WhatsApp number', required: true },
      { name: 'details', label: 'Request details', type: 'textarea', placeholder: 'Printing, locating, or checking the slip', required: true },
    ],
  },
  'admission-letters': {
    overview: 'Get structured help preparing admission deferment or supplementary application letters without inventing institutional requirements.',
    steps: ['Confirm your institution and admission situation.', 'Provide the facts and reason supporting the request.', 'Submit the final letter through the process required by the institution.'],
    requirements: ['Institution name', 'Admission or application details', 'Reason for the request', 'Supporting documents where required'],
    notes: ['Institutional procedures differ.', 'The institution decides whether a request or letter is accepted.'],
    fields: [
      { name: 'fullName', label: 'Full name', placeholder: 'Enter your full name', required: true },
      { name: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'requestType', label: 'Request type', type: 'select', required: true, options: ['Admission deferment','Supplementary admission'] },
      { name: 'whatsapp', label: 'WhatsApp number', type: 'tel', placeholder: 'Enter your WhatsApp number', required: true },
      { name: 'details', label: 'Reason / details', type: 'textarea', placeholder: 'Explain the situation and what you are requesting', required: true },
    ],
  },
};
