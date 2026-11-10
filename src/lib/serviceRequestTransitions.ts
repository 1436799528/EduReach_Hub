// The API remains authoritative. Sharing its transition table with the admin
// controls prevents the UI from offering actions the API will reject.
export const SERVICE_REQUEST_TRANSITIONS: Record<string, readonly string[]> = {
  submitted: ['reviewing', 'processing', 'awaiting_information', 'rejected', 'cancelled'],
  reviewing: ['processing', 'awaiting_information', 'completed', 'rejected', 'cancelled'],
  processing: ['awaiting_information', 'completed', 'rejected', 'cancelled'],
  awaiting_information: ['reviewing', 'processing', 'completed', 'cancelled'],
  completed: ['closed'],
  closed: [],
  rejected: [],
  cancelled: [],
};

export type ServiceRequestAction = { label: string; next: string; kind?: 'success' | 'danger' };

// A deliberately limited set of operator controls, not a new transition policy.
const ACTIONS: Record<string, ServiceRequestAction[]> = {
  submitted: [
    { label: 'Review', next: 'reviewing' }, { label: 'Process', next: 'processing' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  reviewing: [
    { label: 'Process', next: 'processing' }, { label: 'Need info', next: 'awaiting_information' },
    { label: 'Complete', next: 'completed', kind: 'success' }, { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  processing: [
    { label: 'Need info', next: 'awaiting_information' }, { label: 'Complete', next: 'completed', kind: 'success' },
    { label: 'Reject', next: 'rejected', kind: 'danger' },
  ],
  awaiting_information: [
    { label: 'Review', next: 'reviewing' }, { label: 'Process', next: 'processing' },
    { label: 'Complete', next: 'completed', kind: 'success' },
  ],
  completed: [{ label: 'Close', next: 'closed' }],
};

export function serviceRequestActions(status: string): ServiceRequestAction[] {
  if (!Object.hasOwn(SERVICE_REQUEST_TRANSITIONS, status) || !Object.hasOwn(ACTIONS, status)) return [];
  const allowed = SERVICE_REQUEST_TRANSITIONS[status];
  return ACTIONS[status].filter((action) => allowed.includes(action.next));
}
