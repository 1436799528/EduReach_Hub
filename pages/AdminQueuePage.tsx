import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type QueueRow = { id: string; order_ref: string | null; status: string; amount: number; payment_status: string; form_data: Record<string, unknown>; admin_note: string | null; created_at: string; service_catalog?: { title: string } | null };

export default function AdminQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [filter, setFilter] = useState('all');

  async function load() {
    let query = supabase.from('service_requests').select('id,order_ref,status,amount,payment_status,form_data,admin_note,created_at,service_catalog(title)').order('created_at', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    setRows((data || []) as QueueRow[]);
  }
  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id: string, status: string) {
    await supabase.from('service_requests').update({ status }).eq('id', id);
    await load();
  }

  return <AdminLayout><div className="admin-page">
    <div className="admin-page-header"><div><h1>Service Processing Queue</h1><p>Process NELFUND, JAMB, result-checking and admission service requests.</p></div><select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div>
    <div className="admin-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Student</th><th>Service</th><th>Amount</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.id}><td className="mono accent">{row.order_ref || row.id.slice(0, 10)}</td><td>{String(row.form_data?.fullName || row.form_data?.name || 'Student')}</td><td>{row.service_catalog?.title || 'Service request'}</td><td className="money">₦{Number(row.amount || 0).toLocaleString()}</td><td><span className={`status-badge ${row.payment_status}`}>{row.payment_status}</span></td><td><span className={`status-badge ${row.status}`}>{row.status}</span></td><td><div className="admin-action-row"><button className="admin-btn small" onClick={() => updateStatus(row.id, 'processing')}>Process</button><button className="admin-btn small success" onClick={() => updateStatus(row.id, 'completed')}>Complete</button><button className="admin-btn small danger" onClick={() => updateStatus(row.id, 'rejected')}>Reject</button></div></td></tr>)}
      {!rows.length && <tr><td colSpan={7} className="empty-state">No matching service requests.</td></tr>}
    </tbody></table></div></div>
  </div></AdminLayout>;
}
