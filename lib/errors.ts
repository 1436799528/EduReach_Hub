/**
 * Normalize unknown errors at user-facing boundaries without coercing objects
 * to strings or exposing database/framework implementation details.
 * Shared by the browser API client and the Express/Netlify server.
 */
export function userFacingError(value: unknown, fallback = 'We could not complete that request. Please try again.') {
  let raw: string | undefined;

  if (typeof value === 'string') {
    raw = value;
  } else if (value instanceof Error) {
    raw = value.message;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    const nested = candidate.error && typeof candidate.error === 'object' && !Array.isArray(candidate.error)
      ? candidate.error as Record<string, unknown>
      : undefined;
    const candidates = [
      candidate.message,
      candidate.error_description,
      nested?.message,
      nested?.error_description,
      candidate.details,
      candidate.hint,
    ];
    raw = candidates.find((entry): entry is string => typeof entry === 'string');
  }

  const message = raw?.trim();
  if (!message) return fallback;

  const known: Array<[RegExp, string]> = [
    [/failed to fetch|networkerror|load failed|fetch failed/i, 'Please check your internet connection and try again.'],
    [/invalid or expired session|authentication required|administrator session required/i, 'Your session has expired. Please sign in again.'],
    [/not found|could not be found|no .* was found/i, 'The requested information is not available.'],
    [/already been submitted|duplicate|already exists/i, 'This action has already been completed.'],
    [/expired/i, 'This session has expired. Please start again.'],
    [/no questions|question bank/i, 'This CBT is not ready yet. Please choose another available question bank.'],
    [/^this service (?:is )?(?:not (?:currently )?available|not accepting requests|no longer accepting requests)/i, 'This service is not currently available. Please choose another option.'],
    [/permission|forbidden|not authorized|access denied/i, 'You do not have permission to perform this action.'],
    [/too large|payload|size limit/i, 'The submitted file or information is too large. Please reduce it and try again.'],
    [/timeout|timed out/i, 'The request took too long. Please try again.'],
  ];
  const match = known.find(([pattern]) => pattern.test(message));
  if (match) return match[1];

  // Hide infrastructure/schema details even when a server returns them as text.
  if (/postgres|postgresql|supabase|sqlstate|column .* (ambiguous|does not exist)|relation .* does not exist|constraint|violates|rpc|function .* does not exist|syntax error|stack|at [\w./:-]+\(/i.test(message)) {
    return fallback;
  }
  return message.length <= 180 && !/[\n\r]/.test(message) ? message : fallback;
}
