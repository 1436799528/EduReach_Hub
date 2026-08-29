import React, { useState } from 'react';
import { 
  Briefcase, 
  Search, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Building2,
  Award,
  Target,
  GraduationCap,
  FileCheck,
  Check,
  Sparkles,
  MessageSquare,
  BookOpen,
  FileText,
  CreditCard,
  Send,
  ExternalLink,
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { ServiceItem, InstitutionId, UserProfile } from '../types';
import { SERVICE_ITEMS, INSTITUTIONS } from '../data/mockData';
import { ServiceInquiryModal } from './ServiceInquiryModal';

interface MyServicesPageProps {
  user?: UserProfile;
}

export const MyServicesPage: React.FC<MyServicesPageProps> = ({
  user,
}) => {
  const [selectedServiceForInquiry, setSelectedServiceForInquiry] = useState<ServiceItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'pins' | 'nelfund' | 'academic' | 'registry'>('all');
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState<string>('ALL');

  const WHATSAPP_NUMBER = '2349130134969'; // 09130134969

  // Helper to generate formatted WhatsApp message for direct redirection
  const generateFormattedWhatsAppUrl = (service: ServiceItem) => {
    const studentName = user?.name?.trim() || 'Prospective Scholar';
    const userInst = user?.institutionId || 'UNICAL';
    const instName = INSTITUTIONS.find(i => i.id === userInst)?.name || userInst;
    const matric = user?.matricNumber?.trim() || 'N/A';
    const dept = user?.department?.trim() || 'General Studies';
    const lvl = user?.level || '300L';
    const phone = user?.phoneNumber?.trim() || '09130134969';

    const message = `Hello EduReach Hub! 🎓
I would like to proceed with the following campus service:

📋 *SERVICE:* ${service.title}
🏛️ *INSTITUTION:* ${instName} (${userInst})
👤 *STUDENT NAME:* ${studentName}
🔢 *MATRIC / REG NO:* ${matric}
📚 *DEPARTMENT / LEVEL:* ${dept} (${lvl})
📱 *PHONE / CONTACT:* ${phone}
⏱️ *EXPECTED TIMEFRAME:* ${service.processingTime}
📦 *DELIVERY METHOD:* ${service.deliveryMethod}

Please provide the next steps and requirements to process my request immediately. Thank you!`;

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  // Direct Proceed handler (1-click WhatsApp redirect with formatted message)
  const handleProceedDirect = (e: React.MouseEvent, service: ServiceItem) => {
    e.stopPropagation();
    const url = generateFormattedWhatsAppUrl(service);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filter services by category, search query, and institution
  const filteredServices = SERVICE_ITEMS.filter(svc => {
    if (activeCategoryTab === 'pins') {
      if (!['RESULT_CHECKER_PIN', 'POST_UTME_SCREENING_PIN'].includes(svc.id) && !svc.title.toLowerCase().includes('pin') && !svc.title.toLowerCase().includes('scratch')) return false;
    }
    if (activeCategoryTab === 'nelfund') {
      if (!['NELFUND_LOAN_ASSIST', 'REMITA_FEES_CLEARANCE'].includes(svc.id) && !svc.title.toLowerCase().includes('nelfund')) return false;
    }
    if (activeCategoryTab === 'academic') {
      if (!['ASSIGNMENT_ASSISTANCE', 'PROJECT_GUIDANCE', 'RESEARCH_SUPPORT', 'ACADEMIC_TUTORIALS'].includes(svc.id)) return false;
    }
    if (activeCategoryTab === 'registry') {
      if (!['ACADEMIC_TRANSCRIPT', 'STATEMENT_OF_RESULT', 'DEFERMENT_LETTER', 'REMITA_FEES_CLEARANCE'].includes(svc.id)) return false;
    }

    if (selectedInstitutionFilter !== 'ALL') {
      if (svc.popularFor && !svc.popularFor.includes(selectedInstitutionFilter as InstitutionId)) {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match = svc.title.toLowerCase().includes(q) || 
                    svc.shortDesc.toLowerCase().includes(q) || 
                    svc.detailedDesc.toLowerCase().includes(q) ||
                    svc.deliveryMethod.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Get icon and color scheme for fallback placeholders
  const getServiceCategoryMeta = (service: ServiceItem) => {
    if (service.id.includes('PIN') || service.title.toLowerCase().includes('pin')) {
      return {
        icon: CreditCard,
        gradient: 'from-amber-500 via-orange-600 to-amber-700',
        badgeColor: 'bg-amber-500',
        category: 'Exam & Result PINs'
      };
    }
    if (service.id.includes('NELFUND') || service.title.toLowerCase().includes('loan')) {
      return {
        icon: Award,
        gradient: 'from-blue-600 via-indigo-600 to-slate-800',
        badgeColor: 'bg-blue-600',
        category: 'Scholarship & Loan Desk'
      };
    }
    if (service.id.includes('TRANSCRIPT') || service.id.includes('STATEMENT') || service.id.includes('DEFERMENT')) {
      return {
        icon: FileCheck,
        gradient: 'from-purple-600 via-indigo-700 to-slate-900',
        badgeColor: 'bg-purple-600',
        category: 'Registry & Senate Desk'
      };
    }
    if (service.id.includes('ASSIGNMENT') || service.id.includes('PROJECT') || service.id.includes('RESEARCH') || service.id.includes('TUTORIAL')) {
      return {
        icon: Target,
        gradient: 'from-emerald-600 via-teal-700 to-slate-800',
        badgeColor: 'bg-emerald-600',
        category: 'Academic Coaching'
      };
    }
    return {
      icon: Briefcase,
      gradient: 'from-slate-700 via-slate-800 to-slate-900',
      badgeColor: 'bg-slate-700',
      category: 'Campus Service'
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
        
        {/* Header Hero Section */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-xs relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-xs font-bold text-orange-800">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <span>EduReach Campus Services Desk</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Academic & Campus Liaison Services
              </h1>
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                Connect directly with verified on-ground registry agents across Nigerian universities. Fast-track semester scratch PINs, NELFUND loan audits, transcript dispatch, and academic research assistance directly via WhatsApp.
              </p>
            </div>

            {/* Direct WhatsApp Contact Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex flex-col items-start gap-3 self-start md:self-auto shrink-0 shadow-md border border-slate-700 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Direct WhatsApp Liaison
                </span>
              </div>
              <div className="font-mono text-lg font-black text-white">
                09130134969
              </div>
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello EduReach Hub! 🎓 I need assistance with a campus service.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat Official Desk</span>
              </a>
            </div>
          </div>

          {/* Quick Assurance Badges */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>12+ Accredited Campuses</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Verified On-Ground Agents</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Physical Registry Routing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Zero Queues or Delays</span>
            </div>
          </div>
        </div>

        {/* 3 Core Service Feature Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Pillar 1: Exam PINs */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-orange-300 transition-all">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  WAEC, JAMB & Portal PINs
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Automated token delivery directly to your WhatsApp in under 60 seconds with portal login instructions.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveCategoryTab('pins')}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1.5 cursor-pointer pt-2 border-t border-slate-100"
            >
              <span>View Checker PINs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pillar 2: NELFUND & Scholarship Desk */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  NELFUND Loans & Verification
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Document auditing, admission letter matching, NIN validation, and Dean of Student Affairs clearance.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveCategoryTab('nelfund')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1.5 cursor-pointer pt-2 border-t border-slate-100"
            >
              <span>NELFUND Support Desk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Pillar 3: Academic & Research Desk */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-300 transition-all">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Assignments & Project Guidance
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Original coursework assistance, empirical statistical analysis (SPSS/Python), and defense slides.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveCategoryTab('academic')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1.5 cursor-pointer pt-2 border-t border-slate-100"
            >
              <span>Academic Assistance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Filter Navigation & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-4">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <button
              onClick={() => setActiveCategoryTab('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              All Services ({SERVICE_ITEMS.length})
            </button>

            <button
              onClick={() => setActiveCategoryTab('pins')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'pins'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Exam & Result PINs
            </button>

            <button
              onClick={() => setActiveCategoryTab('nelfund')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'nelfund'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              NELFUND Loans & Fees
            </button>

            <button
              onClick={() => setActiveCategoryTab('academic')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'academic'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Assignments & Research
            </button>

            <button
              onClick={() => setActiveCategoryTab('registry')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategoryTab === 'registry'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Transcripts & Registry
            </button>
          </div>

          {/* Institution Filter and Search */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full lg:w-auto">
            
            {/* Campus Select */}
            <div className="relative w-full sm:w-44">
              <select
                value={selectedInstitutionFilter}
                onChange={(e) => setSelectedInstitutionFilter(e.target.value)}
                aria-label="Filter services by university campus"
                className="w-full py-2 pl-3 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-semibold focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">All Campuses</option>
                {INSTITUTIONS.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.shortName}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>

          </div>
        </div>

        {/* Services Grid with Visual Image Placeholders, Zero Monetary References, and Prominent 'Proceed' Buttons */}
        {filteredServices.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Services Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No campus services match your current filter criteria. Try resetting the filters or searching for another service.
            </p>
            <button
              onClick={() => {
                setActiveCategoryTab('all');
                setSelectedInstitutionFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
            >
              Reset Filters
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
                  onClick={() => setSelectedServiceForInquiry(service)}
                  className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:border-orange-400 hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer"
                >
                  {/* Top Image & Placeholder Banner */}
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
                      /* Rich Fallback Image Placeholder */
                      <div className={`w-full h-full bg-gradient-to-tr ${meta.gradient} flex flex-col items-center justify-center p-6 text-white text-center relative`}>
                        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner">
                          <CategoryIcon className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xs font-bold tracking-tight text-white/90 line-clamp-1">{service.title}</span>
                        <span className="text-[10px] text-white/70 uppercase tracking-widest mt-1 font-semibold">{meta.category}</span>
                      </div>
                    )}
                    
                    {/* Visual Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/20" />
                    
                    {/* Processing Time Badge */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg bg-white/95 backdrop-blur-xs text-[11px] font-bold text-slate-800 shadow-xs flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-orange-600" />
                        {service.processingTime}
                      </span>
                    </div>

                    {/* Verified Official Desk Tag */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        Verified
                      </span>
                    </div>

                    {/* Delivery Method Badge */}
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-center justify-between">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-orange-600 text-white tracking-wider shadow-xs">
                        {service.deliveryMethod}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors leading-snug">
                        {service.title}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {service.shortDesc}
                      </p>
                    </div>

                    {/* Card Actions Area */}
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Active in {service.popularFor?.length || 8}+ Campuses</span>
                        </span>
                        <span className="text-orange-600 hover:underline flex items-center gap-0.5">
                          View details <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>

                      {/* Primary 'Proceed' Button (Formatted WhatsApp Redirection) */}
                      <button
                        type="button"
                        onClick={(e) => handleProceedDirect(e, service)}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                        title="Generate formatted message and proceed to WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>Proceed on WhatsApp</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Help Banner */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Need a Custom Campus Service Not Listed Above?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Our on-ground student affairs liaisons handle custom petitions, course clearances, and special registry requests.
            </p>
          </div>

          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello EduReach Hub! 🎓 I would like to inquire about a custom campus service.')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0 flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Chat Custom Request (09130134969)</span>
          </a>
        </div>

      </div>

      {/* Service Inquiry & WhatsApp Modal */}
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
          phoneNumber: user?.phoneNumber,
          institutionId: user?.institutionId,
        }}
      />
    </div>
  );
};
