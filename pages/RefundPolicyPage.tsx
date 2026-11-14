import HubLayout from '../src/components/HubLayout';
import { ShieldAlert } from 'lucide-react';

export default function RefundPolicyPage() {
  return (
    <HubLayout>
      <div className="er-legal-page">
        <div className="hub-container er-legal-container">
          <article className="er-legal-article" aria-labelledby="refund-title">
            <div className="er-legal-draft" role="note">
              <ShieldAlert size={18} aria-hidden="true" />
              <p><strong>Policy framework — pending business and legal review.</strong> This page is not a promise of a refund entitlement or a substitute for legal advice.</p>
            </div>
            <header className="er-legal-head">
              <span className="hub-eyebrow">EduReach policies</span>
              <h1 id="refund-title">Refund Policy</h1>
              <p className="er-legal-summary">How refunds and cancellations will be handled if EduReach introduces paid products or services.</p>
              <p className="er-legal-meta">Draft framework · Last reviewed: not yet recorded</p>
            </header>
            <div className="er-legal-body">
              <h2>Current availability</h2>
              <p>EduReach Hub is currently provided as a free educational platform. Paid subscriptions and paid digital services are not currently offered through this policy. No payment should be made on the assumption that a future paid feature is already available.</p>
              <h2>Before any paid service launches</h2>
              <p>Before accepting payment, EduReach will publish the applicable price, what the purchase includes, whether a payment is one-time or recurring, how renewal and cancellation work, the applicable refund conditions, and a support contact for billing questions.</p>
              <h2>Refund requests</h2>
              <p>When paid services become available, this policy will be completed with the actual refund eligibility rules, request process, time limits, processing method, and any lawful exceptions. Those terms will be displayed before checkout and will not be hidden behind a purchase.</p>
              <h2>Subscriptions and cancellation</h2>
              <p>If subscriptions are introduced, the checkout flow will clearly disclose the amount and billing interval. Users will be given a clear way to manage or cancel recurring payments, subject to the payment provider's documented process and applicable law.</p>
              <h2>Questions</h2>
              <p>For current platform questions, use the <a href="/contact">contact page</a>. Billing-specific contact details will be published before paid transactions are enabled.</p>
            </div>
          </article>
          <footer className="er-legal-foot"><nav aria-label="Other policies"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/cookies">Cookies</a><a href="/accessibility">Accessibility</a></nav></footer>
        </div>
      </div>
    </HubLayout>
  );
}
