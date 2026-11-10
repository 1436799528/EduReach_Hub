/** Shared structural checks; these do not make browser data authoritative. */
export const CBT_UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function validCbtV2QuestionIds(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.length > 0 && ids.every(id => typeof id === 'string' && CBT_UUID.test(id)) &&
    new Set(ids.map(id => id.toLowerCase())).size === ids.length;
}
export function validCbtV2Answer(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}
export function validCbtV2Draft(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([position, answer]) => /^[1-9]\d*$/.test(position) && Number.isSafeInteger(Number(position)) && validCbtV2Answer(answer));
}
export function validCbtV2Revision(value: unknown): value is number { return Number.isSafeInteger(value) && Number(value) >= 0; }
