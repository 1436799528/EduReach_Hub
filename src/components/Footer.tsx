import React, { useState } from 'react';
import { 
  GraduationCap, 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Phone, 
  Mail, 
  Clock, 
  ShieldCheck, 
  BookOpen, 
  Briefcase, 
  Coins, 
  FileText, 
  Building, 
  Scale, 
  Award, 
  CheckCircle2, 
  ExternalLink,
  Users,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { FAQ_ITEMS, INSTITUTIONS } from '../data/mockData';
import { FAQItem } from '../types';

interface FooterProps {
  onNavigateToTab?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth?: (mode?: 'login' | 'register', message?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ 
  onNavigateToTab,
  onOpenAuth
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-adm-1');

  const WHATSAPP_NUMBER = '2349130134969'; // 09130134969
  const EMAIL_CONTACT = 'support@edureachhub.ng';

  const categories = [
    { id: 'ALL', label: 'All School Questions', icon: HelpCircle },
    { id: 'admissions', label: 'Admissions & JAMB CAPS', icon: GraduationCap },
    { id: 'transcripts', label: 'Transcripts & Clearance', icon: FileText },
    { id: 'nelfund', label: 'NELFUND Student Loan', icon: Coins },
    { id: 'academics', label: 'CGPA & Carryovers', icon: BookOpen },
    { id: 'fees_hostels', label: 'Hostels & Remita Fees', icon: Building },
    { id: 'regulations', label: 'Senate Rules & Rights', icon: Scale },
  ];

  const filteredFaqs = FAQ_ITEMS.filter((faq) => {
    if (selectedCategory !== 'ALL' && faq.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.keywords.some((k) => k.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const handleAskModeratorWhatsApp = (questionContext?: string) => {
    const text = questionContext
      ? `Hello EduReach Moderator! 🎓\nI need academic guidance on the following inquiry:\n\n❓ *Question:* ${questionContext}\n\nPlease advise me on the official procedure.`
      : `Hello EduReach Moderator! 🎓\nI have an academic or campus registry concern. Could you please connect me with a student advisor or on-ground campus liaison?`;
    
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const moderatorsList = [
    {
      role: 'Chief Senate & Registry Liaison',
      name: 'Comrade Daniel O. (UNICAL Desk)',
      focus: 'Transcripts, Statement of Results, JAMB CAPS',
      status: 'Online & Available',
      badgeColor: 'bg-emerald-500'
    },
    {
      role: 'NELFUND & Scholarship Advisor',
      name: 'Barr. Aisha Bello (ABU / North Desk)',
      focus: 'Student Loan Audits, NIN & Admission Matching',
      status: 'Online & Available',
      badgeColor: 'bg-blue-500'
    },
    {
      role: 'Academic & Research Coordinator',
      name: 'Dr. Adeyemi K. (UNILAG / UI Desk)',
      focus: 'Coursework Guidance, SPSS Analysis, Defense Prep',
      status: 'Online & Available',
      badgeColor: 'bg-purple-500'
    }
  ];

  return (
    <footer className="w-full bg-slate-900 text-slate-200 border-t border-slate-800 selection:bg-orange-500 selection:text-white">
      
      {/* ========================================================================= */}
      {/* 1. COMPREHENSIVE ACADEMIC FAQ SECTION                                     */}
      {/* ========================================================================= */}
      <div id="student-academic-faq" className="py-14 sm:py-20 border-b border-slate-800 bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-3.5 h-3.5 text-orange-400" />
              <span>Student Knowledge Base & Academic Help</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Addressed Student Concerns
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
              Curated, authoritative answers to common Nigerian university dilemmas — from JAMB CAPS regularization and fast-track transcripts to NELFUND loan audits, CGPA calculations, and missing grade petitions.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
            <input
              type="text"
              placeholder="Search any school problem (e.g. transcript, carryover, NELFUND, CAPS, Remita)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all shadow-inner"
            />
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center justify-center flex-wrap gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-orange-600 text-white shadow-xs border border-orange-500'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-3 max-w-4xl mx-auto">
            {filteredFaqs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
                <p className="text-slate-400 text-xs sm:text-sm">
                  No specific FAQ matches your query "<span className="text-white font-semibold">{searchQuery}</span>".
                </p>
                <button
                  onClick={() => handleAskModeratorWhatsApp(searchQuery)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Ask a Moderator on WhatsApp</span>
                </button>
              </div>
            ) : (
              filteredFaqs.slice(0, 10).map((faq: FAQItem) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isOpen
                        ? 'bg-slate-900/90 border-orange-500/50 shadow-md'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      className="w-full p-4 sm:p-5 text-left flex items-start justify-between gap-4 cursor-pointer focus:outline-hidden"
                    >
                      <span className={`text-xs sm:text-sm font-bold leading-snug ${isOpen ? 'text-orange-400' : 'text-slate-200'}`}>
                        {faq.question}
                      </span>
                      <div className="shrink-0 mt-0.5 p-1 rounded-lg bg-slate-800 text-slate-400">
                        {isOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-orange-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-slate-800/80 space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed animate-in fade-in duration-200">
                        <p>{faq.answer}</p>
                        
                        <div className="pt-2 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => handleAskModeratorWhatsApp(faq.question)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold transition-colors cursor-pointer border border-emerald-500/30"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Ask Moderator about this (09130134969)</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick FAQ Footer Call to Action */}
          <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span>Have an unlisted departmental problem or grievance?</span>
              </h4>
              <p className="text-slate-400 text-xs">
                Our campus senate moderators provide confidential advice and official procedure roadmaps.
              </p>
            </div>
            <button
              onClick={() => handleAskModeratorWhatsApp()}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask Moderator (09130134969)</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MODERATORS & CAMPUS LIAISON CONTACT DESKS                             */}
      {/* ========================================================================= */}
      <div className="py-12 sm:py-16 border-b border-slate-800 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
              <Users className="w-3.5 h-3.5 text-orange-500" />
              <span>Campus Advisory & Moderator Network</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Official Moderator Contacts & Support Desks
            </h3>
            <p className="text-slate-400 text-xs sm:text-sm max-w-xl">
              Get in touch with assigned departmental and registry liaisons stationed across top Nigerian federal and state universities.
            </p>
          </div>

          {/* Direct Hotline Badge */}
          <div className="flex items-center gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                Direct WhatsApp & Call
              </span>
              <span className="font-mono text-sm sm:text-base font-black text-white">
                09130134969
              </span>
            </div>
          </div>
        </div>

        {/* 3 Dedicated Moderator Desks */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {moderatorsList.map((mod, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                    {mod.role}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${mod.badgeColor} animate-pulse`} />
                    <span>{mod.status}</span>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-white">{mod.name}</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong className="text-slate-300">Specialization:</strong> {mod.focus}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hello ${mod.name}! I need assistance regarding ${mod.focus}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Connect on WhatsApp</span>
                </a>
                <span className="text-[11px] text-slate-500 font-mono">24/7 Queue</span>
              </div>
            </div>
          ))}
        </div>

        {/* Operational Info & Response SLAs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Operating Hours</span>
              <span className="text-slate-400">Mon – Sat: 8:00 AM – 10:00 PM (WAT)</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <Mail className="w-5 h-5 text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Moderator Email Desk</span>
              <span className="text-slate-400">{EMAIL_CONTACT}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-white block">Senate Accreditation</span>
              <span className="text-slate-400">Zero tolerance for academic fraud</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. PLATFORM NAVIGATION, CAMPUS DIRECTORY & COPYRIGHT                      */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Brand & Bio */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
                <GraduationCap className="w-4 h-4" />
              </div>
              <span className="text-lg font-black text-white tracking-tight">
                EDUREACH <span className="text-orange-500">HUB</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nigeria’s trusted university academic ecosystem. Access verified past questions, course summaries, peer resource sharing, and on-ground campus liaison services.
            </p>
            <div className="pt-1 flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Serving 12+ Nigerian Universities</span>
            </div>
          </div>

          {/* Col 2: Core Platform Navigation */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-slate-200 tracking-wider">
              Student Modules
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  onClick={() => onNavigateToTab ? onNavigateToTab('my_school') : null}
                  className="hover:text-orange-400 transition-colors text-left cursor-pointer"
                >
                  My School Study Vault (Past Questions & CBT)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateToTab ? onNavigateToTab('services') : null}
                  className="hover:text-orange-400 transition-colors text-left cursor-pointer"
                >
                  Campus Services Desk (PINs & Transcripts)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateToTab ? onNavigateToTab('feed') : null}
                  className="hover:text-orange-400 transition-colors text-left cursor-pointer"
                >
                  Student Resource Feed (Upload & Royalties)
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigateToTab ? onNavigateToTab('profile') : null}
                  className="hover:text-orange-400 transition-colors text-left cursor-pointer"
                >
                  Scholar Dashboard & Settings
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Popular Institutions */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-slate-200 tracking-wider">
              Campus Hubs
            </h4>
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-400">
              {INSTITUTIONS.slice(0, 8).map(inst => (
                <li key={inst.id} className="hover:text-white transition-colors cursor-pointer truncate">
                  • {inst.shortName}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Rapid Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase text-slate-200 tracking-wider">
              Direct Contact
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p>
                <strong className="text-slate-300">WhatsApp Desk:</strong> 09130134969
              </p>
              <p>
                <strong className="text-slate-300">Email:</strong> {EMAIL_CONTACT}
              </p>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello EduReach Hub! I need assistance.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Instant WhatsApp Liaison</span>
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & Terms */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} EduReach Hub Nigeria. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="hover:text-slate-300 cursor-pointer">Academic Integrity Policy</span>
            <span className="hover:text-slate-300 cursor-pointer">Fair Royalty Guidelines</span>
            <span className="hover:text-slate-300 cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-300 cursor-pointer">Privacy Policy</span>
          </div>
        </div>

      </div>

    </footer>
  );
};
