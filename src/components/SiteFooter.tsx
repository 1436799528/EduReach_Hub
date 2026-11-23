import BrandLogo from './BrandLogo';
import SocialIcon from './SocialIcon';
import { useSiteContent } from './useSiteContent';
import { VERIFIED_SOCIAL_LINKS, type VerifiedSocialLink } from '../data/socials';
import { whatsappHref } from '../lib/siteContentModel';

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
 * add further profiles in Site, Social & Contact, and those are merged here. An
 * enabled network with no saved URL keeps its icon but is not a link.
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

export default function SiteFooter() {
  const { content } = useSiteContent();
  const { brand, social } = content.settings;
  const year = new Date().getFullYear();

  // Verified defaults first, then administrator-added profiles; a URL appears
  // once even if both sources carry it.
  const verified = new Map(VERIFIED_SOCIAL_LINKS.map((link) => [link.network, link.url]));
  const socialLinks = social.links
    .filter((link) => link.visible)
    .map((link) => ({
      ...link,
      // A network the team has already verified in code keeps working until an
      // administrator saves the same profile in settings.
      url: link.url || verified.get(link.platform as VerifiedSocialLink['network']) || '',
    }));
  const { contact } = content.settings;
  const generalEmail = contact.email;
  const supportEmail = contact.supportEmail || contact.email;
  const whatsappLink = whatsappHref(contact.whatsapp);

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
            {socialLinks.map((link) =>
              link.url ? (
                <a
                  key={`${link.platform}-${link.label}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${brand.name} on ${link.label}${link.handle ? ` (@${link.handle})` : ''} (opens in a new tab)`}
                  title={`${link.label}${link.handle ? `: @${link.handle}` : ''}`}
                >
                  <SocialIcon platform={link.platform} size={16} />
                </a>
              ) : (
                <span
                  key={`${link.platform}-${link.label}`}
                  className="er-footer-social-icon is-unconfigured"
                  role="img"
                  aria-label={`${link.label}: not configured yet`}
                  title={`${link.label} profile not configured yet`}
                >
                  <SocialIcon platform={link.platform} size={16} />
                </span>
              ),
            )}
          </nav>
        )}

        <div className="er-footer-contact" role="group" aria-label="Contact EduReach Hub">
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} title="Email support">
              {supportEmail}
            </a>
          )}
          {generalEmail && generalEmail !== supportEmail && (
            <a href={`mailto:${generalEmail}`} title="General enquiries">
              {generalEmail}
            </a>
          )}
          {contact.phone && <a href={`tel:${contact.phone.replace(/[^0-9+]/g, '')}`}>{contact.phone}</a>}
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
          )}
          {contact.details.map((detail) => (
            <span key={`${detail.label}-${detail.value}`}>
              {detail.label}: {detail.value}
            </span>
          ))}
        </div>

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
