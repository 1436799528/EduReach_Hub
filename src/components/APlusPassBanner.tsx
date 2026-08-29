import React from 'react';
import { 
  CheckCircle2, 
  Zap, 
  ShieldCheck, 
  DownloadCloud, 
  ArrowRight, 
  Award,
  X,
  BookOpen
} from 'lucide-react';
import { UserProfile } from '../types';

interface APlusPassModalProps {
  user: UserProfile;
  onActivatePass: () => void;
  onClose?: () => void;
  isModal?: boolean;
}

export const APlusPassBanner: React.FC<APlusPassModalProps> = ({
  user,
  onActivatePass,
  onClose,
  isModal = false
}) => {
  const content = (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
      
      {isModal && onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-500/20 text-orange-400 text-xs font-bold mb-3 border border-orange-500/30">
          <Award className="w-3.5 h-3.5" />
          <span>EDUREACH HUB • A+ ACADEMIC PASS</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2 leading-tight">
          Unlimited Access to All Solved Past Questions & Summaries
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm font-normal mb-6 max-w-xl leading-relaxed">
          One semester subscription unlocks every verified study pack, step-by-step past question solution, formula sheet, and offline CBT simulator across all universities.
        </p>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>15,000+ Worked Past Questions</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
            <DownloadCloud className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>Zero-Data Offline Vault Downloads</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>High-Yield Course Summaries</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs font-medium text-slate-200 bg-slate-800/80 border border-slate-700/80 p-3 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>Verified Solution Packs</span>
          </div>
        </div>

        {/* Price & CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-5 border-t border-slate-800">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Semester Plan (4 Months Access)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-white">₦1,500</span>
              <span className="text-xs text-slate-400">/ semester</span>
            </div>
          </div>

          {user?.isAPlusSubscriber ? (
            <div className="px-5 py-2.5 bg-orange-950 border border-orange-700 text-orange-300 rounded-xl font-bold text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-orange-400" />
              <span>A+ PASS ACTIVE ON YOUR ACCOUNT</span>
            </div>
          ) : (
            <button
              onClick={onActivatePass}
              className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Zap className="w-4 h-4" />
              <span>Activate A+ Pass (₦1,500)</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          {content}
        </div>
      </div>
    );
  }

  return content;
};
