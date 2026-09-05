import { useState } from 'react';
import { siteConfig } from '../data/edulebMock';
import { Shell } from '../components/EdulebShared';

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <Shell title="Contact us">
      <section className="contact_area section-padding">
        <div className="container">
          <div className="row">
            <div className="col-lg-5 col-sm-12 col-xs-12">
              <div className="contact_info">
                <h2>Get In Touch</h2>
                <p>Use the contact form to send a message to the Eduleb team. This demo keeps the submission flow local until the production mail/service provider is selected.</p>
                <div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div>
                <div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div>
                <div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div>
              </div>
            </div>
            <div className="col-lg-7 col-sm-12 col-xs-12">
              <form className="contact-form" onSubmit={(event) => { event.preventDefault(); setSent(true); }}>
                <div className="row">
                  <div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div>
                  <div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div>
                  <div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div>
                  <div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div>
                  <div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div>
                </div>
              </form>
              {sent && <div className="form-success">Your demo message has been captured. The production mail handler will be connected once the email provider is selected.</div>}
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
