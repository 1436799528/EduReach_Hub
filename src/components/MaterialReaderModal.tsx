import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  BookOpen, 
  Award, 
  HelpCircle, 
  FileText, 
  DownloadCloud, 
  Share2, 
  CheckCircle2, 
  Check, 
  ArrowRight, 
  RotateCcw, 
  Sun, 
  Moon, 
  Coffee, 
  Maximize2, 
  Clock, 
  Printer, 
  ChevronRight, 
  Calculator, 
  Play,
  Lock,
  StickyNote,
  Trash2,
  Copy,
  Edit2,
  BookmarkCheck,
  Sparkles,
  Plus
} from 'lucide-react';
import { StudyMaterial, CBTQuestion, UserProfile, MaterialNote } from '../types';
import { 
  generateWhatsAppShareLink, 
  saveMaterialNoteToProfile, 
  deleteMaterialNoteFromProfile, 
  getStoredUserProfile 
} from '../services/storage';
import { syncMaterialNoteToBackend, deleteMaterialNoteFromBackend } from '../lib/userFeatures';

interface MaterialReaderModalProps {
  material: StudyMaterial;
  user?: UserProfile;
  isSavedOffline?: boolean;
  onToggleOffline?: (id: string) => void;
  onUnlock?: () => void;
  onOpenTopUp?: () => void;
  onClose: () => void;
  onUpdateUser?: (updated: Partial<UserProfile>) => void;
}

