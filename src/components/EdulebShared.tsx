import type { ReactNode } from 'react';
import { siteConfig } from '../data/edulebMock';

export const imageBase = 'https://themewagon.github.io/eduleb/assets/img';

export function Header() {
  return (
    <div id="navigation" className="navbar-light bg-faded site-navigation">
      <div className="container-fluid">
        <div className="row">
          <div className="col-20 align-self-center">
            <div className="site-logo"><a href="/"><img src={`${imageBase}/logo.png`} alt="Eduleb" /></a></div>
          </div>
          <div className="col-60 d-flex">
            <nav id="main-menu">
              <ul>
                <li className="menu-item-has-children"><a href="#">Home</a><ul><li><a href="/">Home 01</a></li><li><a href="/index2.html">Home 02</a></li></ul></li>
                <li><a href="/about.html">About</a></li>
                <li className="menu-item-has-children"><a href="/course.html">Course</a><ul><li><a href="/course.html">Course</a></li><li><a href="/course_details.html">Course Details</a></li></ul></li>
                <li className="menu-item-has-children"><a href="#">Pages</a><ul><li><a href="/instructor.html">Instructor</a></li><li><a href="/instructor_details.html">Instructor Details</a></li><li><a href="/pricing_plan.html">Pricing Plan</a></li><li><a href="/faq.html">Faq Page</a></li><li><a href="/404.html">404</a></li></ul></li>
                <li className="menu-item-has-children"><a href="/blog.html">Blog</a><ul><li><a href="/blog.html">Blog</a></li><li><a href="/blog_details.html">Blog Details</a></li></ul></li>
                <li><a href="/contact.html">Contact</a></li>
              </ul>
            </nav>
          </div>
          <div className="col-20 d-none d-xl-block text-end align-self-center"><a href="/contact.html" className="header-btn">Sign In</a><a href="/contact.html" className="btn_one">Sign Up</a></div>
          <ul className="mobile_menu">
            <li><a href="#">Home</a><ul className="sub-menu"><li><a href="/">Home 01</a></li><li><a href="/index2.html">Home 02</a></li></ul></li>
            <li><a href="/about.html">About</a></li>
            <li><a href="#">Course</a><ul className="sub-menu"><li><a href="/course.html">Course</a></li><li><a href="/course_details.html">Course Details</a></li></ul></li>
            <li><a href="#">Pages</a><ul className="sub-menu"><li><a href="/instructor.html">Instructor</a></li><li><a href="/instructor_details.html">Instructor Details</a></li><li><a href="/pricing_plan.html">Pricing Plan</a></li><li><a href="/faq.html">Faq Page</a></li><li><a href="/404.html">404</a></li></ul></li>
            <li><a href="/blog.html">Blog</a><ul className="sub-menu"><li><a href="/blog.html">Blog</a></li><li><a href="/blog_details.html">Blog Details</a></li></ul></li>
            <li><a href="/contact.html">Contact</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const popularCourses = ['Development', 'Electrical Engineering', 'Programming', 'Graphic Design', 'Data Analysis', 'Digital Marketing'];
  return (
    <>
      <div className="footer section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-3 col-sm-6 col-xs-12"><div className="single_footer"><a href="/"><img src={`${imageBase}/logo.png`} alt="Eduleb" /></a><p>{siteConfig.description}</p><div className="social_profile"><ul><li><a className="f_facebook" href="#" aria-label="X"><i className="fa-solid fa-x" /></a></li><li><a className="f_twitter" href="#" aria-label="Facebook"><i className="fa-brands fa-facebook-f" /></a></li><li><a className="f_instagram" href="#" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a></li><li><a className="f_linkedin" href="#" aria-label="LinkedIn"><i className="fa-brands fa-linkedin-in" /></a></li></ul></div></div></div>
            <div className="col-lg-2 col-sm-6 col-xs-12"><div className="single_footer"><h4>About Eduleb</h4><ul><li><a href="/about.html">About us</a></li><li><a href="/instructor.html">Instructor Registration</a></li><li><a href="/instructor.html">Become A Teacher</a></li><li><a href="/instructor.html">All Instructors</a></li><li><a href="/faq.html">Asked Question</a></li><li><a href="/contact.html">Contact us</a></li></ul></div></div>
            <div className="col-lg-2 col-sm-6 col-xs-12"><div className="single_footer"><h4>Popular Courses</h4><ul>{popularCourses.map((name) => <li key={name}><a href={`/course.html?category=${encodeURIComponent(name)}`}>{name}</a></li>)}</ul></div></div>
            <div className="col-lg-3 col-sm-6 col-xs-12"><div className="single_footer"><h4>Contact Info</h4><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-mobile" /><p><a href={`https://wa.me/${siteConfig.phone.replace(/\D/g, '')}`}>Contact Whatsapp</a></p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div>
            <div className="col-lg-2 col-sm-6 col-xs-12"><div className="single_footer"><h4>Download App</h4><p>Download our app from app store and Google Play Store.</p><a href="#"><img src={`${imageBase}/google-play.jpg`} className="foot_img" alt="Google Play" /></a><a href="#"><img src={`${imageBase}/app-store.jpg`} className="foot_img" alt="App Store" /></a></div></div>
          </div>
        </div>
      </div>
      <div className="foot_copy"><div className="footer_copyright"><p>© 2026 Eduleb Demo. All Rights Reserved.</p></div></div>
    </>
  );
}

export function Banner({ title }: { title: string }) {
  return <section className="section-top"><div className="container"><div className="col-lg-10 offset-lg-1 text-center"><div className="section-top-title wow fadeInRight" data-wow-duration="1s" data-wow-delay="0.3s" data-wow-offset="0"><h1>{title}</h1><ul><li><a href="/">Home</a></li><li> / {title.toLowerCase()}</li></ul></div></div></div></section>;
}

export function Shell({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="eduleb-app"><Header />{title && <Banner title={title} />}<main>{children}</main><Footer /><button className="topcontrol" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><i className="fa fa-angle-up" /></button></div>;
}
