import React, { useEffect, useState } from 'react';
import { 
  Briefcase, Search, ShieldCheck, Clock, ArrowRight, Building2, Award, Target,
  GraduationCap, FileCheck, Check, Sparkles, MessageSquare, BookOpen, FileText,
  CreditCard, Send, ExternalLink, ChevronRight, Filter, CheckCircle2, X
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
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'admissions' | 'pins' | 'nelfund' | 'academic' | 'registry'>('all');
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
    if (activeCategoryTab === 'admissions') {
      const match = [
        'POSTGRADUATE_ADMISSION_LETTER',
        'POSTGRADUATE_ACCEPTANCE_FEE',
        'ADMISSION_DEFERMENT_SUPPLEMENTARY',
        'DEFERMENT_LETTER'
      ].includes(svc.id) || svc.title.toLowerCase().includes('admission') || svc.title.toLowerCase().includes('postgraduate');
      if (!match) return false;
    }
    if (activeCategoryTab === 'pins') {
      const match = [
        'RESULT_PORTAL_PIN_RECOVERY',
        'WAEC_NECO_RESULT_CHECKING',
        'WAEC_NECO_SCRATCH_CARDS',
        'JAMB_EXAM_SLIP_PRINTING',
        'RESULT_CHECKER_PIN',
        'POST_UTME_SCREENING_PIN'
      ].includes(svc.id) || svc.title.toLowerCase().includes('pin') || svc.title.toLowerCase().includes('scratch') || svc.title.toLowerCase().includes('waec') || svc.title.toLowerCase().includes('jamb');
      if (!match) return false;
    }
    if (activeCategoryTab === 'nelfund') {
      const match = [
        'NELFUND_LOAN_APPLICATION',
        'NELFUND_LOAN_ASSIST',
        'REMITA_FEES_CLEARANCE'
      ].includes(svc.id) || svc.title.toLowerCase().includes('nelfund') || svc.title.toLowerCase().includes('loan');
      if (!match) return false;
    }
    if (activeCategoryTab === 'academic') {
      const match = [
        'ASSIGNMENT_ASSISTANCE',
        'PROJECT_GUIDANCE',
        'RESEARCH_SUPPORT',
        'ACADEMIC_TUTORIALS'
      ].includes(svc.id);
      if (!match) return false;
    }
    if (activeCategoryTab === 'registry') {
      const match = [
        'ACADEMIC_TRANSCRIPT',
        'STATEMENT_OF_RESULT',
        'DEFERMENT_LETTER',
        'REMITA_FEES_CLEARANCE',
        'ADMISSION_DEFERMENT_SUPPLEMENTARY'
      ].includes(svc.id) || svc.title.toLowerCase().includes('transcript') || svc.title.toLowerCase().includes('statement');
      if (!match) return false;
    }
    if (selectedInstitutionFilter !== 'ALL' && svc.popularFor && !svc.popularFor.includes(selectedInstitutionFilter as InstitutionId)) return false;
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchText = `${svc.title} ${svc.shortDesc || ''} ${svc.detailedDesc || ''} ${svc.deliveryMethod || ''} ${svc.id}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const getServiceCategoryMeta = (service: ServiceItem) => {
    if (service.id.includes('PIN') || service.title.toLowerCase().includes('pin') || service.title.toLowerCase().includes('scratch') || service.title.toLowerCase().includes('result')) {
      return { icon: CreditCard, gradient: 'from-amber-500 via-orange-600 to-amber-700', badgeColor: 'bg-amber-500', category: 'Exam & Result PINs' };
    }
    if (service.id.includes('NELFUND') || service.title.toLowerCase().includes('loan') || service.title.toLowerCase().includes('fee') || service.title.toLowerCase().includes('acceptance')) {
      return { icon: Award, gradient: 'from-blue-600 via-indigo-600 to-slate-800', badgeColor: 'bg-blue-600', category: 'Fees & Student Loans' };
    }
    if (service.id.includes('TRANSCRIPT') || service.id.includes('STATEMENT') || service.id.includes('DEFERMENT') || service.id.includes('ADMISSION')) {
      return { icon: FileCheck, gradient: 'from-purple-600 via-indigo-700 to-slate-900', badgeColor: 'bg-purple-600', category: 'Admissions & Registry Desk' };
    }
    if (service.id.includes('ASSIGNMENT') || service.id.includes('PROJECT') || service.id.includes('RESEARCH') || service.id.includes('TUTORIAL')) {
      return { icon: Target, gradient: 'from-emerald-600 via-teal-700 to-slate-800', badgeColor: 'bg-emerald-600', category: 'Academic Coaching' };
    }
    return { icon: Briefcase, gradient: 'from-slate-700 via-slate-800 to-slate-900', badgeColor: 'bg-slate-700', category: 'Campus Service' };
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-800">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>EduReach Campus Services Desk</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Academic & Campus Administrative Services
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                Access official administrative clearance, postgraduate letters, result recovery PINs, NELFUND loan documentation, and on-campus registry desks.
              </p>
            </div>
            <div className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col items-start gap-3 self-start md:self-auto shrink-0 shadow-xs w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Campus Desk</span>
              </div>
              <span className="text-xs text-slate-600">Verified agents stationed across 80+ Nigerian universities.</span>
              <button 
                type="button" 
                id="contact-services-desk-btn"
                onClick={() => filteredServices[0] && setSelectedServiceForInquiry(filteredServices[0])} 
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Contact Services Desk</span>
              </button>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>WAEC, JAMB & NECO</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>NELFUND Applications</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>Postgraduate Admissions</span></div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>Result Portal Recovery</span></div>
          </div>
        </div>

        {/* Dedicated Search Bar & Service Filter Panel */}
        <div id="administrative-services-search-panel" className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Primary Search Input */}
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="services-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search administrative services (e.g., Postgraduate, WAEC, NELFUND, JAMB, PIN recovery, Acceptance fee)..."
                className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  id="clear-services-search-btn"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* University Campus Filter Selector */}
            <div className="flex items-center gap-2.5 shrink-0">
              <select
                id="services-campus-filter"
                value={selectedInstitutionFilter}
                onChange={(e) => setSelectedInstitutionFilter(e.target.value)}
                aria-label="Filter services by university campus"
                className="w-full sm:w-52 py-3.5 pl-3.5 pr-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Universities (80+)</option>
                {INSTITUTIONS.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.shortName} - {inst.name}</option>
                ))}
              </select>

              {(searchQuery || activeCategoryTab !== 'all' || selectedInstitutionFilter !== 'ALL') && (
                <button
                  type="button"
                  id="reset-all-service-filters-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategoryTab('all');
                    setSelectedInstitutionFilter('ALL');
                  }}
                  className="px-3.5 py-3.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Quick-Search Keyword Suggestion Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Search:</span>
            {[
              'Postgraduate',
              'Acceptance Fee',
              'Result PIN',
              'NELFUND Loan',
              'WAEC / NECO',
              'Scratch Cards',
              'JAMB Exam Slip',
              'Deferment Letter'
            ].map((keyword) => {
              const isActive = searchQuery.toLowerCase() === keyword.toLowerCase();
              return (
                <button
                  key={keyword}
                  type="button"
                  id={`quick-search-${keyword.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  onClick={() => setSearchQuery(isActive ? '' : keyword)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-orange-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {keyword}
                </button>
              );
            })}
          </div>

          {/* Category Tabs & Filtered Results Counter */}
          <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 w-full lg:w-auto">
              {[
                ['all', `All Services (${services.length})`],
                ['admissions', 'Postgraduate & Admissions'],
                ['pins', 'Result Checking & PINs'],
                ['nelfund', 'NELFUND & Loans'],
                ['registry', 'Registry & Transcripts'],
                ['academic', 'Academic Coaching'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  id={`services-tab-${id}`}
                  onClick={() => setActiveCategoryTab(id as typeof activeCategoryTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeCategoryTab === id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="text-xs font-semibold text-slate-500 self-end lg:self-auto">
              Showing <span className="font-extrabold text-slate-900">{filteredServices.length}</span> of {services.length} services
            </div>
          </div>
        </div>

        {/* Service Catalog Grid */}
        {servicesLoading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="mx-auto w-8 h-8 rounded-full border-2 border-slate-200 border-t-orange-600 animate-spin" />
            <p className="mt-3 text-xs text-slate-500">Loading current services...</p>
          </div>
        ) : servicesError ? (
          <div className="bg-white rounded-3xl border border-red-200 p-10 text-center shadow-xs">
            <h3 className="text-base font-bold text-slate-900">Service catalogue unavailable</h3>
            <p className="text-xs text-slate-500 mt-1">{servicesError}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div id="no-services-found-state" className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">No Services Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                No administrative services match your search{searchQuery ? ` "${searchQuery}"` : ''}. Try alternative keywords or clear the filters.
              </p>
            </div>
            <button
              type="button"
              id="clear-search-and-filters-btn"
              onClick={() => {
                setSearchQuery('');
                setActiveCategoryTab('all');
                setSelectedInstitutionFilter('ALL');
              }}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Clear Search & Show All</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => {
              const meta = getServiceCategoryMeta(service);
              const CategoryIcon = meta.icon;
              return (
                <div 
                  key={service.id} 
                  id={`service-card-${service.id.toLowerCase()}`}
                  onClick={() => setSelectedServiceForInquiry(service)} 
                  className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-orange-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    {service.imageUrl ? (
                      <img 
                        src={service.imageUrl} 
                        alt={service.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        referrerPolicy="no-referrer" 
                        loading="lazy" 
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-tr ${meta.gradient} flex flex-col items-center justify-center p-6 text-white text-center relative`}>
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner">
                          <CategoryIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-bold tracking-tight text-white/90 line-clamp-1">{service.title}</span>
                        <span className="text-[10px] text-white/70 uppercase tracking-widest mt-1 font-semibold">{meta.category}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/20" />
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs text-[11px] font-bold text-slate-800 shadow-xs flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-orange-600" />
                        {service.processingTime}
                      </span>
                    </div>
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verified Desk
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-orange-600 text-white tracking-wider shadow-xs">
                        {service.deliveryMethod}
                      </span>
                      {service.baseFee > 0 && (
                        <span className="text-xs font-extrabold text-white bg-black/60 backdrop-blur-xs px-2.5 py-0.5 rounded-md">
                          ₦{service.baseFee.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">
                        {service.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {service.shortDesc}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Official EduReach Desk</span>
                        </span>
                        <span className="text-orange-600 flex items-center gap-0.5 font-bold">
                          View details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>

                      <button 
                        type="button" 
                        id={`request-service-btn-${service.id.toLowerCase()}`}
                        onClick={(e) => handleProceedDirect(e, service)} 
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer" 
                        title="Proceed with this service"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Proceed with Service</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Support Banner */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Need Help With an Administrative Service?</h3>
            <p className="text-xs sm:text-sm text-slate-600">Submit a direct request to our campus service desk. Student officers handle all follow-ups and inquiries.</p>
          </div>
          <button 
            type="button" 
            id="open-service-request-footer-btn"
            onClick={() => filteredServices[0] && setSelectedServiceForInquiry(filteredServices[0])} 
            className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0 flex items-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Open Service Request</span>
          </button>
        </div>
      </div>

      <ServiceInquiryModal 
        service={selectedServiceForInquiry} 
        isOpen={!!selectedServiceForInquiry} 
        onClose={() => setSelectedServiceForInquiry(null)} 
        defaultInstitution={user?.institutionId || 'UNICAL'} 
        studentProfile={{ 
          name: user?.name, 
          matricNumber: user?.matricNumber, 
          department: user?.department, 
          level: user?.level, 
          institutionId: user?.institutionId 
        }} 
      />
    </div>
  );
};

