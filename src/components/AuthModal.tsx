import React, { useState } from 'react';
import { 
  X, 
  GraduationCap, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  School, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles
} from 'lucide-react';
import { UserProfile, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  initialMode?: 'login' | 'register';
  redirectMessage?: string;
  onContinueAsGuest?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  initialMode = 'login',
  redirectMessage,
  onContinueAsGuest
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [institutionId, setInstitutionId] = useState<InstitutionId>('UNICAL');
  const [department, setDepartment] = useState('Computer Science');
  const [level, setLevel] = useState('300L');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedUser: UserProfile = {
      id: `usr_${Date.now().toString().slice(-6)}`,
      name: loginEmail.includes('unical') ? 'Blessing Emmanuel (UNICAL Scholar)' : 'Chinedu Okeke',
      email: loginEmail || 'student@edureach.edu.ng',
      phoneNumber: '08148920119',
      institutionId: institutionId || 'UNICAL',
      department: 'Computer Science',
      faculty: 'Science',
      level: '300L',
      walletBalance: 2500,
      isAPlusSubscriber: false,
      enrolledCourses: ['GST 111', 'CSC 301', 'CSC 303'],
      unlockedMaterialIds: ['MAT-GST111-UNICAL-01'],
      savedOfflineMaterialIds: ['MAT-GST111-UNICAL-01'],
      viewHistory: ['MAT-GST111-UNICAL-01'],
      downloadHistory: ['MAT-GST111-UNICAL-01'],
      contributorStats: {
        totalEarned: 12000,
        totalRoyaltyPaid: 8000,
        materialsUploaded: 2,
        pendingPayout: 4000
      },
      agentProfile: {
        isAccredited: true,
        ninNumber: '92841029481',
        cgpa: 4.25,
        guarantorName: 'Dr. E. B. Asuquo',
        guarantorDept: 'Computer Science',
        guarantorPhone: '+234 803 551 8920',
        guarantorStaffId: 'UNICAL/SS/2014/409',
        integrityAgreementSigned: true,
        integritySignedDate: '2025-01-10',
        tier: 'TOP_AGENT_80_20',
        escrowDepositHeld: 10000,
        escrowTarget: 10000,
        totalOrdersCompleted: 35,
        slaSuccessRate: 99.0,
        totalCommissionEarned: 48000,
        availableCommissionBalance: 14500,
        penaltiesCount: 0,
        badges: ['TOP_AGENT_MONTHLY', 'SECURITY_CLEARED']
      },
      role: 'student'
    };

    onLoginSuccess(resolvedUser);
    onClose();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: UserProfile = {
      id: `usr_${Date.now().toString().slice(-6)}`,
      name: name.trim() || 'New Scholar',
      email: email.trim() || 'scholar@edureach.edu.ng',
      phoneNumber: phoneNumber.trim() || '08148920119',
      institutionId,
      department: department.trim() || 'General Studies',
      faculty: 'Science & Arts',
      level,
      walletBalance: 1000, // ₦1,000 welcome grant
      isAPlusSubscriber: false,
      enrolledCourses: ['GST 111'],
      unlockedMaterialIds: [],
      savedOfflineMaterialIds: [],
      viewHistory: [],
      downloadHistory: [],
      contributorStats: {
        totalEarned: 0,
        totalRoyaltyPaid: 0,
        materialsUploaded: 0,
        pendingPayout: 0
      },
      role: 'student'
    };

    onLoginSuccess(newUser);
    onClose();
  };

  const handleQuickDemoScholar = (inst: InstitutionId, demoName: string, dept: string) => {
    const demoUser: UserProfile = {
      id: `usr_demo_${inst.toLowerCase()}`,
      name: demoName,
      email: `${demoName.toLowerCase().replace(/\s+/g, '.')}@student.${inst.toLowerCase()}.edu.ng`,
      phoneNumber: '08148920119',
      institutionId: inst,
      department: dept,
      faculty: 'Science',
      level: '300L',
      walletBalance: 3200,
      isAPlusSubscriber: true,
      enrolledCourses: ['GST 111', 'CSC 301', 'MTH 201'],
      unlockedMaterialIds: ['MAT-GST111-UNICAL-01', 'MAT-MTH101-UNILAG-02'],
      savedOfflineMaterialIds: ['MAT-GST111-UNICAL-01'],
      viewHistory: ['MAT-GST111-UNICAL-01'],
      downloadHistory: ['MAT-GST111-UNICAL-01'],
      contributorStats: {
        totalEarned: 18500,
        totalRoyaltyPaid: 12000,
        materialsUploaded: 3,
        pendingPayout: 6500
      },
      agentProfile: {
        isAccredited: true,
        ninNumber: '92841029481',
        cgpa: 4.38,
        guarantorName: 'Dr. E. B. Asuquo',
        guarantorDept: 'Department of Computer Science',
        guarantorPhone: '+234 803 551 8920',
        guarantorStaffId: `${inst}/SS/2014/409`,
        integrityAgreementSigned: true,
        integritySignedDate: '2025-01-10',
        tier: 'TOP_AGENT_80_20',
        escrowDepositHeld: 10000,
        escrowTarget: 10000,
        totalOrdersCompleted: 48,
        slaSuccessRate: 98.6,
        totalCommissionEarned: 64200,
        availableCommissionBalance: 18400,
        penaltiesCount: 0,
        badges: ['TOP_AGENT_MONTHLY', 'FAST_RESPONDER', 'REGISTRY_EXCELLENCE']
      },
      role: 'student'
    };

    onLoginSuccess(demoUser);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 text-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  EDUREACH <span className="text-orange-500">STUDENT GATE</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Access Campus Materials & Services
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optional Redirect Context Banner */}
        {redirectMessage && (
          <div className="bg-orange-500/10 px-5 py-2.5 border-b border-orange-500/20 flex items-center gap-2 text-xs font-semibold text-orange-300">
            <Sparkles className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span>{redirectMessage}</span>
          </div>
        )}

        {/* Mode Switcher */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs font-bold">
            <button
              onClick={() => setMode('login')}
              className={`py-2 rounded-lg transition-all text-center cursor-pointer ${
                mode === 'login'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In to Account
            </button>
            <button
              onClick={() => setMode('register')}
              className={`py-2 rounded-lg transition-all text-center cursor-pointer ${
                mode === 'register'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register New Student
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Student Email or Matric Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. blessing@student.unical.edu.ng or 21/042144081"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 pl-9 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">
                  Password or Student PIN
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your student password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 pl-9 pr-10 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <span>Sign In to Student Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* 1-Click Fast Student Access */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                  Or One-Click Demo Access as Verified Scholar:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoScholar('UNICAL', 'Blessing Emmanuel (UNICAL Scholar)', 'Computer Science')}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-white text-[11px] truncate">Blessing E. (UNICAL)</div>
                    <div className="text-[10px] text-orange-400">Computer Science 300L</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickDemoScholar('UNILAG', 'Tunde Adebayo (UNILAG)', 'Finance & Banking')}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-orange-500/60 text-left transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-white text-[11px] truncate">Tunde A. (UNILAG)</div>
                    <div className="text-[10px] text-orange-400">Finance & Banking 200L</div>
                  </button>
                </div>
              </div>

            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegisterSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chukwuebuka Obi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 pl-9 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Student Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="you@student.edu.ng"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    WhatsApp Phone
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="08148920119"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    University Campus
                  </label>
                  <select
                    value={institutionId}
                    onChange={(e) => setInstitutionId(e.target.value as InstitutionId)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
                  >
                    {INSTITUTIONS.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.shortName} - {inst.state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Level
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
                  >
                    <option value="100L">100L</option>
                    <option value="200L">200L</option>
                    <option value="300L">300L</option>
                    <option value="400L">400L</option>
                    <option value="500L">500L</option>
                    <option value="PGD/MSc">PGD/MSc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science, Law, Nursing"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Create Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Free Scholar Account</span>
                </button>
              </div>

            </form>
          )}

          {/* Guest Preview Mode */}
          {onContinueAsGuest && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  onContinueAsGuest();
                  onClose();
                }}
                className="text-slate-400 hover:text-orange-400 text-xs font-semibold underline underline-offset-2 transition-colors cursor-pointer"
              >
                Or continue in Guest Preview Mode →
              </button>
            </div>
          )}

        </div>

        {/* Footer Security badge */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Verified Student Data Privacy • 256-bit SSL Protection</span>
        </div>

      </div>
    </div>
  );
};
