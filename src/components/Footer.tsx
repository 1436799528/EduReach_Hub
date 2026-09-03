import React from 'react';
import { MessageSquare, ShieldCheck, Users } from 'lucide-react';

interface FooterProps {
  onNavigateToTab?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth?: (mode?: 'login' | 'register', message?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateToTab, onOpenAuth }) => {
  const askModerator = (context?: string) => {
    const text = context
      ? `Hello EduReach Moderator! I need assistance regarding: ${context}`
      : 'Hello EduReach Moderator! I need help with an academic or campus matter.';
    if (onOpenAuth && !localStorage.getItem('edureach_is_logged_in')) {
      onOpenAuth('register', 'Create a free account to contact the moderator desk.');
      return;
    }
    window.open(`https://wa.me/2349130134969?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <footer className="w-full bg-slate-950 text-white border-t border-slate-800">
      {/* Quick Moderator Support Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/60 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-center md:text-left">
            <div className="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">Need Immediate Help From a Campus Moderator?</h4>
              <p className="text-xs text-slate-400">Direct assistance for past questions, clearance, and registry issues.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => askModerator('General Campus Support')}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat Moderator on WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="py-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white font-extrabold shadow-sm">
                ER
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">EduReach Hub</span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Empowering Nigerian tertiary students with verified past questions, lecture summaries, timed CBT practice, and on-ground campus assistance.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Across 45+ Nigerian Universities</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quick Navigation</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('my_school')}
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                >
                  Past Questions &amp; Notes
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('services')}
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                >
                  Campus Desk Services
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigateToTab?.('feed')}
                  className="hover:text-orange-400 transition-colors cursor-pointer"
                >
                  Campus Feed &amp; Updates
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Moderator Desks</h5>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={() => askModerator('Registry & Transcripts')}
                  className="hover:text-emerald-400 transition-colors text-left cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3 h-3 text-emerald-500" />
                  <span>Registry &amp; Transcripts Desk</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => askModerator('JAMB CAPS & Admissions')}
                  className="hover:text-emerald-400 transition-colors text-left cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3 h-3 text-emerald-500" />
                  <span>JAMB CAPS &amp; Admissions</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => askModerator('NELFUND Student Loan')}
                  className="hover:text-emerald-400 transition-colors text-left cursor-pointer flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3 h-3 text-emerald-500" />
                  <span>NELFUND Loan Support</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} EduReach Hub. Built for Nigerian University Scholars.</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenAuth?.('register')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Student Sign Up
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth?.('login')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

