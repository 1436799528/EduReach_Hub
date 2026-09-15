import { useMemo, useState } from 'react';
import { blogPosts, services, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const serviceHighlights = [
  ['01', 'Services', 'NELFUND, results, JAMB and admission support.'],
  ['02', 'News', 'Quick academic and campus updates.'],
  ['03', 'CBT', 'Practice and past-question support.'],
  ['04', 'Jobs', 'Scholarships and student opportunities.'],
];

const stats = [
  ['05', 'Student services', 'ti-user'],
  ['12+', 'Academic updates', 'ti-book'],
  ['04', 'Support areas', 'ti-medall'],
  ['24/7', 'Online access', 'ti-world'],
  ['100%', 'Student focused', 'ti-id-badge'],
];

const bannerTone: Record<string, string> = {
  'nelfund-loan': 'deep-blue',
  results: 'emerald',
  'scratch-cards': 'deep-blue',
  'jamb-slip': 'emerald',
  'admission-letters': 'deep-blue',
};

const serviceAction = (id: string) => {
  if (id === 'nelfund-loan') return 'Apply Now';
  if (id === 'results') return 'Check Result';
  if (id === 'scratch-cards') return 'Buy Card';
  if (id === 'jamb-slip') return 'Print Slip';
  return 'Start Request';
};

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const searchText = query.trim().toLowerCase();
  const filteredServices = useMemo(() => services.filter((service) => `${service.title} ${service.description}`.toLowerCase().includes(searchText)), [searchText]);
  const latestNews = blogPosts.slice(0, 4);

  return (
    <Shell>
      <section id="home" className="home_bg hb_height" style={{ backgroundImage: `url(${imageBase}/bg/home-bg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="container"><div className="row align-items-center">
          <div className="col-lg-8"><div className="hero-text ht_top">
            <div className="portal-kicker"><span>EDUREACH HUB</span><strong>Student Portal</strong></div>
            <h1><span>Practical Student Support</span> For Nigerian Tertiary Students</h1>
            <p>{siteConfig.description}</p>
            <div className="home_sb"><div className="banner_subs">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si" placeholder="Search past questions, news or services..." aria-label="Search EduReach" />
              <a href="#services" className="subscribe__btn">Search <i className="fa fa-search" /></a>
            </div>{query && <div className="hero-search-results">{filteredServices.slice(0, 5).map((service) => <a href={`/services/${service.id}`} key={service.id}>{service.title}</a>)}<a href={`/blog?search=${encodeURIComponent(query.trim())}`}>Search News: “{query.trim()}”</a></div>}</div>
          </div></div>
          <div className="col-lg-4"><div className="hero-quick-panel"><span className="hero-quick-label">Quick Access</span><a href="/services/nelfund-loan"><strong>NELFUND Assistance</strong><span>Apply and track support</span></a><a href="/services/jamb-slip"><strong>JAMB Exam Slip</strong><span>Printing and document help</span></a><a href="/services/results"><strong>WAEC / NECO Results</strong><span>Result-checking guidance</span></a></div></div>
        </div></div>
      </section>

      <section className="dense-portal-wrap"><div className="container"><div className="dense-portal-grid">
        <section className="portal-primary">
          <div id="channel" className="community-bar dense-channel-bar"><div><strong>Join EduReach Official WhatsApp Channel</strong><span>Get JAMB, NELFUND, admission and campus alerts on your phone.</span></div><div className="community-links"><a href="#" className="community-link whatsapp"><span>WhatsApp</span><strong>Join Channel</strong></a><a href="#" className="community-link telegram"><span>Telegram</span><strong>Join Channel</strong></a></div></div>

          <div className="dense-section-head"><div><span>Featured</span><h2>Quick Student Actions</h2></div><a href="/services">View All Services</a></div>
          <div className="row g-3">
            {services.slice(0, 4).map((service) => <div className="col-md-6" key={service.id}><article className={`app-card ${bannerTone[service.id] === 'emerald' ? 'tint-emerald' : 'tint-blue'}`}><div className={`app-card-banner ${bannerTone[service.id]}`}><span>{service.shortTitle}</span><span className="app-status">Verified Service</span></div><div className="app-card-body"><h3>{service.title}</h3><p>{service.description}</p><a href={`/services/${service.id}`} className="app-card-action">{serviceAction(service.id)}</a></div></article></div>)}
          </div>

          <div className="dense-section-head compact"><div><span>Practice</span><h2>CBT &amp; Past Questions</h2></div><a href="/blog">Explore Updates</a></div>
          <div className="row g-3">
            <div className="col-md-6"><article className="app-card tint-blue"><div className="app-card-banner deep-blue"><span>JAMB UTME</span><span className="app-status">Free Practice</span></div><div className="app-card-body"><h3>UTME Practice Engine</h3><p>Timed questions with instant subject performance scoring.</p><a href="/services/jamb-slip" className="app-card-action">Start Test</a></div></article></div>
            <div className="col-md-6"><article className="app-card tint-emerald"><div className="app-card-banner emerald"><span>POST-UTME</span><span className="app-status">Practice</span></div><div className="app-card-body"><h3>Past Question Practice</h3><p>Practice with focused exam-style questions and study guidance.</p><a href="/blog" className="app-card-action">Start Practice</a></div></article></div>
          </div>
        </section>

        <aside className="portal-sidebar">
          <div className="sidebar-widget"><div className="sidebar-title"><h3>Latest Updates</h3><a href="/blog">All News</a></div><ul className="latest-update-list">{latestNews.map((post) => <li key={post.id}><span>{post.category}</span><a href={`/blog/${post.id}`}>{post.title}</a></li>)}</ul></div>
          <div className="sidebar-widget"><div className="sidebar-title"><h3>Quick Links</h3></div><div className="sidebar-links"><a href="/services/nelfund-loan">NELFUND Assistance</a><a href="/services/results">WAEC / NECO Results</a><a href="/services/scratch-cards">Scratch Cards</a><a href="/services/jamb-slip">JAMB Exam Slip</a><a href="/services/admission-letters">Admission Letters</a></div></div>
          <div className="sidebar-widget sidebar-community"><div className="sidebar-title"><h3>Join Our Channels</h3></div><p>Instant alerts, student guides and quick academic updates.</p><div className="sidebar-community-links"><a href="#" className="community-link whatsapp"><span>WhatsApp</span><strong>Join Channel</strong></a><a href="#" className="community-link telegram"><span>Telegram</span><strong>Join Channel</strong></a></div></div>
        </aside>
      </div></div></section>

      <section className="count_area counter_feature"><div className="container"><div className="row">{stats.map(([value, label, icon]) => <div className="col-lg col-md-4 col-sm-6 col-12" key={label}><div className="single-counter"><span className={`${icon} sc_one`} /><h2 className="counter-num">{value}</h2><p>{label}</p></div></div>)}</div></div></section>

      <section id="about" className="about_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><div className="about-img"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Students learning" loading="lazy" /></div></div><div className="col-lg-6"><div className="section-title"><h2>Practical Support For Nigerian Tertiary Students</h2><p>EduReach brings services, news, practice and opportunities together in one student-focused portal.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Services for everyday student needs</li><li><i className="fa fa-check" /> News and quick academic updates</li><li><i className="fa fa-check" /> Clear next-step actions</li></ul><a href="/services" className="btn_one">Explore Services</a></div></div></div></section>

      <section id="services" className="cat_area section-padding"><div className="container"><div className="section-title text-center"><h2>All Student Services</h2><p>Focused services with direct next-step buttons.</p></div><div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}><article className={`app-card service-app-card ${bannerTone[service.id] === 'emerald' ? 'tint-emerald' : 'tint-blue'}`}><div className={`app-card-banner ${bannerTone[service.id]}`}><span>{service.shortTitle}</span><span className="app-status">Verified Service</span></div><div className="app-card-body"><h3>{service.title}</h3><p>{service.description}</p><a href={`/services/${service.id}`} className="app-card-action">{serviceAction(service.id)}</a></div></article></div>)}</div></div></section>

      <section className="team_area section-padding"><div className="container"><div className="section-title text-center"><h2>What’s Inside</h2><p>Services, news, CBT and opportunities without unnecessary clutter.</p></div><div className="row">{serviceHighlights.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="our-team"><div className="team_img"><div className="demo-avatar static-avatar">{number}</div></div><div className="team-content"><h4>{title}</h4><p>{text}</p></div></div></div>)}</div></div></section>

      <section className="why_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="EduReach student support" loading="lazy" /></div><div className="col-lg-6"><div className="section-title"><h2>Built For Fast Student Actions</h2><p>Choose a service or update, see the next step and move on.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Context-specific action labels</li><li><i className="fa fa-check" /> Dense but readable cards</li><li><i className="fa fa-check" /> Mobile-friendly layouts</li></ul><a href="/contact" className="btn_one">Talk To EduReach</a></div></div></div></section>

      <section className="testimonial_area section-padding"><div className="container"><div className="section-title text-center"><h2>What Students Say About<br />EduReach</h2></div><div className="row">{testimonials.map((testimonial) => <div className="col-lg-4 col-sm-6" key={testimonial.name}><div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div></div>)}</div></div></section>

      <section id="blog" className="blog_area section-padding"><div className="container"><div className="section-title text-center"><h2>Campus News &amp; Updates</h2><p>JAMB, WAEC, NECO, admissions, funding, results and opportunities.</p></div><div className="row">{blogPosts.slice(0, 6).map((post) => <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}><article className="blog_post"><a href={`/blog/${post.id}`} className="blog-img"><img src={post.image} alt={post.title} loading="lazy" /></a><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><span>{post.category}</span>{post.badge && <span>{post.badge}</span>}</div><h3><a href={`/blog/${post.id}`}>{post.title}</a></h3><p>{post.excerpt}</p><a href={`/blog/${post.id}`} className="blog_readmore">Read Story <i className="fa fa-long-arrow-right" /></a></div></article></div>)}</div></div></section>

      <section className="why_area section-padding"><div className="container"><div className="section-title text-center"><h2>Scholarships &amp; Jobs</h2><p>Opportunities students can follow up on quickly.</p></div><div className="row"><div className="col-lg-4 col-sm-6"><article className="app-card tint-emerald"><div className="app-card-banner emerald"><span>Scholarships</span><span className="app-status">Verified Opportunity</span></div><div className="app-card-body"><h3>Funding Opportunities</h3><p>Scholarship and student funding updates.</p><a href="/blog" className="app-card-action">View Opportunity</a></div></article></div><div className="col-lg-4 col-sm-6"><article className="app-card tint-blue"><div className="app-card-banner deep-blue"><span>Jobs</span><span className="app-status">Verified Opportunity</span></div><div className="app-card-body"><h3>Student Jobs</h3><p>Job, internship and graduate opportunity updates.</p><a href="/blog" className="app-card-action">View Opportunity</a></div></article></div></div></div></section>

      <section id="contact" className="contact_area section-padding"><div className="container"><div className="section-title text-center"><h2>Contact</h2><p>Need help with a service? Send a message.</p></div><div className="row align-items-start"><div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div><div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{contactSent && <div className="form-success">Your message has been captured.</div>}</div></div></div></section>
    </Shell>
  );
}
