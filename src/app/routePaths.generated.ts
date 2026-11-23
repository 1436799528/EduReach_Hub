/**
 * GENERATED FILE — do not edit.
 *
 * Written by `scripts/generate-route-paths.ts` from `src/app/routes.tsx`.
 * Run `npm run routes:generate` after changing the router; CI runs
 * `npm run routes:check` and fails if this file is out of date.
 *
 * It exists so the Netlify fallback and the Express fallback can answer an
 * unknown path with a 404 instead of serving the shell with a 200.
 */

export const APP_ROUTE_PATHS: readonly string[] = [
  "/",
  "/about",
  "/accessibility",
  "/admin",
  "/admin/analytics",
  "/admin/banks",
  "/admin/cbt",
  "/admin/content",
  "/admin/content-manager",
  "/admin/faq",
  "/admin/institution-intelligence",
  "/admin/news",
  "/admin/opportunities",
  "/admin/pdf-bank",
  "/admin/question-imports",
  "/admin/queue",
  "/admin/reviews",
  "/admin/schools",
  "/admin/services",
  "/admin/site",
  "/admin/users",
  "/admission",
  "/calculator",
  "/cbt",
  "/cbt/practice",
  "/cbt/results",
  "/cbt/setup/jamb",
  "/cbt/setup/neco",
  "/cbt/setup/post-utme",
  "/cbt/setup/waec",
  "/cgpa-calculator",
  "/contact",
  "/contact-us",
  "/cookie-policy",
  "/cookies",
  "/dashboard",
  "/dashboard/applications",
  "/dashboard/cbt",
  "/dashboard/cbt/results",
  "/dashboard/notifications",
  "/dashboard/past-questions",
  "/dashboard/profile",
  "/dashboard/requests",
  "/dashboard/results",
  "/dashboard/saved",
  "/dashboard/scholarships",
  "/dashboard/services",
  "/dashboard/settings",
  "/dashboard/tools",
  "/disclaimer",
  "/events",
  "/faq",
  "/forgot-password",
  "/help",
  "/jamb",
  "/jobs",
  "/login",
  "/nabteb",
  "/neco",
  "/nelfund",
  "/news",
  "/past-questions",
  "/post-utme",
  "/privacy",
  "/privacy-policy",
  "/profile",
  "/profile/complete",
  "/refund-policy",
  "/refunds",
  "/register",
  "/reset-password",
  "/results",
  "/reviews",
  "/scholarships",
  "/schools",
  "/screening-calculator",
  "/search",
  "/services",
  "/services/track",
  "/settings",
  "/signin",
  "/signup",
  "/support",
  "/terms",
  "/terms-of-service",
  "/tools",
  "/tools/cgpa-calculator",
  "/track",
  "/verify-email",
  "/waec"
];

export const APP_ROUTE_PREFIXES: readonly string[] = [
  "/admission",
  "/cbt/results",
  "/cbt/session",
  "/dashboard/cbt/results",
  "/dashboard/results",
  "/jobs",
  "/news",
  "/schools",
  "/services",
  "/services/apply",
  "/tools",
  "/u"
];

/** True when the router has a case for this path. Query strings are ignored. */
export function isAppRoute(pathname: string): boolean {
  const path = String(pathname || '/').split('?')[0].split('#')[0];
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  if (APP_ROUTE_PATHS.includes(normalized)) return true;
  return APP_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix + '/'));
}
