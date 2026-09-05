import { useState } from 'react';
import { faqs } from '../data/edulebMock';
import { Shell, imageBase } from '../components/EdulebShared';

export default function FAQPage() {
  const [open, setOpen] = useState(0);
  const items = [...faqs, {
    question: 'Can I learn at my own pace?',
    answer: 'Yes. The platform is designed around flexible online learning, so learners can return to lessons and continue from where they stopped.'
  }];

  return (
    <Shell title="Faq">
      <section className="faq_area section-padding">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-7 col-sm-12 col-xs-12">
              <div className="accordion" id="accordionExample">
                {items.map((item, index) => (
                  <div className="accordion-item" key={item.question}>
                    <h2 className="accordion-header" id={`heading${index}`}>
                      <button
                        className={`accordion-button ${open === index ? '' : 'collapsed'}`}
                        type="button"
                        onClick={() => setOpen(open === index ? -1 : index)}
                        aria-expanded={open === index}
                        aria-controls={`collapse${index}`}
                      >
                        {item.question}
                      </button>
                    </h2>
                    <div
                      id={`collapse${index}`}
                      className={`accordion-collapse collapse ${open === index ? 'show' : ''}`}
                      aria-labelledby={`heading${index}`}
                    >
                      <div className="accordion-body">{item.answer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-5 col-sm-12 col-xs-12">
              <div className="faq_img">
                <img src={`${imageBase}/faq.jpg`} alt="Frequently asked questions" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </Shell>
  );
}
