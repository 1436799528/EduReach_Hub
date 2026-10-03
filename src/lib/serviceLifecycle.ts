/**
 * SERVICE-1 — can a student tell exactly what happens after they press Submit?
 *
 * The apply page explained what the student must do before applying (the guides)
 * and then ended at "your request has been registered". The status machine it
 * feeds was only visible later, in the dashboard, as a title-cased word with no
 * meaning attached.
 *
 * This module is the single description of that machine. `service_requests.status`
 * is a checked enum (20260925214000_service_request_statuses.sql); every value it
 * can hold has copy here, and the test asserts that coverage directly against the
 * migration, so a new status cannot ship without an explanation.
 *
 * No durations are promised: EduReach has no measured service-level data, and
 * inventing "3–5 working days" is exactly the kind of claim this work removes.
 */

export type ServiceStage = {
  status: string;
  label: string;
  meaning: string;
  /** True when the request cannot move until the student does something. */
  awaitsStudent: boolean;
  /** True when the request has reached an end state. */
  terminal: boolean;
};

export const SERVICE_STAGES: ServiceStage[] = [
  {
    status: 'submitted',
    label: 'Submitted',
    meaning: 'EduReach has your request and it is queued in the order it arrived.',
    awaitsStudent: false,
    terminal: false,
  },
  {
    status: 'reviewing',
    label: 'Reviewing',
    meaning: 'An EduReach officer is checking the details you sent and what the institution or portal needs.',
    awaitsStudent: false,
    terminal: false,
  },
  {
    status: 'processing',
    label: 'Processing',
    meaning: 'We are working on it. Anything you still need to send will be asked for here.',
    awaitsStudent: false,
    terminal: false,
  },
  {
    status: 'awaiting_information',
    label: 'Waiting on you',
    meaning: 'We asked a question. The request is paused until you answer, so nothing is lost while you gather it.',
    awaitsStudent: true,
    terminal: false,
  },
  {
    status: 'completed',
    label: 'Completed',
    meaning: 'Done. The record and the outcome stay in your dashboard.',
    awaitsStudent: false,
    terminal: true,
  },
  {
    status: 'closed',
    label: 'Closed',
    meaning: 'EduReach closed this request. Open it to see the reason, and start a new one if you still need help.',
    awaitsStudent: false,
    terminal: true,
  },
  {
    status: 'rejected',
    label: 'Not accepted',
    meaning: 'This request could not be taken forward. The reason is on the request, and you can submit a corrected one.',
    awaitsStudent: false,
    terminal: true,
  },
  {
    status: 'cancelled',
    label: 'Cancelled',
    meaning: 'You cancelled this request, so no work is outstanding on it.',
    awaitsStudent: false,
    terminal: true,
  },
];

const BY_STATUS = new Map(SERVICE_STAGES.map((stage) => [stage.status, stage]));

/** Unknown statuses are shown as themselves rather than as a wrong guess. */
export function serviceStatusMeaning(status: string): ServiceStage {
  const key = String(status || '').toLowerCase();
  const stage = BY_STATUS.get(key);
  if (stage) return stage;
  return {
    status: key || 'unknown',
    label: key ? key.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()) : 'Unknown',
    meaning: 'EduReach has not recorded a description for this state yet. Open the request for its full history.',
    awaitsStudent: false,
    terminal: false,
  };
}

/** The happy-path stages a student sees before they submit, in order. */
export function serviceTimeline(): ServiceStage[] {
  return ['submitted', 'reviewing', 'processing', 'completed'].map((status) => serviceStatusMeaning(status));
}

/** How far along the happy path a status is; -1 when it left the path. */
export function serviceStageIndex(status: string): number {
  const key = String(status || '').toLowerCase();
  const path = ['submitted', 'reviewing', 'processing', 'awaiting_information', 'completed'];
  const index = path.indexOf(key);
  if (index === -1) return -1;
  // "Waiting on you" is a pause within processing, not a step forward.
  return key === 'awaiting_information' ? 2 : index;
}

/** Requests that cannot move until the student acts — the dashboard's signal. */
export function needsStudentAction(status: string): boolean {
  return serviceStatusMeaning(status).awaitsStudent;
}
