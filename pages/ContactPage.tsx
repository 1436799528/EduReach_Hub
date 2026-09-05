import { useState } from 'react';
import { siteConfig } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <Shell title="Contact EduReach">
      <section className="contact_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>Talk To EduReach</h2><p>Questions about a service, academic update or how to get started? Send us a message.</p></div>
        <div className="row align-items-start">
          <div className="col-lg-5"><div className="contact_info"><h2>Get In Touch</h2><p>{siteConfig.description}</p><div className="sf_contact"><span className="ti-map" /><p>{siteConfig.address}</p></div><div className="sf_contact"><span className="ti-mobile" /><p>{siteConfig.phone}</p></div><div className="sf_contact"><span className="ti-email" /><p>{siteConfig.email}</p></div></div></div>
          <div className="col-lg-7"><form className="contact-form" onSubmit={(event) => { event.preventDefault(); setSent(true); }}><div className="row"><div className="col-md-6"><input className="form-control" name="name" placeholder="Your Name" required /></div><div className="col-md-6"><input className="form-control" type="email" name="email" placeholder="Your Email" required /></div><div className="col-md-12"><input className="form-control" name="subject" placeholder="Subject" required /></div><div className="col-md-12"><select className="form-control" name="service" defaultValue=""><option value="" disabled>Select a service</option><option>NELFUND Loan Application</option><option>WAEC / NECO Result Checking</option><option>WAEC / NECO Scratch Cards</option><option>JAMB Exam Slip Printing</option><option>Admission Deferment & Supplementary Letters</option><option>General Question</option></select></div><div className="col-md-12"><textarea className="form-control" name="message" rows={7} placeholder="Your Message" required /></div><div className="col-md-12"><button className="btn_one" type="submit">Send Message</button></div></div></form>{sent && <div className="form-success">Your message has been captured. Live message delivery will be connected to the backend next.</div>}</div>
        </div>
      </div></section>
    </Shell>
  );
}
