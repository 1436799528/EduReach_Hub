import type { ReactNode } from 'react';
import HubLayout from './HubLayout';

/** Compatibility wrapper for legacy, unused page modules. The live app uses HubLayout. */
export const imageBase = '';

export function Banner({ title }: { title: string }) {
  return <div className="hub-page-title"><span className="hub-eyebrow">EDUREACH</span><h1>{title}</h1></div>;
}

export function Shell({ children }: { title?: string; children: ReactNode }) {
  return <HubLayout>{children}</HubLayout>;
}
