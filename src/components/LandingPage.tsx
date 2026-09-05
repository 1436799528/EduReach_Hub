import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  LibraryBig,
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
    title: 'Study smarter. Stay ahead.',
    label: 'Past Questions & Study Materials',
    image: 'https://cdn.phototourl.com/free/2026-08-30-2f1df47a-b54e-407b-8bbd-3c2411cbe117.png',
  },
  {
    title: 'Know what is happening on campus.',
    label: 'Campus Feed',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1400&auto=format&fit=crop&q=88',
  },
  {
    title: 'Keep your academic journey organised.',
    label: 'My School & Curriculum',
    image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&auto=format&fit=crop&q=88',
  },
  {
    title: 'Find essential student support faster.',
    label: 'JAMB · WAEC · NECO · NELFUND · Scholarships',
    image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1400&auto=format&fit=crop&q=88',
  },
];

const SERVICES: ServiceItem[] = [
  { id: 'JAMB', title: 'JAMB', shortDesc: 'Admission and examination support', detailedDesc: 'JAMB application and support services.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'WAEC', title: 'WAEC', shortDesc: 'Examination and result support', detailedDesc: 'WAEC result and examination support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'NECO', title: 'NECO', shortDesc: 'Examination and result support', detailedDesc: 'NECO result and examination support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'NELFUND_LOAN_APPLICATION', title: 'NELFUND', shortDesc: 'Student loan application support', detailedDesc: 'NELFUND application support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
  { id: 'SCHOLARSHIP', title: 'Scholarships', shortDesc: 'Find and navigate opportunities', detailedDesc: 'Scholarship application support.', baseFee: 0, processingTime: 'Varies', deliveryMethod: 'Instant WhatsApp & SMS', popularFor: ['ALL'], requiredInputs: [] },
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

const STATS = [
  ['Study Resources', 'Past questions, notes and materials'],
  ['Campus Updates', 'Student conversations and notices'],
  ['Academic Support', 'Courses, curriculum and study tools'],
  ['Student Services', 'JAMB, funding, exams and opportunities'],
  ['Growing Network', 'Built to expand across institutions'],
];

const FEATURE_CARDS = [
  {
    title: 'Academic Resources',
    description: 'Find course materials, past questions and useful study content in one organised place.',
    icon: LibraryBig,
  },
  {
    title: 'Campus Community',
    description: 'Keep up with useful student conversations, updates, opportunities and campus information.',
    icon: MessageSquare,
  },
  {
    title: 'Student Services',
    description: 'Discover important services and support without searching across unrelated platforms.',
    icon: GraduationCap,
  },
  {
    title: 'Your School Space',
    description: 'See your programme, level, courses, curriculum and school resources in one place.',
    icon: Building2,
  },
];

const RESOURCE_CARDS = [
  {
    category: 'Past Questions',
    title: 'Prepare with the questions that matter',
    description: 'Find past examination resources relevant to your school and course.',
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=900&auto=format&fit=crop&q=85',
  },
  {
    category: 'Lecture Materials',
    title: 'Keep your study materials close',
    description: 'Organise useful materials around the courses you are actually taking.',
    image: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=900&auto=format&fit=crop&q=85',
  },
  {
    category: 'CBT Practice',
    title: 'Turn revision into practice',
    description: 'Use practice resources to test what you know before the real examination.',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900&auto=format&fit=crop&q=85',
  },
  {
    category: 'Curriculum',
    title: 'Know what your programme requires',
    description: 'Keep your courses and programme structure easier to understand.',
    image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=900&auto=format&fit=crop&q=85',
  },
];

const TESTIMONIALS = [
  {
    name: 'A student like you',
    role: 'University student',
    quote: 'Everything I usually search for across different student groups can be organised in one place.',
  },
  {
    name: 'Campus user',
    role: 'Undergraduate',
    quote: 'The idea is simple: help students spend less time looking for information and more time using it.',
  },
  {
    name: 'EduReach learner',
    role: 'University student',
    quote: 'Having resources, school information and student services connected makes the platform feel useful every day.',
  },
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
    }, 4800);
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

  const filteredInstitutions = useMemo(
    () => INSTITUTIONS.filter(([shortName, name]) => `${shortName} ${name}`.toLowerCase().includes(schoolQuery.toLowerCase())),
    [schoolQuery],
  );

  const activeSlide = HERO_SLIDES[slideIndex];

  return (
    <div className="er-page min-h-screen overflow-x-hidden text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="group flex items-center gap-3">
            <span className="er-cta flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-600/20">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-lg font-black tracking-tight sm:text-xl">EduReach <span className="text-orange-600">Hub</span></span>
          </button>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-orange-600">Home</button>
            <button type="button" onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">About</button>
            <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Resources</button>
            <button type="button" onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Services</button>
            <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-orange-600">Schools</button>
          </nav>

          <div className="flex items-center gap-2">
            {!isLoggedIn && (
              <button type="button" onClick={() => auth('login')} className="hidden items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">
                <LogIn className="h-4 w-4 text-orange-600" />
                Sign in
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLoggedIn ? navigate('feed') : auth('register'))}
              className="er-cta inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-orange-600/20 sm:px-5"
            >
              {isLoggedIn ? 'Open Hub' : 'Join free'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#fffcf7]">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
            <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-cyan-100/45 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-orange-100/35 blur-3xl" />
          </div>

          <div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[.85fr_1.15fr] lg:px-8 lg:py-20">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Your student hub
              </div>
              <h1 className="max-w-2xl text-5xl font-black leading-[.98] tracking-tight text-slate-950 sm:text-6xl xl:text-7xl">
                Study smarter,
                <span className="block text-orange-600">live connected.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                EduReach Hub brings your academic resources, campus information, school tools and student services together in one place.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => (isLoggedIn ? navigate('feed') : auth('register'))}
                  className="er-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3 text-sm font-black text-white shadow-xl shadow-orange-600/20"
                >
                  {isLoggedIn ? 'Open my hub' : 'Get started'}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDemoCBT?.()}
                  className="er-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm"
                >
                  Try CBT
                  <ChevronRight className="h-4 w-4 text-orange-600" />
                </button>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600" /> Student-first</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600" /> Mobile ready</span>
                <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-orange-600" /> Built for campus life</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-5 rounded-[2.25rem] bg-gradient-to-br from-orange-200/70 via-transparent to-cyan-200/60 blur-2xl" />
              <div className="relative overflow-visible">
                <div className="overflow-hidden rounded-[2rem] border border-white bg-slate-950 p-2 shadow-[0_30px_80px_rgba(15,23,42,.20)]">
                  <div className="relative h-[420px] overflow-hidden rounded-[1.45rem] bg-slate-900 sm:h-[500px]">
                    {HERO_SLIDES.map((slide, index) => (
                      <img
                        key={slide.label}
                        src={slide.image}
                        alt={slide.label}
                        className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ${index === slideIndex ? 'scale-100 opacity-100' : 'scale-[1.05] opacity-0'}`}
                      />
                    ))}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-5">
                      <div className="rounded-full border border-white/20 bg-slate-950/50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white backdrop-blur">EduReach Hub</div>
                      <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur">Student platform</div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-orange-300">{activeSlide.label}</p>
                      <h2 className="mt-2 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl">{activeSlide.title}</h2>
                      <div className="mt-5 flex gap-2">
                        {HERO_SLIDES.map((slide, index) => (
                          <button key={slide.label} type="button" onClick={() => setSlideIndex(index)} aria-label={`Show ${slide.label}`} className={`h-1.5 rounded-full transition-all ${index === slideIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/45'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="er-card absolute -bottom-6 -left-3 hidden rounded-2xl bg-white p-4 sm:block lg:-left-8">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><ShieldCheck className="h-5 w-5" /></div>
                    <div>
                      <p className="text-sm font-black text-slate-900">Built for students</p>
                      <p className="mt-0.5 text-xs text-slate-500">Resources, campus and support</p>
                    </div>
                  </div>
                </div>

                <div className="er-card absolute -right-2 -top-6 hidden rounded-2xl bg-slate-950 p-4 text-white sm:block lg:-right-7">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white"><BookOpen className="h-5 w-5" /></div>
                    <div>
                      <p className="text-xs font-bold text-orange-300">Study space</p>
                      <p className="text-sm font-black">Past Questions + Materials</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-slate-200 sm:grid-cols-3 lg:grid-cols-5">
            {STATS.map(([value, label]) => (
              <div key={value} className="bg-white px-5 py-7 sm:px-6 sm:py-8">
                <p className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">{value}</p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:px-8">
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] bg-orange-100/50 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-100 p-2 shadow-xl">
                <img src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&auto=format&fit=crop&q=88" alt="Students collaborating" className="h-[340px] w-full rounded-[1.5rem] object-cover sm:h-[420px]" />
              </div>
              <div className="er-card absolute -bottom-4 right-4 rounded-2xl bg-white px-4 py-3 shadow-xl sm:right-8">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">One platform</p>
                <p className="mt-1 text-sm font-black text-slate-950">Built around student needs</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Start your journey with us</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">Everything that helps you move through university, connected.</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">EduReach Hub reduces the friction of searching through scattered groups, websites and documents. It gives students a clearer place to study, keep up with campus life and access important support.</p>
              <div className="mt-7 grid gap-4 sm:grid-cols-2">
                {FEATURE_CARDS.map(({ title, description, icon: Icon }, index) => (
                  <div key={title} className="er-card rounded-2xl border-slate-200 bg-white p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><Icon className="h-5 w-5" /></div>
                    <p className="mt-4 text-xs font-black uppercase tracking-[0.1em] text-slate-400">0{index + 1}</p>
                    <h3 className="mt-1.5 text-base font-black text-slate-950">{title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="resources" className="relative overflow-hidden bg-[#fbfbff]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Popular academic areas</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Find the resources that move your studies forward.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Academic content is easier to use when it is organised around what students actually need.</p>
            </div>

            <div className="mt-10 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {['Past Questions', 'Lecture Materials', 'CBT Practice', 'Curriculum', 'Study Notes', 'Course Resources', 'Saved Materials'].map((item, index) => (
                <button key={item} type="button" onClick={() => requireAuth('Sign in to explore academic resources.', () => navigate('my_school'))} className={`whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-black transition ${index === 0 ? 'border-orange-600 bg-orange-600 text-white shadow-md shadow-orange-600/20' : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600'}`}>
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {RESOURCE_CARDS.map((item) => (
                <article key={item.title} className="er-card overflow-hidden rounded-3xl border-slate-200 bg-white">
                  <div className="relative h-48 overflow-hidden">
                    <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/65 to-transparent p-4 pt-10">
                      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-slate-900">{item.category}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-black leading-tight text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
                    <button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-orange-600">Explore <ArrowRight className="h-4 w-4" /></button>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-8 text-center">
              <button type="button" onClick={() => requireAuth('Sign in to explore your academic hub.', () => navigate('my_school'))} className="er-cta inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg">View all academic resources <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        </section>

        <section id="services" className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Student services</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Need something beyond the classroom?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Find important student services and support from one place.</p>
              </div>
              <button type="button" onClick={() => requireAuth('Sign in to view all student services.', () => navigate('services'))} className="er-cta inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 shadow-sm sm:self-auto">View all services <ArrowRight className="h-4 w-4 text-orange-600" /></button>
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {SERVICES.map((service, index) => (
                <button key={service.id} type="button" onClick={() => requireAuth('Sign in to request a student service.', () => setSelectedService(service))} className="er-card group rounded-2xl border-slate-200 bg-white p-5 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><GraduationCap className="h-5 w-5" /></div>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-base font-black text-slate-950">{service.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-5 text-slate-500">{service.shortDesc}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-black text-orange-600">Get support <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.85fr_1.15fr] lg:items-center lg:px-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-300">Why EduReach Hub</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A student platform built to be useful every day.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">The goal is simple: reduce the time students spend searching for information and give them a better place to study, connect and get things done.</p>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {['Academic resources in one place', 'School-aware experiences', 'Campus community information', 'Important student services', 'Built for mobile use', 'Designed to scale across schools'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm font-semibold text-slate-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-orange-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-orange-500/10 blur-3xl" />
              <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.15em] text-orange-300">Your student experience</p>
                    <h3 className="mt-2 text-2xl font-black">One flow. Less friction.</h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20"><Sparkles className="h-5 w-5" /></div>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    ['01', 'Find', 'Search for resources, schools, updates and services.'],
                    ['02', 'Learn', 'Study with materials, past questions and practice tools.'],
                    ['03', 'Connect', 'Keep up with useful campus conversations and information.'],
                    ['04', 'Act', 'Move into the right student service or next step.'],
                  ].map(([number, title, description]) => (
                    <div key={number} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <span className="text-[10px] font-black tracking-[0.12em] text-orange-300">{number}</span>
                      <h4 className="mt-2 text-base font-black text-white">{title}</h4>
                      <p className="mt-1.5 text-xs leading-5 text-slate-400">{description}</p>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => (isLoggedIn ? navigate('feed') : auth('register'))} className="er-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/20">Explore EduReach Hub <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Student voice</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">What the experience should feel like</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Simple enough to understand quickly, useful enough to return to often.</p>
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map((item, index) => (
                <article key={item.name} className="er-card rounded-3xl border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-1 text-orange-500">{Array.from({ length: 5 }).map((_, star) => <Sparkles key={star} className="h-3.5 w-3.5" />)}</div>
                  <p className="mt-5 text-sm leading-7 text-slate-600">“{item.quote}”</p>
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-sm font-black text-slate-950">{item.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{item.role}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">0{index + 1}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="schools" className="bg-[#fbfbff]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Schools</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Find your school in EduReach Hub.</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">As the network grows, more institutions can build richer student experiences inside the same platform.</p>
              </div>

              <div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={schoolQuery} onChange={(e) => setSchoolQuery(e.target.value)} placeholder="Search school by name or short code" className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-11 pr-4 text-sm text-slate-900 outline-none shadow-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {filteredInstitutions.map(([shortName, name]) => (
                    <div key={shortName} title={name} className="er-card rounded-2xl border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-950">{shortName}</span>
                        <Building2 className="h-4 w-4 text-orange-600" />
                      </div>
                      <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{name}</p>
                    </div>
                  ))}
                </div>
                {filteredInstitutions.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">No supported institution matches your search.</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-orange-50">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-6 rounded-[2rem] border border-orange-100 bg-white p-7 shadow-xl shadow-orange-100/40 sm:p-10 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-600">Ready when you are</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Make EduReach Hub part of your student routine.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">Start with a guest preview or create an account and build your own student experience around your school.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                <button type="button" onClick={() => onOpenAuth?.('login')} className="er-cta inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm"><LogIn className="h-4 w-4 text-orange-600" /> Sign in</button>
                <button type="button" onClick={() => auth('register')} className="er-cta inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-600/20"><UserPlus className="h-4 w-4" /> Create account</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_.7fr_.7fr_.8fr]">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-white"><GraduationCap className="h-5 w-5" /></span>
                <span className="text-xl font-black">EduReach Hub</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-7 text-slate-400">Academic resources, campus information, school tools and student services connected in one student-first platform.</p>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-orange-300"><ShieldCheck className="h-3.5 w-3.5" /> Student-first platform</div>
            </div>

            <div>
              <p className="text-sm font-black">Platform</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={() => requireAuth('Sign in to open My School.', () => navigate('my_school'))} className="text-left hover:text-white">My School</button>
                <button type="button" onClick={() => requireAuth('Sign in to open Campus Feed.', () => navigate('feed'))} className="text-left hover:text-white">Campus Feed</button>
                <button type="button" onClick={() => requireAuth('Sign in to view student services.', () => navigate('services'))} className="text-left hover:text-white">Student Services</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-black">Explore</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={() => document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth' })} className="text-left hover:text-white">Resources</button>
                <button type="button" onClick={() => document.getElementById('schools')?.scrollIntoView({ behavior: 'smooth' })} className="text-left hover:text-white">Schools</button>
                <button type="button" onClick={() => onOpenDemoCBT?.()} className="text-left hover:text-white">Try CBT</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-black">Account</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-400">
                <button type="button" onClick={() => auth('login')} className="text-left hover:text-white">Sign in</button>
                <button type="button" onClick={() => auth('register')} className="text-left hover:text-white">Create account</button>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} EduReach Hub. All rights reserved.</p>
            <p>Academic Resources · Campus · Services · Student Life</p>
          </div>
        </div>
      </footer>

      <ServiceInquiryModal service={selectedService} isOpen={Boolean(selectedService)} onClose={() => setSelectedService(null)} />
    </div>
  );
};