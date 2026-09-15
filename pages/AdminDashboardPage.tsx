import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type RequestRow = { id: string; order_ref: string | null; status: string; amount: number; payment_status: string; created_at: string; service_catalog?: { title: string } | null };

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from('service_requests').select('id,order_ref,status,amount,payment_status,created_at,service_catalog(title)').order('created_at', { ascending: false }).limit(12);
    const requests = (data || []) as RequestRow[];
    setRows(requests);
    const { data: paid } = await supabase.from('service_requests').select('amount').eq('payment_status', 'paid');
    setRevenue((paid || []).reduce((sum, item) => sum + Number(item.amount || 0), 0));
    setLoading(false);
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 10000); return () => window.clearInterval(timer); }, []);

  const pending = rows.filter((row) => row.status !== 'completed' && row.status !== 'cancelled' && row.status !== 'rejected').length;

  async function complete(id: string) {
    await supabase.from('service_requests').update({ status: 'completed' }).eq('id', id);
    await load();
  }

  return <AdminLayout>
    <div className="admin-page">
      <div className="admin-page-header"><div><h1>System Operations Control</h1><p>Live processing overview across EduReach student services.</p></div><button className="admin-btn" onClick={() => window.print()}>Export Daily Audit Log</button></div>
      <div className="admin-kpi-grid">
        <div className="admin-kpi"><span>Gross Revenue</span><strong>₦{revenue.toLocaleString()}</strong><small>Paid service requests</small></div>
        <div className="admin-kpi"><span>Pending Orders</span><strong>{pending}</strong><small>Requires processing</small></div>
        <div className="admin-kpi"><span>Completed Orders</span><strong>{rows.filter((r) => r.status === 'completed').length}</strong><small>Latest loaded queue</small></div>
        <div className="admin-kpi"><span>Failed / Rejected</span><strong>{rows.filter((r) => r.status === 'failed' || r.status === 'rejected').length}</strong><small>Review required</small></div>
      </div>
      <div className="admin-card">
        <div className="admin-card-header"><h2>Active Service Processing Queue</h2><span>{loading ? 'Refreshing…' : 'Auto-refreshing · 10s'}</span></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Service</th><th>Amount</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td className="mono accent">{row.order_ref || row.id.slice(0, 10)}</td><td>{row.service_catalog?.title || 'Student service'}</td><td className="money">₦{Number(row.amount || 0).toLocaleString()}</td><td><span className={`status-badge ${row.status}`}>{row.status}</span></td><td>{new Date(row.created_at).toLocaleString()}</td><td className="right">{row.status !== 'completed' && <button className="admin-btn small" onClick={() => complete(row.id)}>Mark Completed</button>}</td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="empty-state">No service requests found.</td></tr>}
        </tbody></table></div>
      </div>
    </div>
  </AdminLayout>;
}
