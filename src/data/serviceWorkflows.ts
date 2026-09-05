export type ServiceField = {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
};

export type ServiceWorkflow = {
  overview: string;
  steps: string[];
  requirements: string[];
  notes: string[];
  fields: ServiceField[];
};

export const serviceWorkflows: Record<string, ServiceWorkflow> = {
  'nelfund-loan': {
    overview: 'Use this request to get organised support before completing a NELFUND student loan application through the official process.',
    steps: [
      'Confirm the current NELFUND application window and eligibility rules from the official source.',
      'Prepare your personal, institution and academic information.',
      'Submit your support request here so EduReach can review what help you need.',
      'Use the official NELFUND channel for the final loan application and sensitive details.'
    ],
    requirements: ['Your full name and email address', 'Institution and programme information', 'A clear description of the support you need'],
    notes: ['NELFUND requirements and application windows may change.', 'EduReach is independent and does not replace the official NELFUND application portal.', 'Never submit passwords, OTPs, card PINs or banking passwords.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your email', required: true },
      { name: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'programme', label: 'Programme / Course', placeholder: 'Enter your programme', required: true },
      { name: 'level', label: 'Current Level', placeholder: 'e.g. 200 Level' },
      { name: 'message', label: 'What do you need help with?', type: 'textarea', placeholder: 'Describe the help you need', required: true }
    ]
  },
  results: {
    overview: 'Request guided support for WAEC or NECO result checking while keeping your examination credentials private.',
    steps: ['Choose the examination body you need.', 'Prepare the examination details required by the official checker.', 'Submit your request without entering any PIN, token or password.', 'Complete the final result check on the official WAEC or NECO channel.'],
    requirements: ['Full name', 'Examination body', 'Examination number or candidate details', 'Your support question'],
    notes: ['EduReach does not store or request result-checking PINs or tokens.', 'Always verify results through the official result-checking channel.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination Body', type: 'select', options: ['WAEC', 'NECO'], required: true },
      { name: 'examYear', label: 'Examination Year', placeholder: 'e.g. 2025', required: true },
      { name: 'examNumber', label: 'Examination Number', placeholder: 'Enter your examination number', required: true },
      { name: 'message', label: 'What do you need help with?', type: 'textarea', placeholder: 'Checking or understanding your result', required: true }
    ]
  },
  'scratch-cards': {
    overview: 'Request help identifying the correct WAEC or NECO result-checking card before purchase or use.',
    steps: ['Select WAEC or NECO.', 'Tell us the card support you need and the quantity.', 'EduReach reviews the request and provides the next step.', 'Keep any card PIN private and use it only through the appropriate official channel.'],
    requirements: ['Full name', 'Examination body', 'Quantity requested', 'Request details'],
    notes: ['EduReach will never ask you to post a scratch-card PIN in this form.', 'Confirm the examination body before buying any card.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'examBody', label: 'Examination Body', type: 'select', options: ['WAEC', 'NECO'], required: true },
      { name: 'quantity', label: 'Quantity', type: 'number', placeholder: '1', required: true },
      { name: 'message', label: 'Request Details', type: 'textarea', placeholder: 'Tell us what card support you need', required: true }
    ]
  },
  'jamb-slip': {
    overview: 'Request practical help locating, reviewing or printing a JAMB examination slip from your candidate record.',
    steps: ['Provide your JAMB registration number and contact email.', 'EduReach records the support request for follow-up.', 'Use the official JAMB profile or channel to access the actual examination slip.', 'Verify your candidate details, examination date and centre before examination day.'],
    requirements: ['Full name', 'JAMB registration number', 'Email address', 'A description of the printing or access problem'],
    notes: ['Never submit your JAMB password or OTP.', 'Keep both a digital copy and a printed copy of the slip where possible.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'jambNumber', label: 'JAMB Registration Number', placeholder: 'Enter your registration number', required: true },
      { name: 'email', label: 'Email Address', type: 'email', placeholder: 'Enter your email', required: true },
      { name: 'serviceNeed', label: 'Support Needed', type: 'select', options: ['Locate slip', 'Print slip', 'Check slip details', 'Other'], required: true },
      { name: 'message', label: 'Additional Details', type: 'textarea', placeholder: 'Tell us what is happening', required: true }
    ]
  },
  'admission-letters': {
    overview: 'Request structured help preparing an admission deferment or supplementary admission letter without inventing institutional rules.',
    steps: ['Select the type of admission request.', 'Provide the institution and basic admission information.', 'Explain the reason for the request clearly and honestly.', 'EduReach prepares the request for review while the institution remains the final authority.'],
    requirements: ['Full name', 'Institution', 'Request type', 'Admission details', 'Reason for the request'],
    notes: ['Institutional requirements and approval decisions differ.', 'EduReach will not create false claims or invent official requirements.'],
    fields: [
      { name: 'fullName', label: 'Full Name', placeholder: 'Enter your full name', required: true },
      { name: 'institution', label: 'Institution', placeholder: 'Enter your school', required: true },
      { name: 'requestType', label: 'Request Type', type: 'select', options: ['Admission Deferment', 'Supplementary Admission'], required: true },
      { name: 'programme', label: 'Programme / Course', placeholder: 'Enter your programme', required: true },
      { name: 'admissionDetails', label: 'Admission Details', type: 'textarea', placeholder: 'Admission year, application details or relevant information', required: true },
      { name: 'message', label: 'Reason / Request Details', type: 'textarea', placeholder: 'Explain your request clearly', required: true }
    ]
  }
};
