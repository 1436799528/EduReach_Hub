import { EDUREACH_WHATSAPP_CHANNEL } from './hubContent';

/**
 * The social accounts that actually exist.
 *
 * This list is deliberately short and code-reviewed: a handle is added only
 * when the account has been created and checked. There is no Facebook,
 * Instagram, X/TikTok or YouTube entry here because EduReach does not operate
 * those accounts yet, and an icon that leads to an empty profile (or worse, an
 * impostor) is worse than no icon.
 *
 * Administrators can add further verified profiles in Admin → Site & Policies;
 * those are merged with this list and de-duplicated by URL in the footer.
 */
export interface VerifiedSocialLink {
  label: string;
  url: string;
  /** Icon family; the footer maps it to a lucide icon and an accessible name. */
  network: 'whatsapp' | 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube' | 'linkedin' | 'telegram' | 'website';
}

export const VERIFIED_SOCIAL_LINKS: VerifiedSocialLink[] = [
  {
    label: 'WhatsApp channel',
    url: EDUREACH_WHATSAPP_CHANNEL,
    network: 'whatsapp',
  },
];

/** Maps a stored link label/URL to an icon family without inventing a handle. */
export function socialNetworkFor(label: string, url: string): VerifiedSocialLink['network'] {
  const text = `${label} ${url}`.toLowerCase();
  if (text.includes('whatsapp') || text.includes('wa.me') || text.includes('whatsapp.com')) return 'whatsapp';
  if (text.includes('facebook') || text.includes('fb.com')) return 'facebook';
  if (text.includes('instagram')) return 'instagram';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('youtube') || text.includes('youtu.be')) return 'youtube';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('telegram') || text.includes('t.me')) return 'telegram';
  if (/(^|\s)x(\s|$)|twitter|x\.com/.test(text)) return 'x';
  return 'website';
}
