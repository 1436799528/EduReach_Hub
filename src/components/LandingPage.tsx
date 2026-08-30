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
  MessageSquare,
  FileText,
  Check,
  UserPlus,
  LogIn,
  ChevronRight,
} from 'lucide-react';
import { StudyMaterial, ServiceItem } from '../types';
import { ServiceInquiryModal } from './ServiceInquiryModal';

interface LandingPageProps {
  isLoggedIn: boolean;
  onNavigateToTab: (tab: 'feed' | 'my_school' | 'services' | 'profile') => void;
  onOpenAuth: (mode?: 'login' | 'register', message?: string) => void;
  onPreviewMaterial?: (material: StudyMaterial) => void;
}

const WHATSAPP_DISPLAY = '09130134969';
const WHATSAPP_LINK = 'https://wa.me/2349130134969';
const HERO_IMAGE_URL = 'https://cdn.phototourl.com/free/2026-08-30-83b1df55-b6bf-42d3-9f8a-0fc9c9c89009.jpg';

const platformAreas = [
  {
    icon: BookOpen,
    title: 'Academic Resources',
    description: 'A protected space for study materials and academic support relevant to your school.',
  },
  {
    icon: Briefcase,
    title: 'Student Services',
    description: 'Practical services that help students handle important academic and campus tasks.',
  },
  {
    icon: GraduationCap,
    title: 'Campus Experience',
    description: 'Stay connected with useful information and support around your student journey.',
  },
];

const testimonials = [
  {
    name: 'Blessing Emmanuel',
    school: 'University of Calabar (UNICAL)',
    department: 'Computer Science, 300L',
    quote: 'EduReach Hub puts the academic and campus support I need in one place.',
  },
  {
    name: 'Tunde Adebayo',
    school: 'University of Lagos (UNILAG)',
    department: 'Finance & Banking, 200L',
    quote: 'The platform makes it easier to find the right student support without unnecessary stress.',
  },
  {
    name: 'Fatima Abubakar',
    school: 'Ahmadu Bello University (ABU Zaria)',
    department: 'Human Physiology, 200L',
    quote: 'Having student resources and campus services organized in one place makes a real difference.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isLoggedIn,
  onNavigateToTab,
  onOpenAuth,
}) => {
  const [selectedServiceModal, setSelectedServiceModal] = useState<ServiceItem | null>(null);

  const openApp = () => {
    if (isLoggedIn) {
      onNavigateToTab('my_school');
      return;
    }
    onOpenAuth('register', 'Create your free student account to access EduReach Hub.');
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-orange-500 selection:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50">
        <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-orange-100/70 blur-3xl" aria-hidden="true" />
        <div className="absolute -left-40 bottom-0 h-72 w-72 rounded-full bg-slate-200/70 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-orange-800">
              <ShieldCheck className="h-4 w-4" />
              <span>Built for Nigerian tertiary students</span>
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
              Academic success and on-ground <span className="text-orange-600">campus support.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              EduReach Hub brings academic resources, student services, and useful campus support into one organized platform designed around the real needs of Nigerian students.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={openApp}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                {isLoggedIn ? <BookOpen className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                <span>{isLoggedIn ? 'Go to My School' : 'Create Free Account'}</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              {!isLoggedIn && (
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100"
                >
                  <LogIn className="h-4 w-4 text-orange-600" />
                  <span>Sign In</span>
                </button>
              )}

              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Student Support</span>
              </a>
            </div>

            <div className="mt-8 grid gap-3 text-xs font-semibold text-slate-600 sm:grid-cols-3">
              {['Student-focused', 'Protected resources', 'Simple campus support'].map((point) => (
                <div key={point} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:justify-self-end">
            <div className="absolute -inset-5 rounded-[2rem] bg-orange-100/70 blur-2xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-300/40">
              <div className="overflow-hidden rounded-[1.5rem] bg-slate-100">
                <img
                  src={HERO_IMAGE_URL}
                  alt="EduReach Hub"
                  className="block h-auto max-h-[520px] w-full object-cover"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:block">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="h-4 w-4 text-orange-600" />
                <span>Resources protected by account access</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600">What EduReach Hub does</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">One platform for the student experience.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base">
              EduReach Hub is built to make academic resources and practical campus support easier to reach, without exposing private student resources to the public.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {platformAreas.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-orange-600">The student experience</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Built around what students actually need.</h2>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Lock className="h-4 w-4" />
              Full resources require an account
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {testimonials.map((testimonial) => (
              <article key={testimonial.name} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex gap-1 text-orange-500">
                  {[1, 2, 3, 4, 5].map((star) => <Star key={star} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="mt-5 text-sm leading-6 text-slate-700">“{testimonial.quote}”</p>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <p className="text-sm font-bold text-slate-900">{testimonial.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{testimonial.department}</p>
                  <p className="text-xs text-slate-500">{testimonial.school}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-4 text-center sm:px-6 lg:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Your student workspace starts after sign-up.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Study materials, resource records, and private student content are not displayed on the public landing page. Create an account to enter the platform and access the features available to you.
            </p>
          </div>
          {!isLoggedIn && (
            <button
              type="button"
              onClick={() => onOpenAuth('register', 'Create your free student account to enter EduReach Hub.')}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-500"
            >
              <UserPlus className="h-4 w-4" />
              <span>Create Free Account</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} EduReach Hub. Built for students.</p>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 hover:text-orange-600">
            Student Support: {WHATSAPP_DISPLAY}
          </a>
        </div>
      </footer>

      {selectedServiceModal && (
        <ServiceInquiryModal
          service={selectedServiceModal}
          onClose={() => setSelectedServiceModal(null)}
        />
      )}
    </div>
  );
};
