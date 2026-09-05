import { useMemo, useState } from 'react';
import {
  blogPosts,
  categories,
  courses,
  faqs,
  getBlogPost,
  getCourse,
  getInstructor,
  instructors,
  pricingPlans,
  siteConfig,
  stats,
  testimonials,
} from './data/edulebMock';

const imageBase = 'https://themewagon.github.io/eduleb/assets/img';
const fallbackImage = `${imageBase}/cat1.jpg`;

function goTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function Header() {
  return (
    <div id="navigation" className="navbar-light bg-faded site-navigation navigation2">
      <div className="container-fluid">
        <div className="row align-items-center">
          <div className="col-12 col-xl-2 align-self-center">
            <div className="site-logo">
              <a href="/" onClick={goTop}><img src={`${imageBase}/logo.png`} alt="Eduleb" /></a>
            </div>
          </div>
          <div className="col-xl-7 d-none d-xl-flex">
            <nav id="main-menu">
              <ul>
                <li className="menu-item-has-children"><a href="/">Home</a><ul><li><a href="/">Home 01</a></li><li><a href="/index2.html">Home 02</a></li></ul></li>
                <li><a href="/about.html">About</a></li>
                <li className="menu-item-has-children"><a href="/course.html">Course</a><ul><li><a href="/course.html">Course</a></li><li><a href="/course_details.html">Course Details</a></li></ul></li>
                <li className="menu-item-has-children"><a href="/instructor.html">Pages</a><ul><li><a href="/instructor.html">Instructor</a></li><li><a href="/instructor_details.html">Instructor Details</a></li><li><a href="/pricing_plan.html">Pricing Plan</a></li><li><a href="/faq.html">FAQ</a></li><li><a href="/404.html">404</a></li></ul></li>
                <li className="menu-item-has-children"><a href="/blog.html">Blog</a><ul><li><a href="/blog.html">Blog</a></li><li><a href="/blog_details.html">Blog Details</a></li></ul></li>
                <li><a href="/contact.html">Contact</a></li>
              </ul>
            </nav>
          </div>
          <div className="col-xl-3 d-none d-xl-block text-end">
            <a href="/contact.html" className="header-btn">Sign In</a>
            <a href="/contact.html" className="btn_one">Sign Up</a>
          </div>
          <div className="col-12 d-xl-none mobile-site-nav">
            <div className="mobile-nav-links">
              <a href="/">Home</a><a href="/about.html">About</a><a href="/course.html">Courses</a><a href="/instructor.html">Instructors</a><a href="/blog.html">Blog</a><a href="/contact.html">Contact</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="footer pt80 pb30">
      <div className="container">
        <div className="row">
          <div className="col-lg-4 col-sm-12 col-xs-12">
            <div className="single_footer">
              <a href="/" className="footer_logo"><img src={`${imageBase}/logo-white.png`} alt="Eduleb" /></a>
              <p>{siteConfig.description} This demo is seeded with editable mock records.</p>
              <div className="social_profile"><ul><li><a href="#" aria-label="Facebook"><i className="fa-brands fa-facebook-f" /></a></li><li><a href="#" aria-label="LinkedIn"><i className="fa-brands fa-linkedin-in" /></a></li><li><a href="#" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a></li></ul></div>
            </div>
          </div>
          <div className="col-lg-2 col-sm-4 col-xs-12">
            <div className="single_footer"><h4>About Eduleb</h4><ul><li><a href="/about.html">About us</a></li><li><a href="/instructor.html">Instructors</a></li><li><a href="/pricing_plan.html">Pricing</a></li><li><a href="/faq.html">FAQ</a></li><li><a href="/contact.html">Contact us</a></li></ul></div>
          </div>
          <div className="col-lg-2 col-sm-4 col-xs-12">
            <div className="single_footer"><h4>Popular Courses</h4><ul>{categories.slice(0, 6).map((item) => <li key={item.name}><a href="/course.html">{item.name}</a></li>)}</ul></div>
          </div>
          <div className="col-lg-4 col-sm-4 col-xs-12">
            <div className="single_footer"><h4>Contact Info</h4><p>{siteConfig.address}</p><p>{siteConfig.phone}</p><p>{siteConfig.email}</p><div className="newsletter-box"><input className="form-control" placeholder="Your email address" /><button className="btn_one" type="button">Join</button></div></div>
          </div>
        </div>
        <div className="footer-bottom text-center"><p>© 2026 Eduleb Demo. Built with the Eduleb page architecture.</p></div>
      </div>
    </footer>
  );
}

