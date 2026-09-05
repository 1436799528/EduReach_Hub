import { services } from '../src/data/edulebMock';
import { Shell } from '../src/components/EdulebShared';

export default function ServicesPage() {
  return (
    <Shell title="Our Services">
      <section className="cat_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>Student Services</h2><p>Practical support for important academic and admission-related tasks.</p></div>
        <div className="row">{services.map((service) => <div className="col-lg-4 col-md-6 col-sm-6 col-xs-12" key={service.id}><div className="single_cat"><img src={service.image} alt={service.title} loading="lazy" /><div className="single_cat_text"><h4>{service.title}</h4><p>{service.description}</p><a href={`/services/${service.id}`}>View Details <i className="fa fa-angle-right" /></a></div></div></div>)}</div>
      </div></section>

      <section className="course_area section-padding"><div className="container">
        <div className="section-title text-center"><h2>Choose A Service</h2><p>Each service now has its own dedicated page with guidance and a support request form.</p></div>
        <div className="row">{services.map((service) => <div className="col-lg-4 col-sm-6 col-xs-12" key={service.id}><div className="single_course"><div className="single_c_img"><img src={service.image} className="img-fluid" alt={service.title} loading="lazy" /><span>{service.shortTitle}</span></div><div className="single_course_text"><span className={service.icon} style={{ fontSize: 28 }} /><h4>{service.title}</h4><p>{service.description}</p><a href={`/services/${service.id}`} className="btn_one">{service.cta}</a></div></div></div>)}</div>
      </div></section>
    </Shell>
  );
}
