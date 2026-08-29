import React, { useState } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  Briefcase, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Star, 
  Clock, 
  Lock, 
  Eye, 
  MessageSquare, 
  FileText, 
  Check,
  UserPlus,
  LogIn,
  ChevronRight
} from 'lucide-react';
import { StudyMaterial, ServiceItem } from '../types';
import { STUDY_MATERIALS, SERVICE_ITEMS } from '../data/mockData';
import { ServiceInquiryModal } from './ServiceInquiryModal';

interface LandingPageProps {
  isLoggedIn: boolean;
  onNavigateToTab: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth: (mode?: 'login' | 'register', message?: string) => void;
  onPreviewMaterial?: (material: StudyMaterial) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  isLoggedIn,
  onNavigateToTab,
  onOpenAuth
}) => {
  const [selectedServiceModal, setSelectedServiceModal] = useState<ServiceItem | null>(null);

  // WhatsApp Desk details
  const WHATSAPP_DISPLAY = '09130134969';
  const WHATSAPP_LINK = 'https://wa.me/2349130134969';

  // Curated Preview Teasers (Not dumping everything, but showing high-yield samples)
  const previewMaterials = STUDY_MATERIALS.slice(0, 4);
  const previewServices = SERVICE_ITEMS.slice(0, 6);

  const testimonials = [
    {
      name: 'Blessing Emmanuel',
      school: 'University of Calabar (UNICAL)',
      department: 'Computer Science, 300L',
      quote: 'The solved past questions and formula matrices gave me my first 5.0 semester GPA. The solutions break down each exam question step by step.',
      rating: 5
    },
    {
      name: 'Tunde Adebayo',
      school: 'University of Lagos (UNILAG)',
      department: 'Finance & Banking, 200L',
      quote: 'Got my WAEC Checker PIN in 30 seconds via WhatsApp and had my transcript processed with zero stress. Direct WhatsApp liaison makes everything super fast.',
      rating: 5
    },
    {
      name: 'Fatima Abubakar',
      school: 'Ahmadu Bello University (ABU Zaria)',
      department: 'Human Physiology, 200L',
      quote: 'The NELFUND student loan clearance support on the Services desk saved my application from being disqualified. Every Nigerian student needs EduReach!',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* 1. HERO SECTION: Sharp, high-contrast, focused on core value proposition */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-5">
            
            {/* Top Verified Tag with WhatsApp Hotline */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-orange-700" />
              <span>Verified Academic Hub & Campus Registry Liaison</span>
            </div>

            {/* Sharp Headline */}
            <h1 className="text-3xl sm:text-5xl font-bold text-slate-950 tracking-tight leading-tight">
              Academic Success & On-Ground <span className="text-orange-600">Campus Services</span> for Nigerian Scholars
            </h1>

            {/* Sub-headline */}
            <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
              Access verified Nigerian university past questions, solved syllabus summaries, and connect with on-ground campus desks for WAEC/JAMB PINs, transcript dispatch, and NELFUND loan audits.
            </p>

            {/* Primary Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
              {isLoggedIn ? (
                <button
                  onClick={() => onNavigateToTab('my_school')}
                  className="w-full sm:w-auto px-7 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Go to My School Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onOpenAuth('register', 'Register free to unlock verified past questions and campus study materials')}
                    className="w-full sm:w-auto px-7 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register Free to Access Materials</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onOpenAuth('login')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4 text-orange-600" />
                    <span>Sign In to Account</span>
                  </button>
                </>
              )}

              {/* WhatsApp Link with Official Badge */}
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                title="Chat with Official WhatsApp Liaison Desk"
              >
                <div className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center font-bold text-xs">
                  <MessageSquare className="w-3 h-3" />
                </div>
                <span>WhatsApp: {WHATSAPP_DISPLAY}</span>
              </a>
            </div>

            {/* Key Service Pillar Indicators */}
            <div className="pt-5 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-600 font-semibold">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Solved Degree Exam Past Questions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Instant WAEC & JAMB PINs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>NELFUND Loan & Transcript Clearance</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 2. MAIN FOCUS SECTION 1: STUDY MATERIALS PREVIEW (Teasers prompting registration) */}
      <section className="py-14 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
                <BookOpen className="w-4 h-4" />
                <span>Academic Study Vault</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Verified Past Questions & Lecture Summaries
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Preview sample course solutions below. Register free to unlock full step-by-step answers, formulas, and CBT practice.
              </p>
            </div>

            {!isLoggedIn ? (
              <button
                onClick={() => onOpenAuth('register', 'Register free to explore full study materials archive')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100 font-bold text-xs transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span>Register to Unlock All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={() => onNavigateToTab('my_school')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span>Open Full Study Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Curated Material Teaser Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {previewMaterials.map((mat) => (
              <div
                key={mat.id}
                className="rounded-2xl bg-slate-50 border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                      {mat.courseCode}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {mat.institutionId} • {mat.level}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {mat.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {mat.courseTitle}
                    </p>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {mat.summary}
                  </p>
                </div>

                {/* Registration Teaser Overlay / Button */}
                <div className="pt-4 mt-3 border-t border-slate-200">
                  {isLoggedIn ? (
                    <button
                      onClick={() => onNavigateToTab('my_school')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-400" />
                      <span>View in My School</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenAuth('register', `Register free to view solved past questions and formulas for ${mat.courseCode}`)}
                      className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Register to Unlock</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Banner Prompting Registration */}
          {!isLoggedIn && (
            <div className="p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm sm:text-base font-bold">
                  Looking for your specific department or level past questions?
                </h4>
                <p className="text-xs text-slate-300">
                  Create a free student profile in 30 seconds to filter by university, faculty, level, and semester.
                </p>
              </div>

              <button
                onClick={() => onOpenAuth('register', 'Create your student account to access past questions matching your department')}
                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
              >
                Create Free Account
              </button>
            </div>
          )}

        </div>
      </section>

      {/* 3. MAIN FOCUS SECTION 2: CAMPUS SERVICES PREVIEW */}
      <section className="py-14 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
                <Briefcase className="w-4 h-4" />
                <span>Campus Services Desk</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                On-Ground Registry & Academic Support
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Official assistance for result scratch PINs, transcript dispatch, NELFUND loan audits, and research guidance with direct WhatsApp liaison.
              </p>
            </div>

            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors self-start sm:self-auto"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp Hotline ({WHATSAPP_DISPLAY})</span>
            </a>
          </div>

          {/* Service Previews Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {previewServices.map((svc) => (
              <div
                key={svc.id}
                className="rounded-2xl bg-white border border-slate-200 overflow-hidden flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div className="h-36 w-full bg-slate-100 relative overflow-hidden">
                  {svc.imageUrl ? (
                    <img
                      src={svc.imageUrl}
                      alt={svc.title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white">
                      <Briefcase className="w-8 h-8 text-orange-500" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-md bg-slate-900/90 text-[11px] font-bold text-white">
                    {svc.processingTime}
                  </div>
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-white/95 text-[11px] font-bold text-slate-900">
                    {svc.deliveryMethod.includes('WhatsApp') ? 'Instant Dispatch' : 'Official Registry'}
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                    {svc.title}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {svc.shortDesc}
                  </p>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      onClick={() => setSelectedServiceModal(svc)}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={`https://wa.me/2349130134969?text=${encodeURIComponent(`Hello EduReach Hub! I would like to request information on: ${svc.title}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Request via WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => {
                if (isLoggedIn) {
                  onNavigateToTab('services');
                } else {
                  onOpenAuth('register', 'Register free to access all campus registry and academic support services');
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Explore All Campus Liaison Services</span>
              <ArrowRight className="w-3.5 h-3.5 text-orange-600" />
            </button>
          </div>

        </div>
      </section>

      {/* 4. STUDENT REVIEWS / TESTIMONIALS (Kept as requested) */}
      <section className="py-14 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center space-y-1 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Trusted by Scholars Across Nigeria
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Real feedback from students who achieved academic milestones and resolved registry bottlenecks with EduReach Hub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200">
                  <h4 className="font-bold text-slate-900 text-xs sm:text-sm">{t.name}</h4>
                  <p className="text-xs text-orange-600 font-semibold">{t.school}</p>
                  <p className="text-[11px] text-slate-500">{t.department}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Service Inquiry Modal */}
      <ServiceInquiryModal
        service={selectedServiceModal}
        isOpen={!!selectedServiceModal}
        onClose={() => setSelectedServiceModal(null)}
      />

    </div>
  );
};
