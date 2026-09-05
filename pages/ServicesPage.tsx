import { services, siteConfig } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

const serviceDetails: Record<string, { steps: string[]; notes: string[] }> = {
  'nelfund-loan': { steps: ['Confirm that you meet the current application requirements.', 'Prepare your personal, academic and banking information.', 'Complete the application carefully and keep your submission details.'], notes: ['Application requirements and windows can change.', 'Use official NELFUND information when submitting sensitive details.'] },
  results: { steps: ['Confirm whether you are checking WAEC or NECO.', 'Prepare the required examination details or result-checking information.', 'Check the result and keep a secure copy of your result details.'], notes: ['Never share result PINs publicly.', 'Use the official result-checking channel for final verification.'] },
  'scratch-cards': { steps: ['Choose the correct WAEC or NECO card option.', 'Confirm the card type before payment or activation.', 'Keep the card details private until they are needed.'], notes: ['Do not buy a card without confirming the examination body.', 'Treat card PINs like passwords.'] },
  'jamb-slip': { steps: ['Confirm your JAMB profile details.', 'Locate the examination slip available for your candidate record.', 'Print or save the slip and verify the details before examination day.'], notes: ['Recheck examination date, centre and candidate details.', 'Keep both a digital and printed copy where possible.'] },
  'admission-letters': { steps: ['Confirm the institution and admission situation.', 'Prepare the facts and reason for the request.', 'Submit the letter through the process required by the institution.'], notes: ['Institutional procedures differ.', 'EduReach should never invent a reason or official requirement.'] },
};

export default function ServicesPage() {
  return (
    <Shell title="Our Services">
      <section className="cat_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>Student Services</h2><p>Practical support for important academic and admission-related tasks.</p></div>
        <div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}><div className="single_cat"><img src={service.image} alt={service.title} loading="lazy" /><div className="single_cat_text"><h4>{service.title}</h4><p>{service.description}</p><a href={`#${service.id}`}>View Details <i className="fa fa-angle-right" /></a></div></div></div>)}</div>
      </div></section>

      <section className="course_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>How Each Service Works</h2><p>Mock service detail content is structured now and can later connect to live workflows.</p></div>
        {services.map((service) => { const detail = serviceDetails[service.id]; return <article id={service.id} className="single_course service-detail-card" key={service.id}><div className="single_c_img"><img src={service.image} className="img-fluid" alt={service.title} loading="lazy" /><span>{service.shortTitle}</span></div><div className="single_course_text"><h4>{service.title}</h4><p>{service.description}</p><h5>Typical Steps</h5><ol>{detail.steps.map((step) => <li key={step}>{step}</li>)}</ol><h5>Important Notes</h5><ul>{detail.notes.map((note) => <li key={note}>{note}</li>)}</ul><a href="/contact" className="btn_one">Get Support</a></div></article>; })}
      </div></section>
    </Shell>
  );
}
