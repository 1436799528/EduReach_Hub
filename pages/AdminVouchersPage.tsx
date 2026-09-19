import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type Voucher = { id: string; exam_body: string; exam_year: number; serial_number: string; status: string; created_at: string };

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Administrative session has expired.');
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init.headers || {}) } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || 'Administrative request failed.');
  return body as T;
}

export default function AdminVouchersPage() {
  const [body, setBody] = useState('WAEC'); const [year, setYear] = useState('2026'); const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [serial, setSerial] = useState(''); const [pin, setPin] = useState(''); const [revealed, setRevealed] = useState<Record<string,string>>({}); const [error, setError] = useState('');
  async function load() { try { setError(''); const result = await adminFetch<{items:Voucher[]}>(`/api/admin/vouchers?exam_body=${body}&exam_year=${year}`); setVouchers(result.items || []); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to load inventory.'); } }
  useEffect(() => { void load(); }, [body, year]);
  async function addVoucher() { if (!serial || !pin) return; try { await adminFetch('/api/admin/vouchers',{method:'POST',body:JSON.stringify({exam_body:body,exam_year:Number(year),serial_number:serial,pin})}); setSerial(''); setPin(''); await load(); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to add voucher.'); } }
  async function reveal(id: string) { try { const result=await adminFetch<{pin:string}>(`/api/admin/vouchers/${id}/reveal`,{method:'POST'}); setRevealed(v=>({...v,[id]:result.pin})); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to reveal PIN.'); } }
  const available = useMemo(() => vouchers.filter(v=>v.status==='available').length,[vouchers]);
  return <AdminLayout><div className="admin-page"><div className="admin-page-header"><div><h1>Scratch Card Voucher Inventory</h1><p>PINs are never loaded with the normal inventory list. Reveal requires an explicit protected action.</p></div></div>{error && <div className="admin-card">{error}</div>}<div className="admin-kpi-grid two"><div className="admin-kpi"><span>{body} {year} Available</span><strong>{available}</strong><small>Ready for dispensing</small></div><div className="admin-kpi"><span>Total Loaded</span><strong>{vouchers.length}</strong><small>Current filter</small></div></div><div className="admin-card"><div className="admin-card-header"><h2>Add Voucher</h2><span>One at a time for controlled stock entry</span></div><div className="admin-inline-form"><select className="admin-select" value={body} onChange={e=>setBody(e.target.value)}><option>WAEC</option><option>NECO</option></select><select className="admin-select" value={year} onChange={e=>setYear(e.target.value)}><option>2026</option><option>2025</option><option>2024</option></select><input className="admin-input" placeholder="Serial number" value={serial} onChange={e=>setSerial(e.target.value)}/><input className="admin-input" placeholder="PIN" value={pin} onChange={e=>setPin(e.target.value)}/><button className="admin-btn success" onClick={()=>void addVoucher()}>Add to Inventory</button></div></div><div className="admin-card"><div className="admin-card-header"><h2>Inventory Log</h2><span>PIN reveal is individually audited</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Card Type</th><th>Serial</th><th>PIN</th><th>Status</th><th>Loaded</th></tr></thead><tbody>{vouchers.map(v=><tr key={v.id}><td>{v.exam_body} {v.exam_year}</td><td className="mono">{v.serial_number}</td><td className="mono sensitive">{revealed[v.id] || '••••••••••••'} {!revealed[v.id] && <button className="admin-text-btn" onClick={()=>void reveal(v.id)}>Reveal</button>}</td><td><span className={`status-badge ${v.status}`}>{v.status}</span></td><td>{new Date(v.created_at).toLocaleString()}</td></tr>)}{!vouchers.length && <tr><td colSpan={5} className="empty-state">No vouchers in this inventory.</td></tr>}</tbody></table></div></div></div></AdminLayout>;
}
