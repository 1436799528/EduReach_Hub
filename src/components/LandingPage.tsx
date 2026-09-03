import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Building2, GraduationCap, LogIn, MessageSquare, Search, UserPlus } from 'lucide-react';
import { ServiceInquiryModal } from './ServiceInquiryModal';
import { ServiceItem } from '../types';

interface LandingPageProps {
  isLoggedIn?: boolean;
  onNavigateToTab?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onNavigate?: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth?: (mode?: 'login' | 'register', message?: string) => void;
  onGetStarted?: () => void;
  onOpenDemoCBT?: () => void;
}

const HERO_SLIDES = [
  {
    title: 'Study smarter',
    label: 'Past Questions & Materials',
    image: 'https://cdn.phototourl.com/free/2026-08-30-2f1df47a-b54e-407b-8bbd-3c2411cbe117.png',
  },
  {
    title: 'Stay connected',
    label: 'Campus Feed',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200&auto=format&fit=crop&q=85',
  },
  {
    title: 'Find your courses',
    label: 'My School',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&auto=format&fit=crop&q=85',
  },
  {
    title: 'Get student support',
    label: 'JAMB · WAEC · NECO · NELFUND · Scholarships',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&auto=format&fit=crop&q=85',
  },
];

const SERVICES: ServiceItem[] = [
  { id: 'JAMB', title: 'JAMB', shortDesc: 'JAMB support', detailedDesc: 'JAMB application and support services.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'WAEC', title: 'WAEC', shortDesc: 'WAEC support', detailedDesc: 'WAEC result and examination support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'NECO', title: 'NECO', shortDesc: 'NECO support', detailedDesc: 'NECO result and examination support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'NELFUND_LOAN_APPLICATION', title: 'NELFUND', shortDesc: 'Student loan support', detailedDesc: 'NELFUND application support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'SCHOLARSHIP', title: 'Scholarships', shortDesc: 'Scholarship support', detailedDesc: 'Scholarship application support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
];

const INSTITUTIONS = [
  ['UNICAL', 'University of Calabar'],
  ['UNILAG', 'University of Lagos'],
  ['UI', 'University of Ibadan'],
  ['UNIBEN', 'University of Benin'],
  ['UNN', 'University of Nigeria'],
  ['OAU', 'Obafemi Awolowo University'],
  ['LASU', 'Lagos State University'],
  ['FUTO', 'Federal University of Technology, Owerri'],
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isLoggedIn = false,
  onNavigateToTab,
  onNavigate,
  onOpenAuth,
  onGetStarted,
  onOpenDemoCBT,
}) => {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % HERO_SLIDES.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, []);

  const navigate = (tab: 'feed' | 'my_school' | 'services' | 'profile') => {
    if (onNavigateToTab) onNavigateToTab(tab);
    else onNavigate?.(tab);
  };

  const auth = (mode: 'login' | 'register') => {
    if (onOpenAuth) onOpenAuth(mode);
    else onGetStarted?.();
  };

  const requireAuth = (message: string, action: () => void) => {
    if (!isLoggedIn) {
      onOpenAuth?.('login', message);
      return;
    }
    action();
  };

  const filteredInstitutions = INSTITUTIONS.filter(([shortName, name]) =>
    `${shortName} ${name}`.toLowerCase().includes(schoolQuery.toLowerCase())
  );

  const activeSlide = HERO_SLIDES[slideIndex];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white"><GraduationCap className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight">EduReach <span className="text-orange-600">Hub</span></span>
          </button>

          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Resources</button>
            <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Services</button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Schools</button>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button type="button" onClick={() => navigate('feed')} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700">Open Hub <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <>
                <button type="button" onClick={() => auth('login')} className="hidden rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex items-center gap-1.5"><LogIn className="h-4 w-4 text-orange-600" />Sign in</button>
                <button type="button" onClick={() => auth('register')} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700"><UserPlus className="h-4 w-4" />Join free</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 lg:px-8 lg:pt-14">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-orange-600">EduReach Hub</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Your student hub.</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">Resources, campus updates and student services.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button type="button" onClick={() => requireAuth('Sign in to access your student hub.', () => navigate('feed'))} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-700">Enter Hub <ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => onOpenDemoCBT?.()} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">Try CBT</button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
              <div className="relative h-[320px] sm:h-[390px]">
                {HERO_SLIDES.map((slide, index) => (
                  <img
                    key={slide.label}
                    src={slide.image}
                    alt={slide.label}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === slideIndex ? 'opacity-100' : 'opacity-0'}`}
                  />
                ))}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/75 via-slate-950/25 to-transparent px-5 pb-5 pt-16 text-white">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/85">{activeSlide.label}</p>
                  <h2 className="mt-1 text-2xl font-bold">{activeSlide.title}</h2>
                </div>
                <div className="absolute bottom-4 right-5 flex gap-1.5" aria-label="Hero slideshow navigation">
                  {HERO_SLIDES.map((slide, index) => (
                    <button key={slide.label} type="button" onClick={() => setSlideIndex(index)} aria-label={`Show ${slide.label}`} className={`h-1.5 rounded-full transition-all ${index === slideIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/60'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              <button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="rounded-2xl border border-slate-200 bg-white p-6 text-left hover:border-orange-300 hover:shadow-sm"><BookOpen className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-lg font-bold">My School</h2><p className="mt-1 text-sm text-slate-500">Courses, materials & past questions.</p></button>
              <button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="rounded-2xl border border-slate-200 bg-white p-6 text-left hover:border-orange-300 hover:shadow-sm"><MessageSquare className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-lg font-bold">Campus Feed</h2><p className="mt-1 text-sm text-slate-500">Updates and student posts.</p></button>
              <button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="rounded-2xl border border-slate-200 bg-white p-6 text-left hover:border-orange-300 hover:shadow-sm"><GraduationCap className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-lg font-bold">Student Services</h2><p className="mt-1 text-sm text-slate-500">Essential education services.</p></button>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Services</p><h2 className="mt-1 text-2xl font-bold">Student services</h2></div><button type="button" onClick={() => requireAuth('Sign in to view all services.', () => navigate('services'))} className="text-sm font-semibold text-orange-600">View all →</button></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SERVICES.map((service) => <button key={service.id} type="button" onClick={() => requireAuth('Sign in to request a service.', () => setSelectedService(service))} className="rounded-2xl border border-slate-200 bg-white p-5 text-left hover:border-orange-300 hover:shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><GraduationCap className="h-5 w-5" /></div><h3 className="mt-4 font-bold">{service.title}</h3><p className="mt-1 text-sm text-slate-500">{service.shortDesc}</p></button>)}
          </div>
        </section>

        <section id="schools" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Schools</p><h2 className="mt-1 text-2xl font-bold">Supported institutions</h2></div>
            <div className="relative mt-5 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={schoolQuery} onChange={(e) => setSchoolQuery(e.target.value)} placeholder="Search school" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10" /></div>
            <div className="mt-5 flex flex-wrap gap-2">{filteredInstitutions.map(([shortName, name]) => <span key={shortName} title={name} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">{shortName}</span>)}</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-[1.4fr_.7fr_.7fr]">
            <div>
              <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600"><GraduationCap className="h-5 w-5" /></span><span className="text-lg font-extrabold">EduReach Hub</span></div>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">Academic resources and student services for higher education.</p>
            </div>
            <div><p className="text-sm font-semibold">Platform</p><div className="mt-3 grid gap-2 text-sm text-slate-300"><button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="text-left hover:text-white">My School</button><button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="text-left hover:text-white">Campus Feed</button><button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="text-left hover:text-white">Services</button></div></div>
            <div><p className="text-sm font-semibold">Account</p><div className="mt-3 grid gap-2 text-sm text-slate-300"><button type="button" onClick={() => auth('login')} className="text-left hover:text-white">Sign in</button><button type="button" onClick={() => auth('register')} className="text-left hover:text-white">Create account</button></div></div>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-slate-800 pt-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} EduReach Hub</p><p>Education · Resources · Student Services</p></div>
        </div>
      </footer>

      <ServiceInquiryModal service={selectedService} isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
    </div>
  );
};
