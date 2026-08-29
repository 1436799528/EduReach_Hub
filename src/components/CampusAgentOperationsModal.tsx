import React, { useState } from 'react';
import { 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Upload, 
  FileText, 
  Award, 
  DollarSign, 
  Send, 
  RefreshCw, 
  Phone, 
  Building2, 
  FileCheck, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  Lock,
  ChevronRight,
  Check,
  AlertCircle
} from 'lucide-react';
import { ServiceOrder, UserProfile, CampusAgent, OrderProofSubmission, AgentOnboardingApplication } from '../types';
import { CAMPUS_AGENTS } from '../data/mockData';

interface CampusAgentOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  orders: ServiceOrder[];
  onUpdateOrder: (order: ServiceOrder) => void;
  onUpdateUserProfile: (user: UserProfile) => void;
}

export const CampusAgentOperationsModal: React.FC<CampusAgentOperationsModalProps> = ({
  isOpen,
  onClose,
  user,
  orders,
  onUpdateOrder,
  onUpdateUserProfile
}) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'onboarding' | 'escrow' | 'incentives'>('queue');
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(orders[0] || null);
  
  // Proof Submission Form State
  const [showProofForm, setShowProofForm] = useState<boolean>(false);
  const [receiptNumber, setReceiptNumber] = useState<string>('UNICAL/BURS/REC/2025-9981');
  const [signoffOfficer, setSignoffOfficer] = useState<string>('Mr. E. O. Akpan (Student Affairs Desk Officer)');
  const [proofNotes, setProofNotes] = useState<string>('Official receipt stamped and endorsed at Senate Secretariat Room 204.');
  const [proofImage, setProofImage] = useState<string>('https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80');

  // Onboarding Form State
  const [onboardingForm, setOnboardingForm] = useState<AgentOnboardingApplication>({
    fullName: user.name || 'Blessing Emmanuel',
    matricNumber: '21/042144081',
    nin: user.agentProfile?.ninNumber || '92841029481',
    cgpa: user.agentProfile?.cgpa ? user.agentProfile.cgpa.toString() : '4.38',
    institutionId: user.institutionId || 'UNICAL',
    department: user.department || 'Computer Science',
    faculty: user.faculty || 'Science',
    level: user.level || '300L',
    phone: user.phoneNumber || '08148920119',
    guarantorLecturerName: user.agentProfile?.guarantorName || 'Dr. E. B. Asuquo',
    guarantorLecturerDept: user.agentProfile?.guarantorDept || 'Department of Computer Science',
    guarantorLecturerPhone: user.agentProfile?.guarantorPhone || '+234 803 551 8920',
    guarantorLecturerStaffId: user.agentProfile?.guarantorStaffId || 'UNICAL/SS/2014/409',
    agreedToIntegrityAgreement: true,
    agreedToEscrowBond: true
  });
  const [onboardingSubmitted, setOnboardingSubmitted] = useState<boolean>(false);

  if (!isOpen) return null;

  const agentProfile = user.agentProfile || {
    isAccredited: true,
    ninNumber: '92841029481',
    cgpa: 4.38,
    guarantorName: 'Dr. E. B. Asuquo',
    guarantorDept: 'Department of Computer Science',
    guarantorPhone: '+234 803 551 8920',
    guarantorStaffId: 'UNICAL/SS/2014/409',
    integrityAgreementSigned: true,
    integritySignedDate: '2025-01-10',
    tier: 'TOP_AGENT_80_20' as const,
    escrowDepositHeld: 10000,
    escrowTarget: 10000,
    totalOrdersCompleted: 48,
    slaSuccessRate: 98.6,
    totalCommissionEarned: 64200,
    availableCommissionBalance: 18400,
    penaltiesCount: 0,
    badges: ['TOP_AGENT_MONTHLY', 'FAST_RESPONDER', 'REGISTRY_EXCELLENCE', 'SECURITY_CLEARED'] as any[]
  };

  // Submit Stamped Proof
  const handleSubmitProof = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const commissionSplit = agentProfile.tier === 'TOP_AGENT_80_20' ? 0.8 : 0.7;
    const repCommission = Math.round(selectedOrder.amountPaid * commissionSplit);

    const newProof: OrderProofSubmission = {
      id: `PRF-${Date.now()}`,
      orderId: selectedOrder.id,
      agentId: user.id,
      agentName: user.name,
      receiptNumber,
      registryStaffSignoff: signoffOfficer,
      stampedImageUrl: proofImage,
      notes: proofNotes,
      submittedAt: 'Just now',
      verifiedByStudentOrAdmin: false,
      status: 'PENDING_VERIFICATION'
    };

    const updatedOrder: ServiceOrder = {
      ...selectedOrder,
      status: 'STAMPED_AND_VERIFIED',
      slaStatus: 'MET',
      assignedAgent: {
        ...selectedOrder.assignedAgent,
        name: user.name,
        phone: user.phoneNumber,
        institution: user.institutionId,
        rating: 4.98,
        commissionEarned: repCommission,
        tier: agentProfile.tier
      },
      proofSubmission: newProof,
      timeline: [
        ...selectedOrder.timeline,
        {
          stage: 'Official Proof Uploaded & Stamped',
          time: 'Just now',
          completed: true,
          description: `Uploaded receipt #${receiptNumber}. Signed off by ${signoffOfficer}. Awaiting verification to release ₦${repCommission.toLocaleString()} payout.`
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    setShowProofForm(false);
  };

  // Approve Stamped Proof & Release Escrow Payout
  const handleApproveProofAndReleasePayout = (order: ServiceOrder) => {
    const commissionSplit = agentProfile.tier === 'TOP_AGENT_80_20' ? 0.8 : 0.7;
    const repCommission = Math.round(order.amountPaid * commissionSplit);

    const updatedOrder: ServiceOrder = {
      ...order,
      status: 'COMPLETED_DISPATCHED',
      slaStatus: 'MET',
      proofSubmission: order.proofSubmission ? {
        ...order.proofSubmission,
        verifiedByStudentOrAdmin: true,
        status: 'APPROVED_VERIFIED'
      } : undefined,
      timeline: [
        ...order.timeline,
        {
          stage: 'Proof Verified & Escrow Payout Released',
          time: 'Just now',
          completed: true,
          description: `Verified by Student/Senate Desk. ₦${repCommission.toLocaleString()} released to campus rep balance.`
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);

    // Update user agent commission balance
    const updatedUser: UserProfile = {
      ...user,
      agentProfile: {
        ...agentProfile,
        totalOrdersCompleted: (agentProfile.totalOrdersCompleted || 0) + 1,
        totalCommissionEarned: (agentProfile.totalCommissionEarned || 0) + repCommission,
        availableCommissionBalance: (agentProfile.availableCommissionBalance || 0) + repCommission
      }
    };
    onUpdateUserProfile(updatedUser);
  };

  // Re-route to Backup Agent
  const handleReRouteOrder = (order: ServiceOrder) => {
    const backupRep = CAMPUS_AGENTS.find(a => a.institutionId === order.targetInstitution && a.id !== order.assignedAgent?.id) || CAMPUS_AGENTS[1];

    const updatedOrder: ServiceOrder = {
      ...order,
      isReRouted: true,
      assignedAgent: {
        id: backupRep.id,
        name: backupRep.name,
        phone: backupRep.phone,
        institution: backupRep.institutionId,
        rating: backupRep.rating,
        tier: backupRep.tier || 'STANDARD_70_30'
      },
      backupAgent: {
        id: 'backup_auto_assigned',
        name: 'Auto-Dispatched Secondary Campus Rep',
        phone: backupRep.phone,
        institution: backupRep.institutionId
      },
      timeline: [
        ...order.timeline,
        {
          stage: 'Order Re-Routed to Backup Campus Rep',
          time: 'Just now',
          completed: true,
          description: `Assigned rep was delayed or unavailable. System auto-reassigned order to backup agent ${backupRep.name} to protect 4-hour SLA.`
        }
      ]
    };

    onUpdateOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
  };

  // Onboarding Submit
  const handleSaveOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    const cgpaNum = parseFloat(onboardingForm.cgpa);
    if (cgpaNum < 3.0) {
      alert('Minimum CGPA requirement is 3.0 / 5.0 for Campus Agent accreditation.');
      return;
    }

    const updatedProfile = {
      ...user,
      role: 'campus_agent' as const,
      agentProfile: {
        isAccredited: true,
        ninNumber: onboardingForm.nin,
        cgpa: cgpaNum,
        guarantorName: onboardingForm.guarantorLecturerName,
        guarantorDept: onboardingForm.guarantorLecturerDept,
        guarantorPhone: onboardingForm.guarantorLecturerPhone,
        guarantorStaffId: onboardingForm.guarantorLecturerStaffId,
        integrityAgreementSigned: true,
        integritySignedDate: new Date().toISOString().split('T')[0],
        tier: cgpaNum >= 4.0 ? ('TOP_AGENT_80_20' as const) : ('STANDARD_70_30' as const),
        escrowDepositHeld: 10000,
        escrowTarget: 10000,
        totalOrdersCompleted: 0,
        slaSuccessRate: 100,
        totalCommissionEarned: 0,
        availableCommissionBalance: 0,
        penaltiesCount: 0,
        badges: ['SECURITY_CLEARED', 'REGISTRY_EXCELLENCE'] as any[]
      }
    };

    onUpdateUserProfile(updatedProfile);
    setOnboardingSubmitted(true);
    setTimeout(() => {
      setOnboardingSubmitted(false);
      setActiveTab('queue');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-slate-900 text-slate-100 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Campus Student Agent Operations Hub
                </span>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                  {agentProfile.tier === 'TOP_AGENT_80_20' ? '⭐ Tier 1: 80% Split (Top Rep)' : 'Tier 2: 70% Split'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Registry SLA Dispatch, Proof Verification & Escrow Desk
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-2 px-5 pt-3 bg-slate-950 border-b border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('queue')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'queue'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>SLA Dispatch Queue & Tasks ({orders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('onboarding')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'onboarding'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Onboarding & NIN/Guarantor Verification</span>
          </button>

          <button
            onClick={() => setActiveTab('escrow')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'escrow'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>₦10,000 Security Escrow Bond</span>
          </button>

          <button
            onClick={() => setActiveTab('incentives')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'incentives'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Commission Splits & Badges</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 text-xs space-y-5 font-sans">
          
          {/* TAB 1: SLA DISPATCH QUEUE & TASK LIFECYCLE */}
          {activeTab === 'queue' && (
            <div className="space-y-5">
              
              {/* Visual Task Lifecycle Stepper */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Task Lifecycle & SLA Enforcement Architecture
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-300 block mb-1">1. Order Placed</span>
                    <span className="text-[10px] text-slate-400">Escrow Funded</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800">
                    <span className="font-bold text-emerald-400 block mb-1">2. Auto-Assign Rep</span>
                    <span className="text-[10px] text-emerald-300">2-4h SLA Timer</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-300 block mb-1">3. Proof Upload</span>
                    <span className="text-[10px] text-slate-400">Stamp & Receipt</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-bold text-slate-300 block mb-1">4. Verification</span>
                    <span className="text-[10px] text-slate-400">Student Sign-off</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-950/60 border border-amber-800">
                    <span className="font-bold text-amber-400 block mb-1">5. Payout Released</span>
                    <span className="text-[10px] text-amber-300">70% / 80% Split</span>
                  </div>
                </div>
              </div>

              {/* Order Selection & Action Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Left: Orders List */}
                <div className="space-y-2 lg:col-span-1">
                  <span className="text-xs font-bold text-slate-400 block mb-1">
                    Active Assigned Dispatches:
                  </span>

                  {orders.map(ord => (
                    <button
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrder(ord);
                        setShowProofForm(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedOrder?.id === ord.id
                          ? 'bg-slate-800 border-emerald-500 shadow-md'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[10px] font-bold text-emerald-400">
                          {ord.trackingCode}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          ord.slaStatus === 'MET'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : ord.slaStatus === 'URGENT'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}>
                          {ord.slaDeadline || '4h SLA Target'}
                        </span>
                      </div>
                      <h4 className="font-bold text-white text-xs truncate">
                        {ord.serviceType.replace(/_/g, ' ')}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {ord.studentName} ({ord.targetInstitution}) • ₦{ord.amountPaid.toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Right: Selected Order Detail & Operational Controls */}
                {selectedOrder && (
                  <div className="lg:col-span-2 bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-4">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold border border-emerald-800">
                            {selectedOrder.targetInstitution}
                          </span>
                          <span className="font-mono text-xs text-slate-300 font-bold">
                            {selectedOrder.trackingCode}
                          </span>
                        </div>
                        <h3 className="font-bold text-white text-sm mt-1">
                          {selectedOrder.serviceType.replace(/_/g, ' ')}
                        </h3>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Agent Payout on Completion</span>
                        <span className="text-sm font-extrabold text-emerald-400 font-mono">
                          ₦{Math.round(selectedOrder.amountPaid * (agentProfile.tier === 'TOP_AGENT_80_20' ? 0.8 : 0.7)).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Student details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-900 p-3 rounded-lg text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Student:</span>
                        <span className="font-bold text-slate-200">{selectedOrder.studentName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Matric / Reg No:</span>
                        <span className="font-mono font-bold text-slate-200">{selectedOrder.matricNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Department:</span>
                        <span className="font-bold text-slate-200">{selectedOrder.department}</span>
                      </div>
                    </div>

                    {/* Stamped Proof Submission Status */}
                    {selectedOrder.proofSubmission ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-emerald-400">
                            <FileCheck className="w-4 h-4" />
                            <span>Submitted Stamped Official Proof</span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                            selectedOrder.proofSubmission.status === 'APPROVED_VERIFIED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {selectedOrder.proofSubmission.status}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <img
                            src={selectedOrder.proofSubmission.stampedImageUrl || 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80'}
                            alt="Stamped Document Proof"
                            className="w-full sm:w-32 h-24 object-cover rounded-lg border border-slate-700"
                          />
                          <div className="text-[11px] space-y-1">
                            <p className="text-slate-300">
                              <strong>Receipt/Doc #:</strong> {selectedOrder.proofSubmission.receiptNumber || 'N/A'}
                            </p>
                            <p className="text-slate-300">
                              <strong>Sign-off Officer:</strong> {selectedOrder.proofSubmission.registryStaffSignoff}
                            </p>
                            <p className="text-slate-400 italic">
                              "{selectedOrder.proofSubmission.notes}"
                            </p>
                          </div>
                        </div>

                        {/* Admin / Student Verification Trigger */}
                        {!selectedOrder.proofSubmission.verifiedByStudentOrAdmin && (
                          <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApproveProofAndReleasePayout(selectedOrder)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>Verify & Release Payout to Agent</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Action Buttons for Agent */
                      <div className="space-y-3">
                        {!showProofForm ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setShowProofForm(true)}
                              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Upload className="w-4 h-4" />
                              <span>Submit Stamped Document Proof</span>
                            </button>

                            <button
                              onClick={() => handleReRouteOrder(selectedOrder)}
                              className="py-2.5 px-3 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 rounded-xl transition-colors font-semibold flex items-center gap-1.5 cursor-pointer"
                              title="Re-assign to backup campus agent if delayed"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Re-Route to Backup Rep</span>
                            </button>
                          </div>
                        ) : (
                          /* Proof Submission Form */
                          <form onSubmit={handleSubmitProof} className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-emerald-400" />
                              <span>Upload Stamped Registry Receipt / Verification Proof</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Receipt / Serial Number *</label>
                                <input
                                  type="text"
                                  required
                                  value={receiptNumber}
                                  onChange={(e) => setReceiptNumber(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-emerald-300 focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Registry / Desk Officer Sign-off *</label>
                                <input
                                  type="text"
                                  required
                                  value={signoffOfficer}
                                  onChange={(e) => setSignoffOfficer(e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Fulfillment & Verification Notes</label>
                              <textarea
                                rows={2}
                                value={proofNotes}
                                onChange={(e) => setProofNotes(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setShowProofForm(false)}
                                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition-colors"
                              >
                                Upload & Request Payout Release
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: ONBOARDING & VERIFICATION PROTOCOL */}
          {activeTab === 'onboarding' && (
            <div className="space-y-4">
              
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Accreditation Protocols: Identity & Academic Clearance</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Campus student reps hold fiduciary custody over student transcripts, bursary clearances, and NELFUND forms. Every agent must provide verified NIN, school identity credentials, maintain a minimum CGPA of 3.0, and hold an endorsed faculty lecturer guarantor.
                </p>
              </div>

              {onboardingSubmitted ? (
                <div className="p-6 bg-emerald-950/60 border border-emerald-700 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">Application Accredited & Bond Active</h3>
                  <p className="text-xs text-emerald-200">
                    Your guarantor details and NIN were verified. Your ₦10,000 security escrow account has been provisioned.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveOnboarding} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Full Student Name *</label>
                      <input
                        type="text"
                        required
                        value={onboardingForm.fullName}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">11-Digit NIN (National Identity Number) *</label>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={onboardingForm.nin}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, nin: e.target.value }))}
                        placeholder="e.g. 92841029481"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-emerald-300"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-semibold">Cumulative CGPA (Min 3.0/5.0) *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="3.0"
                        max="5.0"
                        required
                        value={onboardingForm.cgpa}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, cgpa: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-amber-300"
                      />
                    </div>
                  </div>

                  {/* Guarantor Details */}
                  <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-xs font-bold text-emerald-400 block">
                      Faculty Lecturer / HOD Guarantor Endorsement
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Guarantor Lecturer Name *</label>
                        <input
                          type="text"
                          required
                          value={onboardingForm.guarantorLecturerName}
                          onChange={(e) => setOnboardingForm(prev => ({ ...prev, guarantorLecturerName: e.target.value }))}
                          placeholder="e.g. Dr. E. B. Asuquo"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Lecturer Staff ID / University Code *</label>
                        <input
                          type="text"
                          required
                          value={onboardingForm.guarantorLecturerStaffId}
                          onChange={(e) => setOnboardingForm(prev => ({ ...prev, guarantorLecturerStaffId: e.target.value }))}
                          placeholder="e.g. UNICAL/SS/2014/409"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Department / Faculty *</label>
                        <input
                          type="text"
                          required
                          value={onboardingForm.guarantorLecturerDept}
                          onChange={(e) => setOnboardingForm(prev => ({ ...prev, guarantorLecturerDept: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Guarantor Phone Contact *</label>
                        <input
                          type="text"
                          required
                          value={onboardingForm.guarantorLecturerPhone}
                          onChange={(e) => setOnboardingForm(prev => ({ ...prev, guarantorLecturerPhone: e.target.value }))}
                          placeholder="+234 803 551 8920"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        required
                        checked={onboardingForm.agreedToIntegrityAgreement}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, agreedToIntegrityAgreement: e.target.checked }))}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 mt-0.5"
                      />
                      <span>I sign and accept the <strong>Campus Integrity & Registry Anti-Fraud Agreement</strong>.</span>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-300">
                      <input
                        type="checkbox"
                        required
                        checked={onboardingForm.agreedToEscrowBond}
                        onChange={(e) => setOnboardingForm(prev => ({ ...prev, agreedToEscrowBond: e.target.checked }))}
                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 mt-0.5"
                      />
                      <span>I agree to maintain a <strong>₦10,000 security escrow deposit</strong> held against unfulfilled orders and SLA breaches.</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
                  >
                    Save & Submit Campus Agent Accreditation
                  </button>
                </form>
              )}

            </div>
          )}

          {/* TAB 3: SECURITY ESCROW BOND */}
          {activeTab === 'escrow' && (
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Escrow Security Deposit
                  </span>
                  <div className="text-xl font-extrabold text-emerald-400 font-mono">
                    ₦{agentProfile.escrowDepositHeld.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-400/80 mt-1 block">
                    Target Met (₦10,000 Fully Funded)
                  </span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    Withdrawable Commission Balance
                  </span>
                  <div className="text-xl font-extrabold text-white font-mono">
                    ₦{agentProfile.availableCommissionBalance.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Instant Bank Payout Ready
                  </span>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                    SLA Compliance Rate
                  </span>
                  <div className="text-xl font-extrabold text-amber-400 font-mono">
                    {agentProfile.slaSuccessRate}%
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    {agentProfile.penaltiesCount} SLA Penalties Recorded
                  </span>
                </div>
              </div>

              {/* Escrow rules */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Escrow Bond Operational Rules</span>
                </h4>
                <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
                  <li><strong>Security Hold:</strong> ₦10,000 from cumulative commissions remains in the security bond to protect against unfulfilled orders.</li>
                  <li><strong>SLA Breach Policy:</strong> Delays exceeding the 4-hour window without a validated campus Senate strike notice incur a ₦500 micro-deduction and auto-reassignment to a backup rep.</li>
                  <li><strong>Full Bond Return:</strong> When graduating or stepping down from campus representation, the complete ₦10,000 escrow bond is released upon clearance.</li>
                </ul>
              </div>

            </div>
          )}

          {/* TAB 4: COMMISSION SPLITS & BADGES */}
          {activeTab === 'incentives' && (
            <div className="space-y-4">
              
              {/* Revenue Splits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${
                  agentProfile.tier === 'STANDARD_70_30'
                    ? 'bg-slate-800/80 border-emerald-500 shadow-md'
                    : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs text-white">Standard Campus Rep Tier</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">70% Rep / 30% Platform</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Earn 70% commission on every physical dispatch, PIN generation, and transcript processing.
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${
                  agentProfile.tier === 'TOP_AGENT_80_20'
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-md'
                    : 'bg-slate-950 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-xs text-amber-300">Top Agent Monthly Tier ⭐</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">80% Rep / 20% Platform</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Maintained &gt;95% SLA compliance and &gt;20 monthly dispatches. Unlocks higher revenue cut and priority routing for high-value orders.
                  </p>
                </div>
              </div>

              {/* Performance Badges */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-300 block">
                  Earned Operational Performance Badges:
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <Award className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                    <span className="font-bold text-white text-[11px] block">Top Agent Monthly</span>
                    <span className="text-[10px] text-slate-400">80/20 Revenue Split</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <TrendingUp className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <span className="font-bold text-white text-[11px] block">Fast Responder</span>
                    <span className="text-[10px] text-slate-400">&lt;35 Mins Avg Time</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <ShieldCheck className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                    <span className="font-bold text-white text-[11px] block">Security Cleared</span>
                    <span className="text-[10px] text-slate-400">NIN & Guarantor Vetted</span>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-center">
                    <Building2 className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                    <span className="font-bold text-white text-[11px] block">Registry Liaison</span>
                    <span className="text-[10px] text-slate-400">Direct Senate Access</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Total Lifetime Commissions:</span>
            <span className="font-mono font-bold text-emerald-400">₦{agentProfile.totalCommissionEarned.toLocaleString()}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close Operational Desk
          </button>
        </div>

      </div>
    </div>
  );
};