export const MaterialReaderModal: React.FC<MaterialReaderModalProps> = ({
  material,
  user,
  isSavedOffline = false,
  onToggleOffline,
  onUnlock,
  onOpenTopUp,
  onClose,
  onUpdateUser
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'formulas' | 'worked' | 'cbt' | 'notes'>('summary');
  const [theme, setTheme] = useState<'day' | 'night' | 'sepia'>('day');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Quick Notes State
  const [notes, setNotes] = useState<MaterialNote[]>(() => {
    const userNotes = user?.materialNotes || getStoredUserProfile().materialNotes || [];
    return userNotes.filter((n) => n.materialId === material.id);
  });
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Synchronize when user profile materialNotes changes
  useEffect(() => {
    const userNotes = user?.materialNotes || getStoredUserProfile().materialNotes || [];
    setNotes(userNotes.filter((n) => n.materialId === material.id));
  }, [user?.materialNotes, material.id]);

  const handleSaveNote = async () => {
    const trimmed = newNoteContent.trim();
    if (!trimmed) return;

    setSaveStatus('saving');
    const newNote: MaterialNote = {
      id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      materialId: material.id,
      courseCode: material.courseCode,
      materialTitle: material.title,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    // 1. Save to local storage profile
    const updatedUser = saveMaterialNoteToProfile(newNote);

    // 2. Update local state immediately
    setNotes((prev) => [newNote, ...prev]);
    setNewNoteContent('');

    // 3. Notify parent app if callback provided
    if (onUpdateUser) {
      onUpdateUser({ materialNotes: updatedUser.materialNotes });
    }

    // 4. Sync to Supabase backend if user session exists
    if (user?.id) {
      try {
        await syncMaterialNoteToBackend(user.id, newNote);
      } catch (err) {
        console.warn('Backend note sync warning:', err);
      }
    }

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

  const handleUpdateNote = async (noteId: string) => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;

    const targetNote = notes.find((n) => n.id === noteId);
    if (!targetNote) return;

    const updatedNote: MaterialNote = {
      ...targetNote,
      content: trimmed,
      updatedAt: new Date().toISOString()
    };

    const updatedUser = saveMaterialNoteToProfile(updatedNote);
    setNotes((prev) => prev.map((n) => (n.id === noteId ? updatedNote : n)));
    setEditingNoteId(null);
    setEditingContent('');

    if (onUpdateUser) {
      onUpdateUser({ materialNotes: updatedUser.materialNotes });
    }

    if (user?.id) {
      try {
        await syncMaterialNoteToBackend(user.id, updatedNote);
      } catch (err) {
        console.warn('Backend note sync error:', err);
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const updatedUser = deleteMaterialNoteFromProfile(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));

    if (onUpdateUser) {
      onUpdateUser({ materialNotes: updatedUser.materialNotes });
    }

    if (user?.id) {
      try {
        await deleteMaterialNoteFromBackend(user.id, noteId);
      } catch (err) {
        console.warn('Backend note delete error:', err);
      }
    }
  };

  const handleCopyNote = (noteId: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedNoteId(noteId);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleInsertTag = (tag: string) => {
    setNewNoteContent((prev) => (prev ? `${prev} [${tag}] ` : `[${tag}] `));
    noteTextareaRef.current?.focus();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // CBT Exam State
  const [cbtAnswers, setCbtAnswers] = useState<Record<string, number>>({});
  const [cbtSubmitted, setCbtSubmitted] = useState(false);
  const [cbtScore, setCbtScore] = useState(0);

  const handleCbtSelect = (questionId: string, optionIdx: number) => {
    if (cbtSubmitted) return;
    setCbtAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  const handleCbtSubmit = () => {
    if (!material.cbtQuestions) return;
    let score = 0;
    material.cbtQuestions.forEach(q => {
      if (cbtAnswers[q.id] === q.correctAnswer) {
        score++;
      }
    });
    setCbtScore(score);
    setCbtSubmitted(true);
  };

  const handleCbtReset = () => {
    setCbtAnswers({});
    setCbtSubmitted(false);
    setCbtScore(0);
  };

  const getThemeStyles = () => {
    switch (theme) {
      case 'night':
        return 'bg-slate-900 text-slate-100 border-slate-800';
      case 'sepia':
        return 'bg-[#fbf0d9] text-[#433422] border-[#e6d5b8]';
      case 'day':
      default:
        return 'bg-white text-slate-900 border-slate-200';
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-xs leading-relaxed';
      case 'lg': return 'text-base leading-loose';
      case 'base':
      default: return 'text-sm leading-relaxed';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="material-reader-modal"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden ${getThemeStyles()}`}
      >
        
        {/* Modal Top Bar */}
        <div className="p-3 sm:p-4 border-b flex items-center justify-between gap-2 bg-slate-950 text-white">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold whitespace-nowrap">
              {material.institutionId} • {material.level}
            </span>
            <div className="truncate">
              <h2 className="text-sm font-bold truncate text-white">
                {material.courseCode}: {material.title}
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                {material.department} — {material.academicSession}
              </p>
            </div>
          </div>

          {/* Reader Controls: Theme, Font Size, Offline, Share */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            
            {/* Theme switcher */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button 
                onClick={() => setTheme('day')}
                className={`p-1.5 rounded-md ${theme === 'day' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Day Mode (Clean White)"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setTheme('sepia')}
                className={`p-1.5 rounded-md ${theme === 'sepia' ? 'bg-amber-800 text-amber-200' : 'text-slate-400 hover:text-white'}`}
                title="Sepia Mode (Eye Relaxing)"
              >
                <Coffee className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setTheme('night')}
                className={`p-1.5 rounded-md ${theme === 'night' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                title="Night Mode (Dark)"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font size */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
              <button 
                onClick={() => setFontSize('sm')} 
                className={`px-2 py-1 rounded ${fontSize === 'sm' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                A-
              </button>
              <button 
                onClick={() => setFontSize('base')} 
                className={`px-2 py-1 rounded ${fontSize === 'base' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                A
              </button>
              <button 
                onClick={() => setFontSize('lg')} 
                className={`px-2 py-1 rounded ${fontSize === 'lg' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                A+
              </button>
            </div>

            {/* Quick Notes */}
            <button
              onClick={() => setActiveTab('notes')}
              className={`p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs ${
                activeTab === 'notes'
                  ? 'bg-amber-600 border-amber-500 text-white font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Quick Notes for this Material"
            >
              <StickyNote className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Quick Notes</span>
              {notes.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 font-bold text-[10px]">
                  {notes.length}
                </span>
              )}
            </button>

            {/* Offline Save */}
            <button
              onClick={() => onToggleOffline(material.id)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isSavedOffline 
                  ? 'bg-emerald-600 border-emerald-500 text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={isSavedOffline ? 'Saved Offline' : 'Save for Offline Use'}
            >
              <DownloadCloud className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 sm:px-4 py-2 border-b bg-slate-100 dark:bg-slate-950/60 overflow-x-auto scrollbar-thin">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'summary'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Core Summary & Notes</span>
          </button>

          {material.formulas && material.formulas.length > 0 && (
            <button
              onClick={() => setActiveTab('formulas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'formulas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Formulas & Cheat Sheet ({material.formulas.length})</span>
            </button>
          )}

          {material.workedQuestions && material.workedQuestions.length > 0 && (
            <button
              onClick={() => setActiveTab('worked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'worked'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Worked Past Questions ({material.workedQuestions.length})</span>
            </button>
          )}

          {material.cbtQuestions && material.cbtQuestions.length > 0 && (
            <button
              onClick={() => setActiveTab('cbt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'cbt'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Timed CBT Practice ({material.cbtQuestions.length} Qs)</span>
            </button>
          )}

          {/* Quick Notes Tab */}
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'notes'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-300" />
            <span>Quick Notes {notes.length > 0 ? `(${notes.length})` : ''}</span>
          </button>
        </div>

        {/* Tab Body Content Area */}
        <div className={`p-4 sm:p-6 overflow-y-auto flex-1 ${getFontSizeClass()}`}>
          
          {/* TAB 1: Core Summary & Notes */}
          {activeTab === 'summary' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Executive Summary Box */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300 mb-2 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Syllabus Summary & Examination Scope</span>
                </div>
                <p className="leading-relaxed opacity-95">
                  {material.summary}
                </p>
              </div>

              {/* High-Yield Key Concepts */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-90">
                  Key Concepts to Master Before Exam Day:
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {material.coreConcepts.map((concept, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-xl border bg-slate-500/5 flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-medium">{concept}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Academic Study Notes */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider mb-3 opacity-90">
                  Lecture Summaries & Analysis:
                </h3>
                <div className="p-4 rounded-xl border bg-slate-500/5 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                  {material.fullTextContent}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: Formulas & Cheat Sheet */}
          {activeTab === 'formulas' && material.formulas && (
            <div className="space-y-4 animate-fadeIn">
              <div className="mb-4">
                <h3 className="font-bold text-base mb-1">
                  High-Yield Formula & Rule Sheet
                </h3>
                <p className="text-xs opacity-75">
                  Memorize these core formulas, theorems, and rules for quick recall during exams.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {material.formulas.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm">
                        {item.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 font-bold">
                        Formula #{idx + 1}
                      </span>
                    </div>
                    <div className="bg-slate-900 text-emerald-400 font-mono text-sm sm:text-base p-3 rounded-lg border border-slate-800 shadow-inner mb-2">
                      {item.formula}
                    </div>
                    <p className="text-xs opacity-80 italic">
                      💡 Application Note: {item.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Worked Past Questions & Step-by-Step Solutions */}
          {activeTab === 'worked' && material.workedQuestions && (
            <div className="space-y-6 animate-fadeIn">
              <div className="mb-2">
                <h3 className="font-bold text-base mb-1">
                  Step-by-Step Solved Past Questions
                </h3>
                <p className="text-xs opacity-75">
                  Extracted from actual past degree examinations with full marking scheme breakdowns.
                </p>
              </div>

              {material.workedQuestions.map((q, idx) => (
                <div 
                  key={idx}
                  className="p-5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-500/5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-md bg-indigo-600 text-white font-bold text-xs">
                      {q.questionNumber} ({q.year})
                    </span>
                    <span className="text-[11px] font-semibold opacity-75">
                      Verified Senate Standard
                    </span>
                  </div>

                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl font-medium">
                    <p className="leading-relaxed">
                      {q.questionText}
                    </p>
                  </div>

                  {/* Step-by-Step Solution */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2 text-indigo-700 dark:text-indigo-300">
                      Step-by-Step Mathematical & Analytical Derivation:
                    </h4>
                    <div className="space-y-2">
                      {q.stepByStepSolution.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-start gap-2 text-xs">
                          <span className="font-bold text-emerald-600 flex-shrink-0">›</span>
                          <p className="font-mono">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Key Takeaway */}
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                    <span className="font-bold text-amber-800 dark:text-amber-300 mr-1">
                      ⭐ Examiner's Key Takeaway:
                    </span>
                    <span>{q.keyTakeaway}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Interactive CBT Practice Exam */}
          {activeTab === 'cbt' && material.cbtQuestions && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* CBT Header with Score */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div>
                  <h3 className="font-bold text-sm text-purple-900 dark:text-purple-200">
                    CBT Exam Simulator: {material.courseCode}
                  </h3>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Select the best option for each question and submit to see your instant score & explanation.
                  </p>
                </div>

                {cbtSubmitted && (
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-purple-600 dark:text-purple-300">
                      {cbtScore} / {material.cbtQuestions.length}
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600">
                      {Math.round((cbtScore / material.cbtQuestions.length) * 100)}% Pass Rate
                    </span>
                  </div>
                )}
              </div>

              {/* CBT Questions List */}
              <div className="space-y-4">
                {material.cbtQuestions.map((q, qIdx) => {
                  const selectedOpt = cbtAnswers[q.id];
                  const isCorrect = selectedOpt === q.correctAnswer;

                  return (
                    <div 
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-500/5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs">
                          Question {qIdx + 1}:
                        </span>
                        {q.year && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-500/20">
                            {q.year}
                          </span>
                        )}
                      </div>

                      <p className="font-medium text-sm">
                        {q.question}
                      </p>

                      {/* Options */}
                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => {
                          const isSelected = selectedOpt === optIdx;
                          let optStyle = 'border-slate-300 dark:border-slate-700 hover:bg-slate-500/10';

                          if (cbtSubmitted) {
                            if (optIdx === q.correctAnswer) {
                              optStyle = 'bg-emerald-500/20 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold';
                            } else if (isSelected) {
                              optStyle = 'bg-rose-500/20 border-rose-500 text-rose-800 dark:text-rose-300 font-bold';
                            }
                          } else if (isSelected) {
                            optStyle = 'bg-purple-600 text-white font-bold border-purple-600';
                          }

                          return (
                            <button
                              key={optIdx}
                              onClick={() => handleCbtSelect(q.id, optIdx)}
                              className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center gap-2.5 ${optStyle}`}
                            >
                              <span className="w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation if submitted */}
                      {cbtSubmitted && (
                        <div className="p-3 rounded-lg bg-slate-900 text-slate-200 text-xs border border-slate-800 mt-2">
                          <span className="font-bold text-emerald-400 mr-1">
                            {isCorrect ? '✅ Correct Answer!' : '❌ Incorrect!'} Explanation:
                          </span>
                          <span>{q.explanation}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit & Reset Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {!cbtSubmitted ? (
                  <button
                    onClick={handleCbtSubmit}
                    disabled={Object.keys(cbtAnswers).length === 0}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-md"
                  >
                    Submit Exam & View Detailed Solutions
                  </button>
                ) : (
                  <button
                    onClick={handleCbtReset}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Retake CBT Practice Exam</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Quick Notes & Study Memos */}
          {activeTab === 'notes' && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Header Info Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-600 text-white text-[11px] font-bold">
                      {material.courseCode} Memo Desk
                    </span>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      Personal Study Notes & Memos
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                    Jot down short memos, exam reminders, and page takeaways. Memos are linked to this material and saved directly to your profile.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200">
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{notes.length} Memo{notes.length === 1 ? '' : 's'} Saved</span>
                  </span>
                </div>
              </div>

              {/* Note Composer Card */}
              <div className="p-4 sm:p-5 rounded-2xl border border-slate-300 dark:border-slate-800 bg-slate-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="quick-memo-input" className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Jot Down a New Memo</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {newNoteContent.length}/600 chars
                  </span>
                </div>

                {/* Quick Tag Helpers */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Insert tag:</span>
                  {[
                    { label: 'Exam Tip', tag: 'Exam Tip' },
                    { label: 'Formula', tag: 'Formula Rule' },
                    { label: 'Definition', tag: 'Core Definition' },
                    { label: 'Past Q Ref', tag: 'Past Q Ref' },
                    { label: 'Page Ref', tag: 'Page Ref' },
                  ].map((item) => (
                    <button
                      key={item.tag}
                      type="button"
                      onClick={() => handleInsertTag(item.tag)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300 transition-colors border border-transparent hover:border-amber-500/30 cursor-pointer"
                    >
                      + {item.label}
                    </button>
                  ))}
                </div>

                {/* Memo Textarea */}
                <textarea
                  id="quick-memo-input"
                  ref={noteTextareaRef}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value.slice(0, 600))}
                  placeholder="e.g. Remember to review Section 3 derivation on page 18 — Lecturer specifically highlighted this for continuous assessment..."
                  rows={3}
                  className="w-full text-xs sm:text-sm p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all resize-y"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveNote();
                    }
                  }}
                />

                {/* Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Tip: Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Ctrl+Enter</kbd> to save
                  </span>

                  <div className="flex items-center gap-2 ml-auto">
                    {saveStatus === 'saved' && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg animate-in fade-in">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Saved to Profile!</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={!newNoteContent.trim() || saveStatus === 'saving'}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{saveStatus === 'saving' ? 'Saving...' : 'Save Memo to Profile'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Existing Notes List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Saved Memos for {material.courseCode} ({notes.length})
                  </h3>
                  {notes.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Synchronized with your account
                    </span>
                  )}
                </div>

                {notes.length === 0 ? (
                  <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-500/5 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                      <StickyNote className="w-6 h-6" />
                    </div>
                    <div className="space-y-1 max-w-sm mx-auto">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Study Memos Yet
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Jot down exam formulas, revision questions, or key lecturer hints above. Your memos remain saved to your profile even when you close the reader.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => noteTextareaRef.current?.focus()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Write First Memo</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note, idx) => {
                      const isEditing = editingNoteId === note.id;
                      const formattedDate = new Date(note.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      });
                      const formattedTime = new Date(note.createdAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div
                          key={note.id}
                          className="p-4 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-2xs space-y-2.5 transition-all"
                        >
                          {/* Note Card Header */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                                {notes.length - idx}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                Memo #{notes.length - idx}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {formattedDate} at {formattedTime}
                              </span>
                              {note.updatedAt && (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                                  (Edited)
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleCopyNote(note.id, note.content)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Copy memo text"
                              >
                                {copiedNoteId === note.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {!isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingContent(note.content);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Edit memo"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Cancel editing"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Delete memo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Note Content / Editing */}
                          {isEditing ? (
                            <div className="space-y-2 pt-1">
                              <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                rows={3}
                                className="w-full text-xs p-2.5 rounded-xl border border-amber-400 bg-amber-50/20 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateNote(note.id)}
                                  className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed opacity-95">
                              {note.content}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="p-3 sm:p-4 border-t flex items-center justify-between gap-2 bg-slate-500/5">
          <div className="flex items-center gap-2 text-xs opacity-75">
            <span>Verified Study Material • {material.pageCount} Pages</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const url = generateWhatsAppShareLink(material);
                window.open(url, '_blank');
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to WhatsApp</span>
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold transition-colors"
            >
              Done Reading
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
