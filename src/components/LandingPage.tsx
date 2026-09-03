import React, { useState } from 'react';
import { ArrowRight, BookOpen, Building2, CheckCircle2, GraduationCap, LogIn, MessageSquare, Search, UserPlus } from 'lucide-react';
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

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">EduReach <span className="text-orange-600">Hub</span></span>
          </button>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Resources</button>
            <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Services</button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Schools</button>
          </nav>

          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button type="button" onClick={() => navigate('feed')} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">
                Open Hub <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button type="button" onClick={() => auth('login')} className="hidden items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 sm:inline-flex">
                  <LogIn className="h-4 w-4 text-orange-600" /> Sign in
                </button>
                <button type="button" onClick={() => auth('register')} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700">
                  <UserPlus className="h-4 w-4" /> Join free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
            <div className="max-w-2xl">
              <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">For Nigerian students</span>
              <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">Everything you need for school.</h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Past questions, course materials, campus updates and student services in one place.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => requireAuth('Sign in to access your student hub.', () => navigate('feed'))} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700">
                  Open EduReach <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onOpenDemoCBT?.()} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50">Try CBT</button>
              </div>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-slate-200 pt-6 text-sm">
                <div><CheckCircle2 className="h-5 w-5 text-orange-600" /><p className="mt-2 font-bold">Course resources</p></div>
                <div><CheckCircle2 className="h-5 w-5 text-orange-600" /><p className="mt-2 font-bold">Campus feed</p></div>
                <div><CheckCircle2 className="h-5 w-5 text-orange-600" /><p className="mt-2 font-bold">Student services</p></div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
              <img src={HERO_IMAGE} alt="EduReach Hub" className="h-[380px] w-full object-cover sm:h-[440px]" />
              <div className="absolute left-4 top-4 rounded-xl border border-white/70 bg-white px-3 py-2 text-xs font-bold shadow-sm">WAEC / NECO</div>
              <div className="absolute right-4 top-16 rounded-xl border border-white/70 bg-white px-3 py-2 text-xs font-bold shadow-sm">JAMB</div>
              <div className="absolute bottom-20 left-4 rounded-xl border border-white/70 bg-white px-3 py-2 text-xs font-bold shadow-sm">NELFUND</div>
              <div className="absolute bottom-5 right-4 rounded-xl border border-white/70 bg-white px-3 py-2 text-xs font-bold shadow-sm">Scholarships</div>
            </div>
          </div>
        </section>

        <section id="resources" className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"><BookOpen className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-xl font-bold">My School</h2><p className="mt-2 text-sm text-slate-600">Your courses, materials and past questions.</p><button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="mt-5 text-sm font-bold text-orange-600">Open My School →</button></div>
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"><MessageSquare className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-xl font-bold">Campus Feed</h2><p className="mt-2 text-sm text-slate-600">School updates and student posts.</p><button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="mt-5 text-sm font-bold text-orange-600">Open Feed →</button></div>
            <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"><GraduationCap className="h-6 w-6 text-orange-600" /><h2 className="mt-4 text-xl font-bold">Student Services</h2><p className="mt-2 text-sm text-slate-600">Get help with essential education services.</p><button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="mt-5 text-sm font-bold text-orange-600">View Services →</button></div>
          </div>
        </section>

        <section id="services" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between gap-6">
            <div><p className="text-sm font-bold uppercase tracking-wider text-orange-600">Services</p><h2 className="mt-2 text-3xl font-extrabold tracking-tight">Student services</h2></div>
            <button type="button" onClick={() => requireAuth('Sign in to view all services.', () => navigate('services'))} className="hidden text-sm font-bold text-orange-600 sm:block">View all →</button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {SERVICES.map((service) => (
              <button key={service.id} type="button" onClick={() => requireAuth('Sign in to request a service.', () => setSelectedService(service))} className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><GraduationCap className="h-5 w-5" /></div>
                <h3 className="mt-4 font-bold">{service.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{service.shortDesc}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="schools" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><Building2 className="h-6 w-6 text-orange-600" /><div><p className="text-sm font-bold uppercase tracking-wider text-orange-600">Schools</p><h2 className="text-2xl font-extrabold">Supported institutions</h2></div></div>
            <div className="relative mt-6 max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={schoolQuery} onChange={(e) => setSchoolQuery(e.target.value)} placeholder="Search school" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10" /></div>
            <div className="mt-6 flex flex-wrap gap-2">{filteredInstitutions.map(([shortName, name]) => <span key={shortName} title={name} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700">{shortName}</span>)}</div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} EduReach Hub</p>
          <div className="flex gap-5"><button type="button" onClick={() => auth('login')} className="hover:text-slate-900">Sign in</button><button type="button" onClick={() => auth('register')} className="font-semibold text-orange-600">Join free</button></div>
        </div>
      </footer>

      <ServiceInquiryModal service={selectedService} isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
    </div>
  );
};
