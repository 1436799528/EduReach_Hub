import React, { useState } from 'react';
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

const HERO_IMAGE = 'https://cdn.phototourl.com/free/2026-08-30-2f1df47a-b54e-407b-8bbd-3c2411cbe117.png';

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

export const LandingPage: React.FC<LandingPageProps> = ({ isLoggedIn = false, onNavigateToTab, onNavigate, onOpenAuth, onGetStarted, onOpenDemoCBT }) => {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [schoolQuery, setSchoolQuery] = useState('');

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

  const filteredInstitutions = INSTITUTIONS.filter(([shortName, name]) => `${shortName} ${name}`.toLowerCase().includes(schoolQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white"><GraduationCap className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight">EduReach <span className="text-orange-600">Hub</span></span>
          </button>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 md:flex">
            <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Resources</button>
            <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Services</button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Schools</button>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button type="button" onClick={() => navigate('feed')} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">Open Hub <ArrowRight className="h-4 w-4" /></button>
            ) : (
              <>
                <button type="button" onClick={() => auth('login')} className="hidden items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"><LogIn className="h-4 w-4 text-orange-600" />Sign in</button>
                <button type="button" onClick={() => auth('register')} className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700"><UserPlus className="h-4 w-4" />Join free</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
            <div>
              <p className="text-sm font-semibold text-orange-600">EduReach Hub</p>
              <h1 className="mt-3 max-w-xl text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Learn. Connect. Get support.</h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">Resources, campus information and student services.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => requireAuth('Sign in to access EduReach Hub.', () => navigate('feed'))} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700">Get started <ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => onOpenDemoCBT?.()} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">Try CBT</button>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-700">
                <span className="inline-flex items-center gap-2"><BookOpen className="h-4 w-4 text-orange-600" />Course resources</span>
                <span className="inline-flex items-center gap-2"><MessageSquare className="h-4 w-4 text-orange-600" />Campus feed</span>
                <span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4 text-orange-600" />Student services</span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <img src={HERO_IMAGE} alt="EduReach Hub" className="h-[320px] w-full object-cover sm:h-[400px]" />
              <div className="absolute left-4 top-4 rounded-lg border border-white/80 bg-white px-3 py-2 text-xs font-bold shadow-sm">JAMB</div>
              <div className="absolute right-4 top-12 rounded-lg border border-white/80 bg-white px-3 py-2 text-xs font-bold shadow-sm">WAEC / NECO</div>
              <div className="absolute bottom-16 left-4 rounded-lg border border-white/80 bg-white px-3 py-2 text-xs font-bold shadow-sm">NELFUND</div>
              <div className="absolute bottom-4 right-4 rounded-lg border border-white/80 bg-white px-3 py-2 text-xs font-bold shadow-sm">Scholarships</div>
            </div>
          </div>
        </section>

        <section id="resources" className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div><p className="text-sm font-semibold text-orange-600">Resources</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">Your study space</h2></div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300">
                <BookOpen className="h-6 w-6 text-orange-600" /><h3 className="mt-4 text-lg font-bold">My School</h3><p className="mt-1 text-sm text-slate-500">Courses and materials</p><span className="mt-5 inline-flex text-sm font-bold text-orange-600">Open <ArrowRight className="ml-1 h-4 w-4" /></span>
              </button>
              <button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300">
                <MessageSquare className="h-6 w-6 text-orange-600" /><h3 className="mt-4 text-lg font-bold">Campus Feed</h3><p className="mt-1 text-sm text-slate-500">Updates and student posts</p><span className="mt-5 inline-flex text-sm font-bold text-orange-600">Open <ArrowRight className="ml-1 h-4 w-4" /></span>
              </button>
              <button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="group rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-orange-300">
                <GraduationCap className="h-6 w-6 text-orange-600" /><h3 className="mt-4 text-lg font-bold">Student Services</h3><p className="mt-1 text-sm text-slate-500">JAMB, WAEC, NECO and more</p><span className="mt-5 inline-flex text-sm font-bold text-orange-600">View services <ArrowRight className="ml-1 h-4 w-4" /></span>
              </button>
            </div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-sm font-semibold text-orange-600">Services</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight">Education services</h2></div>
            <button type="button" onClick={() => requireAuth('Sign in to view all services.', () => navigate('services'))} className="hidden text-sm font-bold text-orange-600 sm:block">View all <ArrowRight className="ml-1 inline h-4 w-4" /></button>
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SERVICES.map((service) => (
              <button key={service.id} type="button" onClick={() => requireAuth('Sign in to request a service.', () => setSelectedService(service))} className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-orange-600"><GraduationCap className="h-5 w-5" /></span>
                <h3 className="mt-4 font-bold">{service.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{service.shortDesc}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="schools" className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-orange-600" /><div><p className="text-sm font-semibold text-orange-600">Schools</p><h2 className="mt-1 text-2xl font-extrabold">Supported institutions</h2></div></div>
            <div className="relative mt-6 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={schoolQuery} onChange={(e) => setSchoolQuery(e.target.value)} placeholder="Search school" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10" /></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredInstitutions.map(([shortName, name]) => <div key={shortName} title={name} className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="font-bold text-slate-900">{shortName}</p><p className="mt-0.5 text-xs text-slate-500">{name}</p></div>)}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} EduReach Hub</p>
          <div className="flex gap-5"><button type="button" onClick={() => auth('login')} className="hover:text-slate-900">Sign in</button><button type="button" onClick={() => auth('register')} className="font-semibold text-orange-600">Join free</button></div>
        </div>
      </footer>

      <ServiceInquiryModal service={selectedService} isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
    </div>
  );
};
