import React, { useState } from 'react';
import { FAQItem } from '../types';
import { FAQ_ITEMS } from '../data/mockData';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  MessageSquare, 
  ExternalLink, 
  ShieldAlert, 
  GraduationCap, 
  FileText, 
  Coins, 
  BookOpen, 
  Building, 
  Scale,
  PhoneCall,
  Sparkles
} from 'lucide-react';

interface FAQSectionProps {
  onDirectWhatsApp?: (customQuestion?: string) => void;
}

export const FAQSection: React.FC<FAQSectionProps> = ({ onDirectWhatsApp }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-adm-1');

  const WHATSAPP_NUMBER = '2349130134969'; // 09130134969

  const categories = [
    { id: 'ALL', label: 'All School Questions', icon: HelpCircle },
    { id: 'admissions', label: 'Admissions & JAMB', icon: GraduationCap },
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

  const handleAskAdminWhatsApp = (questionContext?: string) => {
    const text = questionContext
      ? `Hello Admin/Moderator! 🎓\nI need clarification on the following academic problem:\n\n❓ *Question:* ${questionContext}\n\nPlease assist me with verified campus guidance.`
      : `Hello Admin/Moderator! 🎓\nI have an academic issue not listed in the FAQ. Could you please connect me with a student advisor or on-ground registry liaison?`;
    
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="faq-section" className="py-16 bg-white border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Section Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            Comprehensive Student Knowledge Base
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked School Questions & Solutions
          </h2>
          <p className="text-slate-600 text-base max-w-2xl mx-auto">
            Clear, authoritative answers to everyday Nigerian university challenges — from JAMB CAPS issues and transcripts to NELFUND verification and CGPA computation.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
          <input
            type="text"
            placeholder="Search any school problem (e.g. transcript, carryover, NELFUND, CAPS, Remita, missing result)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-xs"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center justify-center flex-wrap gap-2">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {filteredFaqs.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-orange-500 mx-auto" />
              <h4 className="text-base font-bold text-slate-800">No exact FAQ matched your search</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Don't worry! Our on-ground campus moderators and student advisors are available live on WhatsApp to resolve your specific school problem.
              </p>
              <button
                onClick={() => handleAskAdminWhatsApp(searchQuery)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                Ask a Moderator on WhatsApp (09130134969)
              </button>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className={`border rounded-2xl transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'border-orange-300 bg-orange-50/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 text-sm sm:text-base"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-orange-600' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-slate-700 text-sm leading-relaxed border-t border-orange-100/80 space-y-3 animate-in fade-in duration-150">
                      <p>{faq.answer}</p>
                      
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                        <div className="flex flex-wrap gap-1.5">
                          {faq.keywords.map((k) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]"
                            >
                              #{k}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() => handleAskAdminWhatsApp(faq.question)}
                          className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold text-xs transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Need help with this? Chat WhatsApp Desk
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Not Found / Direct to Admin Banner */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold tracking-wider uppercase border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Live Admin & Moderator Hotline
            </div>
            <h3 className="text-xl sm:text-2xl font-bold">
              Didn't find an answer to your school problem?
            </h3>
            <p className="text-slate-300 text-sm max-w-lg leading-relaxed">
              Connect directly with our senior institutional moderators and administrative desk on WhatsApp. We provide on-ground assistance for every Nigerian university.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
            <a
              href="https://wa.me/2349130134969"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all hover:translate-y-px"
            >
              <MessageSquare className="w-5 h-5 fill-slate-950" />
              WhatsApp (09130134969)
            </a>
          </div>
        </div>

      </div>
    </section>
  );
};
