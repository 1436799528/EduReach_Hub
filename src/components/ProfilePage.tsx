import React, { useState } from 'react';
import { BookOpen, Check, Edit3, HelpCircle, LogOut, MessageSquare, Phone, Save, StickyNote, Trash2, User, X } from 'lucide-react';
import { UserProfile } from '../types';
import { deleteMaterialNoteFromProfile } from '../services/storage';
import { deleteMaterialNoteFromBackend } from '../lib/userFeatures';

interface ProfilePageProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
}

const faqs = [
  ['How do I access my study materials?', 'Open My School from the navigation bar. Search by course, filter by level or semester, and open the material you need.'],
  ['How do I request a campus service?', 'Open Campus Services, choose a service and submit the request form. Your request is saved to your account.'],
  ['How do I save a study resource?', 'Use the save option on a material card. Saved resources appear under My School > Saved.'],
];

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onUpdateUser, onLogout }) => {
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'help'>('profile');
  const [name, setName] = useState(user.name);
  const [faculty, setFaculty] = useState(user.faculty || '');
  const [department, setDepartment] = useState(user.department || '');
  const [level, setLevel] = useState(user.level || '');
  const [courseCode, setCourseCode] = useState('');
  const [courses, setCourses] = useState(user.enrolledCourses || []);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpSent, setHelpSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    onUpdateUser({ name, faculty, department, level, enrolledCourses: courses });
    setEditing(false);
  };

  const addCourse = () => {
    const code = courseCode.trim().toUpperCase();
    if (!code || courses.includes(code)) return;
    const next = [...courses, code];
    setCourses(next);
    onUpdateUser({ enrolledCourses: next });
    setCourseCode('');
  };

  const removeCourse = (code: string) => {
    const next = courses.filter((item) => item !== code);
    setCourses(next);
    onUpdateUser({ enrolledCourses: next });
  };

  const deleteNote = async (noteId: string) => {
    const updated = deleteMaterialNoteFromProfile(noteId);
    onUpdateUser({ materialNotes: updated.materialNotes });
    try {
      await deleteMaterialNoteFromBackend(user.id, noteId);
    } catch (error) {
      console.warn('Unable to delete backend note', error);
    }
  };

  const sendHelp = (event: React.FormEvent) => {
    event.preventDefault();
    const message = helpMessage.trim();
    if (!message) return;
    const text = encodeURIComponent(`Hello EduReach Hub Support Desk,\n\nStudent: ${user.name}\nSchool: ${user.institutionId}\nDepartment: ${user.department} (${user.level})\nInquiry: ${message}`);
    window.open(`https://wa.me/2349130134969?text=${text}`, '_blank', 'noopener,noreferrer');
    setHelpSent(true);
    setHelpMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                alt={user.name}
                className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                referrerPolicy="no-referrer"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"><Check className="h-3 w-3" /> Account</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{user.institutionId} · {user.department} · {user.level}</p>
                <p className="mt-1 text-xs text-slate-400">{user.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing((value) => !value)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                {editing ? <X className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                {editing ? 'Cancel' : 'Edit profile'}
              </button>
              <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3.5 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-3">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setActiveTab('profile')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === 'profile' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><User className="mr-1 inline h-3.5 w-3.5" /> Profile</button>
              <button type="button" onClick={() => setActiveTab('help')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === 'help' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><HelpCircle className="mr-1 inline h-3.5 w-3.5" /> Help</button>
            </div>
          </div>
        </section>

        {activeTab === 'profile' ? (
          <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Student details</h2>
                  <p className="mt-1 text-xs text-slate-500">Use these details to match your academic resources.</p>
                </div>
                {!editing && <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-orange-600">Edit</button>}
              </div>

              {editing ? (
                <form onSubmit={saveProfile} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700">Full name<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:bg-white" /></label>
                    <label className="text-xs font-semibold text-slate-700">Faculty<input value={faculty} onChange={(event) => setFaculty(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:bg-white" /></label>
                    <label className="text-xs font-semibold text-slate-700">Department<input value={department} onChange={(event) => setDepartment(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:bg-white" /></label>
                    <label className="text-xs font-semibold text-slate-700">Level<select value={level} onChange={(event) => setLevel(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-orange-500 focus:bg-white"><option>100L</option><option>200L</option><option>300L</option><option>400L</option><option>500L</option><option>600L</option><option>Postgraduate</option></select></label>
                  </div>
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700"><Save className="h-4 w-4" /> Save changes</button>
                </form>
              ) : (
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  {[
                    ['Full name', user.name],
                    ['Email', user.email],
                    ['Phone', user.phoneNumber || 'Not set'],
                    ['Institution', user.institutionId],
                    ['Faculty', user.faculty || 'Not set'],
                    ['Department', user.department || 'Not set'],
                    ['Level', user.level || 'Not set'],
                    ['Matric / Reg. No.', user.matricNumber || 'Not set'],
                  ].map(([label, value]) => <div key={label}><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm text-slate-800">{value}</dd></div>)}
                </dl>
              )}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <div><h3 className="text-sm font-bold text-slate-900">Enrolled courses</h3><p className="mt-1 text-xs text-slate-500">Used to personalize course resources.</p></div>
                  <BookOpen className="h-4 w-4 text-orange-600" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {courses.length ? courses.map((course) => <span key={course} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{course}<button type="button" onClick={() => removeCourse(course)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${course}`}><X className="h-3 w-3" /></button></span>) : <span className="text-xs text-slate-400">No courses added yet.</span>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={courseCode} onChange={(event) => setCourseCode(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCourse(); } }} placeholder="e.g. EEE 311" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-orange-500 focus:bg-white" />
                  <button type="button" onClick={addCourse} className="rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Add</button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><h2 className="text-sm font-bold text-slate-900">Saved study notes</h2><p className="mt-1 text-xs text-slate-500">Private notes linked to your study packs.</p></div><StickyNote className="h-4 w-4 text-orange-600" /></div>
              <div className="mt-4 space-y-3">
                {user.materialNotes?.length ? user.materialNotes.map((note) => <div key={note.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">{note.courseCode} · {note.materialTitle}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">{note.content}</p></div><button type="button" onClick={() => void deleteNote(note.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete note"><Trash2 className="h-3.5 w-3.5" /></button></div></div>) : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center"><StickyNote className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-2 text-xs font-semibold text-slate-600">No saved notes</p><p className="mt-1 text-[11px] text-slate-400">Notes you make while studying will appear here.</p></div>}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_.9fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4"><MessageSquare className="h-4 w-4 text-orange-600" /><div><h2 className="text-sm font-bold text-slate-900">Contact support</h2><p className="mt-1 text-xs text-slate-500">Send an inquiry through the EduReach support desk.</p></div></div>
              <form onSubmit={sendHelp} className="mt-5 space-y-3">
                <textarea value={helpMessage} onChange={(event) => { setHelpMessage(event.target.value); setHelpSent(false); }} required rows={6} placeholder="Describe the problem or question…" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none focus:border-orange-500 focus:bg-white" />
                {helpSent && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">Support chat opened in WhatsApp.</p>}
                <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700"><MessageSquare className="h-4 w-4" /> Contact support</button>
              </form>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="text-sm font-bold text-slate-900">Common questions</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {faqs.map(([question, answer], index) => <div key={question} className="py-3 first:pt-0 last:pb-0"><button type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-slate-800"><span>{question}</span><span className="text-slate-400">{openFaq === index ? '−' : '+'}</span></button>{openFaq === index && <p className="mt-2 pr-5 text-xs leading-5 text-slate-500">{answer}</p>}</div>)}
              </div>
              <div className="mt-5 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500"><Phone className="h-4 w-4 text-orange-600" /> Support contact opens in WhatsApp.</div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
