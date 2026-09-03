import React, { useState } from 'react';
import { 
  UserProfile, 
  InstitutionId 
} from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { 
  User, 
  Phone, 
  Building2, 
  GraduationCap, 
  LogOut, 
  Edit3, 
  Check, 
  Plus, 
  X, 
  HelpCircle, 
  MessageSquare, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  BookOpen,
  StickyNote,
  Trash2,
  Copy
} from 'lucide-react';
import { deleteMaterialNoteFromProfile } from '../services/storage';
import { deleteMaterialNoteFromBackend } from '../lib/userFeatures';

interface ProfilePageProps {
  user: UserProfile;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onLogout: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onUpdateUser,
  onLogout
}) => {
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [institutionId, setInstitutionId] = useState<InstitutionId>(user.institutionId);
  const [faculty, setFaculty] = useState(user.faculty || 'Physical Sciences');
  const [department, setDepartment] = useState(user.department);
  const [level, setLevel] = useState(user.level);
  const [matricNumber, setMatricNumber] = useState(user.matricNumber || '21/042144081');
  const [stateOfOrigin, setStateOfOrigin] = useState(user.stateOfOrigin || 'Cross River');
  
  // Enrolled Course Codes
  const [newCourseCode, setNewCourseCode] = useState('');
  const [coursesList, setCoursesList] = useState<string[]>(user.enrolledCourses || ['CSC 311', 'CSC 321', 'MTH 301']);

  // Tabs: Details vs Help & WhatsApp
  const [activeTab, setActiveTab] = useState<'profile' | 'help'>('profile');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [helpMessage, setHelpMessage] = useState('');
  const [helpSent, setHelpSent] = useState(false);
  const [copiedProfileNoteId, setCopiedProfileNoteId] = useState<string | null>(null);

  const handleDeleteProfileNote = async (noteId: string) => {
    const updatedUser = deleteMaterialNoteFromProfile(noteId);
    onUpdateUser({ materialNotes: updatedUser.materialNotes });
    if (user.id) {
      try {
        await deleteMaterialNoteFromBackend(user.id, noteId);
      } catch (e) {
        console.warn('Backend delete note error', e);
      }
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name,
      email,
      phoneNumber,
      institutionId,
      faculty,
      department,
      level,
      matricNumber,
      stateOfOrigin,
      enrolledCourses: coursesList
    });
    setIsEditing(false);
  };

  const handleAddCourse = () => {
    const trimmed = newCourseCode.trim().toUpperCase();
    if (trimmed && !coursesList.includes(trimmed)) {
      const updated = [...coursesList, trimmed];
      setCoursesList(updated);
      onUpdateUser({ enrolledCourses: updated });
      setNewCourseCode('');
    }
  };

  const handleRemoveCourse = (courseToRemove: string) => {
    const updated = coursesList.filter(c => c !== courseToRemove);
    setCoursesList(updated);
    onUpdateUser({ enrolledCourses: updated });
  };

  const handleSendHelp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpMessage.trim()) return;
    const text = encodeURIComponent(
      `Hello EduReach Hub Support Desk,\n\nStudent: ${user.name}\nSchool: ${user.institutionId}\nDepartment: ${user.department} (${user.level})\nInquiry: ${helpMessage}`
    );
    window.open(`https://wa.me/2349130134969?text=${text}`, '_blank');
    setHelpSent(true);
    setTimeout(() => {
      setHelpSent(false);
      setHelpMessage('');
    }, 3000);
  };

  const faqs = [
    {
      q: 'How do I access verified past questions and study packs?',
      a: 'All course packs and solved past questions are available in the My School section. You can filter by level, semester, and course code to view and download study notes.'
    },
    {
      q: 'How fast are WAEC, JAMB, and NECO checker PINs delivered?',
      a: 'Tokens and PINs are dispatched immediately via WhatsApp to your phone number upon request confirmation (usually in under 3 minutes).'
    },
    {
      q: 'How does EduReach process campus transcripts and senate clearance?',
      a: 'Our accredited campus registry liaisons physically interface with your university records department, track application files, and ensure prompt verification and dispatch.'
    },
    {
      q: 'Can I edit my matriculation number or change my university?',
      a: 'Yes! Click "Edit Details" on this profile page to update your matriculation number, faculty, department, level, or institution. All changes are saved instantly.'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Profile Header Hero Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="relative">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                alt={user.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-orange-500 shadow-sm"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{user.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-orange-400 border border-slate-700">
                  Verified Scholar
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-300">
                {user.department} • <strong className="text-orange-400">{user.institutionId}</strong> ({user.level})
              </p>

              <div className="text-[11px] text-slate-400 font-mono">
                Matric No: {user.matricNumber || '21/042144081'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile Details</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition-all cursor-pointer"
              >
                Cancel Editing
              </button>
            )}

            <button
              onClick={onLogout}
              className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold border border-rose-500/30 transition-all flex items-center gap-1.5 cursor-pointer flex-1 md:flex-initial justify-center"
              title="Log out and return to landing page"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Profile Navigation Sub-tabs */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-orange-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Academic & Student Records</span>
          </button>

          <button
            onClick={() => setActiveTab('help')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'help'
                ? 'bg-orange-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
            <span>Help Desk & Direct WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Profile Details Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Details / Form View */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {isEditing ? 'Make Corrections to Your Profile' : 'Official Student Records'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isEditing ? 'Update any inaccurate information and click Save.' : 'These records are used to match past questions and liaison services.'}
                </p>
              </div>

              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              )}
            </div>

            {isEditing ? (
              /* Editable Form */
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp / Phone Number</label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="08148920119"
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Matriculation Number</label>
                    <input
                      type="text"
                      value={matricNumber}
                      onChange={(e) => setMatricNumber(e.target.value)}
                      placeholder="21/042144081"
                      required
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">University / Campus</label>
                    <select
                      value={institutionId}
                      onChange={(e) => setInstitutionId(e.target.value as InstitutionId)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    >
                      {INSTITUTIONS.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.shortName} - {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Academic Level</label>
                    <select
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    >
                      <option value="100L">100L (Freshman)</option>
                      <option value="200L">200L (Sophomore)</option>
                      <option value="300L">300L (Junior)</option>
                      <option value="400L">400L (Final Year)</option>
                      <option value="500L">500L (Engineering/Pharmacy)</option>
                      <option value="Postgraduate">Postgraduate (MSc / PhD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Faculty</label>
                    <input
                      type="text"
                      value={faculty}
                      onChange={(e) => setFaculty(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:border-orange-500 font-medium"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Corrections</span>
                  </button>
                </div>
              </form>
            ) : (
              /* Read-only Structured Cards */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Full Name</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{user.name}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Email Address</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">{user.email}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">WhatsApp / Phone</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{user.phoneNumber || '08148920119'}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Matriculation Number</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block font-mono">{user.matricNumber || '21/042144081'}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">University</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{user.institutionId}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Department & Level</span>
                    <span className="text-sm font-bold text-slate-900 mt-0.5 block">{user.department} ({user.level})</span>
                  </div>
                </div>

                {/* Enrolled Courses Management */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-slate-800">
                      Enrolled Semester Courses ({coursesList.length})
                    </div>
                    <span className="text-[10px] text-slate-400">Used to filter your study packs & past questions</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {coursesList.map((course) => (
                      <span
                        key={course}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-bold shadow-2xs"
                      >
                        <span>{course}</span>
                        <button
                          onClick={() => handleRemoveCourse(course)}
                          className="text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add Course Code Input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={newCourseCode}
                      onChange={(e) => setNewCourseCode(e.target.value)}
                      placeholder="Add course code (e.g. GST 101, CHM 211)..."
                      className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500 flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCourse();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCourse}
                      className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>

                {/* Saved Study Memos & Quick Notes Section */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-slate-800">
                        Saved Study Memos & Notes ({user.materialNotes?.length || 0})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">Linked to study packs</span>
                  </div>

                  {(!user.materialNotes || user.materialNotes.length === 0) ? (
                    <div className="text-center py-6 px-3 bg-white rounded-xl border border-slate-200/70 space-y-1.5">
                      <p className="text-xs font-semibold text-slate-700">No study notes saved yet</p>
                      <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                        While reading course summaries or past questions in My School, click the Quick Notes tab to save exam memos to your profile.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {user.materialNotes.map((note) => {
                        const dateStr = new Date(note.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        });

                        return (
                          <div
                            key={note.id}
                            className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-800 text-[10px] font-bold">
                                  {note.courseCode}
                                </span>
                                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                                  {note.materialTitle}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {dateStr}
                                </span>
                                {note.updatedAt && (
                                  <span className="text-[10px] text-amber-600 font-semibold">
                                    (Edited)
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (navigator.clipboard) {
                                      navigator.clipboard.writeText(note.content);
                                      setCopiedProfileNoteId(note.id);
                                      setTimeout(() => setCopiedProfileNoteId(null), 2000);
                                    }
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                  title="Copy memo"
                                >
                                  {copiedProfileNoteId === note.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteProfileNote(note.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Delete memo"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {note.content}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

          {/* Right Sidebar: Academic Stats & Quick Help */}
          <div className="space-y-6">
            
            {/* Academic Footprint */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Academic Summary
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Saved Offline Packs</span>
                  <strong className="text-slate-900 font-bold">{user.savedOfflineMaterialIds.length}</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Saved Study Memos</span>
                  <strong className="text-amber-600 font-bold">{user.materialNotes?.length || 0}</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Enrolled Courses</span>
                  <strong className="text-orange-600 font-bold">{coursesList.length}</strong>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Campus Registry Desk</span>
                  <strong className="text-emerald-600 font-bold">Active</strong>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp Contact Card */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-slate-300">Official WhatsApp Desk</span>
              </div>
              <p className="font-mono text-lg font-bold text-white">09130134969</p>
              <p className="text-xs text-slate-400">
                Direct registry & academic inquiry support for Nigerian university students.
              </p>
              <a
                href="https://wa.me/2349130134969"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message on WhatsApp</span>
              </a>
            </div>

          </div>

        </div>
      )}

      {/* Help & Support Tab */}
      {activeTab === 'help' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FAQs Accordion */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Frequently Asked Academic Questions
              </h2>
              <p className="text-xs text-slate-500">
                Quick answers on past question archives, NELFUND loan clearance, exam PINs, and transcripts.
              </p>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full p-4 text-left font-bold text-xs sm:text-sm text-slate-800 flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-4 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* WhatsApp Direct Help Desk Form */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Phone className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">
                Direct WhatsApp Support Desk
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Need immediate help with your result PINs, research project writeup, or NELFUND clearance? Message our verified desk officers directly.
              </p>
              <div className="pt-1 font-mono text-sm font-bold text-emerald-400">
                Hotline: 09130134969
              </div>
            </div>

            <form onSubmit={handleSendHelp} className="space-y-3 pt-2">
              <textarea
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
                placeholder="Type your academic or service inquiry here..."
                rows={3}
                className="w-full text-xs bg-slate-800 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-400 focus:outline-none focus:border-orange-500"
              />

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{helpSent ? 'Opening WhatsApp...' : 'Send to WhatsApp Desk'}</span>
              </button>
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