function PageBanner({ title }: { title: string }) {
  return <div className="page-banner-area" style={{ backgroundImage: `url(${imageBase}/bg/section-top.jpg)` }}><div className="container"><div className="row"><div className="col-lg-8 offset-lg-2 text-center"><h1>{title}</h1><p><a href="/">Home</a> / {title}</p></div></div></div></div>;
}

function CourseCard({ course }: { course: typeof courses[number] }) {
  return <div className="col-lg-4 col-sm-6 col-xs-12"><div className="course-slide"><div className="course-img"><img src={course.image} alt="" onError={(e) => { e.currentTarget.src = fallbackImage; }} /><span>{course.category}</span></div><div className="course_content"><span className="course_meta">{course.level}</span><h3><a href={`/course_details.html?course=${course.id}`}>{course.title}</a></h3><p>{course.description}</p><div className="course-meta"><span><i className="fa-regular fa-circle-play" /> {course.lessons} lessons</span><span><i className="fa-regular fa-clock" /> {course.duration}</span></div><div className="course_bottom"><strong>{course.price}</strong><a className="course_btn" href={`/course_details.html?course=${course.id}`}>View course</a></div></div></div></div>;
}

function InstructorCard({ instructor }: { instructor: typeof instructors[number] }) {
  return <div className="col-lg-3 col-sm-6 col-xs-12"><div className="single_team"><div className="team_img"><div className="demo-avatar">{instructor.initials}</div></div><h4><a href={`/instructor_details.html?instructor=${instructor.id}`}>{instructor.name}</a></h4><p>{instructor.role}</p><div className="team_info"><span>{instructor.courses.toString().padStart(2, '0')} Course</span><span>{instructor.students} Student</span></div></div></div>;
}

function BlogCard({ post }: { post: typeof blogPosts[number] }) {
  return <div className="col-lg-4 col-sm-6 col-xs-12"><article className="blog_post"><div className="blog-img"><img src={post.image} alt="" onError={(e) => { e.currentTarget.src = fallbackImage; }} /></div><div className="blog_content"><div className="blog_meta"><span>{post.date}</span><a href={`/blog_details.html?post=${post.id}`}>{post.category}</a></div><h3><a href={`/blog_details.html?post=${post.id}`}>{post.title}</a></h3><p>{post.excerpt}</p><a className="blog_readmore" href={`/blog_details.html?post=${post.id}`}>Read More <i className="fa fa-long-arrow-right" /></a></div></article></div>;
}

