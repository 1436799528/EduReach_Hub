/**
 * Temporary pre-launch switch for email sign-up confirmation.
 *
 * Email verification is OFF by default while testers need immediate access.
 * The verification UI and hosted eight-digit OTP code remain in AuthPageV2
 * behind this switch; nothing in the auth infrastructure was deleted.
 *
 * To restore the launch flow:
 *   1. set VITE_EMAIL_VERIFICATION_ENABLED=true in the deployment;
 *   2. set the Supabase project's `mailer_autoconfirm` back to false;
 *   3. redeploy.
 */
export const EMAIL_VERIFICATION_ENABLED = import.meta.env.VITE_EMAIL_VERIFICATION_ENABLED === 'true';
