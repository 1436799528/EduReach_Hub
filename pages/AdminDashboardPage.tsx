import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type RequestRow = { id: string; user_id: string; status: string; form_data: Record<string, unknown>; created_at: string; updated_at: string; service_catalog?: { title: string } | null };

export default function AdminDashboardPage() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); const { data } = await supabase.from('service_requests').select('id,user_id,status,form_data,created_at,updated_at,service_catalog(title)').order('created_at', { ascending: false }).limit(20); setRows((data || []) as RequestRow[]); setLoading(false); }
  useEffect(() => { load(); }, []);
  const pending = rows.filter((row) => !['completed', 'cancelled', 'rejected'].includes(row.status)).length;
  const completed = rows.filter((row) => row.status === 'completed').length;
  const rejected = rows.filter((row) => row.status === 'rejected').length;
  async function updateStatus(id: string, status: string) { await supabase.from('service_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id); await load(); }
  return <AdminLayout><div className="admin-page"><div className="admin-page-header"><div><h1>System Operations Control</h1><p>Live processing overview across EduReach student services.</p></div><button className="admin-btn" onClick={() => window.print()}>Print Queue</button></div><div className="admin-kpi-grid"><div className="admin-kpi"><span>Requests</span><strong>{rows.length}</strong><small>Latest service requests</small></div><div className="admin-kpi"><span>Pending</span><strong>{pending}</strong><small>Requires processing</small></div><div className="admin-kpi"><span>Completed</span><strong>{completed}</strong><small>Completed in loaded queue</small></div><div className="admin-kpi"><span>Rejected</span><strong>{rejected}</strong><small>Review required</small></div></div><div className="admin-card"><div className="admin-card-header"><h2>Active Service Processing Queue</h2><span>{loading ? 'Loading…' : 'Live data'}</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Service</th><th>Details</th><th>Status</th><th>Date</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td className="mono accent">{String(row.form_data?.fullName || row.form_data?.name || row.user_id.slice(0, 8))}</td><td>{row.service_catalog?.title || 'Student service'}</td><td>{String(row.form_data?.message || row.form_data?.requestDetails || '—')}</td><td><span className={`status-badge ${row.status}`}>{row.status}</span></td><td>{new Date(row.created_at).toLocaleString()}</td><td className="right"><div className="admin-action-row">{row.status !== 'completed' && <button className="admin-btn small success" onClick={() => updateStatus(row.id, 'completed')}>Complete</button>}{row.status !== 'rejected' && row.status !== 'completed' && <button className="admin-btn small danger" onClick={() => updateStatus(row.id, 'rejected')}>Reject</button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={6} className="empty-state">No service requests found.</td></tr>}</tbody></table></div></div></div></AdminLayout>;
}
