import { useMemo, useState } from 'react';
import { blogPosts, services, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const serviceHighlights = [
  ['01', 'Funding', 'Get help understanding student loan applications and keeping important funding information organised.'],
  ['02', 'Results', 'Find clear guidance for WAEC and NECO result checking and related result services.'],
  ['03', 'Examinations', 'Get practical support around JAMB examination documents and preparation.'],
  ['04', 'Admissions', 'Get structured help with admission deferment and supplementary application letters.'],
];

const stats = [
  ['05', 'Student services', 'ti-user'],
  ['12+', 'Academic updates', 'ti-book'],
  ['04', 'Support areas', 'ti-medall'],
  ['24/7', 'Online access', 'ti-world'],
  ['100%', 'Student focused', 'ti-id-badge'],
];

const journey = [
  ['01', 'Find a service', 'Choose the student service that matches what you need.'],
  ['02', 'Follow the guidance', 'Use the clear information and steps provided for the service.'],
  ['03', 'Stay updated', 'Keep up with campus news, academic updates and deadlines.'],
  ['04', 'Get support', 'Reach out when you need help with the next step.'],
];

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
            </div>{query && <div className="hero-search-results">{filteredServices.slice(0, 5).map((service) => <a href="#services" key={service.id}>{service.title}</a>)}</div>}</div>
          </div></div>
          <div className="col-lg-6"><div className="hero-text-img"><img src={`${imageBase}/home-img2.png`} className="img-fluid" alt="Students learning online" /><div className="home_ps"><span className="ti-user" /><h2>Students</h2><p>Fast. Reliable. No stress.</p></div></div></div>
        </div></div>
      </section>

      <section className="count_area counter_feature"><div className="container"><div className="row">{stats.map(([value, label, icon]) => <div className="col-lg col-md-4 col-sm-6 col-12" key={label}><div className="single-counter"><span className={`${icon} sc_one`} /><h2 className="counter-num">{value}</h2><p>{label}</p></div></div>)}</div></div></section>

      <section className="top_cat__area section-padding"><div className="container"><div className="section-title text-center"><h2>One Place. Many Student Needs.</h2><p>EduReach brings practical student services, important updates and useful support together in one place.</p></div><div className="row">{journey.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="single_tp"><span className="sc_one">{number}</span><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>

      <section id="about" className="about_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><div className="about-img"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Students learning" loading="lazy" /></div></div><div className="col-lg-6"><div className="section-title"><h2>Practical Support For Nigerian Tertiary Students</h2><p>EduReach is built around real student needs: accessing funding information, checking results, preparing examination documents, handling admission requests and staying informed.</p></div><p>Our goal is simple: make student life easier by putting useful services, academic updates and practical guidance in one place. No unnecessary complexity. Just clear help for real student needs.</p><ul className="why_list"><li><i className="fa fa-check" /> Student services and academic support</li><li><i className="fa fa-check" /> Campus news, updates and important dates</li><li><i className="fa fa-check" /> Human support when you need it</li></ul><a href="#services" className="btn_one">Explore EduReach</a></div></div></div></section>

      <section id="services" className="cat_area section-padding"><div className="container"><div className="section-title text-center"><h2>What EduReach Provides</h2><p>Choose the practical student service you need.</p></div><div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}><div className="single_cat"><img src={service.image} alt={service.title} loading="lazy" /><div className="single_cat_text"><h4>{service.title}</h4><p>{service.description}</p><a href="#contact">{service.cta} <i className="fa fa-angle-right" /></a></div></div></div>)}</div></div></section>

      <section className="course_area section-padding"><div className="container"><div className="section-title text-center"><h2>Explore EduReach Services</h2><p>Practical services designed around everyday student needs.</p></div><div className="row">{services.map((service) => <div className="col-lg-4 col-sm-6 col-xs-12" key={service.id}><div className="single_course"><div className="single_c_img"><img src={service.image} className="img-fluid" alt={service.title} loading="lazy" /><span>{service.shortTitle}</span></div><div className="single_course_text"><span className={service.icon} style={{ fontSize: 28 }} /><h4>{service.title}</h4><p>{service.description}</p><a href="#contact" className="btn_one">{service.cta}</a></div></div></div>)}</div></div></section>

      <section className="team_area section-padding"><div className="container"><div className="section-title text-center"><h2>Student Support Areas</h2><p>Focused support around the services and information students use most.</p></div><div className="row">{serviceHighlights.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="our-team"><div className="team_img"><div className="demo-avatar static-avatar">{number}</div></div><div className="team-content"><h4>{title}</h4><p>{text}</p></div></div></div>)}</div></div></section>

      <section className="why_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="EduReach student support" loading="lazy" /></div><div className="col-lg-6"><div className="section-title"><h2>Why Students Use EduReach</h2><p>We focus on useful things students actually need, including services, updates and clear next-step guidance.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Useful services in one place</li><li><i className="fa fa-check" /> Academic news and quick updates</li><li><i className="fa fa-check" /> Clear, student-focused information</li></ul><a href="#contact" className="btn_one">Talk To EduReach</a></div></div></div></section>

      <section className="testimonial_area section-padding"><div className="container"><div className="section-title text-center"><h2>What Students Say About<br />EduReach</h2></div><div className="row">{testimonials.map((testimonial) => <div className="col-lg-4 col-sm-6" key={testimonial.name}><div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div></div>)}</div></div></section>

      <section id="blog" className="blog_area section-padding"><div className="container"><div className="section-title text-center"><h2>Latest News &amp; Campus Updates</h2><p>News, campus gist, quick updates, academic guidance, admissions and student opportunities.</p></div><div className="row">{blogPosts.slice(0, 6).map((post) => <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}><article className="blog_post"><div className="blog-img"><img src={post.image} alt={post.title} loading="lazy" /></div><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><span>{post.category}</span>{post.badge && <span>{post.badge}</span>}</div><h3>{post.title}</h3><p>{post.excerpt}</p><a href="#contact" className="blog_readmore">Read More <i className="fa fa-long-arrow-right" /></a></div></article></div>)}</div></div></section>

      <section id="contact" className="contact_area section-padding"><div className="container"><div className="section-title text-center"><h2>Talk To EduReach</h2><p>Have a question or need help choosing a service? Send us a message.</p></div><div className="row align-items-start"><div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div><div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{contactSent && <div className="form-success">Your message has been captured. The production mail service will be connected later.</div>}</div></div></div></section>
    </Shell>
  );
}
