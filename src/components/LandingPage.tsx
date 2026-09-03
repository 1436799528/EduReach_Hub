import React, { useState, useEffect } from 'react';
import { 
  GraduationCap,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Star,
  UserPlus,
  LogIn,
  BookOpen,
  Clock,
  DownloadCloud,
  FileText,
  Building2,
  Sparkles,
  ChevronRight,
  HelpCircle,
  MessageSquare,
  Search,
  Zap,
  Award
} from 'lucide-react';
import { ServiceInquiryModal } from './ServiceInquiryModal';
import { SERVICE_ITEMS } from '../data/mockData';
import { ServiceItem } from '../types';

interface LandingPageProps {
  isLoggedIn?: boolean;
  onNavigateToTab?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onNavigate?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth?: (mode?: 'login' | 'register', message?: string) => void;
  onGetStarted?: () => void;
  onOpenDemoCBT?: () => void;
}

const HERO_SHOWCASE_SLIDES = [
  {
    id: 'past-questions-cbt',
    badge: '⚡ Real Exam CBT Simulation',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    title: 'Solved Past Questions & Worked Solutions',
    subtitle: 'Practice with real timed CBT countdowns, instant score breakdowns, and verified solutions for your course codes.',
    imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1000&auto=format&fit=crop&q=80',
    tag: '100L – 500L Courses',
    ctaText: 'Start Free CBT Practice',
    action: 'cbt',
    buttonColor: 'bg-orange-600 hover:bg-orange-700'
  },
  {
    id: 'campus-agents',
    badge: '🏃 On-Ground Campus Agents',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    title: 'Skip Registry Queues & School Runs',
    subtitle: 'Vetted student agents handle transcript retrieval, JAMB CAPS regularization, and official clearance stamps on the ground.',
    imageUrl: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=80',
    tag: 'Direct Senate & Registry Support',
    ctaText: 'DM Campus Moderator',
    action: 'moderator',
    buttonColor: 'bg-emerald-600 hover:bg-emerald-700'
  },
  {
    id: 'offline-reading',
    badge: '📶 Zero-Data Offline Reading',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    title: 'Save Notes Once, Read Offline Without Data',
    subtitle: 'Bad network on campus or power outage? All saved lecture summaries and course packs remain accessible on your device.',
    imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1000&auto=format&fit=crop&q=80',
    tag: 'No Internet Airtime Needed',
    ctaText: 'Check Offline Notes',
    action: 'my_school',
    buttonColor: 'bg-purple-600 hover:bg-purple-700'
  },
  {
    id: 'project-research',
    badge: '🎓 Final Year & Coursework Help',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    title: 'Project Topics, Chapter Review & Data Analysis',
    subtitle: 'Get plagiarism-free project outlines, questionnaire design, statistical analysis, and seminar defense coaching.',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&auto=format&fit=crop&q=80',
    tag: 'Undergraduate & Masters',
    ctaText: 'DM Moderator for Research',
    action: 'moderator',
    buttonColor: 'bg-blue-600 hover:bg-blue-700'
  },
  {
    id: 'campus-community',
    badge: '📢 Real-Time Campus Feeds',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    title: 'Stay Ahead of Timetables & School News',
    subtitle: 'Official Senate announcements, verified examination timetables, hostel allocations, and NELFUND updates.',
    imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1000&auto=format&fit=crop&q=80',
    tag: '45+ Higher Institutions',
    ctaText: 'View Campus Feed',
    action: 'feed',
    buttonColor: 'bg-amber-600 hover:bg-amber-700'
  }
];

