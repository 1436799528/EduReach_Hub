import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Building2, 
  GraduationCap, 
  Award, 
  ShieldCheck, 
  HelpCircle, 
  MessageSquare, 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  X, 
  Clock, 
  Sparkles, 
  UserCheck, 
  BookOpen,
  Send,
  LifeBuoy
} from 'lucide-react';
import { UserProfile, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';

interface UserProfileModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updated: Partial<UserProfile>) => void;
  onToggleRole: () => void;
  onOpenAPlus: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdateUser,
  onToggleRole,
  onOpenAPlus
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'help' | 'faq'>('profile');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [customHelpMessage, setCustomHelpMessage] = useState('');
  const [helpSent, setHelpSent] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber);
  const [institutionId, setInstitutionId] = useState<InstitutionId>(user.institutionId);
  const [department, setDepartment] = useState(user.department);
  const [level, setLevel] = useState(user.level);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser({
      name,
      email,
      phoneNumber,
      institutionId,
      department,
      level
    });
    setIsEditing(false);
  };

  const handleSendHelpInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customHelpMessage.trim()) return;
    const text = encodeURIComponent(
      `Hello EduReach Hub Support,\n\nName: ${user.name}\nInstitution: ${user.institutionId}\nDepartment: ${user.department} (${user.level})\nInquiry: ${customHelpMessage}`
    );
    window.open(`https://wa.me/234020000000?text=${text}`, '_blank');
    setHelpSent(true);
    setTimeout(() => {
      setHelpSent(false);
      setCustomHelpMessage('');
    }, 3000);
  };

  const faqs = [
    {
      q: 'How does EduReach Assignment Assistance work?',
      a: 'Submit your assignment instructions, course code, and deadline via Our Services tab. Our verified academic specialists research, solve, and structure 100% original, plagiarism-free work delivered directly to your WhatsApp and email with step-by-step explanations.'
    },
    {
      q: 'What is included in Project Guidance & Research Support?',
      a: 'We provide end-to-end guidance from proposal topic formulation and approval, literature review, Chapter 1 to 5 writeups, SPSS/Python data analysis, to final defense PowerPoint presentation slides.'
    },
    {
      q: 'How do Academic Tutorials work?',
      a: 'You can book 1-on-1 intensive virtual revision sessions (via Google Meet / Zoom) or receive step-by-step audio notes and worked solutions from top departmental scholars tailored to your exact course syllabus.'
    },
    {
      q: 'What is the A+ Academic Pass?',
      a: 'The A+ Pass is a ₦1,500/semester subscription granting you unlimited instant unlocks to over 15,000+ solved past questions, high-yield lecture summaries, formula sheets, and offline study packs across all universities.'
    },
    {
      q: 'How do Contributor Royalties work?',
      a: 'When you upload verified past question solutions or course summaries that pass Senate moderation, you earn 70% royalties whenever another student unlocks your material. Payouts are transferred automatically to your Nigerian bank account.'
    },
    {
      q: 'How fast are campus administrative service orders processed?',
      a: 'Result checker PINs and scratch cards are delivered instantly. NELFUND loan documentation and transcript processing usually take between 24 to 72 hours with real-time tracking.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Header */}
        <div className="bg-slate-900 text-white p-6 pb-5 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                alt={user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-orange-500 shadow-md"
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <Check className="w-3 h-3 text-white stroke-[3]" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white">{user.name}</h2>
                {user.isAPlusSubscriber && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-600 text-white uppercase tracking-wider">
                    A+ Pass
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {user.department} • {user.institutionId} ({user.level})
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Wallet: <strong className="text-orange-400">₦{user.walletBalance.toLocaleString()}</strong>
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                  Role: <strong className="text-white">{user.role}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <div className="flex items-center gap-2 mt-5 pt-3 border-t border-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveSubTab('profile')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeSubTab === 'profile'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              Student Profile
            </button>
            <button
              onClick={() => setActiveSubTab('help')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'help'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Help & Support</span>
            </button>
            <button
              onClick={() => setActiveSubTab('faq')}
              className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'faq'
                  ? 'bg-orange-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>FAQs & Guide</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          
          {/* TAB 1: PROFILE DETAILS */}
          {activeSubTab === 'profile' && (
            <div className="space-y-6">
              {!isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Full Name</span>
                      <span className="text-sm font-bold text-slate-900">{user.name}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Email Address</span>
                      <span className="text-sm font-bold text-slate-900">{user.email}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">WhatsApp / Phone</span>
                      <span className="text-sm font-bold text-slate-900">{user.phoneNumber}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Current University</span>
                      <span className="text-sm font-bold text-slate-900">{user.institutionId}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Department</span>
                      <span className="text-sm font-bold text-slate-900">{user.department}</span>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Academic Level</span>
                      <span className="text-sm font-bold text-slate-900">{user.level}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Edit Academic Info
                    </button>

                    <button
                      onClick={onToggleRole}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Switch Mode: {user.role === 'moderator' ? 'Student Mode' : 'Senate Moderator Mode'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Phone Number</label>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Primary University</label>
                      <select
                        value={institutionId}
                        onChange={(e) => setInstitutionId(e.target.value as InstitutionId)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                      >
                        {INSTITUTIONS.map(inst => (
                          <option key={inst.id} value={inst.id}>
                            {inst.shortName} - {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Academic Level</label>
                      <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value as any)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:border-orange-500 focus:outline-none"
                      >
                        <option value="100L">100 Level</option>
                        <option value="200L">200 Level</option>
                        <option value="300L">300 Level</option>
                        <option value="400L">400 Level</option>
                        <option value="500L">500 Level</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: HELP & SUPPORT DESK */}
          {activeSubTab === 'help' && (
            <div className="space-y-6">
              
              {/* EduReach Brand Support Banner */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-orange-400 font-bold text-xs uppercase tracking-wider mb-1">
                    EDUREACH HUB • 24/7 SUPPORT DESK
                  </div>
                  <h3 className="text-base font-extrabold text-white">
                    Need Help With Your Studies or Service Orders?
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    Connect directly with our senior academic coordinators and campus desks for instant assistance on assignments, project writeups, tutorials, and portal clearances.
                  </p>
                </div>

                <a
                  href="https://wa.me/234020000000?text=Hello%20EduReach%20Hub%20Support,%20I%20need%20assistance"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 flex-shrink-0 cursor-pointer shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Live Help</span>
                </a>
              </div>

              {/* Direct Support Channels */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center mb-2">
                    <Phone className="w-4 h-4 text-orange-600" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">WhatsApp Hotline</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">+234 0200 000000</p>
                  <button
                    onClick={() => handleCopy('+234020000000', 'phone')}
                    className="mt-2 text-[11px] font-bold text-orange-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'phone' ? 'Copied' : 'Copy Number'}</span>
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center mb-2">
                    <Mail className="w-4 h-4 text-orange-600" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Official Email</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1 truncate">edureachhub@gmail.com</p>
                  <button
                    onClick={() => handleCopy('edureachhub@gmail.com', 'email')}
                    className="mt-2 text-[11px] font-bold text-orange-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedText === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedText === 'email' ? 'Copied' : 'Copy Email'}</span>
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center mb-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Social Support</h4>
                  <p className="text-xs font-semibold text-slate-600 mt-1">@EdureachHub</p>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-[11px] font-bold text-orange-600 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Follow & DM</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Quick Inquiry Form */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                <h4 className="text-xs font-bold text-slate-900 mb-1">Send a Quick Message to Academic Desk</h4>
                <p className="text-xs text-slate-500 mb-3">
                  Have questions about your coursework, custom project proposal, or payment confirmation?
                </p>

                <form onSubmit={handleSendHelpInquiry} className="space-y-3">
                  <textarea
                    rows={3}
                    value={customHelpMessage}
                    onChange={(e) => setCustomHelpMessage(e.target.value)}
                    placeholder="Describe your inquiry (e.g. I need help with my MTH 201 assignment due this Friday)..."
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-orange-500"
                    required
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Directly routes to verified EduReach coordinators</span>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{helpSent ? 'Opening WhatsApp...' : 'Send Inquiry'}</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* TAB 3: FAQS & KNOWLEDGE BASE */}
          {activeSubTab === 'faq' && (
            <div className="space-y-3">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-900">Frequently Asked Questions</h3>
                <p className="text-xs text-slate-500">Quick answers regarding EduReach Hub services and academic operations.</p>
              </div>

              {faqs.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                    className="w-full p-4 text-left flex items-center justify-between text-xs font-bold text-slate-900 hover:bg-slate-100/60 cursor-pointer"
                  >
                    <span>{item.q}</span>
                    {openFaqIndex === idx ? (
                      <ChevronUp className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    )}
                  </button>
                  {openFaqIndex === idx && (
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3 bg-white">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
