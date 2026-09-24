import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type QueueRow = { id: string; user_id: string; status: string; form_data: Record<string, unknown>; created_at: string; reference_code: string | null; service_catalog?: { title: string } | null };

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Administrative session has expired.');
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Administrative request failed.');
  return body as T;
}

export default function AdminQueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]); const [filter, setFilter] = useState('all'); const [error, setError] = useState('');
  async function load() { try { setError(''); const body = await adminFetch<{items: QueueRow[]}>(`/api/admin/service-requests?status=${encodeURIComponent(filter)}`); setRows(body.items || []); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load queue.'); } }
  useEffect(() => { void load(); }, [filter]);
  async function updateStatus(id: string, status: string) { try { await adminFetch(`/api/admin/service-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update request.'); } }
  return <AdminLayout><div className="admin-page"><div className="admin-page-header"><div><h1>Service Processing Queue</h1><p>Process student service requests through controlled status transitions.</p></div><select className="admin-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option></select></div>{error && <div className="admin-card">{error}</div>}<div className="admin-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Service</th><th>Reference</th><th>Details</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td className="mono accent">{String(row.form_data?.fullName || row.form_data?.name || row.user_id.slice(0,8))}</td><td>{row.service_catalog?.title || 'Service request'}</td><td className="mono">{row.reference_code || '—'}</td><td>{String(row.form_data?.message || row.form_data?.requestDetails || '—')}</td><td><span className={`status-badge ${row.status}`}>{row.status}</span></td><td>{new Date(row.created_at).toLocaleString()}</td><td><div className="admin-action-row">{row.status === 'submitted' && <button type="button" className="admin-btn small" onClick={()=>void updateStatus(row.id,'reviewing')}>Review</button>}{['submitted','reviewing'].includes(row.status) && <button type="button" className="admin-btn small" onClick={()=>void updateStatus(row.id,'processing')}>Process</button>}{['reviewing','processing'].includes(row.status) && <button type="button" className="admin-btn small success" onClick={()=>void updateStatus(row.id,'completed')}>Complete</button>}{!['completed','rejected','cancelled'].includes(row.status) && <button type="button" className="admin-btn small danger" onClick={()=>void updateStatus(row.id,'rejected')}>Reject</button>}</div></td></tr>)}{!rows.length && <tr><td colSpan={7} className="empty-state">No matching service requests.</td></tr>}</tbody></table></div></div></div></AdminLayout>;
}