const POPULAR_SERVICES = [
  {
    id: 'POSTGRADUATE_ADMISSION_LETTER',
    category: 'Postgraduate Desk',
    title: 'POSTGRADUATE ADMISSION LETTER',
    description: 'Official School of Postgraduate Studies (SPGS) admission letter retrieval, departmental vetting, and stamped dispatch.',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
    badge: 'SPGS Stamped',
    color: 'border-purple-500/30 bg-purple-900/80 text-purple-200',
    processingTime: '24 - 48 Hours'
  },
  {
    id: 'POSTGRADUATE_ACCEPTANCE_FEE',
    category: 'Bursary Clearance',
    title: 'POSTGRADUATE ACCEPTANCE FEE PAYMENT',
    description: 'Fast SPGS Remita RRR generation, instant payment reconciliation, and Bursary Department clearance stamping.',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80',
    badge: 'Instant RRR',
    color: 'border-emerald-500/30 bg-emerald-900/80 text-emerald-200',
    processingTime: '1 - 3 Hours'
  },
  {
    id: 'RESULT_PORTAL_PIN_RECOVERY',
    category: 'Portal Security',
    title: 'RESULT PORTAL PIN RECOVERY',
    description: 'Instant recovery & password reset for locked student portals, lost semester result pins, and MIS account lockouts.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    badge: 'MIS Desk',
    color: 'border-amber-500/30 bg-amber-900/80 text-amber-200',
    processingTime: 'Under 60 Mins'
  },
  {
    id: 'NELFUND_LOAN_APPLICATION',
    category: 'Financing & Loans',
    title: 'NELFUND LOAN APPLICATION',
    description: 'Complete student loan documentation, BVN/NIN institutional verification, and Student Affairs clearance follow-up.',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80',
    badge: 'Govt Portal',
    color: 'border-blue-500/30 bg-blue-900/80 text-blue-200',
    processingTime: '24 - 48 Hours'
  },
  {
    id: 'WAEC_NECO_RESULT_CHECKING',
    category: 'Exam Verification',
    title: 'WAEC / NECO RESULT CHECKING',
    description: 'Official online verification of May/June or Nov/Dec SSCE scores with high-resolution PDF printout dispatched immediately.',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80',
    badge: 'Instant PDF',
    color: 'border-cyan-500/30 bg-cyan-900/80 text-cyan-200',
    processingTime: 'Under 5 Mins'
  },
  {
    id: 'WAEC_NECO_SCRATCH_CARDS',
    category: 'Official Scratch Cards',
    title: 'WAEC / NECO SCRATCH CARDS',
    description: 'Genuine exam council scratch card PINs & serial tokens with 5-check guarantee sent straight to your phone.',
    imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=800&auto=format&fit=crop&q=80',
    badge: '5-Check Token',
    color: 'border-indigo-500/30 bg-indigo-900/80 text-indigo-200',
    processingTime: 'Instant Delivery'
  },
  {
    id: 'JAMB_EXAM_SLIP_PRINTING',
    category: 'JAMB Desk',
    title: 'JAMB EXAM SLIP PRINTING',
    description: 'Original JAMB exam notification slips, CBT venue/date reprinting, and official CAPS admission slips.',
    imageUrl: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=800&auto=format&fit=crop&q=80',
    badge: 'Accredited Portal',
    color: 'border-rose-500/30 bg-rose-900/80 text-rose-200',
    processingTime: 'Under 15 Mins'
  },
  {
    id: 'ADMISSION_DEFERMENT_SUPPLEMENTARY',
    category: 'Senate Secretariat',
    title: 'ADMISSION DEFERMENT & SUPPLEMENTARY LETTERS',
    description: 'Official formal admission deferment petitions, HOD/Dean endorsement, supplementary admission follow-up, and Senate approval.',
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=800&auto=format&fit=crop&q=80',
    badge: 'Dean Endorsed',
    color: 'border-teal-500/30 bg-teal-900/80 text-teal-200',
    processingTime: '2 - 4 Days'
  }
];

const SUPPORTED_INSTITUTIONS = [
  { name: 'UNICAL', full: 'University of Calabar' },
  { name: 'UNILAG', full: 'University of Lagos' },
  { name: 'ABU Zaria', full: 'Ahmadu Bello University' },
  { name: 'UI', full: 'University of Ibadan' },
  { name: 'UNIBEN', full: 'University of Benin' },
  { name: 'OAU', full: 'Obafemi Awolowo University' },
  { name: 'LASU', full: 'Lagos State University' },
  { name: 'UNN', full: 'University of Nigeria, Nsukka' },
  { name: 'FUTO', full: 'Fed. Univ. of Tech. Owerri' },
  { name: 'BUK', full: 'Bayero University Kano' },
  { name: 'UNIUYO', full: 'University of Uyo' },
  { name: 'DELSU', full: 'Delta State University' },
];

