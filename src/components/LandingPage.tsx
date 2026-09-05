import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LogIn,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from 'lucide-react';
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
    <div className="er-page min-h-screen text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/60 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1 transition-transform hover:-translate-y-0.5"
          >
            <span className="er-cta er-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="truncate text-lg font-black tracking-tight sm:text-xl">
              EduReach <span className="text-orange-600">Hub</span>
            </span>
          </button>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="transition-colors hover:text-orange-600">Resources</button>
            <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="transition-colors hover:text-orange-600">Services</button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="transition-colors hover:text-orange-600">Schools</button>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isLoggedIn ? (
              <button type="button" onClick={() => navigate('feed')} className="er-cta inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 sm:px-4">
                <span className="hidden xs:inline">Open Hub</span>
                <span className="xs:hidden">Hub</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <button type="button" onClick={() => auth('login')} className="hidden items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 sm:inline-flex">
                  <LogIn className="h-4 w-4 text-orange-600" />
                  Sign in
                </button>
                <button type="button" onClick={() => auth('register')} className="er-cta inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 sm:px-4">
                  <UserPlus className="h-4 w-4" />
                  Join free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-[-8rem] top-[-10rem] h-72 w-72 rounded-full bg-orange-200/30 blur-3xl" />
            <div className="absolute right-[-6rem] top-20 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl" />
          </div>

          <div className="er-content relative grid items-center gap-10 pb-12 pt-8 sm:pb-16 sm:pt-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-12 lg:pb-20 lg:pt-16">
            <div className="er-float max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-orange-700 shadow-sm backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                Built for students
              </div>
              <p className="text-sm font-bold text-orange-600">EduReach Hub</p>
              <h1 className="mt-3 max-w-2xl text-4xl font-black leading-[1.02] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                One place for your <span className="text-orange-600">student life.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Study with better resources, stay close to campus updates, and get essential student services without jumping between platforms.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => requireAuth('Sign in to access your student hub.', () => navigate('feed'))}
                  className="er-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-xl shadow-orange-600/20 sm:px-6"
                >
                  Enter Hub
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDemoCBT?.()}
                  className="er-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/85 px-5 py-3 text-sm font-bold text-slate-800 shadow-md sm:px-6"
                >
                  Try CBT
                  <ChevronRight className="h-4 w-4 text-orange-600" />
                </button>
              </div>

              <div className="mt-8 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ['Materials', 'Study resources'],
                  ['Campus', 'Student updates'],
                  ['Services', 'Essential support'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-sm backdrop-blur">
                    <div className="text-sm font-black text-slate-900">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative lg:pl-2">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-r from-orange-500/10 via-transparent to-cyan-400/10 blur-2xl" />
              <div className="er-card er-tilt er-glow relative overflow-hidden rounded-[1.75rem] border-white/70 bg-slate-950 p-1.5 shadow-2xl shadow-slate-900/15">
                <div className="relative overflow-hidden rounded-[1.35rem] bg-slate-900">
                  <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="rounded-full border border-white/20 bg-slate-950/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur">
                      Student dashboard
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 text-[10px] font-bold text-white/85 backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Live experience
                    </div>
                  </div>

                  <div className="relative h-[320px] sm:h-[430px]">
                    {HERO_SLIDES.map((slide, index) => (
                      <img
                        key={slide.label}
                        src={slide.image}
                        alt={slide.label}
                        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${index === slideIndex ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'}`}
                      />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/5" />
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <div className="max-w-lg">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-300">{activeSlide.label}</p>
                        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{activeSlide.title}</h2>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {['Fast access', 'Mobile ready', 'Student-first'].map((tag) => (
                            <span key={tag} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-5 right-5 flex gap-1.5 sm:right-7 sm:bottom-7" aria-label="Hero slideshow navigation">
                      {HERO_SLIDES.map((slide, index) => (
                        <button
                          key={slide.label}
                          type="button"
                          onClick={() => setSlideIndex(index)}
                          aria-label={`Show ${slide.label}`}
                          className={`h-1.5 rounded-full transition-all ${index === slideIndex ? 'w-7 bg-white' : 'w-1.5 bg-white/50'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="er-card absolute -bottom-5 -left-3 hidden rounded-2xl border-white/80 bg-white/95 p-3 shadow-xl sm:block md:left-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs font-black text-slate-900">Student-first</p>
                    <p className="text-[10px] text-slate-500">Built around your workflow</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="border-y border-slate-200/70 bg-white/55">
          <div className="er-content py-12 sm:py-16">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Your core hub</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Everything important, one tap away.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">The main student spaces are designed to feel connected instead of like separate apps.</p>
              </div>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-3">
              {[
                { title: 'My School', desc: 'Courses, curriculum, materials and past questions.', icon: BookOpen, action: () => requireAuth('Sign in to open My School.', () => navigate('my_school')), label: 'Academic' },
                { title: 'Campus Feed', desc: 'Updates, conversations and useful student posts.', icon: MessageSquare, action: () => requireAuth('Sign in to open Campus Feed.', () => navigate('feed')), label: 'Community' },
                { title: 'Student Services', desc: 'JAMB, WAEC, NECO, NELFUND and scholarships.', icon: GraduationCap, action: () => requireAuth('Sign in to view student services.', () => navigate('services')), label: 'Support' },
              ].map(({ title, desc, icon: Icon, action, label }, index) => (
                <button key={title} type="button" onClick={action} className="er-card er-tilt group relative overflow-hidden rounded-3xl p-6 text-left">
                  <div className="absolute right-0 top-0 h-28 w-28 translate-x-8 -translate-y-8 rounded-full bg-orange-100/70 blur-2xl transition-transform duration-300 group-hover:translate-x-4" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-100">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">0{index + 1} · {label}</span>
                    </div>
                    <h3 className="mt-7 text-xl font-black text-slate-950">{title}</h3>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{desc}</p>
                    <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-black text-orange-600">Open space <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_15%,rgba(249,115,22,.10),transparent_28%),radial-gradient(circle_at_90%_85%,rgba(34,211,238,.08),transparent_24%)]" />
          <div className="er-content relative py-12 sm:py-16">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-600">Student services</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Support that feels simple.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">Start with the service you need, then complete the request through the existing workflow.</p>
              </div>
              <button type="button" onClick={() => requireAuth('Sign in to view all services.', () => navigate('services'))} className="er-cta inline-flex items-center gap-2 self-start rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-black text-orange-700 shadow-sm sm:self-auto">
                View all services <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {SERVICES.map((service, index) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => requireAuth('Sign in to request a service.', () => setSelectedService(service))}
                  className="er-card er-tilt er-cta group rounded-2xl p-5 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-base font-black text-slate-950">{service.title}</h3>
                  <p className="mt-1.5 min-h-10 text-sm leading-5 text-slate-500">{service.shortDesc}</p>
                  <div className="mt-5 inline-flex items-center gap-1 text-xs font-black text-orange-600">Start <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section id="schools" className="border-t border-slate-200/70 bg-slate-950 text-white">
          <div className="er-content py-12 sm:py-16">
            <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-orange-300">Schools</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Designed to grow around your campus.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Start with the institutions already represented in the product, while keeping the experience ready to expand.</p>
              </div>

              <div>
                <div className="relative max-w-xl">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    placeholder="Search school by name or short code"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.07] py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400/60 focus:ring-2 focus:ring-orange-400/10"
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredInstitutions.map(([shortName, name]) => (
                    <div key={shortName} title={name} className="group rounded-xl border border-white/10 bg-white/[0.05] p-3 transition-transform hover:-translate-y-0.5 hover:border-orange-400/40 hover:bg-white/[0.08]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white">{shortName}</span>
                        <Building2 className="h-3.5 w-3.5 text-orange-300/80" />
                      </div>
                      <div className="mt-1 text-[10px] leading-4 text-slate-400">{name}</div>
                    </div>
                  ))}
                </div>
                {filteredInstitutions.length === 0 && (
                  <div className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-400">No supported institution matches your search.</div>
                )}
              </div>
            </div>

            <div className="mt-10 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3">
              {[
                'Responsive on mobile and desktop',
                'Student-first navigation',
                'Built for real workflows',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm font-semibold text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-950 text-white">
        <div className="er-content py-10">
          <div className="grid gap-8 md:grid-cols-[1.4fr_.7fr_.7fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="er-cta flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 shadow-lg shadow-orange-600/20">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <span className="text-lg font-black">EduReach Hub</span>
              </div>
              <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Academic resources, campus updates and student services in one student-first platform.</p>
            </div>

            <div>
              <p className="text-sm font-bold">Platform</p>
              <div className="mt-3 grid gap-2.5 text-sm text-slate-400">
                <button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="text-left transition-colors hover:text-white">My School</button>
                <button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="text-left transition-colors hover:text-white">Campus Feed</button>
                <button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="text-left transition-colors hover:text-white">Services</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold">Account</p>
              <div className="mt-3 grid gap-2.5 text-sm text-slate-400">
                <button type="button" onClick={() => auth('login')} className="text-left transition-colors hover:text-white">Sign in</button>
                <button type="button" onClick={() => auth('register')} className="text-left transition-colors hover:text-white">Create account</button>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} EduReach Hub</p>
            <p>Education · Resources · Student Services</p>
          </div>
        </div>
      </footer>

      <ServiceInquiryModal service={selectedService} isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
    </div>
  );
};
