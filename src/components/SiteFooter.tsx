import BrandLogo from './BrandLogo';
import { useSiteContent } from './useSiteContent';

/**
 * The site footer: one compact bar, the same on every surface.
 *
 * The product has a small number of pages every visitor needs to be able to
 * reach from anywhere: who we are, how to reach a person, and the policies that
 * govern the account. Everything else already has a home in the header, the
 * side rail or the mobile bottom navigation, so repeating it here only made the
 * footer taller and the page noisier.
 *
 * The brand name and year come from site settings. The links are code because
 * each one maps to a real route; a link that does not resolve is not a footer
 * link, it is a broken promise.
 *
 * The "Cookie settings" button is part of this contract. Consent must stay
 * reopenable after the banner is dismissed, on every page, including signed-in
 * screens that do not render the public shell.
 */

interface FooterLink { href: string; label: string }

const ESSENTIAL: FooterLink[] = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookies', label: 'Cookies' },
];

export default function SiteFooter() {
  const { content } = useSiteContent();
  const { brand } = content.settings;
  const year = new Date().getFullYear();

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

        <nav className="er-footer-legal" aria-label="Footer: policies">
          {ESSENTIAL.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
          <button
            type="button"
            className="er-footer-cookie-settings"
            onClick={() => window.dispatchEvent(new CustomEvent('edureach:open-cookie-settings'))}
          >
            Cookie settings
          </button>
        </nav>
      </div>
    </footer>
  );
}
