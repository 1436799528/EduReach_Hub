import React, { useEffect, useState } from 'react';
import { 
  Briefcase, Search, ShieldCheck, Clock, ArrowRight, Building2, Award, Target,
  GraduationCap, FileCheck, Check, Sparkles, MessageSquare, BookOpen, FileText,
  CreditCard, Send, ExternalLink, ChevronRight, Filter, CheckCircle2
} from 'lucide-react';
import { ServiceItem, InstitutionId, UserProfile } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { getActiveServiceCatalog } from '../lib/serviceCatalog';
import { ServiceInquiryModal } from './ServiceInquiryModal';

interface MyServicesPageProps { user?: UserProfile; }

export const MyServicesPage: React.FC<MyServicesPageProps> = ({ user }) => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [selectedServiceForInquiry, setSelectedServiceForInquiry] = useState<ServiceItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'pins' | 'nelfund' | 'academic' | 'registry'>('all');
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState<string>('ALL');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setServicesLoading(true);
        setServicesError(null);
        const liveServices = await getActiveServiceCatalog();
        if (mounted) setServices(liveServices);
      } catch (error) {
        console.error('Service catalogue load failed', error);
        if (mounted) setServicesError('Unable to load current services. Please refresh and try again.');
      } finally {
        if (mounted) setServicesLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const WHATSAPP_NUMBER = (import.meta.env.VITE_SERVICES_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, '');

  const generateFormattedWhatsAppUrl = (service: ServiceItem) => {
    const studentName = user?.name?.trim() || 'Prospective Scholar';
    const userInst = user?.institutionId || 'UNICAL';
    const instName = INSTITUTIONS.find(i => i.id === userInst)?.name || userInst;
    const matric = user?.matricNumber?.trim() || 'N/A';
    const dept = user?.department?.trim() || 'General Studies';
    const lvl = user?.level || '300L';

    const message = `Hello EduReach Hub!\nI would like to proceed with the following campus service:\n\nSERVICE: ${service.title}\nINSTITUTION: ${instName} (${userInst})\nSTUDENT NAME: ${studentName}\nMATRIC / REG NO: ${matric}\nDEPARTMENT / LEVEL: ${dept} (${lvl})\nEXPECTED TIMEFRAME: ${service.processingTime}\nDELIVERY METHOD: ${service.deliveryMethod}\n\nPlease provide the next steps and requirements to process my request.`;

    if (!WHATSAPP_NUMBER) return `https://wa.me/?text=${encodeURIComponent(message)}`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const handleProceedDirect = (e: React.MouseEvent, service: ServiceItem) => {
    e.stopPropagation();
    if (!WHATSAPP_NUMBER) {
      setSelectedServiceForInquiry(service);
      return;
    }
    window.open(generateFormattedWhatsAppUrl(service), '_blank', 'noopener,noreferrer');
  };

  const filteredServices = services.filter(svc => {
    if (activeCategoryTab === 'pins' && !['RESULT_CHECKER_PIN', 'POST_UTME_SCREENING_PIN'].includes(svc.id) && !svc.title.toLowerCase().includes('pin') && !svc.title.toLowerCase().includes('scratch')) return false;
    if (activeCategoryTab === 'nelfund' && !['NELFUND_LOAN_ASSIST', 'REMITA_FEES_CLEARANCE'].includes(svc.id) && !svc.title.toLowerCase().includes('nelfund')) return false;
    if (activeCategoryTab === 'academic' && !['ASSIGNMENT_ASSISTANCE', 'PROJECT_GUIDANCE', 'RESEARCH_SUPPORT', 'ACADEMIC_TUTORIALS'].includes(svc.id)) return false;
    if (activeCategoryTab === 'registry' && !['ACADEMIC_TRANSCRIPT', 'STATEMENT_OF_RESULT', 'DEFERMENT_LETTER', 'REMITA_FEES_CLEARANCE'].includes(svc.id)) return false;
    if (selectedInstitutionFilter !== 'ALL' && svc.popularFor && !svc.popularFor.includes(selectedInstitutionFilter as InstitutionId)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!svc.title.toLowerCase().includes(q) && !svc.shortDesc.toLowerCase().includes(q) && !svc.detailedDesc.toLowerCase().includes(q) && !svc.deliveryMethod.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getServiceCategoryMeta = (service: ServiceItem) => {
    if (service.id.includes('PIN') || service.title.toLowerCase().includes('pin')) return { icon: CreditCard, gradient: 'from-amber-500 via-orange-600 to-amber-700', badgeColor: 'bg-amber-500', category: 'Exam & Result PINs' };
    if (service.id.includes('NELFUND') || service.title.toLowerCase().includes('loan')) return { icon: Award, gradient: 'from-blue-600 via-indigo-600 to-slate-800', badgeColor: 'bg-blue-600', category: 'Scholarship & Loan Desk' };
    if (service.id.includes('TRANSCRIPT') || service.id.includes('STATEMENT') || service.id.includes('DEFERMENT')) return { icon: FileCheck, gradient: 'from-purple-600 via-indigo-700 to-slate-900', badgeColor: 'bg-purple-600', category: 'Registry & Senate Desk' };
    if (service.id.includes('ASSIGNMENT') || service.id.includes('PROJECT') || service.id.includes('RESEARCH') || service.id.includes('TUTORIAL')) return { icon: Target, gradient: 'from-emerald-600 via-teal-700 to-slate-800', badgeColor: 'bg-emerald-600', category: 'Academic Coaching' };
    return { icon: Briefcase, gradient: 'from-slate-700 via-slate-800 to-slate-900', badgeColor: 'bg-slate-700', category: 'Campus Service' };
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-800"><ShieldCheck className="w-4 h-4 text-orange-600" /><span>EduReach Campus Services Desk</span></div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">Academic & Campus Liaison Services</h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">Access the current EduReach service catalogue for WAEC, JAMB, NECO, NELFUND, scholarship and campus support requests.</p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col items-start gap-3 self-start md:self-auto shrink-0 shadow-xs w-full sm:w-auto">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Official Services Desk</span></div>
              <span className="text-xs text-slate-600">Moderators handle pending questions and service requests.</span>
              <button type="button" onClick={() => filteredServices[0] && setSelectedServiceForInquiry(filteredServices[0])} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"><MessageSquare className="w-4 h-4" /><span>Contact Services Desk</span></button>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>WAEC, JAMB & NECO</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>NELFUND Applications</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>Scholarship Applications</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>Campus Support</span></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {[
              ['all', `All Services (${services.length})`],
              ['pins', 'Exam & Result PINs'],
              ['nelfund', 'NELFUND Loans & Fees'],
              ['academic', 'Assignments & Research'],
              ['registry', 'Transcripts & Registry'],
            ].map(([id, label]) => <button key={id} onClick={() => setActiveCategoryTab(id as typeof activeCategoryTab)} className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeCategoryTab === id ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}>{label}</button>)}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
            <select value={selectedInstitutionFilter} onChange={(e) => setSelectedInstitutionFilter(e.target.value)} aria-label="Filter services by university campus" className="w-full sm:w-44 py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"><option value="ALL">All Campuses</option>{INSTITUTIONS.map(inst => <option key={inst.id} value={inst.id}>{inst.shortName}</option>)}</select>
            <div className="relative w-full sm:w-60"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" /><input type="text" placeholder="Search services..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" /></div>
          </div>
        </div>

        {servicesLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs"><div className="mx-auto w-8 h-8 rounded-full border-2 border-slate-200 border-t-orange-600 animate-spin" /><p className="mt-3 text-xs text-slate-500">Loading current services...</p></div>
        ) : servicesError ? (
          <div className="bg-white rounded-3xl border border-red-200 p-10 text-center shadow-xs"><h3 className="text-base font-bold text-slate-900">Service catalogue unavailable</h3><p className="text-xs text-slate-500 mt-1">{servicesError}</p></div>
        ) : filteredServices.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs"><div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto"><Search className="w-6 h-6" /></div><h3 className="text-base font-bold text-slate-900 mt-4">No Services Found</h3><p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">No active services match your current filter criteria.</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const meta = getServiceCategoryMeta(service); const CategoryIcon = meta.icon;
              return <div key={service.id} onClick={() => setSelectedServiceForInquiry(service)} className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-orange-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer">
                <div className="relative h-48 w-full bg-slate-100 overflow-hidden">{service.imageUrl ? <img src={service.imageUrl} alt={service.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" loading="lazy" /> : <div className={`w-full h-full bg-gradient-to-tr ${meta.gradient} flex flex-col items-center justify-center p-6 text-white text-center relative`}><div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner"><CategoryIcon className="w-6 h-6 text-white" /></div><span className="text-xs font-bold tracking-tight text-white/90 line-clamp-1">{service.title}</span><span className="text-[10px] text-white/70 uppercase tracking-widest mt-1 font-semibold">{meta.category}</span></div>}<div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/20" /><div className="absolute top-3 left-3"><span className="px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs text-[11px] font-bold text-slate-800 shadow-xs flex items-center gap-1.5"><Clock className="w-3 h-3 text-orange-600" />{service.processingTime}</span></div><div className="absolute top-3 right-3"><span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-400" />Verified</span></div><div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between"><span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-orange-600 text-white tracking-wider shadow-xs">{service.deliveryMethod}</span></div></div>
                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between"><div className="space-y-2"><h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">{service.title}</h3><p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{service.shortDesc}</p></div><div className="pt-4 border-t border-slate-100 space-y-3"><div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold"><span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" /><span>Available through EduReach Services Desk</span></span><span className="text-orange-600 flex items-center gap-0.5">View details <ChevronRight className="w-3 h-3" /></span></div><button type="button" onClick={(e) => handleProceedDirect(e, service)} className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer" title="Proceed with this service"><MessageSquare className="w-4 h-4" /><span>Proceed with Service</span><ArrowRight className="w-3.5 h-3.5 ml-auto" /></button></div></div>
              </div>;
            })}
          </div>
        )}

        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1 text-center sm:text-left"><h3 className="text-base sm:text-lg font-bold text-slate-900">Need Help With a Service?</h3><p className="text-xs sm:text-sm text-slate-600">Submit a request through the service desk. Moderators will review and respond to pending requests.</p></div>
          <button type="button" onClick={() => filteredServices[0] && setSelectedServiceForInquiry(filteredServices[0])} className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-emerald-400" /><span>Open Service Request</span></button>
        </div>
      </div>
      <ServiceInquiryModal service={selectedServiceForInquiry} isOpen={!!selectedServiceForInquiry} onClose={() => setSelectedServiceForInquiry(null)} defaultInstitution={user?.institutionId || 'UNICAL'} studentProfile={{ name: user?.name, matricNumber: user?.matricNumber, department: user?.department, level: user?.level, institutionId: user?.institutionId }} />
    </div>
  );
};
