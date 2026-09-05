import { useState } from 'react';
import { blogPosts, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const services = [
  { icon: 'ti-book', title: 'Academic Tutorial', text: 'Get clear, focused support for difficult topics, coursework and exam preparation.' },
  { icon: 'ti-light-bulb', title: 'Project Guidance', text: 'Move your school project from an idea to a clear, practical plan with guided support.' },
  { icon: 'ti-files', title: 'Assignment Assistance', text: 'Organise assignments, improve structure and understand what your lecturer expects.' },
  { icon: 'ti-search', title: 'Research Support', text: 'Get practical help with research planning, source selection, structure and presentation.' },
  { icon: 'ti-comments', title: 'Student Support', text: 'Get the right direction when you are stuck and need someone to help you move forward.' },
  { icon: 'ti-world', title: 'Online Learning', text: 'Access useful learning materials and guidance from anywhere, on any device.' },
];

const stats = [
  ['4,500+', 'Active student', 'ti-user'],
  ['134', 'Our Online Course', 'ti-book'],
  ['29', 'Academic Programs', 'ti-medall'],
  ['684', 'Certified Students', 'ti-id-badge'],
  ['9,410', 'Enrolled Students', 'ti-user'],
];

const journey = [
  ['01', 'Expert Teacher', 'Learn from people who understand both theory and practical work.'],
  ['02', 'Quality Education', 'Get simple explanations, useful examples and focused learning support.'],
  ['03', 'Remote Learning', 'Study wherever you are with a responsive learning experience.'],
  ['04', 'Lifetime Support', 'Keep access to useful guidance as your academic journey continues.'],
];

export default function HomePage() {
  const [contactSent, setContactSent] = useState(false);

  return (
    <Shell>
      {/* HOME */}
      <section id="home" className="home_bg hb_height" style={{ backgroundImage: `url(${imageBase}/bg/home-bg.jpg)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="hero-text ht_top">
                <h1><span>Smart Study</span> Where Knowledge Meets the Web</h1>
                <p>{siteConfig.description}</p>
                <div className="home_sb">
                  <div className="banner_subs">
                    <a href="#services" className="subscribe__btn">Explore Services <i className="fa fa-angle-right" /></a>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="hero-text-img">
                <img src={`${imageBase}/home-img2.png`} className="img-fluid" alt="Students learning online" />
                <div className="home_ps"><span className="ti-user" /><h2>Students</h2><p>Built for practical learning support</p></div>
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
                <div className="single-counter">
                  <span className={`${icon} sc_one`} />
                  <h2 className="counter-num">{value}</h2>
                  <p>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="top_cat__area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Start your journey With us</h2>
            <p>We offer a simple approach to learning. Choose the support you need and build your skills step by step.</p>
          </div>
          <div className="row">
            {journey.map(([number, title, text]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={number}>
                <div className="single_tp">
                  <span className="sc_one">{number}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="why_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <div className="about-img">
                <img src={`${imageBase}/about1.png`} className="img-fluid" alt="Students learning" />
              </div>
            </div>
            <div className="col-lg-6">
              <div className="section-title">
                <h2>We Are Providing The Support Students Need</h2>
                <p>We are building a practical digital learning space where students can find useful academic support, learning resources and guidance without unnecessary complexity.</p>
              </div>
              <p>Our goal is simple: make learning support easier to find, easier to understand and easier to access. The platform brings academic guidance, project support and practical learning together in one place.</p>
              <ul className="why_list">
                <li><i className="fa fa-check" /> Clear and practical academic support</li>
                <li><i className="fa fa-check" /> Student-focused services and guidance</li>
                <li><i className="fa fa-check" /> Simple access from any device</li>
              </ul>
              <a href="#services" className="btn_one">Explore Services</a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="course_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Our Services</h2>
            <p>Choose the support you need and take the next step in your academic journey.</p>
          </div>
          <div className="row">
            {services.map((service) => (
              <div className="col-lg-4 col-sm-6 col-xs-12" key={service.title}>
                <div className="service-card">
                  <span className={service.icon} />
                  <h3>{service.title}</h3>
                  <p>{service.text}</p>
                  <a href="#contact" className="course_btn">Get Started <i className="fa fa-angle-right" /></a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta_area section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-6 col-sm-12">
              <div className="single_cta">
                <span>Need Academic Help?</span>
                <h2>Start With The Right Support</h2>
                <p>Tell us what you need and we will help you choose the right service for your situation.</p>
                <a href="#contact" className="btn_one">Get Started</a>
              </div>
            </div>
            <div className="col-lg-6 col-sm-12">
              <div className="single_cta">
                <span>Ready To Learn?</span>
                <h2>Build Useful Skills</h2>
                <p>Use practical learning support to understand more, practise better and move forward.</p>
                <a href="#contact" className="btn_one">Contact Us</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BLOG */}
      <section id="blog" className="blog_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Latest Blog &amp; News</h2>
            <p>Study ideas, student guidance and practical advice for academic life.</p>
          </div>
          <div className="row">
            {blogPosts.slice(0, 3).map((post) => (
              <div className="col-lg-4 col-sm-6 col-xs-12" key={post.id}>
                <article className="blog_post">
                  <div className="blog-img"><img src={post.image} alt={post.title} /></div>
                  <div className="blog_content">
                    <div className="blog_meta"><span>{post.date}</span><span>{post.category}</span></div>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <a href="#contact" className="blog_readmore">Read More <i className="fa fa-long-arrow-right" /></a>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="contact_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Contact Us</h2>
            <p>Have a question or need help choosing a service? Send us a message.</p>
          </div>
          <div className="row align-items-start">
            <div className="col-lg-5">
              <div className="contact_info">
                <h2>Get In Touch</h2>
                <p>{siteConfig.description}</p>
                <div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div>
                <div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div>
                <div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div>
              </div>
            </div>
            <div className="col-lg-7">
              <form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}>
                <div className="row">
                  <div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div>
                  <div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div>
                  <div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div>
                  <div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div>
                  <div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div>
                </div>
              </form>
              {contactSent && <div className="form-success">Your message has been captured. The production mail service will be connected later.</div>}
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>What Students Say</h2></div>
          <div className="row">
            {testimonials.map((testimonial) => (
              <div className="col-lg-4 col-sm-6" key={testimonial.name}>
                <div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Shell>
  );
}
