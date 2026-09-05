import { useState } from 'react';
import type { ReactNode } from 'react';
import { siteConfig } from '../data/edulebMock';
import AuthModal from './AuthModal';

export const imageBase = 'https://themewagon.github.io/eduleb/assets/img';
export const fallbackImage = `${imageBase}/about1.png`;

export function Header() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | null>(null);
  return (
    <>
      <div id="navigation" className="navbar-light bg-faded site-navigation">
        <div className="container-fluid">
          <div className="row">
            <div className="col-20 align-self-center"><div className="site-logo"><a href="#home"><img src={`${imageBase}/logo.png`} alt="Eduleb" /></a></div></div>
            <div className="col-60 d-flex"><nav id="main-menu"><ul><li><a href="#home">Home</a></li><li><a href="#about">About</a></li><li><a href="#services">Services</a></li><li><a href="#blog">Blog</a></li><li><a href="#contact">Contact</a></li></ul></nav></div>
            <div className="col-20 d-none d-xl-block text-end align-self-center auth-nav-actions"><button type="button" className="header-btn auth-link-btn" onClick={() => setAuthMode('signin')}>Sign In</button><button type="button" className="btn_one auth-link-btn" onClick={() => setAuthMode('signup')}>Sign Up</button></div>
            <ul className="mobile_menu">
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
              <li><a href="#services">Services</a></li>
              <li><a href="#blog">Blog</a></li>
              <li><a href="#contact">Contact</a></li>
              <li><button type="button" className="mobile-auth-button" onClick={() => setAuthMode('signin')}>Sign In</button></li>
              <li><button type="button" className="mobile-auth-button mobile-auth-primary" onClick={() => setAuthMode('signup')}>Sign Up</button></li>
            </ul>
          </div>
        </div>
      </div>
      {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
    </>
  );
}

export function Footer() {
  return <><div className="footer section-padding"><div className="container"><div className="row"><div className="col-lg-4 col-sm-6 col-xs-12"><div className="single_footer"><a href="#home"><img src={`${imageBase}/logo.png`} alt="Eduleb" /></a><p>{siteConfig.description}</p><div className="social_profile"><ul><li><a href="#" aria-label="X"><i className="fa-solid fa-x" /></a></li><li><a href="#" aria-label="Facebook"><i className="fa-brands fa-facebook-f" /></a></li><li><a href="#" aria-label="Instagram"><i className="fa-brands fa-instagram" /></a></li><li><a href="#" aria-label="LinkedIn"><i className="fa-brands fa-linkedin-in" /></a></li></ul></div></div></div><div className="col-lg-3 col-sm-6 col-xs-12"><div className="single_footer"><h4>Quick Links</h4><ul><li><a href="#home">Home</a></li><li><a href="#about">About</a></li><li><a href="#services">Services</a></li><li><a href="#blog">Blog</a></li><li><a href="#contact">Contact</a></li></ul></div></div><div className="col-lg-5 col-sm-12 col-xs-12"><div className="single_footer"><h4>Contact Info</h4><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div></div></div></div><div className="foot_copy"><div className="footer_copyright"><p>© 2026 Eduleb. All Rights Reserved.</p></div></div></>;
}

export function Banner({ title }: { title: string }) { return <section className="section-top"><div className="container"><div className="col-lg-10 offset-lg-1 text-center"><div className="section-top-title"><h1>{title}</h1><ul><li><a href="#home">Home</a></li><li> / {title.toLowerCase()}</li></ul></div></div></div></section>; }
export function Shell({ title, children }: { title?: string; children: ReactNode }) { return <div className="eduleb-app"><Header />{title && <Banner title={title} />}<main>{children}</main><Footer /><button className="topcontrol" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"><i className="fa fa-angle-up" /></button></div>; }
