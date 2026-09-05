import { useMemo, useState } from 'react';
import { blogPosts, categories, courses, instructors, siteConfig, stats, testimonials } from '../src/data/edulebMock';
import { BlogCard, CourseCard, InstructorCard, JourneySection, StatsStrip } from '../src/components/EdulebCards';
import { Shell, imageBase } from '../src/components/EdulebShared';

export function HomePage({ variant = 1 }: { variant?: 1 | 2 }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => courses.filter((course) => `${course.title} ${course.category} ${course.level}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  const categorySection = (
    <section className={variant === 2 ? 'category_two_area section-padding' : 'cat_area section-padding'}>
      <div className="container">
        <div className="section-title text-center">
          <h2>{variant === 2 ? 'Popular Courses by category' : 'Find out by popular Categories'}</h2>
          <p>Browse practical learning options by subject and skill area.</p>
        </div>
        <div className="row">
          {categories.map((category) => (
            <div className="col-lg-3 col-sm-6 col-xs-12" key={category.name}>
              <div className={variant === 2 ? 'cat_list_two' : 'single_cat'}>
                <img src={category.image} alt={category.name} />
                <span>{category.count.toString().padStart(2, '0')} Courses</span>
                <h4><a href={`/course.html?category=${encodeURIComponent(category.name)}`}>{category.name}</a></h4>
                <p>Practical lessons designed to help learners make steady progress.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const ctaSection = (
    <section className="cta_area section-padding">
      <div className="container">
        <div className="row">
          <div className="col-lg-6 col-sm-12">
            <div className="single_cta">
              <span>Build Your Career</span>
              <h2>Become an Instructor</h2>
              <p>Share your knowledge, build structured lessons and help students develop useful skills.</p>
              <a href="/contact.html" className="btn_one">Apply now</a>
            </div>
          </div>
          <div className="col-lg-6 col-sm-12">
            <div className="single_cta">
              <span>Build Your Career</span>
              <h2>Get Free Courses</h2>
              <p>Start with accessible learning resources and move into more advanced study as you progress.</p>
              <a href="/course.html" className="btn_one">Contact now</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <Shell>
      <section
        className={`home_bg hb_height ${variant === 2 ? 'home_variant_two' : ''}`}
        style={{ backgroundImage: `url(${imageBase}/bg/${variant === 1 ? 'home-bg.jpg' : 'home-bg2.jpg'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="container">
          <div className="row align-items-center">
            {variant === 1 ? (
              <>
                <div className="col-lg-6">
                  <div className="hero-text ht_top">
                    <h1><span>Smart Study</span> Where Knowledge Meets the Web</h1>
                    <p>{siteConfig.description}</p>
                  </div>
                  <div className="home_sb">
                    <div className="banner_subs">
                      <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si" placeholder="Search your course here" />
                      <a href={`/course.html?q=${encodeURIComponent(query)}`} className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></a>
                    </div>
                    {query && <div className="hero-search-results">{filtered.slice(0, 5).map((course) => <a key={course.id} href={`/course_details.html?course=${course.id}`}>{course.title}</a>)}</div>}
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="hero-text-img">
                    <img src={`${imageBase}/home-img2.png`} className="img-fluid" alt="Student learning online" />
                    <div className="home_ps"><span className="ti-user" /><h2>{stats[0].value}</h2><p>{stats[0].label}</p></div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="col-lg-6">
                  <div className="hero-text-img2"><img src={`${imageBase}/home-img1.png`} className="img-fluid" alt="Students learning" /></div>
                </div>
                <div className="col-lg-6">
                  <div className="hero-text2 ht_top">
                    <h1>Explore Our <span>{stats[1].value}+</span> Online courses for all</h1>
                    <p>{siteConfig.description}</p>
                  </div>
                  <div className="home_sb2">
                    <div className="banner_subs2">
                      <input value={query} onChange={(event) => setQuery(event.target.value)} className="form-control home_si2" placeholder="Search your course here" />
                      <a href={`/course.html?q=${encodeURIComponent(query)}`} className="subscribe__btn">Search <i className="fa fa-paper-plane-o" /></a>
                    </div>
                    {query && <div className="hero-search-results">{filtered.slice(0, 5).map((course) => <a key={course.id} href={`/course_details.html?course=${course.id}`}>{course.title}</a>)}</div>}
                  </div>
                  <div className="home_tag"><span>Popular Topic:</span> <a href="/course.html">Engineering</a>, <a href="/course.html">Development</a>, <a href="/course.html">Design</a>, <a href="/course.html">Business</a></div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {variant === 2 && (
        <div className="partner-logo section-padding">
          <div className="container">
            <div className="row part_bg align-items-center">
              <div className="col-lg-4"><div className="partner_title"><h3>Helping <span>86,000+</span> learners build useful skills</h3></div></div>
              <div className="col-lg-8 text-center"><div className="partner"><span>UNICAL</span><span>TechBridge</span><span>LearnHub</span><span>STEM Africa</span><span>CampusPro</span></div></div>
            </div>
          </div>
        </div>
      )}

      <StatsStrip />
      {variant === 1 ? <><JourneySection />{categorySection}</> : categorySection}

      <section className="course_area section-padding">
        <div className="container">
          <div className="section-title text-center">
            <h2>Join with more than <b>80,000+</b><br /> courses & learning creators.</h2>
            <p>Explore a growing catalogue of practical, beginner-friendly learning opportunities.</p>
          </div>
          <div className="row">{filtered.slice(0, 6).map((course) => <CourseCard course={course} key={course.id} />)}</div>
        </div>
      </section>

      <section className="team_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>Meet our Instructors</h2><p>Learn from educators and practitioners who turn complex ideas into practical lessons.</p></div>
          <div className="row">{instructors.map((instructor) => <InstructorCard instructor={instructor} key={instructor.id} />)}</div>
        </div>
      </section>

      <section className="why_area section-padding">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-lg-6"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="Online learning" /></div>
            <div className="col-lg-6">
              <div className="section-title"><h2>Why Choose Us For Your Online Education Courses</h2><p>We combine structured learning, useful projects and clear progress signals.</p></div>
              <ul className="why_list"><li><i className="fa fa-check" /> Practical, structured lessons for modern learners</li><li><i className="fa fa-check" /> Experienced instructors with useful examples</li><li><i className="fa fa-check" /> A clear path from discovery to completion</li></ul>
              <a href="/course.html" className="btn_one">View All Courses</a>
            </div>
          </div>
        </div>
      </section>

      {variant === 2 && ctaSection}

      <section className="testimonial_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>What Student’s Say To Do<br />Their Online Course</h2></div>
          <div className="row">
            {testimonials.map((testimonial) => (
              <div className="col-lg-4 col-sm-6" key={testimonial.name}>
                <div className="testimonial"><i className="fa fa-quote-left" /><p>{testimonial.text}</p><h4>{testimonial.name}</h4><span>{testimonial.company}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="blog_area section-padding">
        <div className="container">
          <div className="section-title text-center"><h2>Latest Blog & news</h2><p>Guides, study ideas and practical advice for students and instructors.</p></div>
          <div className="row">{blogPosts.slice(0, 3).map((post) => <BlogCard post={post} key={post.id} />)}</div>
        </div>
      </section>
    </Shell>
  );
}

export const Home01 = () => <HomePage />;
export const Home02 = () => <HomePage variant={2} />;
