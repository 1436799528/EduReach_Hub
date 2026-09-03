import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  UserCheck, 
  FileText, 
  CheckSquare, 
  History, 
  Send, 
  Award, 
  Building2, 
  BookOpen, 
  AlertCircle,
  MessageSquare,
  Edit3,
  ThumbsUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  StudyMaterial, 
  UserProfile, 
  VerificationStatus, 
  VerificationAuditLog, 
  VerificationChecklist 
} from '../types';

interface VerificationWorkflowModalProps {
  material: StudyMaterial;
  currentUser: UserProfile;
  onClose: () => void;
  onApprove: (materialId: string, notes: string, checklist: VerificationChecklist) => void;
  onRequestRevision: (materialId: string, reasonCategory: string, feedback: string, suggestedChanges: string[], checklist: VerificationChecklist) => void;
  onReject: (materialId: string, reasonCategory: string, notes: string, checklist: VerificationChecklist) => void;
  onAssignModerator: (materialId: string, moderator: { id: string; name: string; role: string; institution: string }) => void;
  onResubmitMaterial?: (materialId: string, resubmissionNotes: string) => void;
}

export const VerificationWorkflowModal: React.FC<VerificationWorkflowModalProps> = ({
  material,
  currentUser,
  onClose,
  onApprove,
  onRequestRevision,
  onReject,
  onAssignModerator,
  onResubmitMaterial,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'checklist' | 'audit_log'>('content');
  const [actionType, setActionType] = useState<'APPROVE' | 'REVISION' | 'REJECT' | null>(null);

  // Moderation Forms
  const [approvalNotes, setApprovalNotes] = useState('Approved by Senate Peer Review Board. Solved past questions comply fully with curriculum benchmarks.');
  const [revisionCategory, setRevisionCategory] = useState('Incomplete Worked Solutions');
  const [revisionFeedback, setRevisionFeedback] = useState('');
  const [revisionItems, setRevisionItems] = useState<string[]>([
    'Provide step-by-step working for numerical/syllogism questions',
    'Enhance formatting and formula legibility'
  ]);
  const [newRevisionItem, setNewRevisionItem] = useState('');

  const [rejectionCategory, setRejectionCategory] = useState('Legibility & Quality Standards');
  const [rejectionNotes, setRejectionNotes] = useState('');

  const [resubmissionNotes, setResubmissionNotes] = useState('');
  const [showResubmitSuccess, setShowResubmitSuccess] = useState(false);

  // Rubric Checklist State
  const [checklist, setChecklist] = useState<VerificationChecklist>({
    syllabusAlignment: true,
    solutionAccuracy: true,
    legibilityAndFormatting: true,
    originalityCheck: true,
    appropriatePricing: true,
    comments: ''
  });

  const isAssignedToCurrentUser = material.assignedModerator?.id === currentUser.id;
  const isUploader = material.uploader.id === currentUser.id;

  const handleAssignToMe = () => {
    onAssignModerator(material.id, {
      id: currentUser.id,
      name: currentUser.name,
      role: 'Senate Senior Moderator',
      institution: currentUser.institutionId
    });
  };

  const handleAddRevisionItem = () => {
    if (!newRevisionItem.trim()) return;
    setRevisionItems([...revisionItems, newRevisionItem.trim()]);
    setNewRevisionItem('');
  };

  const handleRemoveRevisionItem = (index: number) => {
    setRevisionItems(revisionItems.filter((_, i) => i !== index));
  };

  const handleApproveSubmit = () => {
    onApprove(material.id, approvalNotes, checklist);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    onClose();
  };

  const handleRevisionSubmit = () => {
    if (!revisionFeedback.trim() && revisionItems.length === 0) {
      alert('Please provide feedback or specific revision items for the student contributor.');
      return;
    }
    onRequestRevision(material.id, revisionCategory, revisionFeedback, revisionItems, checklist);
    onClose();
  };

  const handleRejectSubmit = () => {
    if (!rejectionNotes.trim()) {
      alert('Please provide a reason explaining the rejection decision.');
      return;
    }
    onReject(material.id, rejectionCategory, rejectionNotes, checklist);
    onClose();
  };

  const handleResubmitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onResubmitMaterial) {
      onResubmitMaterial(material.id, resubmissionNotes || 'Updated with requested step-by-step workings.');
      setShowResubmitSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const getStatusBadge = (status?: VerificationStatus) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Senate Verified & Approved</span>
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Revision Requested</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Rejected</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Under Review</span>
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Pending Assignment</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fadeIn">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-xs">
                {material.institutionId}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold text-xs">
                {material.courseCode}
              </span>
              {getStatusBadge(material.verificationStatus)}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">
              {material.title}
            </h2>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
              <span>Contributor: <strong className="text-white">{material.uploader.name}</strong> ({material.uploader.badge})</span>
              <span>Level: <strong className="text-white">{material.level}</strong></span>
              <span>Price: <strong className="text-emerald-400">₦{material.unlockPrice}</strong></span>
              <span>Session: <strong className="text-white">{material.academicSession}</strong></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Assigned Moderator Notice & Fast Claim Bar */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Assigned Moderator:{' '}
              {material.assignedModerator ? (
                <strong className="text-slate-900 font-bold">
                  {material.assignedModerator.name} ({material.assignedModerator.institution})
                </strong>
              ) : (
                <span className="text-slate-500 italic">Unassigned (In National Queue)</span>
              )}
            </span>
          </div>

          {!isAssignedToCurrentUser && (
            <button
              onClick={handleAssignToMe}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assign to Me</span>
            </button>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          <button
            onClick={() => { setActiveTab('content'); setActionType(null); }}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'content'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Document Content Inspector</span>
          </button>

          <button
            onClick={() => { setActiveTab('checklist'); setActionType(null); }}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Senate Quality Rubric</span>
          </button>

          <button
            onClick={() => { setActiveTab('audit_log'); setActionType(null); }}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'audit_log'
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Verification Audit Trail ({material.auditLogs?.length || 0})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* Uploader Revision Notification Banner */}
          {material.verificationStatus === 'REVISION_REQUESTED' && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Moderator Feedback & Required Changes:</span>
              </div>
              <p className="text-xs text-slate-800 bg-white/70 p-2.5 rounded-lg border border-amber-200 font-medium">
                "{material.moderationFeedback || 'Please update worked solutions and improve formatting.'}"
              </p>
              {material.revisionRequests && material.revisionRequests.length > 0 && (
                <ul className="text-xs text-slate-700 list-disc list-inside space-y-1 pt-1">
                  {material.revisionRequests.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              )}

              {/* Uploader Fast Resubmit Form */}
              <form onSubmit={handleResubmitSubmit} className="pt-2 border-t border-amber-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Notes on what you corrected (e.g. Added step 3 working)..."
                  value={resubmissionNotes}
                  onChange={(e) => setResubmissionNotes(e.target.value)}
                  className="flex-1 text-xs bg-white border border-amber-300 rounded-lg p-2 focus:ring-1 focus:ring-amber-500 font-medium"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Resubmit to Senate</span>
                </button>
              </form>

              {showResubmitSuccess && (
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Material resubmitted successfully to moderation queue!</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: Content Inspector */}
          {activeTab === 'content' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                  Document Executive Summary
                </h3>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed font-medium">
                  {material.summary}
                </div>
              </div>

              {/* Core Concepts */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                  Key Concepts & Topics Covered
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {material.coreConcepts.map((concept, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <span>{concept}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full Text / Worked Question Solutions Preview */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                  Full Notes / Worked Solutions Body
                </h3>
                <div className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                  {material.fullTextContent || material.summary}
                </div>
              </div>

              {/* Worked Questions if present */}
              {material.workedQuestions && material.workedQuestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                    Sample Exam Questions & Step-by-Step Proofs ({material.workedQuestions.length})
                  </h3>
                  <div className="space-y-3">
                    {material.workedQuestions.map((wq, i) => (
                      <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="font-bold text-slate-900 flex items-center justify-between">
                          <span>{wq.questionNumber} ({wq.year})</span>
                          <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-semibold">Verified Solution</span>
                        </div>
                        <div className="text-slate-800 font-medium">{wq.questionText}</div>
                        <div className="space-y-1 bg-white p-3 rounded-lg border border-slate-200 text-slate-700">
                          {wq.stepByStepSolution.map((step, sIdx) => (
                            <div key={sIdx}>{step}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Senate Rubric Checklist */}
          {activeTab === 'checklist' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>National Senate Verification Benchmark Rubric</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Assess the upload against the 5 national academic standards before rendering a moderation decision.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.syllabusAlignment}
                    onChange={(e) => setChecklist({ ...checklist, syllabusAlignment: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">1. Syllabus & Curriculum Alignment</div>
                    <div className="text-[11px] text-slate-500">Material reflects current NUC Core Curriculum & Minimum Academic Standards (CCMAS) for {material.level} {material.courseCode}.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.solutionAccuracy}
                    onChange={(e) => setChecklist({ ...checklist, solutionAccuracy: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">2. Step-by-Step Worked Solution Accuracy</div>
                    <div className="text-[11px] text-slate-500">Mathematical steps, formulas, legal case citations, and reasoning steps are accurate and verified.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.legibilityAndFormatting}
                    onChange={(e) => setChecklist({ ...checklist, legibilityAndFormatting: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">3. Legibility & Mobile Screen Readability</div>
                    <div className="text-[11px] text-slate-500">Text and diagrams are sharp, properly formatted, high-contrast, and easily readable on low-bandwidth phones.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.originalityCheck}
                    onChange={(e) => setChecklist({ ...checklist, originalityCheck: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">4. Originality & Plagiarism Free</div>
                    <div className="text-[11px] text-slate-500">Contributor authored summary notes or solved past questions without unauthorized copyright infringement.</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.appropriatePricing}
                    onChange={(e) => setChecklist({ ...checklist, appropriatePricing: e.target.checked })}
                    className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">5. Fair Student Pricing Cap</div>
                    <div className="text-[11px] text-slate-500">Unlock price (₦{material.unlockPrice}) complies with the national student micro-pricing ceiling (₦100 - ₦500).</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: Audit Trail Log */}
          {activeTab === 'audit_log' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-slate-500">
                  Verification History & Moderation Logs
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {material.auditLogs?.length || 0} Logged Actions
                </span>
              </div>

              <div className="space-y-3">
                {(!material.auditLogs || material.auditLogs.length === 0) ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                    No moderation actions logged yet. This material is in initial queue.
                  </div>
                ) : (
                  material.auditLogs.map((log) => (
                    <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{log.moderatorName}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                            {log.moderatorBadge}
                          </span>
                        </div>
                        <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          log.action === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                          log.action === 'REVISION_REQUESTED' ? 'bg-amber-100 text-amber-800' :
                          log.action === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          Action: {log.action}
                        </span>
                        {log.reasonCategory && (
                          <span className="text-slate-600 font-medium">({log.reasonCategory})</span>
                        )}
                      </div>

                      {log.notes && (
                        <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                          {log.notes}
                        </p>
                      )}

                      {log.suggestedChanges && log.suggestedChanges.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-[11px] font-bold text-slate-600">Suggested Changes:</div>
                          <ul className="list-disc list-inside text-slate-600 text-[11px]">
                            {log.suggestedChanges.map((sc, i) => (
                              <li key={i}>{sc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Action Panels */}
          {actionType === 'APPROVE' && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Approve & Grant National Senate Verification Seal</span>
              </div>
              <p className="text-xs text-emerald-800">
                Approving this material will publish it with the official "Senate Verified" badge, trigger a +₦500 quality verification bonus to the contributor, and broadcast it to students in {material.department}.
              </p>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Verification Endorsement Notes
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  className="w-full text-xs bg-white border border-emerald-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleApproveSubmit}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Confirm Approval & Publish Verified Pack</span>
                </button>
                <button
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionType === 'REVISION' && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Request Revisions from Student Contributor</span>
              </div>
              <p className="text-xs text-amber-800">
                Specify what needs correction. The contributor will receive an alert notification with your instructions and can resubmit directly.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Revision Category *
                  </label>
                  <select
                    value={revisionCategory}
                    onChange={(e) => setRevisionCategory(e.target.value)}
                    className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2.5 font-medium"
                  >
                    <option value="Incomplete Worked Solutions">Incomplete Worked Solutions</option>
                    <option value="Legibility & Quality Standards">Legibility & Quality Standards</option>
                    <option value="Missing Formulas / Diagrams">Missing Formulas / Diagrams</option>
                    <option value="Syllabus Inconsistency">Syllabus Inconsistency</option>
                    <option value="Formatting & Typo Correction">Formatting & Typo Correction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Detailed Reviewer Remarks *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Worked solution for Q3 is missing step-by-step working..."
                    value={revisionFeedback}
                    onChange={(e) => setRevisionFeedback(e.target.value)}
                    className="w-full text-xs bg-white border border-amber-300 rounded-lg p-2.5 font-medium"
                  />
                </div>
              </div>

              {/* Itemized checklist items */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Itemized Changes Required:
                </label>
                <div className="space-y-1.5">
                  {revisionItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-amber-200 text-xs">
                      <span>• {item}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRevisionItem(i)}
                        className="text-red-500 hover:text-red-700 text-xs font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Add another required revision item..."
                    value={newRevisionItem}
                    onChange={(e) => setNewRevisionItem(e.target.value)}
                    className="flex-1 text-xs bg-white border border-amber-300 rounded-lg p-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddRevisionItem}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleRevisionSubmit}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Revision Request to Uploader</span>
                </button>
                <button
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {actionType === 'REJECT' && (
            <div className="p-5 rounded-2xl bg-red-50 border border-red-300 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                <XCircle className="w-5 h-5 text-red-600" />
                <span>Reject Uploaded Material</span>
              </div>
              <p className="text-xs text-red-800">
                Rejecting removes the material from the public library. An explanation will be sent to the contributor.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Rejection Category *
                  </label>
                  <select
                    value={rejectionCategory}
                    onChange={(e) => setRejectionCategory(e.target.value)}
                    className="w-full text-xs bg-white border border-red-300 rounded-lg p-2.5 font-medium"
                  >
                    <option value="Legibility & Quality Standards">Legibility & Quality Standards</option>
                    <option value="Plagiarism & Unauthorized Copying">Plagiarism & Unauthorized Copying</option>
                    <option value="Inaccurate / Erroneous Content">Inaccurate / Erroneous Content</option>
                    <option value="Off-Syllabus / Outdated Material">Off-Syllabus / Outdated Material</option>
                    <option value="Duplicate Upload">Duplicate Upload</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Formal Explanation Notes *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scans are blurry and out of focus for mobile users..."
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    className="w-full text-xs bg-white border border-red-300 rounded-lg p-2.5 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleRejectSubmit}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Rejection</span>
                </button>
                <button
                  onClick={() => setActionType(null)}
                  className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Action Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            National Academic Senate Quality Enforcement Desk
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActionType('APPROVE')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                actionType === 'APPROVE'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve & Verify</span>
            </button>

            <button
              onClick={() => setActionType('REVISION')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                actionType === 'REVISION'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              <span>Request Revision</span>
            </button>

            <button
              onClick={() => setActionType('REJECT')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                actionType === 'REJECT'
                  ? 'bg-red-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>Reject</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl bg-white"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
