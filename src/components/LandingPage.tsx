import React from 'react';
import {
  GraduationCap,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Star,
  Lock,
  UserPlus,
  LogIn,
} from 'lucide-react';

interface LandingPageProps {
  isLoggedIn: boolean;
  onNavigateToTab: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth: (mode?: 'login' | 'register', message?: string) => void;
}

const HERO_IMAGE_URL = 'https://cdn.phototourl.com/free/2026-08-30-2f1df47a-b54e-407b-8bbd-3c2411cbe117.png';

const services = [
  { title: 'WAEC / NECO', description: 'Registration and examination support.' },
  { title: 'JAMB', description: 'Application and admission support.' },
  { title: 'NELFUND Application', description: 'Guidance with student loan applications.' },
  { title: 'Scholarship Application', description: 'Support with finding and applying for scholarships.' },
];

const testimonials = [
  {
    name: 'Blessing Emmanuel',
    school: 'University of Calabar (UNICAL)',
    department: 'Computer Science, 300L',
    quote: 'EduReach Hub puts the academic and campus support I need in one place.',
    rating: 5,
  },
  {
    name: 'Tunde Adebayo',
    school: 'University of Lagos (UNILAG)',
    department: 'Finance & Banking, 200L',
    quote: 'The platform makes it easier to find the right student support without unnecessary stress.',
    rating: 5,
  },
  {
    name: 'Fatima Abubakar',
    school: 'Ahmadu Bello University (ABU Zaria)',
    department: 'Human Physiology, 200L',
    quote: 'Having student resources and campus services organized in one place makes a real difference.',
    rating: 5,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ isLoggedIn, onNavigateToTab, onOpenAuth }) => {
  const handleServiceClick = () => {
    if (isLoggedIn) {
      onNavigateToTab('services');
      return;
    }
    onOpenAuth('register', 'Create your free student account to access EduReach Hub services.');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      {/* Public home: explain the platform without exposing application resources. */}
      <section className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 border-b border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-8">
            <div className="text-left max-w-3xl space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-200 text-orange-900 text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-orange-700" />
                <span>Verified Academic Hub & Campus Registry Liaison</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold text-slate-950 tracking-tight leading-tight">
                Academic Success & On-Ground <span className="text-orange-600">Campus Services</span> for Nigerian Scholars
              </h1>

              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed font-medium">
                EduReach Hub brings academic support, student services, and useful campus assistance into one organized platform designed around the real needs of Nigerian students.
              </p>

              <div className="pt-3 flex flex-col sm:flex-row items-center lg:items-start gap-3">
                {isLoggedIn ? (
                  <button
                    onClick={() => onNavigateToTab('feed')}
                    className="w-full sm:w-auto px-7 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4" />
                    <span>Go to Campus Feed</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => onOpenAuth('register', 'Create your free student account to access EduReach Hub.')}
                      className="w-full sm:w-auto px-7 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Register Free</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onOpenAuth('login')}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm border border-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogIn className="w-4 h-4 text-orange-600" />
                      <span>Sign In</span>
                    </button>
                  </>
                )}
              </div>

              <div className="pt-5 flex flex-wrap items-center gap-6 text-xs text-slate-600 font-semibold">
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Student-focused</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Protected resources</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>Moderator support</span></div>
              </div>
            </div>

            <div className="relative mt-12 lg:mt-0 lg:pl-6">
              <div className="absolute -inset-5 rounded-[2rem] bg-orange-100/70 blur-2xl" aria-hidden="true" />
              <div className="relative px-2 py-4 sm:px-6 lg:px-10 overflow-visible">
                <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/40">
                  <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
                    <img
                      src={HERO_IMAGE_URL}
                      alt="EduReach Hub student platform"
                      className="block h-auto max-h-[540px] w-full object-cover"
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-x-0 top-1/2 hidden -translate-y-1/2 justify-between sm:flex">
                  <div className="pointer-events-auto -ml-1 w-44 space-y-3 lg:-ml-3">
                    {services.slice(0, 2).map((service) => (
                      <button
                        key={service.title}
                        type="button"
                        onClick={handleServiceClick}
                        className="w-full rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-xl shadow-slate-300/30 backdrop-blur transition-transform hover:-translate-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">{service.title}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-orange-600" />
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">{service.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="pointer-events-auto -mr-1 w-44 space-y-3 lg:-mr-3">
                    {services.slice(2, 4).map((service) => (
                      <button
                        key={service.title}
                        type="button"
                        onClick={handleServiceClick}
                        className="w-full rounded-2xl border border-slate-200 bg-white/95 p-4 text-left shadow-xl shadow-slate-300/30 backdrop-blur transition-transform hover:-translate-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">{service.title}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-orange-600" />
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-slate-500">{service.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:hidden">
                  {services.map((service) => (
                    <button key={service.title} type="button" onClick={handleServiceClick} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                      {service.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Public explanation only. No mock resources or resource previews are rendered here. */}
      <section className="py-14 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-1 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
              <Briefcase className="w-4 h-4" />
              <span>What EduReach Hub provides</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Academic Support & Student Services</h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Students can access their school resources, student uploads, materials, past questions, projects, and other protected features after creating an account.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { title: 'Academic Resources', text: 'School-specific materials, past questions, projects, and other learning resources.' },
              { title: 'Student Community', text: 'A private student space for useful uploads, discussions, projects, and shared academic support.' },
              { title: 'Campus Services', text: 'Access the available student services through the authenticated platform.' },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1 max-w-xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Private Student Workspace</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Your resources stay behind your account</h2>
              <p className="text-xs sm:text-sm text-slate-600">
                The public homepage does not display mock resources or private resource records. Sign in to enter the student workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => isLoggedIn ? onNavigateToTab('feed') : onOpenAuth('register', 'Create your free student account to enter the student workspace.')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>{isLoggedIn ? 'Open Campus Feed' : 'Create Free Account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-1 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Trusted by Scholars Across Nigeria</h2>
            <p className="text-xs sm:text-sm text-slate-600">Feedback from students using EduReach Hub for academic and campus support.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1 text-amber-500" aria-label={`${t.rating} out of 5 stars`}>
                    {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">"{t.quote}"</p>
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
    </div>
  );
};
