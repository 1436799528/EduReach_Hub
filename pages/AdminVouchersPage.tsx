import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type Voucher = { id: string; exam_body: string; exam_year: number; serial_number: string; pin: string; status: string; created_at: string };

export default function AdminVouchersPage() {
  const [body, setBody] = useState('WAEC');
  const [year, setYear] = useState('2026');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [serial, setSerial] = useState('');
  const [pin, setPin] = useState('');
  const [showPins, setShowPins] = useState(false);

  async function load() {
    const { data } = await supabase.from('voucher_inventory').select('*').eq('exam_body', body).eq('exam_year', Number(year)).order('created_at', { ascending: false }).limit(100);
    setVouchers((data || []) as Voucher[]);
  }
  useEffect(() => { load(); }, [body, year]);

  async function addVoucher() {
    if (!serial || !pin) return;
    await supabase.from('voucher_inventory').insert({ exam_body: body, exam_year: Number(year), serial_number: serial, pin });
    setSerial(''); setPin(''); await load();
  }

  const available = useMemo(() => vouchers.filter((v) => v.status === 'available').length, [vouchers]);

  return <AdminLayout><div className="admin-page">
    <div className="admin-page-header"><div><h1>Scratch Card Voucher Inventory</h1><p>Secure WAEC and NECO result-checking voucher stock for controlled dispensing.</p></div><button className="admin-btn" onClick={() => setShowPins(!showPins)}>{showPins ? 'Hide PINs' : 'Reveal PINs'}</button></div>
    <div className="admin-kpi-grid two"><div className="admin-kpi"><span>{body} {year} Available</span><strong>{available}</strong><small>Ready for dispensing</small></div><div className="admin-kpi"><span>Total Loaded</span><strong>{vouchers.length}</strong><small>Current filter</small></div></div>
    <div className="admin-card"><div className="admin-card-header"><h2>Add Voucher</h2><span>One at a time for secure stock control</span></div><div className="admin-inline-form"><select className="admin-select" value={body} onChange={(e) => setBody(e.target.value)}><option>WAEC</option><option>NECO</option></select><select className="admin-select" value={year} onChange={(e) => setYear(e.target.value)}><option>2026</option><option>2025</option><option>2024</option></select><input className="admin-input" placeholder="Serial number" value={serial} onChange={(e) => setSerial(e.target.value)} /><input className="admin-input" placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} /><button className="admin-btn success" onClick={addVoucher}>Add to Inventory</button></div></div>
    <div className="admin-card"><div className="admin-card-header"><h2>Inventory Log</h2><span>PINs are restricted to staff</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Card Type</th><th>Serial</th><th>PIN</th><th>Status</th><th>Loaded</th></tr></thead><tbody>{vouchers.map((v) => <tr key={v.id}><td>{v.exam_body} {v.exam_year}</td><td className="mono">{v.serial_number}</td><td className="mono sensitive">{showPins ? v.pin : '••••••••••••'}</td><td><span className={`status-badge ${v.status}`}>{v.status}</span></td><td>{new Date(v.created_at).toLocaleString()}</td></tr>)}{!vouchers.length && <tr><td colSpan={5} className="empty-state">No vouchers in this inventory.</td></tr>}</tbody></table></div></div>
  </div></AdminLayout>;
}
