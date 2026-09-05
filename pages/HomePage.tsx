import { useMemo, useState } from 'react';
import { blogPosts, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const categories = [
  ['Write', 'Letters, appeals, and official school documents.', 'cat1.jpg'],
  ['My School', 'Courses, materials, and department information.', 'cat2.jpg'],
  ['Search', 'Find answers, resources, notices, and useful templates.', 'cat3.jpg'],
  ['Calculate', 'GPA, CGPA, and grade-target calculations for students.', 'cat4.jpg'],
  ['Check', 'School updates, academic calendars, and important dates.', 'cat5.jpg'],
  ['Support', 'Get private human support when you need help.', 'cat6.jpg'],
];

const services = [
  ['Write', 'Letters, appeals, and official school documents.', 'cat1.jpg', 'ti-pencil'],
  ['My School', 'Courses, materials, and department information in one place.', 'cat2.jpg', 'ti-book'],
  ['Search', 'Find answers, resources, notices, and useful templates quickly.', 'cat3.jpg', 'ti-search'],
  ['Calculate', 'Work out GPA, CGPA, and the grades you need to reach your target.', 'cat4.jpg', 'ti-bar-chart'],
  ['Check', 'Keep up with school updates, academic calendars, and important dates.', 'cat5.jpg', 'ti-check-box'],
  ['Support', 'Get private human support when you need help with school life.', 'cat6.jpg', 'ti-comments'],
];

const supportAreas = [
  ['Academic Help', 'Get clear direction when coursework, assignments or difficult topics become confusing.', 'AH'],
  ['School Information', 'Find useful academic information, notices, dates and resources in one place.', 'SI'],
  ['Student Tools', 'Use simple tools for everyday academic decisions and planning.', 'ST'],
  ['Human Support', 'Reach out when you need help beyond a search result or calculator.', 'HS'],
];

const stats = [
  ['01', 'Student hub', 'ti-user'],
  ['06', 'Core services', 'ti-book'],
  ['03', 'Simple steps', 'ti-medall'],
  ['01', 'Shared platform', 'ti-world'],
  ['100%', 'Student focused', 'ti-id-badge'],
];

const journey = [
  ['01', 'Register', 'Create your student account.'],
  ['02', 'Set your school', 'Choose your institution and academic details.'],
  ['03', 'Use EduReach', 'Open the service or information you need.'],
  ['04', 'Get support', 'Move forward with the right information or human help.'],
];

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const searchText = query.trim().toLowerCase();
  const filteredServices = useMemo(() => services.filter((service) => `${service[0]} ${service[1]}`.toLowerCase().includes(searchText)), [searchText]);

  return (
    <Shell>
      {/* HOME */}
      <section id="home" className="home_bg hb_height" style={{ backgroundImage: `url(${imageBase}/bg/home-bg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="hero-text ht_top">
                <h1><span>EduReach Hub</span> Practical Support For Nigerian Tertiary Students</h1>
                <p>{siteConfig.description}</p>
                <div className="home_sb">
                  <div className="banner_subs">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si" placeholder="Search EduReach services here" aria-label="Search EduReach services" />
                    <a href="#services" className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></a>
                  </div>
                  {query && <div className="hero-search-results">{filteredServices.slice(0, 5).map(([title]) => <a href="#services" key={title}>{title}</a>)}</div>}
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="hero-text-img">
                <img src={`${imageBase}/home-img2.png`} className="img-fluid" alt="Students learning online" />
                <div className="home_ps"><span className="ti-user" /><h2>Students</h2><p>Fast. Reliable. No stress.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="count_area counter_feature">
        <div className="container">
          <div className="row">
            {stats.map(([value, label, icon]) => (
              <div className="col-lg col-md-4 col-sm-6 col-12" key={label}>
                <div className="single-counter"><span className={`${icon} sc_one`} /><h2 className="counter-num">{value}</h2><p>{label}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="top_cat__area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>One Place. Many Student Needs.</h2>
            <p>EduReach brings useful student information, tools and support together in one place.</p>
          </div>
          <div className="row">
            {journey.map(([number, title, text]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={number}>
                <div className="single_tp"><span className="sc_one">{number}</span><h3>{title}</h3><p>{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="about_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="about-img"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Students learning" /></div>
            </div>
            <div className="col-lg-6">
              <div className="section-title">
                <h2>Practical Support For Nigerian Tertiary Students</h2>
                <p>EduReach is built around the small problems students face every day: finding the right information, preparing school documents, checking dates, using simple academic tools and getting help when they are stuck.</p>
              </div>
              <p>Our goal is simple: make student life easier by putting useful information, tools and support in one place. No unnecessary complexity. Just clear help for real student needs.</p>
              <ul className="why_list">
                <li><i className="fa fa-check" /> School information and academic resources</li>
                <li><i className="fa fa-check" /> Useful student tools and calculators</li>
                <li><i className="fa fa-check" /> Human support when you need it</li>
              </ul>
              <a href="#services" className="btn_one">Explore EduReach</a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="cat_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>What EduReach Provides</h2>
            <p>One place. Many student needs.</p>
          </div>
          <div className="row">
            {categories.map(([title, text, image]) => (
              <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={title}>
                <div className="single_cat">
                  <img src={`${imageBase}/${image}`} alt={title} />
                  <div className="single_cat_text"><h4>{title}</h4><p>{text}</p><a href="#contact">Explore Service <i className="fa fa-angle-right" /></a></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="course_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Explore The EduReach Tools</h2>
            <p>Useful services designed around everyday student problems.</p>
          </div>
          <div className="row">
            {services.map(([title, text, image, icon]) => (
              <div className="col-lg-4 col-sm-6 col-xs-12" key={title}>
                <div className="single_course">
                  <div className="single_c_img"><img src={`${imageBase}/${image}`} className="img-fluid" alt={title} /><span>{title}</span></div>
                  <div className="single_course_text"><span className={icon} style={{ fontSize: 28 }} /><h4>{title}</h4><p>{text}</p><a href="#contact" className="btn_one">Get Started</a></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="team_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>How EduReach Helps</h2><p>Simple support areas built around real student needs.</p></div>
          <div className="row">
            {supportAreas.map(([title, text, initials]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={title}>
                <div className="our-team">
                  <div className="team_img"><div className="demo-avatar static-avatar">{initials}</div></div>
                  <div className="team-content"><h4>{title}</h4><p>{text}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="why_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="EduReach student support" /></div>
            <div className="col-lg-6">
              <div className="section-title"><h2>Why Students Use EduReach</h2><p>We focus on useful things students actually need, not unnecessary features.</p></div>
              <ul className="why_list"><li><i className="fa fa-check" /> One place for information, tools and support</li><li><i className="fa fa-check" /> Clear and simple student-focused design</li><li><i className="fa fa-check" /> Useful from phone, tablet or computer</li></ul>
              <a href="#contact" className="btn_one">Talk To EduReach</a>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>What Students Say About<br />EduReach</h2></div>
          <div className="row">
            {testimonials.map((testimonial) => (
              <div className="col-lg-4 col-sm-6" key={testimonial.name}><div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div></div>
            ))}
          </div>
        </div>
      </section>

      {/* BLOG */}
      <section id="blog" className="blog_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>Latest EduReach Guides</h2><p>Useful student guidance, tools and practical advice for academic life.</p></div>
          <div className="row">
            {blogPosts.slice(0, 3).map((post) => (
              <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}>
                <article className="blog_post"><div className="blog-img"><img src={post.image} alt={post.title} /></div><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><span>{post.category}</span></div><h3>{post.title}</h3><p>{post.excerpt}</p><a href="#contact" className="blog_readmore">Read More <i className="fa fa-long-arrow-right" /></a></div></article>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="contact_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>Talk To EduReach</h2><p>Have a question or need help choosing what to use? Send us a message.</p></div>
          <div className="row align-items-start">
            <div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div>
            <div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{contactSent && <div className="form-success">Your message has been captured. The production mail service will be connected later.</div>}</div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
