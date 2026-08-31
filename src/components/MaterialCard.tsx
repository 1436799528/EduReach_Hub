import React from 'react';
import { CheckCircle, Star, DownloadCloud, Share2, Eye, Check, Play, Lock } from 'lucide-react';
import { StudyMaterial, UserProfile } from '../types';
import { generateWhatsAppShareLink } from '../services/storage';

interface MaterialCardProps {
  material: StudyMaterial;
  user?: UserProfile;
  isUnlocked?: boolean;
  isOffline?: boolean;
  onRead?: (material: StudyMaterial) => void;
  onOpenReader?: (material: StudyMaterial) => void;
  onUnlock?: (material: StudyMaterial) => void;
  onUnlockMaterial?: (material: StudyMaterial) => void;
  onToggleOffline: (materialId: string) => void;
  onOpenCBT?: (material: StudyMaterial) => void;
}

export const MaterialCard: React.FC<MaterialCardProps> = ({
  material,
  user,
  isUnlocked: isUnlockedProp,
  isOffline: isOfflineProp,
  onRead,
  onOpenReader,
  onUnlock,
  onUnlockMaterial,
  onToggleOffline,
  onOpenCBT,
}) => {
  const isUnlocked = isUnlockedProp !== undefined
    ? isUnlockedProp
    : (material.unlockPrice === 0 || Boolean(user?.isAPlusSubscriber) || Boolean(user?.unlockedMaterialIds?.includes(material.id)));

  const isSavedOffline = isOfflineProp !== undefined
    ? isOfflineProp
    : Boolean(user?.savedOfflineMaterialIds?.includes(material.id));

  const handleRead = () => {
    if (!isUnlocked) {
      if (onUnlock) onUnlock(material);
      else if (onUnlockMaterial) onUnlockMaterial(material);
      return;
    }
    if (onRead) onRead(material);
    else if (onOpenReader) onOpenReader(material);
  };

  const handleUnlock = () => {
    if (onUnlock) onUnlock(material);
    else if (onUnlockMaterial) onUnlockMaterial(material);
  };

  const handleShareWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(generateWhatsAppShareLink(material), '_blank', 'noopener,noreferrer');
  };

  const getFormatBadge = (type: string) => {
    switch (type) {
      case 'past_question': return { label: 'Past Questions', bg: 'bg-orange-50 text-orange-800 border-orange-200' };
      case 'lecture_summary': return { label: 'Lecture Summary', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
      case 'handwritten_note': return { label: 'Scholar Handnotes', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
      case 'cbt_pack': return { label: 'CBT Exam Pack', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200' };
      case 'project_guide': return { label: 'Project Topic Guide', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
      default: return { label: 'Study Resource', bg: 'bg-slate-50 text-slate-800 border-slate-200' };
    }
  };

  const format = getFormatBadge(material.materialType);

  return (
    <div id={`material-card-${material.id}`} className="bg-white rounded-2xl border border-slate-200 hover:border-orange-500/40 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-900 text-white flex items-center gap-1">
              <span>{material.institutionId}</span><span className="text-slate-400">•</span><span className="text-orange-400">{material.level}</span>
            </span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${format.bg}`}>{format.label}</span>
          </div>
          {material.isVerified && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200" title="Verified by EduReach Academic Board">
              <CheckCircle className="w-3 h-3 text-emerald-600" /><span>Verified</span>
            </span>
          )}
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-orange-600 transition-colors line-clamp-2">{material.title}</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">{material.courseCode} • {material.courseTitle}</p>
        </div>
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mt-2.5">{material.summary}</p>
      </div>

      <div className="p-5 pt-3 mt-1 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between mb-3 text-xs">
          <div className="flex items-center gap-2">
            <img src={material.uploader.avatar} alt={material.uploader.name} className="w-6 h-6 rounded-full object-cover border border-slate-200" referrerPolicy="no-referrer" />
            <div><p className="text-[11px] font-bold text-slate-800 leading-tight">{material.uploader.name}</p><span className="text-[9px] text-slate-500 font-medium">{material.uploader.badge}</span></div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><span className="flex items-center text-amber-600 font-bold"><Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-0.5" />{material.rating}</span><span>•</span><span>{material.unlockCount} unlocks</span></div>
        </div>

        {!isUnlocked && (
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            <span>Sign in or unlock to read this resource.</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button id={`read-btn-${material.id}`} onClick={isUnlocked ? handleRead : handleUnlock} className={`flex-1 py-2.5 px-3 rounded-xl text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${isUnlocked ? 'bg-slate-900 hover:bg-slate-800' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {isUnlocked ? <Eye className="w-3.5 h-3.5 text-orange-400" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{isUnlocked ? 'Read Study Pack' : material.unlockPrice > 0 ? `Unlock • ₦${material.unlockPrice}` : 'Sign in to Access'}</span>
          </button>

          {material.cbtQuestions && material.cbtQuestions.length > 0 && onOpenCBT && (
            <button id={`cbt-btn-${material.id}`} onClick={() => onOpenCBT(material)} className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 transition-colors border border-slate-300 text-xs font-bold flex items-center shadow-xs cursor-pointer" title="Practice CBT Exam Questions"><Play className="w-3.5 h-3.5 text-orange-600" /></button>
          )}

          <button id={`offline-btn-${material.id}`} onClick={() => onToggleOffline(material.id)} className={`p-2.5 rounded-xl transition-colors border text-xs font-semibold shadow-xs cursor-pointer ${isSavedOffline ? 'bg-orange-50 border-orange-300 text-orange-800' : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600'}`} title={isSavedOffline ? 'Saved in Offline Vault' : 'Save for offline reading'}>
            {isSavedOffline ? <Check className="w-3.5 h-3.5 text-orange-600" /> : <DownloadCloud className="w-3.5 h-3.5 text-slate-500" />}
          </button>

          <button id={`share-btn-${material.id}`} onClick={handleShareWhatsApp} className="p-2.5 rounded-xl bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 transition-colors shadow-xs cursor-pointer" title="Share to WhatsApp study group"><Share2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
};
