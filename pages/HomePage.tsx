import { useMemo, useState } from 'react';
import { blogPosts, siteConfig, testimonials } from '../src/data/edulebMock';
import { Shell, imageBase } from '../src/components/EdulebShared';

const categories = [
  ['Digital & Web Skills', 'Digital skills for study, work and modern opportunities.', 'cat1.jpg'],
  ['Engineering Support', 'Practical technical guidance for engineering students.', 'cat2.jpg'],
  ['Academic Success', 'Focused support for difficult courses and examinations.', 'cat3.jpg'],
  ['Research & Projects', 'Guidance for research work, projects and presentations.', 'cat4.jpg'],
  ['Career Development', 'Build useful professional skills before graduation.', 'cat5.jpg'],
  ['Business & Entrepreneurship', 'Learn how to turn useful skills into practical services.', 'cat6.jpg'],
  ['Design & Creativity', 'Develop clear visual and creative skills for modern work.', 'cat7.jpg'],
  ['Personal Development', 'Improve your study habits, confidence and consistency.', 'cat8.jpg'],
  ['Data & Technology', 'Understand data, tools and technology through practical learning.', 'cat1.jpg'],
  ['Communication Skills', 'Write, present and communicate your ideas more effectively.', 'cat2.jpg'],
  ['Professional Skills', 'Develop the skills employers look for in young professionals.', 'cat3.jpg'],
  ['Student Support', 'Get direction when academic work becomes difficult.', 'cat4.jpg'],
];

const services = [
  ['Academic Tutorial', 'Get clear, focused support for difficult topics, coursework and exam preparation.', 'cat1.jpg', 'ti-book'],
  ['Project Guidance', 'Move your school project from an idea to a clear, practical plan with guided support.', 'cat2.jpg', 'ti-light-bulb'],
  ['Assignment Assistance', 'Organise assignments, improve structure and understand what your lecturer expects.', 'cat3.jpg', 'ti-files'],
  ['Research Support', 'Get practical help with research planning, source selection, structure and presentation.', 'cat4.jpg', 'ti-search'],
  ['Student Support', 'Get the right direction when you are stuck and need someone to help you move forward.', 'cat5.jpg', 'ti-comments'],
  ['Online Learning', 'Access useful learning materials and guidance from anywhere, on any device.', 'cat6.jpg', 'ti-world'],
];

const instructors = [
  ['Amara Okafor', 'Electrical Engineering Tutor', 'AO', 'team1.jpg'],
  ['Daniel Obi', 'Software & Python Instructor', 'DO', 'team2.jpg'],
  ['Fatima Bello', 'UI/UX & Creative Design', 'FB', 'team3.jpg'],
  ['Emeka Nwachukwu', 'Data & Business Analytics', 'EN', 'team4.jpg'],
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
                <h1><span>Smart Study</span> Where Knowledge Meets the Web</h1>
                <p>{siteConfig.description}</p>
                <div className="home_sb">
                  <div className="banner_subs">
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si" placeholder="Search our services here" aria-label="Search services" />
                    <a href="#services" className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></a>
                  </div>
                  {query && <div className="hero-search-results">{filteredServices.slice(0, 5).map(([title]) => <a href="#services" key={title}>{title}</a>)}</div>}
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
                <div className="single-counter"><span className={`${icon} sc_one`} /><h2 className="counter-num">{value}</h2><p>{label}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="top_cat__area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Start your journey With us</h2>
            <p>Choose from useful learning support and gain new skills with a simple, practical approach.</p>
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
                <h2>We Are Providing The Support Students Need</h2>
                <p>We are building a practical digital learning space where students can find useful academic support, learning resources and guidance without unnecessary complexity.</p>
              </div>
              <p>Our goal is simple: make learning support easier to find, easier to understand and easier to access. The platform brings academic guidance, project support and practical learning together in one place.</p>
              <ul className="why_list">
                <li><i className="fa fa-check" /> Clear and practical academic support</li>
                <li><i className="fa fa-check" /> Student-focused services and guidance</li>
                <li><i className="fa fa-check" /> Simple access from any device</li>
              </ul>
              <a href="#services" className="btn_one">View Our Services</a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES — Eduleb category architecture */}
      <section id="services" className="cat_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Find The Right Service For You</h2>
            <p>Choose from practical services designed around real student needs.</p>
          </div>
          <div className="row">
            {categories.map(([title, text, image]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={title}>
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
            <h2>Our Core Services</h2>
            <p>Simple, practical support that helps students understand more and move forward.</p>
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
          <div className="section-title text-center"><h2>Meet Our Instructors</h2><p>Learn from educators and practitioners who turn complex ideas into practical guidance.</p></div>
          <div className="row">
            {instructors.map(([name, role, initials, image]) => (
              <div className="col-lg-3 col-sm-6 col-xs-12" key={name}>
                <div className="our-team">
                  <div className="team_img"><img src={`${imageBase}/team/${image}`} alt={name} onError={(event) => { event.currentTarget.style.display = 'none'; }} /><div className="demo-avatar">{initials}</div></div>
                  <div className="team-content"><h4>{name}</h4><p>{role}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="why_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="Learning support" /></div>
            <div className="col-lg-6">
              <div className="section-title"><h2>Why Choose Us For Your Learning Journey</h2><p>We keep learning support practical, clear and focused on what students actually need.</p></div>
              <ul className="why_list"><li><i className="fa fa-check" /> Practical, structured support</li><li><i className="fa fa-check" /> Guidance built around student needs</li><li><i className="fa fa-check" /> Simple access from any device</li></ul>
              <a href="#contact" className="btn_one">Get Started</a>
            </div>
          </div>
        </div>
      </section>

      <section className="testimonial_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>What Students Say To Do<br />Their Online Learning</h2></div>
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
          <div className="section-title text-center"><h2>Latest Blog &amp; News</h2><p>Study ideas, student guidance and practical advice for academic life.</p></div>
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
          <div className="section-title text-center"><h2>Contact Us</h2><p>Have a question or need help choosing a service? Send us a message.</p></div>
          <div className="row align-items-start">
            <div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div>
            <div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setContactSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{contactSent && <div className="form-success">Your message has been captured. The production mail service will be connected later.</div>}</div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
