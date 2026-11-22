import {
  Facebook,
  Instagram,
  Linkedin,
  Link2,
  MessageCircle,
  Music2,
  Send,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useSiteContent } from './useSiteContent';
import { VERIFIED_SOCIAL_LINKS, socialNetworkFor, type VerifiedSocialLink } from '../data/socials';

/**
 * The site footer: one compact bar, the same on every surface.
 *
 * The product has a small number of pages every visitor needs to be able to
 * reach from anywhere: who we are, how to reach a person, what other students
 * think, help, and the policies that govern the account. Everything else
 * already has a home in the header, the side rail or the mobile bottom
 * navigation, so repeating it here only made the footer taller and the page
 * noisier.
 *
 * The brand name and year come from site settings. The links are code because
 * each one maps to a real route; a link that does not resolve is not a footer
 * link, it is a broken promise.
 *
 * Social accounts are shown only when they exist. The verified list comes from
 * `src/data/socials.ts` (currently the WhatsApp channel); an administrator may
 * add further profiles in Site & Policies, and those are merged here. There is
 * no placeholder icon for a network EduReach does not operate.
 *
 * The "Cookie settings" button is part of this contract. Consent must stay
 * reopenable after the banner is dismissed, on every page, including signed-in
 * screens that do not render the public shell.
 */

interface FooterLink { href: string; label: string }

const COMPANY: FooterLink[] = [
  { href: '/about', label: 'About' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/faq', label: 'Help & FAQ' },
  { href: '/contact', label: 'Contact' },
];

const POLICIES: FooterLink[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

const SOCIAL_ICONS: Record<VerifiedSocialLink['network'], LucideIcon> = {
  whatsapp: MessageCircle,
  facebook: Facebook,
  instagram: Instagram,
  x: Link2,
  tiktok: Music2,
  youtube: Youtube,
  linkedin: Linkedin,
  telegram: Send,
  website: Link2,
};

const NETWORK_NAMES: Record<VerifiedSocialLink['network'], string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  website: 'website',
};

function isHttps(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export default function SiteFooter() {
  const { content } = useSiteContent();
  const { brand, social } = content.settings;
  const year = new Date().getFullYear();

  // Verified defaults first, then administrator-added profiles; a URL appears
  // once even if both sources carry it.
  const seen = new Set<string>();
  const socialLinks: VerifiedSocialLink[] = [];
  for (const link of [...VERIFIED_SOCIAL_LINKS, ...social.links.map((entry) => ({
    label: entry.label,
    url: entry.url,
    network: socialNetworkFor(entry.label, entry.url),
  }))]) {
    if (!link.url || !isHttps(link.url) || seen.has(link.url)) continue;
    seen.add(link.url);
    socialLinks.push(link);
  }

  return (
    <footer className="er-footer">
      <div className="hub-container er-footer-bar">
        <div className="er-footer-identity">
          <a className="er-footer-brand-link" href="/" aria-label={`${brand.name}: home`}>
            <BrandLogo height={24} radius="50%" />
          </a>
          <p className="er-footer-copy">
            © {year} {brand.name}. Independent platform; not affiliated with JAMB, WAEC,
            NECO or any institution.
          </p>
        </div>

        {socialLinks.length > 0 && (
          <nav className="er-footer-social" aria-label={`${brand.name} on social media`}>
            {socialLinks.map((link) => {
              const Icon = SOCIAL_ICONS[link.network] || Link2;
              const network = NETWORK_NAMES[link.network] || 'social';
              return (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${brand.name} on ${network} (opens in a new tab)`}
                  title={`${network}: ${link.label}`}
                >
                  <Icon size={16} aria-hidden="true" />
                </a>
              );
            })}
          </nav>
        )}

        <nav className="er-footer-legal" aria-label="Footer: company and policies">
          <div className="er-footer-group">
            {COMPANY.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </div>
          <div className="er-footer-group">
            {POLICIES.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
            <button
              type="button"
              className="er-footer-cookie-settings"
              onClick={() => window.dispatchEvent(new CustomEvent('edureach:open-cookie-settings'))}
            >
              Cookie settings
            </button>
          </div>
        </nav>
      </div>
    </footer>
  );
}
