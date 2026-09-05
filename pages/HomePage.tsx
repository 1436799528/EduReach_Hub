import { useState } from 'react';
import { blogPosts, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const services = [
  { icon: 'ti-book', title: 'Academic Tutorial', text: 'Get clear, focused academic support for difficult topics and coursework.' },
  { icon: 'ti-light-bulb', title: 'Project Guidance', text: 'Get practical guidance for projects, research ideas and technical work.' },
  { icon: 'ti-files', title: 'Assignment Assistance', text: 'Organise your assignment work with structured academic support.' },
  { icon: 'ti-search', title: 'Research Support', text: 'Find direction for research planning, sources, structure and presentation.' },
  { icon: 'ti-comments', title: 'Student Support', text: 'Connect with the right learning support when you need it.' },
  { icon: 'ti-world', title: 'Online Learning', text: 'Access useful learning resources from anywhere, on any device.' },
];

export default function HomePage() {
  const [contactSent, setContactSent] = useState(false);

  return (
    <Shell>
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

      <section id="about" className="why_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6">
              <img src={`${imageBase}/about3.png`} className="img-fluid" alt="Students learning" />
            </div>
            <div className="col-lg-6">
              <div className="section-title">
                <h2>About Eduleb</h2>
                <p>We are building a simple digital learning space where students can find useful academic support, learning resources and practical guidance.</p>
              </div>
              <p>Eduleb is designed around the needs of modern students. The goal is straightforward: make useful learning support easier to find, easier to understand and easier to access.</p>
              <ul className="why_list">
                <li><i className="fa fa-check" /> Clear and practical academic support</li>
                <li><i className="fa fa-check" /> Services designed around student needs</li>
                <li><i className="fa fa-check" /> Simple access from any device</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="course_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Our Services</h2>
            <p>Choose the support you need and take the next step in your academic journey.</p>
          </div>
          <div className="row">
            {services.map((service) => (
              <div className="col-lg-4 col-sm-6" key={service.title}>
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

      <section id="blog" className="blog_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Latest Blog</h2>
            <p>Useful study ideas, student guidance and practical learning advice.</p>
          </div>
          <div className="row">
            {blogPosts.slice(0, 3).map((post) => (
              <div className="col-lg-4 col-sm-6" key={post.id}>
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
                  <div className="col-md-12"><textarea className="form-control" name="message" rows={6} placeholder="Your Message" required /></div>
                  <div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div>
                </div>
              </form>
              {contactSent && <div className="form-success">Your message has been captured. We will connect the production mail service later.</div>}
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
