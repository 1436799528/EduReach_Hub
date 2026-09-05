import { Shell, imageBase } from '../src/components/EdulebShared';

const values = [
  ['01', 'Student First', 'We build around the problems students actually face, from admissions and results to funding and academic deadlines.'],
  ['02', 'Clear Information', 'Important information should be easy to understand, easy to find and easy to act on.'],
  ['03', 'Practical Help', 'We connect students with useful services, guides and next-step support instead of unnecessary complexity.'],
  ['04', 'Reliable Updates', 'Our goal is to make academic news and campus updates easier to follow and organise.'],
];

export default function AboutPage() {
  return (
    <Shell title="About EduReach">
      <section className="about_area section-padding">
        <div className="container"><div className="row align-items-center">
          <div className="col-lg-6"><div className="about-img"><img src={`${imageBase}/about3.png`} className="img-fluid" alt="EduReach student support" loading="lazy" /></div></div>
          <div className="col-lg-6">
            <div className="section-title"><h2>Built To Make Student Life Easier</h2><p>EduReach Hub is a student-focused platform for practical services, academic information, campus updates and everyday support.</p></div>
            <p>Students spend too much time searching for documents, checking important dates, understanding application steps and finding reliable academic information. EduReach is designed to bring those needs into one simple place.</p>
            <a href="/services" className="btn_one">Explore Our Services</a>
          </div>
        </div></div>
      </section>

      <section className="top_cat__area section-padding"><div className="container">
        <div className="section-title text-center"><h2>What We Stand For</h2><p>Simple principles behind the EduReach experience.</p></div>
        <div className="row">{values.map(([number, title, text]) => <div className="col-lg-3 col-sm-6 col-xs-12" key={number}><div className="single_tp"><span className="sc_one">{number}</span><h3>{title}</h3><p>{text}</p></div></div>)}</div>
      </div></section>

      <section className="why_area section-padding"><div className="container"><div className="row align-items-center">
        <div className="col-lg-6"><img src={`${imageBase}/about1.png`} className="img-fluid" alt="Students using EduReach" loading="lazy" /></div>
        <div className="col-lg-6"><div className="section-title"><h2>More Than A Website</h2><p>EduReach is being built as a practical student support platform that can grow as student needs grow.</p></div><ul className="why_list"><li><i className="fa fa-check" /> Service access and guidance</li><li><i className="fa fa-check" /> Academic news and campus updates</li><li><i className="fa fa-check" /> Useful information in one place</li><li><i className="fa fa-check" /> Secure student accounts and support</li></ul></div>
      </div></div></section>

      <section className="testimonial_area section-padding"><div className="container"><div className="section-title text-center"><h2>Our Mission</h2><p>Help students spend less time searching and more time moving forward.</p></div></div></section>
    </Shell>
  );
}
