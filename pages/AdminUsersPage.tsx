import { useEffect, useState } from 'react';
import { supabase } from '../src/lib/supabase';
import AdminLayout from './AdminLayout';

type Profile = { id: string; full_name: string; school: string; faculty: string; department: string; level: string; role: string; matric_number: string | null; created_at: string };

export default function AdminUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]); const [query, setQuery] = useState('');
  async function load() { const { data } = await supabase.from('profiles').select('id,full_name,school,faculty,department,level,role,matric_number,created_at').order('created_at', { ascending: false }).limit(200); setProfiles((data || []) as Profile[]); }
  useEffect(() => { load(); }, []);
  const filtered = profiles.filter((p) => `${p.full_name} ${p.school} ${p.department} ${p.matric_number || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <AdminLayout><div className="admin-page"><div className="admin-page-header"><div><h1>Student Accounts</h1><p>Review student profiles and staff roles from the live EduReach database.</p></div><input className="admin-input admin-search" placeholder="Search name, school or matric number" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="admin-card"><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Institution</th><th>Department</th><th>Level</th><th>Role</th><th>Joined</th></tr></thead><tbody>{filtered.map((p) => <tr key={p.id}><td><b>{p.full_name || 'Unnamed student'}</b><div className="muted">{p.matric_number || 'No matric number'}</div></td><td>{p.school || '—'}</td><td>{p.department || '—'}</td><td>{p.level || '—'}</td><td><span className={`status-badge ${p.role}`}>{p.role}</span></td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}{!filtered.length && <tr><td colSpan={6} className="empty-state">No students match the search.</td></tr>}</tbody></table></div></div></div></AdminLayout>;
}
