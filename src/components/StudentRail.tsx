import { blogPosts, services } from '../data/edulebMock';

const quickLinks = [
  ['Find a Service', '/services'],
  ['Latest Updates', '/blog'],
  ['Contact EduReach', '/contact'],
];

export default function StudentRail() {
  const latest = blogPosts.slice(0, 4);

  return (
    <aside className="student-rail" aria-label="EduReach student quick links">
      <div className="rail-card rail-highlight">
        <span className="rail-kicker">EduReach Student Hub</span>
        <h3>Useful things, one scroll away.</h3>
        <p>Jump to a service, catch the latest update or get help without leaving the page.</p>
        <a href="/services" className="btn_one rail-primary-btn">Explore Services</a>
      </div>

      <div className="rail-card">
        <div className="rail-card-title"><h4>Quick Links</h4><span className="ti-bolt" /></div>
        <div className="rail-link-list">
          {quickLinks.map(([label, href]) => <a href={href} key={href}>{label}<i className="fa fa-angle-right" /></a>)}
        </div>
      </div>

      <div className="rail-card">
        <div className="rail-card-title"><h4>Student Services</h4><span className="ti-layout-grid2" /></div>
        <div className="rail-service-list">
          {services.map((service) => <a href={`/services/${service.id}`} key={service.id}><span className="rail-service-icon"><i className={service.icon} /></span><span><strong>{service.shortTitle}</strong><small>{service.title}</small></span></a>)}
        </div>
      </div>

      <div className="rail-card">
        <div className="rail-card-title"><h4>Latest Updates</h4><span className="ti-notepad" /></div>
        <div className="rail-news-list">
          {latest.map((post) => <a href={`/blog/${post.id}`} key={post.id}><span className="rail-news-date">{post.date}</span><strong>{post.title}</strong></a>)}
        </div>
        <a href="/blog" className="rail-more-link">See all updates <i className="fa fa-long-arrow-right" /></a>
      </div>

      <div className="rail-card rail-contact-card">
        <span className="ti-headphone-alt" />
        <h4>Need help choosing?</h4>
        <p>Tell EduReach what you need and we will point you to the right service.</p>
        <a href="/contact">Talk to EduReach <i className="fa fa-angle-right" /></a>
      </div>
    </aside>
  );
}
