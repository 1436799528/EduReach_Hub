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

  return (
    <Shell>
      <section id="home" className="home_bg hb_height" style={{ backgroundImage: `url(${imageBase}/bg/home-bg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="container"><div className="row align-items-center">
          <div className="col-lg-6"><div className="hero-text ht_top">
            <h1><span>EduReach Hub</span> Practical Support For Nigerian Tertiary Students</h1>
            <p>{siteConfig.description}</p>
            <div className="home_sb"><div className="banner_subs">
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si" placeholder="Search EduReach services here" aria-label="Search EduReach services" />
              <a href="#services" className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></a>
            </div>{query && <div className="hero-search-results">{filteredServices.slice(0, 5).map((service) => <a href={`/services/${service.id}`} key={service.id}>{service.title}</a>)}</div>}</div>
          </div></div>
          <div className="col-lg-6"><div className="hero-text-img"><img src={`${imageBase}/home-img2.png`} className="img-fluid" alt="Students learning online" /><div className="home_ps"><span className="ti-user" /><h2>Students</h2><p>Fast. Reliable. No stress.</p></div></div></div>
        </div></div>
      </section>

      <section className="count_area counter_feature"><div className="container"><div className="row">{stats.map(([value, label, icon]) => <div className="col-lg col-md-4 col-sm-6 col-12" key={label}><div className="single-counter"><span className={`${icon} sc_one`} /><h2 className="counter-num">{value}</h2><p>{label}</p></div></div>)}</div></div></section>

      <section className="top_cat__area section-padding"><div className="container"><div className="section-title text-center"><h2>One Place. Many Student Needs.</h2><p>Services, practice, news and opportunities in one place.</p></div><div className="row">{serviceHighlights.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="single_tp"><span className="sc_one">{number}</span><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>

      <section id="about" className="about_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><div className="about-img"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Students learning" loading="lazy" /></div></div><div className="col-lg-6"><div className="section-title"><h2>Practical Support For Nigerian Tertiary Students</h2><p>Find services, updates and useful student information fast.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Services for everyday student needs</li><li><i className="fa fa-check" /> News and quick academic updates</li><li><i className="fa fa-check" /> Direct next-step actions</li></ul><a href="/services" className="btn_one">Explore Services</a></div></div></div></section>

      <section id="services" className="cat_area section-padding"><div className="container"><div className="section-title text-center"><h2>Services</h2><p>Short steps. Clear actions. No unnecessary copy.</p></div><div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}><article className="app-card service-app-card"><div className={`app-card-banner ${bannerTone[service.id]}`}><span>{service.shortTitle}</span><span className="app-status">Active</span></div><div className="app-card-body"><h3>{service.title}</h3><p>{service.description}</p><a href={`/services/${service.id}`} className="app-card-action">{serviceAction(service.id)}</a></div></article></div>)}</div></div></section>

      <section className="course_area section-padding"><div className="container"><div className="section-title text-center"><h2>Practice</h2><p>Practice tools and past-question support are coming into the same compact app style.</p></div><div className="row"><div className="col-lg-4 col-sm-6 col-xs-12"><article className="app-card practice-app-card"><div className="app-card-banner deep-blue"><span>CBT</span><span className="app-status">Practice</span></div><div className="app-card-body"><h3>UTME CBT Simulator</h3><p>Timed past questions and instant scoring.</p><a href="/services/jamb-slip" className="app-card-action">Start Test</a></div></article></div><div className="col-lg-4 col-sm-6 col-xs-12"><article className="app-card practice-app-card"><div className="app-card-banner emerald"><span>Past Questions</span><span className="app-status">Practice</span></div><div className="app-card-body"><h3>Past Questions</h3><p>Practice with focused exam-style questions.</p><a href="/blog" className="app-card-action">Practice Now</a></div></article></div></div></div></section>

      <section className="community-bar-area section-padding"><div className="container"><div className="community-bar"><div><strong>Student Channels</strong><span>Join for fast alerts, guides and daily practice.</span></div><div className="community-links"><a href="#" className="community-link telegram"><span>Telegram</span><strong>Join Channel</strong></a><a href="#" className="community-link whatsapp"><span>WhatsApp</span><strong>Join Group</strong></a><a href="#" className="community-link youtube"><span>YouTube / X</span><strong>Follow Us</strong></a></div></div></div></section>

      <section className="team_area section-padding"><div className="container"><div className="section-title text-center"><h2>What’s Inside</h2><p>Keep it simple: services, news, CBT and jobs.</p></div><div className="row">{serviceHighlights.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="our-team"><div className="team_img"><div className="demo-avatar static-avatar">{number}</div></div><div className="team-content"><h4>{title}</h4><p>{text}</p></div></div></div>)}</div></div></section>

      <section className="why_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="EduReach student support" loading="lazy" /></div><div className="col-lg-6"><div className="section-title"><h2>Built For Fast Student Actions</h2><p>Choose a card, see the next step and move on.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Short labels</li><li><i className="fa fa-check" /> Clear action buttons</li><li><i className="fa fa-check" /> Mobile-friendly cards</li></ul><a href="/contact" className="btn_one">Talk To EduReach</a></div></div></div></section>

      <section className="testimonial_area section-padding"><div className="container"><div className="section-title text-center"><h2>What Students Say About<br />EduReach</h2></div><div className="row">{testimonials.map((testimonial) => <div className="col-lg-4 col-sm-6" key={testimonial.name}><div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div></div>)}</div></div></section>

      <section id="blog" className="blog_area section-padding"><div className="container"><div className="section-title text-center"><h2>News</h2><p>Campus gist, JAMB, WAEC, NECO, admissions and opportunities.</p></div><div className="row">{blogPosts.slice(0, 6).map((post) => <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}><article className="blog_post"><a href={`/blog/${post.id}`} className="blog-img"><img src={post.image} alt={post.title} loading="lazy" /></a><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><span>{post.category}</span>{post.badge && <span>{post.badge}</span>}</div><h3><a href={`/blog/${post.id}`}>{post.title}</a></h3><p>{post.excerpt}</p><a href={`/blog/${post.id}`} className="blog_readmore">Read Story <i className="fa fa-long-arrow-right" /></a></div></article></div>)}</div></div></section>

      <section className="why_area section-padding"><div className="container"><div className="section-title text-center"><h2>Jobs</h2><p>Scholarships, student opportunities and career updates.</p></div><div className="row"><div className="col-lg-4 col-sm-6"><article className="app-card"><div className="app-card-banner emerald"><span>Scholarships</span><span className="app-status">New</span></div><div className="app-card-body"><h3>Funding Opportunities</h3><p>Find scholarship and funding updates.</p><a href="/blog" className="app-card-action">View Opportunity</a></div></article></div><div className="col-lg-4 col-sm-6"><article className="app-card"><div className="app-card-banner deep-blue"><span>Jobs</span><span className="app-status">Updates</span></div><div className="app-card-body"><h3>Student Jobs</h3><p>See job and internship updates.</p><a href="/blog" className="app-card-action">View Opportunity</a></div></article></div></div></div></section>

      <section id="contact" className="contact_area section-padding"><div className="container"><div className="section-title text-center"><h2>Contact</h2><p>Need help with a service? Send a message.</p></div><div className="row align-items-start"><div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div><div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{contactSent && <div className="form-success">Your message has been captured.</div>}</div></div></div></section>
    </Shell>
  );
}