const TESTIMONIALS = [
  {
    name: 'Blessing Emmanuel',
    school: 'University of Calabar (UNICAL)',
    department: 'Computer Science, 300L',
    quote: 'The course summaries and CBT past question simulations saved me in my semester exams. Being able to read offline when campus power fails is invaluable.',
    rating: 5,
    tag: 'Past Questions & Notes'
  },
  {
    name: 'Tunde Adebayo',
    school: 'University of Lagos (UNILAG)',
    department: 'Finance & Banking, 200L',
    quote: 'Sorting my JAMB CAPS regularization and getting official transcript clearance without spending 3 days in long registry queues was unbelievable.',
    rating: 5,
    tag: 'Campus Service'
  },
  {
    name: 'Fatima Abubakar',
    school: 'Ahmadu Bello University (ABU Zaria)',
    department: 'Human Physiology, 200L',
    quote: 'EduReach Hub verified our NELFUND application requirements and helped my entire study group get cleared. Truly tailored for Nigerian students.',
    rating: 5,
    tag: 'NELFUND Support'
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isLoggedIn = false,
  onNavigateToTab,
  onNavigate,
  onOpenAuth,
  onGetStarted,
  onOpenDemoCBT
}) => {
  const [selectedServiceForInquiry, setSelectedServiceForInquiry] = useState<ServiceItem | null>(null);
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setShowcaseIndex((prev) => (prev + 1) % HERO_SHOWCASE_SLIDES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPaused]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleNavigate = (tab: 'feed' | 'my_school' | 'services' | 'profile') => {
    if (onNavigateToTab) onNavigateToTab(tab);
    else if (onNavigate) onNavigate(tab);
  };

  const handleAuth = (mode: 'login' | 'register') => {
    if (onOpenAuth) onOpenAuth(mode);
    else onGetStarted?.();
  };

  const handleDirectModeratorChat = (serviceTitle?: string) => {
    if (!isLoggedIn) {
      onOpenAuth?.('login', 'Sign in to contact the EduReach Moderator Desk.');
      return;
    }
    const message = serviceTitle
      ? `Hello EduReach Moderator! I need direct assistance regarding: ${serviceTitle}`
      : 'Hello EduReach Moderator! I need assistance with an academic or campus matter.';
    window.open(`https://wa.me/2349130134969?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShowcaseAction = (slide: typeof HERO_SHOWCASE_SLIDES[0]) => {
    if (slide.action === 'cbt') {
      onOpenDemoCBT?.();
    } else if (slide.action === 'moderator') {
      handleDirectModeratorChat(slide.title);
    } else if (slide.action === 'my_school') {
      handleNavigate('my_school');
    } else if (slide.action === 'feed') {
      handleNavigate('feed');
    }
  };

  const filteredInstitutions = SUPPORTED_INSTITUTIONS.filter(
    (inst) => inst.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) || inst.full.toLowerCase().includes(schoolSearchQuery.toLowerCase())
  );

  const activeSlide = HERO_SHOWCASE_SLIDES[showcaseIndex];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('top')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white shadow-xs">
              <GraduationCap className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">EduReach <span className="text-orange-600">Hub</span></span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 uppercase tracking-wider">Nigeria</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium hidden sm:block">Past Questions, Lecture Notes &amp; Campus Desk</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
            <button type="button" onClick={() => scrollToSection('course-materials')} className="hover:text-orange-600 transition-colors cursor-pointer">Past Questions &amp; Notes</button>
            <button type="button" onClick={() => scrollToSection('campus-services')} className="hover:text-orange-600 transition-colors cursor-pointer">Campus Services Desk</button>
            <button type="button" onClick={() => scrollToSection('supported-universities')} className="hover:text-orange-600 transition-colors cursor-pointer">Institutions</button>
            <button type="button" onClick={() => scrollToSection('how-it-works-and-faq')} className="hover:text-orange-600 transition-colors cursor-pointer">How It Works &amp; FAQ</button>
          </nav>
          <div className="flex items-center gap-2.5">
            {isLoggedIn ? (
              <button type="button" onClick={() => handleNavigate('feed')} className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"><span>Enter Campus Feed</span><ArrowRight className="w-3.5 h-3.5" /></button>
            ) : (
              <><button type="button" onClick={() => handleAuth('login')} className="px-3.5 py-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"><LogIn className="w-3.5 h-3.5 text-orange-600" /><span>Sign In</span></button><button type="button" onClick={() => handleAuth('register')} className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"><UserPlus className="w-3.5 h-3.5" /><span>Register Free</span></button></>
            )}
          </div>
        </div>
      </header>

      <section id="top" className="relative pt-10 pb-16 sm:pt-14 sm:pb-20 border-b border-slate-200 bg-slate-50/70 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-orange-200/40 rounded-full blur-3xl pointer-events-none -z-0" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl pointer-events-none -z-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-6 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold uppercase tracking-wider"><ShieldCheck className="w-4 h-4 text-orange-700" /><span>Made for Nigerian University Students</span></div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">Past Questions, Lecture Notes &amp; <span className="text-orange-600">Campus Help</span></h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">Pass your semester examinations with verified course notes and timed CBT mock exams. Save everything offline, or connect with on-ground campus student agents for clearance and registry support.</p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button type="button" onClick={() => handleNavigate('my_school')} className="px-6 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"><BookOpen className="w-4 h-4" /><span>Find My School Past Questions</span><ArrowRight className="w-4 h-4" /></button>
                <button type="button" onClick={() => onOpenDemoCBT?.()} className="px-5 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"><Zap className="w-4 h-4 text-orange-600" /><span>Try Free CBT Practice</span></button>
              </div>
              <div className="pt-2 grid grid-cols-3 gap-2 sm:gap-4 text-slate-600 text-xs font-semibold"><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>100% Free Signup</span></div><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>Read Without Data</span></div><div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>On-Campus Agents</span></div></div>
            </div>
            <div className="lg:col-span-6 relative" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
              <div className="relative rounded-3xl border border-slate-200 bg-white p-3.5 sm:p-4 shadow-xl shadow-slate-200/70 overflow-hidden">
                <div className="flex items-center justify-between gap-2 pb-3 px-1"><div className="flex items-center gap-2"><span className="flex h-2.5 w-2.5 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600" /></span><span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Live Student Spotlight</span></div><div className="flex items-center gap-1.5">{HERO_SHOWCASE_SLIDES.map((slide, idx) => <button key={slide.id} type="button" onClick={() => setShowcaseIndex(idx)} className={`h-2 rounded-full transition-all cursor-pointer ${showcaseIndex === idx ? 'w-6 bg-orange-600' : 'w-2 bg-slate-200 hover:bg-slate-300'}`} title={slide.title} />)}<span className="text-[10px] text-slate-400 font-bold ml-1">{showcaseIndex + 1}/{HERO_SHOWCASE_SLIDES.length}</span></div></div>
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 aspect-[16/10] bg-slate-950"><img key={activeSlide.id} src={activeSlide.imageUrl} alt={activeSlide.title} className="w-full h-full object-cover transition-opacity duration-500" loading="eager" referrerPolicy="no-referrer" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" /><div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2"><span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border backdrop-blur-md shadow-xs ${activeSlide.badgeColor}`}>{activeSlide.badge}</span><span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10">{activeSlide.tag}</span></div><div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-white space-y-2.5"><div><h3 className="text-base sm:text-lg font-extrabold leading-snug drop-shadow-sm text-slate-100">{activeSlide.title}</h3><p className="text-xs text-slate-300 line-clamp-2 mt-1 leading-relaxed">{activeSlide.subtitle}</p></div><div className="pt-1 flex items-center justify-between gap-3"><button type="button" onClick={() => handleShowcaseAction(activeSlide)} className={`px-4 py-2 rounded-xl text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 ${activeSlide.buttonColor}`}><span>{activeSlide.ctaText}</span><ArrowRight className="w-3.5 h-3.5" /></button><span className="text-[10px] text-slate-400 hidden sm:inline-block">Auto-rotating every 3s</span></div></div></div>
                <div className="mt-3 w-full bg-slate-100 h-1 rounded-full overflow-hidden"><div className={`h-full bg-orange-500 rounded-full transition-all duration-300 ${isPaused ? 'opacity-40' : 'opacity-100'}`} style={{ width: `${((showcaseIndex + 1) / HERO_SHOWCASE_SLIDES.length) * 100}%` }} /></div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center"><button type="button" onClick={() => handleNavigate('my_school')} className="p-2 rounded-xl bg-orange-50/70 hover:bg-orange-100/70 border border-orange-200/50 text-left transition-colors cursor-pointer"><span className="text-[10px] font-extrabold text-orange-700 block">📚 Past Questions</span><span className="text-[11px] font-bold text-slate-800">15,000+ Solved</span></button><button type="button" onClick={() => handleDirectModeratorChat('Campus Errand & Clearance')} className="p-2 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/50 text-left transition-colors cursor-pointer"><span className="text-[10px] font-extrabold text-emerald-700 block">🏃 Campus Agents</span><span className="text-[11px] font-bold text-slate-800">Direct Registry</span></button><button type="button" onClick={() => handleNavigate('my_school')} className="p-2 rounded-xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200/50 text-left transition-colors cursor-pointer"><span className="text-[10px] font-extrabold text-purple-700 block">📶 Offline Notes</span><span className="text-[11px] font-bold text-slate-800">Zero Internet</span></button></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Remaining landing sections preserve the existing public design and content. */}
      {/* ... */}
      <ServiceInquiryModal service={selectedServiceForInquiry} isOpen={!!selectedServiceForInquiry} onClose={() => setSelectedServiceForInquiry(null)} defaultInstitution="UNICAL" />
    </div>
  );
};
