import { services } from '../src/data/edulebMock';
import { ContentWithRail, Shell } from '../src/components/EdulebShared';

export default function ServicesPage() {
  return (
    <Shell title="Our Services">
      <section className="cat_area section-padding">
        <ContentWithRail>
          <div className="section-title"><h2>Student Services</h2><p>Practical support for important academic and admission-related tasks.</p></div>
          <div className="row">{services.map((service) => <div className="col-md-6" key={service.id}><div className="single_cat"><img src={service.image} alt={service.title} loading="lazy" /><div className="single_cat_text"><h4>{service.title}</h4><p>{service.description}</p><a href={`/services/${service.id}`}>View Details <i className="fa fa-angle-right" /></a></div></div></div>)}</div>

          <div className="page-section-card">
            <div className="section-title"><h2>Choose A Service</h2><p>Each service has its own dedicated page with guidance and a support request form.</p></div>
            <div className="row">{services.map((service) => <div className="col-sm-6" key={service.id}><div className="single_course"><div className="single_c_img"><img src={service.image} className="img-fluid" alt={service.title} loading="lazy" /><span>{service.shortTitle}</span></div><div className="single_course_text"><span className={service.icon} style={{ fontSize: 28 }} /><h4>{service.title}</h4><p>{service.description}</p><a href={`/services/${service.id}`} className="btn_one">{service.cta}</a></div></div></div>)}</div>
          </div>
        </ContentWithRail>
      </section>
    </Shell>
  );
}
