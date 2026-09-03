import React, { useState } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  UploadCloud, 
  CheckCircle, 
  FileText, 
  DollarSign, 
  Building2, 
  ArrowUpRight, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  ThumbsUp, 
  Plus, 
  Check, 
  AlertCircle,
  Banknote,
  Send,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, StudyMaterial, InstitutionId, MaterialType } from '../types';
import { INSTITUTIONS } from '../data/mockData';

interface ContributorHubProps {
  user: UserProfile;
  materials: StudyMaterial[];
  onUploadMaterial: (newMaterial: Partial<StudyMaterial>) => void;
  onRequestPayout: (amount: number, bankDetails: { bank: string; accountNumber: string; accountName: string }) => void;
  onModerateMaterial: (materialId: string, approved: boolean) => void;
  onOpenVerificationModal: (material: StudyMaterial) => void;
}

export const ContributorHub: React.FC<ContributorHubProps> = ({
  user,
  materials,
  onUploadMaterial,
  onRequestPayout,
  onModerateMaterial,
  onOpenVerificationModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'moderation' | 'payouts'>('overview');
  const [moderationFilter, setModerationFilter] = useState<'ALL' | 'PENDING' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED' | 'REJECTED'>('ALL');
  const [selectedInstFilter, setSelectedInstFilter] = useState<string>('ALL');

  // Upload Form State
  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [institutionId, setInstitutionId] = useState<InstitutionId>(user.institutionId || 'UNICAL');
  const [faculty, setFaculty] = useState('Science');
  const [department, setDepartment] = useState('Computer Science');
  const [level, setLevel] = useState<'100L' | '200L' | '300L' | '400L' | '500L' | '600L'>('200L');
  const [semester, setSemester] = useState<'1st Semester' | '2nd Semester'>('1st Semester');
  const [materialType, setMaterialType] = useState<MaterialType>('past_question');
  const [unlockPrice, setUnlockPrice] = useState<number>(300);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [coreConcepts, setCoreConcepts] = useState('');
  const [fullTextContent, setFullTextContent] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Payout Form State
  const [payoutAmount, setPayoutAmount] = useState<number>(user.contributorStats.pendingPayout || 5000);
  const [selectedBank, setSelectedBank] = useState('Access Bank');
  const [accountNumber, setAccountNumber] = useState('0124892019');
  const [accountName, setAccountName] = useState('BLESSING EMMANUEL (VERIFIED)');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutSuccessMsg, setPayoutSuccessMsg] = useState('');

  const NIGERIAN_BANKS = [
    'Access Bank',
    'GTBank (Guaranty Trust)',
    'Zenith Bank',
    'OPay Digital Services',
    'Palmpay',
    'Kuda Microfinance Bank',
    'First Bank of Nigeria',
    'United Bank for Africa (UBA)',
    'Sterling Bank',
    'Moniepoint Microfinance Bank',
    'Stanbic IBTC'
  ];

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode || !title || !summary) return;

    const newMat: Partial<StudyMaterial> = {
      title,
      courseCode,
      courseTitle: courseTitle || courseCode,
      institutionId,
      department,
      faculty,
      level,
      semester,
      materialType,
      academicSession: '2024/2025 Current Session',
      unlockPrice: Number(unlockPrice),
      isVerified: false,
      summary,
      coreConcepts: coreConcepts.split('\n').filter(c => c.trim().length > 0),
      fullTextContent: fullTextContent || summary,
      rating: 5.0,
      reviewCount: 1,
      unlockCount: 0,
      fileSizeKb: 850,
      pageCount: 24,
      crossCampusEquivalents: [],
      createdAt: new Date().toISOString().split('T')[0]
    };

    onUploadMaterial(newMat);
    setUploadSuccess(true);
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });

    // Reset
    setTimeout(() => {
      setTitle('');
      setCourseCode('');
      setCourseTitle('');
      setSummary('');
      setCoreConcepts('');
      setFullTextContent('');
      setUploadSuccess(false);
      setActiveTab('overview');
    }, 2000);
  };

  const handlePayoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payoutAmount <= 0 || payoutAmount > user.contributorStats.pendingPayout) return;

    setPayoutLoading(true);
    setTimeout(() => {
      onRequestPayout(payoutAmount, {
        bank: selectedBank,
        accountNumber,
        accountName
      });
      setPayoutLoading(false);
      setPayoutSuccessMsg(`₦${payoutAmount.toLocaleString()} successfully transferred to ${accountName} (${selectedBank})!`);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
      setTimeout(() => setPayoutSuccessMsg(''), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Contributor Economy Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-emerald-800/40 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 mb-3">
            <Award className="w-3.5 h-3.5" />
            <span>National Contributor & Creator Economy</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Monetize Your Lecture Notes & Solved Past Questions 🇳🇬
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
            Class Reps, First-Class Scholars, and Course Moderators earn <span className="text-emerald-400 font-bold">micro-credits & direct bank royalties</span> whenever students nationwide unlock their verified study packs.
          </p>

          {/* Hub Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'overview'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              📊 Earnings & Royalties
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'upload'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload Study Pack</span>
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'payouts'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Bank Payout (₦{user.contributorStats.pendingPayout.toLocaleString()})</span>
            </button>
            <button
              onClick={() => setActiveTab('moderation')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'moderation'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Peer Verification Queue</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: Overview & Earnings Stats */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Total Royalties Earned</span>
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                ₦{user.contributorStats.totalEarned.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold">
                +₦2,400 earned this week
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Available Payout Balance</span>
                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                ₦{user.contributorStats.pendingPayout.toLocaleString()}
              </div>
              <button
                onClick={() => setActiveTab('payouts')}
                className="text-[11px] text-amber-700 font-bold hover:underline"
              >
                Withdraw to Bank ›
              </button>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Live Published Packs</span>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {user.contributorStats.materialsUploaded} Packs
              </div>
              <span className="text-[11px] text-indigo-600 font-semibold">
                100% Peer Verified
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">Contributor Tier</span>
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg font-extrabold text-purple-700">
                ⭐ Star Contributor
              </div>
              <span className="text-[11px] text-slate-500">
                70% Royalty Share Rate
              </span>
            </div>

          </div>

          {/* Quick Upload CTA & Instructions */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-1">
                Have verified past questions or lecture notes from your department?
              </h3>
              <p className="text-xs text-slate-600 max-w-xl">
                Upload in PDF or text format. Our campus peer moderators will verify accuracy and publish nationwide. You receive instant credit every time a student unlocks!
              </p>
            </div>
            <button
              onClick={() => setActiveTab('upload')}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs whitespace-nowrap shadow-sm flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Submit Study Material</span>
            </button>
          </div>

          {/* Submissions & Verification Status Tracker */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>My Uploaded Packs & Verification Lifecycle</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track Senate moderation feedback, resubmit revisions, and see royalty unlocks.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('upload')}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Upload</span>
              </button>
            </div>

            <div className="space-y-3">
              {materials
                .filter(m => m.uploader.id === user.id || m.uploader.name.includes(user.name.split(' ')[0]) || m.uploader.badge.includes('Verified Scholar') || m.id.includes('UNICAL'))
                .slice(0, 5)
                .map((mat) => {
                  const isApproved = mat.verificationStatus === 'APPROVED' || mat.isVerified;
                  const isRevision = mat.verificationStatus === 'REVISION_REQUESTED';
                  const isRejected = mat.verificationStatus === 'REJECTED';
                  const isPending = !isApproved && !isRevision && !isRejected;

                  return (
                    <div 
                      key={mat.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            {mat.institutionId}
                          </span>
                          <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {mat.courseCode}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {mat.title}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>Price: <strong className="text-emerald-700">₦{mat.unlockPrice}</strong></span>
                          <span>Unlocks: <strong>{mat.unlockCount} students</strong></span>
                          <span>Level: <strong>{mat.level}</strong></span>
                          <span>Uploaded: <strong>{mat.createdAt || 'Recent'}</strong></span>
                        </div>

                        {/* Revision guidance preview if requested */}
                        {isRevision && mat.moderationFeedback && (
                          <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-amber-800">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Action Required from Moderator:</span>
                            </div>
                            <p className="text-[11px] font-medium">{mat.moderationFeedback}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isApproved && (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Senate Verified (+₦500)</span>
                          </span>
                        )}

                        {isRevision && (
                          <button
                            onClick={() => onOpenVerificationModal(mat)}
                            className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Fix & Resubmit</span>
                          </button>
                        )}

                        {isPending && (
                          <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-blue-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>In Review Queue</span>
                          </span>
                        )}

                        {isRejected && (
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-red-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        )}

                        <button
                          onClick={() => onOpenVerificationModal(mat)}
                          className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Details & Audit
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: Upload Study Material Form */}
      {activeTab === 'upload' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="max-w-2xl mx-auto">
            
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                Upload Course Material or Past Question
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Help fellow students prepare for exams and earn money for approved materials.
              </p>
            </div>

            {uploadSuccess && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>Material submitted successfully! Forwarded to Senate Peer Verification Queue.</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              
              {/* Institution & Course Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    University / Institution *
                  </label>
                  <select
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value as InstitutionId)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {INSTITUTIONS.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.shortName} - {inst.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Course Code (e.g. GST 111, EEE 301) *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="e.g. GST 111"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Course Title & Material Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Course Official Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="e.g. Use of English & Study Skills"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Material Pack Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. 5-Year Solved Past Questions & Concord Summary"
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Faculty, Department, Level, Semester */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Faculty</label>
                  <input
                    type="text"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    placeholder="e.g. Science"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Level</label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <option value="100L">100L</option>
                    <option value="200L">200L</option>
                    <option value="300L">300L</option>
                    <option value="400L">400L</option>
                    <option value="500L">500L</option>
                    <option value="600L">600L</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2"
                  >
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>
              </div>

              {/* Format Type & Unlock Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Material Format Type
                  </label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  >
                    <option value="past_question">Worked Past Questions & Solutions</option>
                    <option value="lecture_summary">High-Yield Lecture Summary</option>
                    <option value="handwritten_note">Scholar Handwritten Notes</option>
                    <option value="cbt_pack">CBT Practice Test Pack</option>
                    <option value="project_guide">Project Topic & Methodology Guide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Unlock Price (NGN)
                  </label>
                  <select
                    value={unlockPrice}
                    onChange={(e) => setUnlockPrice(Number(e.target.value))}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5"
                  >
                    <option value={0}>₦0 (Free / Open Knowledge Access)</option>
                    <option value={200}>₦200 (Standard Summary)</option>
                    <option value={300}>₦300 (Comprehensive Past Questions)</option>
                    <option value={400}>₦400 (Specialized Engineering/Medical)</option>
                    <option value={500}>₦500 (Masterpack with CBT)</option>
                  </select>
                </div>
              </div>

              {/* Summary Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Executive Summary & Scope *
                </label>
                <textarea
                  required
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Summarize the topics covered and why this pack guarantees exam success..."
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Core Concepts */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Key Concepts Covered (One per line)
                </label>
                <textarea
                  rows={3}
                  value={coreConcepts}
                  onChange={(e) => setCoreConcepts(e.target.value)}
                  placeholder="• Concord Proximity Rules&#10;• Second-order RLC response&#10;• Postal rule in Nigerian contract law"
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Full Notes / Solutions Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Notes Text or Solved Questions
                </label>
                <textarea
                  rows={5}
                  value={fullTextContent}
                  onChange={(e) => setFullTextContent(e.target.value)}
                  placeholder="Paste or type full lecture summary, formulas, and worked steps here..."
                  className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Submit Study Material</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* TAB 3: Instant Bank Payouts */}
      {activeTab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="max-w-xl mx-auto space-y-6">
            
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Instant Bank Account Payout (Nigerian Banks)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Withdraw accumulated royalties directly to your commercial or digital bank account with zero fees.
              </p>
            </div>

            {payoutSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span>{payoutSuccessMsg}</span>
              </div>
            )}

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-medium">Available for Withdrawal</span>
                <div className="text-2xl font-extrabold text-slate-900">
                  ₦{user.contributorStats.pendingPayout.toLocaleString()}
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                Instant Clearing
              </span>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Nigerian Bank *
                </label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  NUBAN Account Number (10 Digits) *
                </label>
                <input
                  type="text"
                  maxLength={10}
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full text-xs font-mono font-medium bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Verified Account Name (NIBSS Matched)
                </label>
                <input
                  type="text"
                  readOnly
                  value={accountName}
                  className="w-full text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Withdrawal Amount (NGN) *
                </label>
                <input
                  type="number"
                  min={100}
                  max={user.contributorStats.pendingPayout}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={payoutLoading || user.contributorStats.pendingPayout <= 0}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-colors shadow-md flex items-center justify-center gap-2"
              >
                {payoutLoading ? (
                  <span>Processing NIBSS Transfer...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Disburse ₦{payoutAmount.toLocaleString()} to {selectedBank}</span>
                  </>
                )}
              </button>

            </form>

          </div>
        </div>
      )}

      {/* TAB 4: Peer Verification Queue & Senate Desk */}
      {activeTab === 'moderation' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>National Senate Peer Review Desk</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Academic Content Verification Pipeline
              </h2>
              <p className="text-xs text-slate-500">
                Assess student uploads, assign review tasks, enforce NUC syllabus benchmarks, and award verification seals.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-500 font-medium">Logged in Reviewer:</span>
                <div className="font-bold text-slate-900">{user.name} ({user.role.toUpperCase()})</div>
              </div>
            </div>
          </div>

          {/* Queue Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setModerationFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                moderationFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Queue ({materials.length})
            </button>

            <button
              onClick={() => setModerationFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                moderationFilter === 'PENDING'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Pending Assignment ({materials.filter(m => !m.verificationStatus || m.verificationStatus === 'PENDING').length})</span>
            </button>

            <button
              onClick={() => setModerationFilter('UNDER_REVIEW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                moderationFilter === 'UNDER_REVIEW'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>Under Review ({materials.filter(m => m.verificationStatus === 'UNDER_REVIEW').length})</span>
            </button>

            <button
              onClick={() => setModerationFilter('REVISION_REQUESTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                moderationFilter === 'REVISION_REQUESTED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              <span>Revisions Needed ({materials.filter(m => m.verificationStatus === 'REVISION_REQUESTED').length})</span>
            </button>

            <button
              onClick={() => setModerationFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                moderationFilter === 'APPROVED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              <span>Verified & Live ({materials.filter(m => m.verificationStatus === 'APPROVED' || m.isVerified).length})</span>
            </button>

            <button
              onClick={() => setModerationFilter('REJECTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                moderationFilter === 'REJECTED'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span>Rejected ({materials.filter(m => m.verificationStatus === 'REJECTED').length})</span>
            </button>
          </div>

          {/* Queue List */}
          <div className="space-y-3">
            {materials
              .filter(m => {
                if (moderationFilter === 'PENDING') return !m.verificationStatus || m.verificationStatus === 'PENDING';
                if (moderationFilter === 'UNDER_REVIEW') return m.verificationStatus === 'UNDER_REVIEW';
                if (moderationFilter === 'REVISION_REQUESTED') return m.verificationStatus === 'REVISION_REQUESTED';
                if (moderationFilter === 'APPROVED') return m.verificationStatus === 'APPROVED' || m.isVerified;
                if (moderationFilter === 'REJECTED') return m.verificationStatus === 'REJECTED';
                return true;
              })
              .map((mat) => {
                const isApproved = mat.verificationStatus === 'APPROVED' || mat.isVerified;
                const isRevision = mat.verificationStatus === 'REVISION_REQUESTED';
                const isRejected = mat.verificationStatus === 'REJECTED';
                const isUnderReview = mat.verificationStatus === 'UNDER_REVIEW';
                const isPending = !isApproved && !isRevision && !isRejected && !isUnderReview;

                return (
                  <div 
                    key={mat.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {mat.institutionId}
                        </span>
                        <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                          {mat.courseCode}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {mat.title}
                        </span>

                        {isApproved && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Senate Verified</span>
                          </span>
                        )}

                        {isRevision && (
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                            <span>Revision Requested</span>
                          </span>
                        )}

                        {isUnderReview && (
                          <span className="text-[11px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-600" />
                            <span>Under Review</span>
                          </span>
                        )}

                        {isPending && (
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Pending Assignment</span>
                          </span>
                        )}

                        {isRejected && (
                          <span className="text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-red-600" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-1">
                        {mat.summary}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span>Contributor: <strong className="text-slate-800">{mat.uploader.name}</strong> ({mat.uploader.badge})</span>
                        <span>Level: <strong>{mat.level}</strong></span>
                        <span>Price: <strong className="text-emerald-700">₦{mat.unlockPrice}</strong></span>
                        <span>Moderator: <strong className="text-slate-800">{mat.assignedModerator ? mat.assignedModerator.name : 'Unassigned'}</strong></span>
                        <span>Audit Logs: <strong>{mat.auditLogs?.length || 0} actions</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => onOpenVerificationModal(mat)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Review & Moderate</span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
};
