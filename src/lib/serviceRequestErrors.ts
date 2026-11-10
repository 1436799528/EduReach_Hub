import { userFacingError } from '../../lib/errors';
import { EduReachError } from './failures';

/** A timeout or transport failure can happen after a request has committed. */
export function serviceRequestUpdateFailure(error: unknown, fallback: string): { message: string; needsRefresh: boolean } {
  const uncertain = !(error instanceof EduReachError) || ['offline', 'timeout', 'server', 'unknown'].includes(error.kind);
  const stale = error instanceof EduReachError && error.status === 409;
  return {
    needsRefresh: uncertain || stale,
    message: uncertain ? 'Unable to confirm the update. Refresh the queue before retrying.' : userFacingError(error, fallback),
  };
}