function Home({ variant = 1 }: { variant?: 1 | 2 }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => courses.filter((course) => `${course.title} ${course.category} ${course.level}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const heroImage = variant === 1 ? `${imageBase}/home-img2.png` : `${imageBase}/home-img1.png`;
  const heroBg = variant === 1 ? `${imageBase}/bg/home-bg.jpg` : `${imageBase}/bg/home-bg2.jpg`;
  return <>
    <section className={`home_bg hb_height ${variant === 2 ? 'home_variant_two' : ''}`} style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center center' }}>
      <div className="container"><div className="row align-items-center">
        {variant === 1 ? <>
          <div className="col-lg-6 col-sm-12"><div className="hero-text ht_top"><h1><span>Smart Study</span> Where Knowledge Meets the Web</h1><p>{siteConfig.description}</p></div><div className="home_sb"><div className="banner_subs"><input value={query} onChange={(e) => setQuery(e.target.value)} className="form-control home_si" placeholder="Search your course here" /><button type="button" className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></button></div>{query && <div className="hero-search-results">{filtered.slice(0, 4).map((course) => <a key={course.id} href={`/course_details.html?course=${course.id}`}>{course.title}</a>)}</div>}</div></div>
          <div className="col-lg-6 col-sm-12"><div className="hero-text-img"><img src={heroImage} className="img-fluid" alt="Student learning online" /><div className="home_ps"><span className="ti-user" /><h2>4,500+</h2><p>Active student</p></div></div></div>
        </> : <>
          <div className="col-lg-6 col-sm-12"><div className="hero-text-img2"><img src={heroImage} className="img-fluid" alt="Students learning" /></div></div>
          <div className="col-lg-6 col-sm-12"><div className="hero-text2 ht_top"><h1>Explore Our <span>134+</span> Online courses for all</h1><p>{siteConfig.description}</p></div><div className="home_sb2"><div className="banner_subs2"><input value={query} onChange={(e) => setQuery(e.target.value)} className="form-control home_si2" placeholder="Search your course here" /><button type="button" className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></button></div></div><div className="home_tag"><span>Popular Topic:</span> <a href="/course.html">Engineering</a>, <a href="/course.html">Development</a>, <a href="/course.html">Design</a>, <a href="/course.html">Business</a></div>{query && <div className="hero-search-results">{filtered.slice(0, 4).map((course) => <a key={course.id} href={`/course_details.html?course=${course.id}`}>{course.title}</a>)}</div>}</div>
        </>}
      </div></div>
    </section>
    {variant === 2 && <PartnerStrip />}
    <section className="count_area counter_feature"><div className="container"><div className="row">{stats.slice(1, 5).map((stat, index) => <div className="col-lg-3 col-sm-6 col-xs-12" key={stat.label}><div className="single-counter"><span className={`ti-${['folder','medall-alt','id-badge','user'][index]} sc_${index + 1}`} /><h2 className="counter-num">{stat.value}</h2><p>{stat.label}</p></div></div>)}</div></div></section>
    {variant === 1 ? <JourneySection /> : <CategoryTwo />}
    <section className="course_area section-padding"><div className="container"><div className="section-title text-center"><h2>Join with more than <b>80,000+</b><br /> courses & learning creators.</h2><p>Explore a growing catalogue of practical, beginner-friendly learning opportunities.</p></div><div className="row">{filtered.slice(0, 6).map((course) => <CourseCard key={course.id} course={course} />)}</div><div className="text-center mt40"><a className="btn_one" href="/course.html">View all Courses</a></div></div></section>
    <section className="team_area section-padding"><div className="container"><div className="section-title text-center"><h2>Meet our Instructors</h2><p>Learn from educators and practitioners who turn complex ideas into practical lessons.</p></div><div className="row">{instructors.map((person) => <InstructorCard key={person.id} instructor={person} />)}</div></div></section>
    <section className="why_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Online learning" /></div><div className="col-lg-6"><div className="section-title"><h2>Why Choose Us For Your Online Education Courses</h2><p>We combine structured learning, useful projects and clear progress signals.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Get access to practical courses built for modern learners</li><li><i className="fa fa-check" /> Learn from instructors with real-world experience</li><li><i className="fa fa-check" /> Build a learning record you can grow over time</li></ul><a href="/course.html" className="btn_one">View All Courses</a></div></div></div></section>
    <section className="testimonial_area section-padding"><div className="container"><div className="section-title text-center"><h2>What Student’s Say To Do<br />Their Online Course</h2></div><div className="row">{testimonials.map((item) => <div key={item.name} className="col-lg-4 col-sm-6"><div className="testimonial"><i className="fa fa-quote-left" /><p>{item.text}</p><h4>{item.name}</h4><span>{item.company}</span></div></div>)}</div></div></section>
    <section className="blog_area section-padding"><div className="container"><div className="section-title text-center"><h2>Latest Blog & news</h2><p>Guides, study ideas and practical advice for students and instructors.</p></div><div className="row">{blogPosts.slice(0, 3).map((post) => <BlogCard key={post.id} post={post} />)}</div></div></section>
  </>;
}

function JourneySection() {
  const cards = [
    ['01', 'Expert Teacher', 'Learn from instructors who understand both theory and practical work.'],
    ['02', 'Quality Education', 'Short, structured lessons make it easier to learn consistently.'],
    ['03', 'Remote Learning', 'Study from anywhere with a responsive course experience.'],
    ['04', 'Life Time Support', 'Keep your learning resources close as your skills grow.'],
  ];
  return <section className="top_cat__area section-padding"><div className="container"><div className="section-title text-center"><h2>Start your journey With us</h2><p>{siteConfig.description}</p></div><div className="row">{cards.map(([num, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={num}><div className="single_tp"><span className="sc_one">{num}</span><h3>{title}</h3><p>{text}</p></div></div>)}</div></div></section>;
}

function PartnerStrip() {
  return <div className="partner-logo section-padding"><div className="container"><div className="row part_bg align-items-center"><div className="col-lg-4"><div className="partner_title"><h3>Helping <span>86,000+</span> learners build useful skills</h3></div></div><div className="col-lg-8 text-center"><div className="partner"><span>UNICAL</span><span>TechBridge</span><span>LearnHub</span><span>STEM Africa</span><span>CampusPro</span></div></div></div></div></div>;
}

function CategoryTwo() {
  return <section className="category_two_area section-padding"><div className="container"><div className="section-title text-center"><h2>Popular Courses by category</h2><p>Browse the catalogue by the skills learners are asking for most.</p></div><div className="row">{categories.slice(0, 8).map((cat) => <div className="col-lg-3 col-sm-6 col-xs-12" key={cat.name}><div className="cat_list_two"><img src={cat.image} alt="" onError={(e) => { e.currentTarget.src = fallbackImage; }} /><span>{cat.count.toString().padStart(2, '0')} Courses</span><h4><a href={`/course.html?category=${encodeURIComponent(cat.name)}`}>{cat.name}</a></h4><p>Practical lessons designed to help learners make steady progress.</p></div></div>)}</div></div></section>;
}

function AboutPage() {
  return <><PageBanner title="About us" /><section className="about_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="About Eduleb" /></div><div className="col-lg-6"><div className="section-title"><h2>We Are Providing The Online Course In Global World</h2><p>{siteConfig.description}</p></div><p className="about_copy">Eduleb is positioned as a practical learning hub: learners discover courses, compare instructors, follow lessons and build evidence of progress. The current records are demo data and are ready to be replaced with your real platform content.</p><ul className="why_list"><li><i className="fa fa-check" /> Access a growing catalogue of structured courses</li><li><i className="fa fa-check" /> Find an instructor and follow a clear learning path</li><li><i className="fa fa-check" /> Keep the same Eduleb page pattern across the site</li></ul></div></div></div></section><section className="count_area counter_feature"><div className="container"><div className="row">{stats.map((stat) => <div className="col-lg col-sm-6" key={stat.label}><div className="single-counter"><h2 className="counter-num">{stat.value}</h2><p>{stat.label}</p></div></div>)}</div></div></section></>;
}

function CoursePage() {
  const [search, setSearch] = useState('');
  const results = courses.filter((course) => `${course.title} ${course.category} ${course.level}`.toLowerCase().includes(search.toLowerCase()));
  return <><PageBanner title="Our courses" /><section className="course_area section-padding"><div className="container"><div className="course-filter-row"><input value={search} onChange={(e) => setSearch(e.target.value)} className="form-control" placeholder="Search courses, categories or levels" /></div><div className="row mt40">{results.map((course) => <CourseCard key={course.id} course={course} />)}</div></div></section></>;
}

function CourseDetailsPage() {
  const id = new URLSearchParams(window.location.search).get('course') || courses[0].id;
  const course = getCourse(id) || courses[0];
  return <><PageBanner title="Course Details" /><section className="course_details section-padding"><div className="container"><div className="row"><div className="col-lg-8"><img src={course.image} className="img-fluid course-detail-image" alt="" /><h2>{course.title}</h2><p>{course.description}</p><div className="detail-grid"><div><strong>Level</strong><span>{course.level}</span></div><div><strong>Lessons</strong><span>{course.lessons}</span></div><div><strong>Duration</strong><span>{course.duration}</span></div><div><strong>Rating</strong><span>{course.rating}/5</span></div></div><h3>What you will learn</h3><ul className="why_list"><li><i className="fa fa-check" /> Understand the key concepts through guided lessons</li><li><i className="fa fa-check" /> Apply your knowledge with practical activities</li><li><i className="fa fa-check" /> Build confidence by completing a clear learning path</li></ul></div><div className="col-lg-4"><div className="course-sidebar"><h3>{course.price}</h3><p>Demo enrolment</p><a href="/contact.html" className="btn_one w-100 text-center">Enrol in Course</a><hr /><p><strong>Category:</strong> {course.category}</p><p><strong>Certificate:</strong> Available on eligible completion</p></div></div></div></div></section></>;
}

function InstructorsPage() {
  return <><PageBanner title="Our instructor" /><section className="team_area section-padding"><div className="container"><div className="section-title text-center"><h2>Meet our Instructors</h2><p>Experienced educators and practitioners ready to guide learners.</p></div><div className="row">{instructors.map((person) => <InstructorCard key={person.id} instructor={person} />)}</div></div></section></>;
}

function InstructorDetailsPage() {
  const id = new URLSearchParams(window.location.search).get('instructor') || instructors[0].id;
  const person = getInstructor(id) || instructors[0];
  const authored = courses.slice(0, Math.min(person.courses, courses.length));
  return <><PageBanner title="Instructor Details" /><section className="team_details_area section-padding"><div className="container"><div className="row align-items-center"><div className="col-lg-4 text-center"><div className="demo-avatar demo-avatar-large">{person.initials}</div></div><div className="col-lg-8"><div className="section-title"><h2>{person.name}</h2><p>{person.role}</p></div><p>{person.bio}</p><div className="detail-grid"><div><strong>Courses</strong><span>{person.courses}</span></div><div><strong>Students</strong><span>{person.students}</span></div></div></div></div><div className="section-title mt60"><h2>Courses by {person.name}</h2></div><div className="row">{authored.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} />)}</div></div></section></>;
}

function PricingPage() {
  return <><PageBanner title="Pricing Plan" /><section className="pricing_area section-padding"><div className="container"><div className="section-title text-center"><h2>Choose a learning plan</h2><p>Demo plans show how the public pricing page can look before real billing rules are connected.</p></div><div className="row">{pricingPlans.map((plan) => <div className="col-lg-4 col-sm-6" key={plan.name}><div className="pricing-table"><h3>{plan.name}</h3><div className="price">{plan.price}</div><span>{plan.period}</span><p>{plan.description}</p><ul>{plan.features.map((feature) => <li key={feature}><i className="fa fa-check" /> {feature}</li>)}</ul><a href="/contact.html" className="btn_one">Choose Plan</a></div></div>)}</div></div></section></>;
}

function FAQPage() {
  const [open, setOpen] = useState(0);
  return <><PageBanner title="FAQ" /><section className="faq_area section-padding"><div className="container"><div className="section-title text-center"><h2>Frequently Asked Questions</h2><p>Common questions for the demo learning platform.</p></div><div className="faq-list">{faqs.map((faq, index) => <div className={`faq-item ${open === index ? 'open' : ''}`} key={faq.question}><button type="button" onClick={() => setOpen(open === index ? -1 : index)}><span>{faq.question}</span><i className="fa fa-plus" /></button>{open === index && <div className="faq-answer"><p>{faq.answer}</p></div>}</div>)}</div></div></section></>;
}

function BlogPage() {
  return <><PageBanner title="Blog" /><section className="blog_area section-padding"><div className="container"><div className="row">{blogPosts.map((post) => <BlogCard key={post.id} post={post} />)}</div></div></section></>;
}

function BlogDetailsPage() {
  const id = new URLSearchParams(window.location.search).get('post') || blogPosts[0].id;
  const post = getBlogPost(id) || blogPosts[0];
  return <><PageBanner title="Blog Details" /><section className="blog_details section-padding"><div className="container"><div className="row"><div className="col-lg-8"><img src={post.image} className="img-fluid" alt="" /><div className="blog_meta mt30"><span>{post.date}</span> <a href="/blog.html">{post.category}</a></div><h2>{post.title}</h2><p>{post.excerpt}</p><p>Learning works best when ideas are broken into steps that can be tested. This demo article area is ready for your real editorial content, author profile, related posts and calls to action.</p><p><strong>Author:</strong> {post.author}</p></div><div className="col-lg-4"><div className="course-sidebar"><h3>Latest Posts</h3>{blogPosts.slice(0, 5).map((item) => <a className="sidebar-post" key={item.id} href={`/blog_details.html?post=${item.id}`}>{item.title}</a>)}</div></div></div></div></section></>;
}

function ContactPage() {
  const [sent, setSent] = useState(false);
  return <><PageBanner title="Contact us" /><section className="contact_area section-padding"><div className="container"><div className="row"><div className="col-lg-5"><div className="contact_info"><h2>Let's talk about learning</h2><p>{siteConfig.description}</p><p><strong>Address:</strong> {siteConfig.address}</p><p><strong>Phone:</strong> {siteConfig.phone}</p><p><strong>Email:</strong> {siteConfig.email}</p></div></div><div className="col-lg-7"><form className="contact-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" placeholder="Your name" required /></div><div className="col-md-6"><input className="form-control" type="email" placeholder="Email address" required /></div><div className="col-12"><input className="form-control" placeholder="Subject" required /></div><div className="col-12"><textarea className="form-control" rows={6} placeholder="Tell us how we can help" required /></div><div className="col-12"><button className="btn_one" type="submit">Send message</button></div></div></form>{sent && <div className="form-success">Demo message captured successfully. Connect this form to your backend when the real workflow is defined.</div>}</div></div></div></section></>;
}

function ErrorPage() {
  return <><PageBanner title="404" /><section className="error_page section-padding text-center"><div className="container"><img src={`${imageBase}/404.svg`} alt="Page not found" className="error-image" /><h2>Page not found</h2><p>The page you requested does not exist in the current Eduleb route map.</p><a href="/" className="btn_one">Back Home</a></div></section></>;
}

export default function EdulebSite() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  let page: JSX.Element;
  switch (path) {
    case '/':
    case '/index.html': page = <Home />; break;
    case '/index2.html': page = <Home variant={2} />; break;
    case '/about.html': page = <AboutPage />; break;
    case '/course.html': page = <CoursePage />; break;
    case '/course_details.html': page = <CourseDetailsPage />; break;
    case '/instructor.html': page = <InstructorsPage />; break;
    case '/instructor_details.html': page = <InstructorDetailsPage />; break;
    case '/pricing_plan.html': page = <PricingPage />; break;
    case '/faq.html': page = <FAQPage />; break;
    case '/blog.html': page = <BlogPage />; break;
    case '/blog_details.html': page = <BlogDetailsPage />; break;
    case '/contact.html': page = <ContactPage />; break;
    case '/404.html': page = <ErrorPage />; break;
    default: page = <ErrorPage />;
  }
  return <div className="eduleb-app"><Header />{page}<Footer /><button className="topcontrol" type="button" onClick={goTop} aria-label="Back to top"><i className="fa fa-angle-up" /></button></div>;
}
