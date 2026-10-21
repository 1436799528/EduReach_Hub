import BrandLogo from './BrandLogo';
import { useSiteContent } from './useSiteContent';
import { whatsappHref } from '../lib/siteContentModel';

/**
 * The public footer: identity, where to learn, where to go, how to reach a
 * person, and the policy pages.
 *
 * Everything an administrator can change - name, one-line description, contact
 * details, social accounts - comes from `site_settings` through
 * `useSiteContent()`. The link columns are code because they map to routes that
 * exist; a link that does not resolve to a route is not a footer link, it is a
 * broken promise.
 *
 * There is deliberately no "popular past questions" strip: nothing in the
 * database ranks past questions by demand, and inventing a ranking would be the
 * same error as inventing a statistic.
 */

interface FooterLink { href: string; label: string }

const LEARN: FooterLink[] = [
  { href: '/cbt', label: 'CBT practice' },
  { href: '/past-questions', label: 'Past questions' },
  { href: '/schools', label: 'School finder' },
  { href: '/screening-calculator', label: 'Screening calculator' },
  { href: '/tools/cgpa-calculator', label: 'CGPA calculator' },
];

const EXPLORE: FooterLink[] = [
  { href: '/services', label: 'Student services' },
  { href: '/news', label: 'News & updates' },
  { href: '/jobs', label: 'Scholarships & jobs' },
  { href: '/events', label: 'Deadlines & calendar' },
];

const LEGAL: FooterLink[] = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/accessibility', label: 'Accessibility' },
  { href: '/disclaimer', label: 'Disclaimer' },
];

function LinkColumn({ heading, label, links }: { heading: string; label: string; links: FooterLink[] }) {
  return (
    <nav className="er-footer-col" aria-label={label}>
      <h2 className="er-footer-heading">{heading}</h2>
      <div className="er-footer-links">
        {links.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
      </div>
    </nav>
  );
}

export default function SiteFooter() {
  const { content } = useSiteContent();
  const { brand, footer, contact, social } = content.settings;
  const whatsapp = whatsappHref(contact.whatsapp);
  const year = new Date().getFullYear();

  return (
    <footer className="er-footer">
      <div className="hub-container">
        <div className="er-footer-grid">
          <div className="er-footer-brand">
            <a className="er-footer-brand-link" href="/" aria-label={`${brand.name}: home`}>
              <BrandLogo height={28} radius="50%" />
              <strong>{brand.name}</strong>
            </a>
            <p className="er-footer-about">{footer.about}</p>
            {social.links.length > 0 && (
              <div className="er-footer-social" aria-label="EduReach on social media">
                {social.links.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer me">{link.label}</a>
                ))}
              </div>
            )}
          </div>

          <LinkColumn heading="Learn" label="Footer: learning resources" links={LEARN} />
          <LinkColumn heading="Explore" label="Footer: navigation" links={EXPLORE} />

          <nav className="er-footer-col" aria-label="Footer: contact and support">
            <h2 className="er-footer-heading">Get help</h2>
            <div className="er-footer-links">
              <a href="/contact">Contact us</a>
              {whatsapp && (
                <a className="er-footer-help" href={whatsapp} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
              )}
              {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
            </div>
            {contact.note && <p className="er-footer-note">{contact.note}</p>}
          </nav>
        </div>

        <div className="er-footer-bottom">
          <p className="er-footer-copy">
            © {year} {brand.name}. Independent study and student-services platform; not affiliated with JAMB, WAEC,
            NECO or any institution.
          </p>
          <nav className="er-footer-legal" aria-label="Footer: policies">
            {LEGAL.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
