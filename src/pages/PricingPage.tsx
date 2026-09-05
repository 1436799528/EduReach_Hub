import { pricingPlans } from '../data/edulebMock';
import { imageBase, Shell } from '../components/EdulebShared';

export default function PricingPage() {
  return (
    <Shell title="Pricing Plan">
      <section id="pricing" className="pricing-content section-padding">
        <div className="container">
          <div className="row text-center">
            {pricingPlans.map((plan, index) => (
              <div
                className="col-lg-4 col-sm-4 col-xs-12 wow fadeInUp"
                data-wow-duration="1s"
                data-wow-delay={`${0.1 + index * 0.1}s`}
                data-wow-offset="0"
                key={plan.name}
              >
                <div className={`single-pricing ${index === pricingPlans.length - 1 ? 'single-pricing-white' : ''}`}>
                  <div className="price-head">
                    <h2>{plan.name}</h2>
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  {index === pricingPlans.length - 1 && <span className="price-label">Best</span>}
                  <h1 className="price">{plan.price}</h1>
                  <h5>{plan.period}</h5>
                  <ul>
                    {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <a className="btn_one" href="/contact.html">Get start</a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="partner-logo section-padding">
        <div className="container">
          <div className="row part_bg">
            <div className="col-lg-4 col-sm-4 col-xs-12">
              <div className="partner_title">
                <h3>Helping <span>86,000+</span> global learners build useful skills</h3>
              </div>
            </div>
            <div className="col-lg-8 col-sm-8 col-xs-12 text-center">
              <div className="partner">
                {[1, 2, 3, 4, 5, 2, 1, 3, 4].map((item, index) => (
                  <a href="/course.html" key={`${item}-${index}`}>
                    <img src={`${imageBase}/clients/${item}.png`} alt="Learning partner" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
