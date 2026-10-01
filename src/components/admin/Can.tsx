/**
 * Capability-aware rendering for the admin console.
 *
 * This is a UX layer, not a boundary: the server re-checks every capability
 * (see lib/authorization.ts). Its job is to not show a control the signed-in
 * account cannot use — and to explain the refusal when a deep link is opened.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { hasCapability as holderHasCapability, type Capability } from '../../lib/capabilities';

export interface AdminCapabilityValue {
  role: string;
  capabilities: readonly string[];
}

const AdminCapabilityContext = createContext<AdminCapabilityValue | null>(null);

export function AdminCapabilityProvider({ value, children }: { value: AdminCapabilityValue; children: ReactNode }) {
  return <AdminCapabilityContext.Provider value={value}>{children}</AdminCapabilityContext.Provider>;
}

export function useAdminCapabilities(): AdminCapabilityValue {
  return useContext(AdminCapabilityContext) ?? { role: '', capabilities: [] };
}

export function useHasCapability(capability: Capability): boolean {
  return holderHasCapability(useAdminCapabilities(), capability);
}

/**
 * Renders children only when the console session holds the capability.
 * `<Can capability="news.publish">…</Can>`
 */
export function Can({
  capability,
  fallback = null,
  children,
}: {
  capability: Capability;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return <>{useHasCapability(capability) ? children : fallback}</>;
}
