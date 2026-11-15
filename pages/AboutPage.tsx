import HubLayout from '../src/components/HubLayout';
import { useSiteContent } from '../src/components/useSiteContent';

/**
 * The "About" destination linked from the compact footer.
 *
 * The description is the same admin-managed sentence the footer used to carry,
 * so there is one place to correct the product's one-line story. Nothing here
 * invents a statistic, a founding date or an institutional affiliation.
 */
export default function AboutPage() {
  const { content } = useSiteContent();
  const { brand, footer } = content.settings;

  return (
    <HubLayout>
      <div className="er-legal-page">
        <div className="hub-container er-legal-container">
          <article className="er-legal-article" aria-labelledby="about-title">
            <header className="er-legal-head">
              <h1 id="about-title">{brand.name}</h1>
              <p className="er-legal-summary">{footer.about}</p>
            </header>

            <div className="er-legal-body">
              <p>
                {brand.name} is an independent study and student-services platform. It is not affiliated with JAMB,
                WAEC, NECO or any institution, and it does not speak for them.
              </p>
              <p>
                Practice papers and study tools are here to help you prepare. When a question or a record looks wrong,
                tell us through the <a href="/contact">contact page</a> so the page can be corrected instead of left
                misleading.
              </p>
            </div>
          </article>
        </div>
      </div>
    </HubLayout>
  );
}
