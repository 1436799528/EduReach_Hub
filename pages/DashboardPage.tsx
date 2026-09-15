import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import { Shell } from '../src/components/EdulebShared';
import { services } from '../src/data/edulebMock';

type DashboardRequest = {
  id: string;
  status: string;
  created_at: string;
  form_data: Record<string, unknown>;
  service: { title: string; service_key: string } | null;
};

export default function DashboardPage() {
  const [isDemo, setIsDemo] = useState(false);
  const [email, setEmail] = useState('');
  const [requests, setRequests] = useState<DashboardRequest[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const demo = sessionStorage.getItem('edureach_demo_mode') === 'true';
    setIsDemo(demo);

    async function loadUser() {
      if (demo) {
        setEmail('demo@edureach.ng');
        setRequests([
          {
            id: 'demo-nelfund',
            status: 'processing',
            created_at: new Date().toISOString(),
            form_data: { message: 'Demo NELFUND application support request.' },
            service: { title: 'NELFUND Loan Application', service_key: 'nelfund-loan' },
          },
          {
            id: 'demo-results',
            status: 'processing',
            created_at: new Date().toISOString(),
            form_data: { message: 'Demo WAEC / NECO result-checking request.' },
            service: { title: 'WAEC / NECO Result Checking', service_key: 'results' },
          },
        ]);
        return;
      }

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        window.location.href = '/';
        return;
      }

      setEmail(data.user.email || '');
      const { data: rows, error: requestError } = await supabase
        .from('service_requests')
        .select('id,status,created_at,form_data,service:service_catalog(title,service_key)')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!requestError && rows) {
        setRequests(rows as DashboardRequest[]);
      }
    }

    loadUser();
  }, []);

  function signOut() {
    sessionStorage.removeItem('edureach_demo_mode');
    if (isDemo) {
      window.location.href = '/';
      return;
    }
    supabase.auth.signOut().finally(() => { window.location.href = '/'; });
  }

  return (
    <Shell title="Student Dashboard">
      <section className="dashboard_area section-padding">
        <div className="container">
          <div className="dashboard-welcome">
            <div>
              <span className="dashboard-kicker">{isDemo ? 'DEMO PREVIEW' : 'MY EDUREACH'}</span>
              <h2>{isDemo ? 'Welcome to the EduReach demo account' : 'Welcome back'}</h2>
              <p>{email || 'Student account'} · 300L · Electrical Engineering</p>
            </div>
            <button type="button" className="btn_one dashboard-signout" onClick={signOut}>Sign Out</button>
          </div>

          {isDemo && <div className="dashboard-demo-note">This is a safe demo preview. No real student credentials are being used, and demo requests are displayed as sample data.</div>}

          <div className="row">
            <div className="col-lg-8">
              <div className="dashboard-card">
                <div className="section-title"><h3>My Service Requests</h3><p>See how student service requests appear after submission.</p></div>
                {requests.length === 0 ? (
                  <div className="dashboard-empty">No service requests yet. Open a service and submit a request to create one.</div>
                ) : (
                  <div className="dashboard-request-list">
                    {requests.map((request) => (
                      <div className="dashboard-request" key={request.id}>
                        <div>
                          <span className="dashboard-request-type">{request.service?.title || 'EduReach Service'}</span>
                          <h4>{String(request.form_data?.message || 'Service request')}</h4>
                          <small>{new Date(request.created_at).toLocaleDateString()} · {request.status}</small>
                        </div>
                        <span className={`dashboard-status status-${request.status}`}>{request.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="col-lg-4">
              <div className="dashboard-card">
                <div className="section-title"><h3>Quick Services</h3><p>Jump straight into the student tools.</p></div>
                <div className="dashboard-service-links">
                  {services.map((service) => <a href={`/services/${service.id}`} key={service.id}><span className={service.icon} />{service.title}<i className="fa fa-angle-right" /></a>)}
                </div>
              </div>

              <div className="dashboard-card dashboard-profile-card">
                <div className="section-title"><h3>Demo Student</h3><p>Sample profile used to demonstrate the authenticated area.</p></div>
                <ul className="why_list">
                  <li><i className="fa fa-check" /> University Demo Campus</li>
                  <li><i className="fa fa-check" /> Faculty of Engineering</li>
                  <li><i className="fa fa-check" /> Electrical Engineering</li>
                  <li><i className="fa fa-check" /> Level 300</li>
                </ul>
              </div>
            </div>
          </div>

          {message && <div className="form-success">{message}</div>}
        </div>
      </section>
    </Shell>
  );
}
