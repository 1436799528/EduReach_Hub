import React, { useState } from 'react';
import { 
  Briefcase, 
  Search, 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Phone, 
  FileText, 
  Send,
  Building2,
  X,
  CreditCard,
  Award,
  BookOpen,
  Target,
  GraduationCap,
  MessageSquare,
  HelpCircle,
  FileCheck,
  Check,
  Lock,
  Sparkles
} from 'lucide-react';
import { ServiceItem, ServiceOrder, CampusAgent, InstitutionId, UserProfile } from '../types';
import { SERVICE_ITEMS, CAMPUS_AGENTS, INSTITUTIONS } from '../data/mockData';
import { generateOrderWhatsAppSummary } from '../services/storage';

interface CampusServiceDeskProps {
  user: UserProfile;
  orders: ServiceOrder[];
  onPlaceOrder: (service: ServiceItem, formData: Record<string, string>, targetInstitution: InstitutionId) => void;
  onConfirmReceipt?: (orderId: string) => void;
  onOpenAgentOps?: () => void;
  onOpenWebhookInspector?: () => void;
}

export const CampusServiceDesk: React.FC<CampusServiceDeskProps> = ({
  user,
  orders,
  onPlaceOrder,
  onConfirmReceipt,
  onOpenAgentOps,
  onOpenWebhookInspector
}) => {
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [targetInstitution, setTargetInstitution] = useState<InstitutionId>(user.institutionId || 'UNICAL');
  const [formData, setFormData] = useState<Record<string, string>>({
    matricNumber: '21/042144081',
    whatsappNumber: user.phoneNumber || '08148920119',
    academicSession: '2024/2025',
    semester: '1st Semester',
    department: user.department || 'Computer Science'
  });

  const [activeTrackingOrder, setActiveTrackingOrder] = useState<ServiceOrder | null>(orders[0] || null);
  const [searchTrackingCode, setSearchTrackingCode] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState<'all' | 'academic' | 'registry' | 'pins' | 'tracking'>('all');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    onPlaceOrder(selectedService, formData, targetInstitution);
    setSelectedService(null);
    setActiveCategoryTab('tracking');
  };

  const handleSearchTracking = () => {
    if (!searchTrackingCode.trim()) return;
    const found = orders.find(o => 
      o.trackingCode.toLowerCase().includes(searchTrackingCode.trim().toLowerCase()) ||
      o.id.toLowerCase().includes(searchTrackingCode.trim().toLowerCase())
    );
    if (found) {
      setActiveTrackingOrder(found);
      setActiveCategoryTab('tracking');
    }
  };

  // Filter services by structured category
  const filteredServices = SERVICE_ITEMS.filter(svc => {
    if (activeCategoryTab === 'academic') {
      return ['ASSIGNMENT_ASSISTANCE', 'PROJECT_GUIDANCE', 'RESEARCH_SUPPORT', 'ACADEMIC_TUTORIALS'].includes(svc.id);
    }
    if (activeCategoryTab === 'registry') {
      return ['TRANSCRIPT_PROCESSING', 'STATEMENT_OF_RESULT', 'NELFUND_DOC_PREP', 'CAMPUS_CLEARANCE'].includes(svc.id);
    }
    if (activeCategoryTab === 'pins') {
      return ['RESULT_CHECKER_PIN', 'JAMB_PORTAL_SCRATCH'].includes(svc.id);
    }
    return true;
  });

  const getServiceIcon = (id: string) => {
    switch (id) {
      case 'ASSIGNMENT_ASSISTANCE':
        return <FileCheck className="w-5 h-5 text-orange-600" />;
      case 'PROJECT_GUIDANCE':
        return <Target className="w-5 h-5 text-orange-600" />;
      case 'RESEARCH_SUPPORT':
        return <Search className="w-5 h-5 text-orange-600" />;
      case 'ACADEMIC_TUTORIALS':
        return <GraduationCap className="w-5 h-5 text-orange-600" />;
      case 'TRANSCRIPT_PROCESSING':
      case 'STATEMENT_OF_RESULT':
        return <FileText className="w-5 h-5 text-orange-600" />;
      default:
        return <Building2 className="w-5 h-5 text-orange-600" />;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Clean Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>EduReach Verified Student Services</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Academic Assistance & Campus Service Desk
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
            Direct professional guidance for assignments, projects, empirical research, and fast-track campus registry processing.
          </p>
        </div>

        {/* Value badges */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-600" />
            <span>On-Time Delivery</span>
          </div>
          <span className="text-slate-300">•</span>
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-orange-600" />
            <span>Escrow Protected</span>
          </div>
        </div>
      </div>

      {/* Structured Category Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveCategoryTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'all'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            All Services ({SERVICE_ITEMS.length})
          </button>

          <button
            onClick={() => setActiveCategoryTab('academic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'academic'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Academic & Research
          </button>

          <button
            onClick={() => setActiveCategoryTab('registry')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'registry'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Registry & Transcripts
          </button>

          <button
            onClick={() => setActiveCategoryTab('pins')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategoryTab === 'pins'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            PINs & Scratch Cards
          </button>

          <button
            onClick={() => setActiveCategoryTab('tracking')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategoryTab === 'tracking'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>Track Orders ({orders.length})</span>
          </button>
        </div>

        {/* Quick Tracking Search */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <input
            type="text"
            value={searchTrackingCode}
            onChange={(e) => setSearchTrackingCode(e.target.value)}
            placeholder="Tracking ID (e.g. TRK-)..."
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-orange-500 w-full sm:w-44"
          />
          <button
            onClick={handleSearchTracking}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            Find
          </button>
        </div>
      </div>

      {/* Main View: Catalog vs Tracking */}
      {activeCategoryTab !== 'tracking' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                    {getServiceIcon(service.id)}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                    {service.processingTime}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {service.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {service.shortDesc}
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Delivery Method:
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <Check className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                    <span>{service.deliveryMethod}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Fixed Fee</span>
                  <span className="text-lg font-extrabold text-slate-900">
                    ₦{service.baseFee.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => setSelectedService(service)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Request Service</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Order Tracking & Escrow Release Hub */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Active Orders & Live SLA Pipeline
              </h2>
              <p className="text-xs text-slate-500">
                Track campus agent dispatch, milestone completion, and release funds upon satisfactory delivery.
              </p>
            </div>

            {onOpenWebhookInspector && (
              <button
                onClick={onOpenWebhookInspector}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Inspect Paystack Webhook
              </button>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Orders in Pipeline</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select any academic or campus service above to place an order and track milestone execution.
              </p>
              <button
                onClick={() => setActiveCategoryTab('all')}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold"
              >
                Browse Services
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Orders List Column */}
              <div className="space-y-3">
                {orders.map((order) => {
                  const isSelected = activeTrackingOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => setActiveTrackingOrder(order)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900">{order.serviceTitle}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Code: {order.trackingCode}</span>
                        <span className="font-bold text-slate-700">₦{order.amountPaid.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active Order Detailed Tracking View */}
              {activeTrackingOrder && (
                <div className="lg:col-span-2 bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <div className="text-[11px] font-bold text-orange-600 uppercase">
                        {activeTrackingOrder.targetInstitution} Desk
                      </div>
                      <h3 className="text-base font-bold text-slate-900">
                        {activeTrackingOrder.serviceTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Tracking: <span className="font-mono font-bold text-slate-700">{activeTrackingOrder.trackingCode}</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900">
                        ₦{activeTrackingOrder.amountPaid.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 justify-end">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Escrow Held</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Timeline */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Execution Milestones:
                    </div>
                    <div className="space-y-3 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
                      {activeTrackingOrder.timeline.map((step, idx) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            step.completed ? 'border-orange-600 bg-orange-600' : 'border-slate-300'
                          }`}>
                            {step.completed && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className={`font-bold ${step.completed ? 'text-slate-900' : 'text-slate-500'}`}>
                                {step.stage}
                              </span>
                              <span className="text-[11px] text-slate-400">{step.time}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Escrow Confirmation & Release Action */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {activeTrackingOrder.status === 'COMPLETED' ? 'Order Completed & Escrow Released' : 'Confirm Receipt & Release Escrow'}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {activeTrackingOrder.status === 'COMPLETED'
                          ? 'Agent payout of ₦' + (activeTrackingOrder.amountPaid * 0.85).toLocaleString() + ' has been settled to the campus specialist.'
                          : 'Click confirm once you have received your deliverables to release the campus specialist payout.'}
                      </p>
                    </div>

                    {activeTrackingOrder.status !== 'COMPLETED' && (
                      <button
                        onClick={() => {
                          if (onConfirmReceipt) {
                            onConfirmReceipt(activeTrackingOrder.id);
                          }
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1.5 flex-shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Release</span>
                      </button>
                    )}
                  </div>

                  {/* WhatsApp Specialist Link */}
                  {activeTrackingOrder.assignedAgent && (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold text-xs flex items-center justify-center">
                          {activeTrackingOrder.assignedAgent.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">
                            {activeTrackingOrder.assignedAgent.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Desk Officer • {activeTrackingOrder.assignedAgent.phone}
                          </div>
                        </div>
                      </div>

                      <a
                        href={`https://wa.me/${activeTrackingOrder.assignedAgent.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-500"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>WhatsApp Desk</span>
                      </a>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* Service Request Form Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
                  Service Request Form
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedService.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="space-y-4 pt-4">
              
              {/* Institution Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target University / Campus</label>
                <select
                  value={targetInstitution}
                  onChange={(e) => setTargetInstitution(e.target.value as InstitutionId)}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500"
                >
                  {INSTITUTIONS.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.shortName} - {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dynamic Inputs */}
              {selectedService.requiredInputs.map((input) => (
                <div key={input.field}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {input.label} {input.required && <span className="text-rose-500">*</span>}
                  </label>
                  {input.type === 'select' && input.options ? (
                    <select
                      value={formData[input.field] || ''}
                      onChange={(e) => handleInputChange(input.field, e.target.value)}
                      required={input.required}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500"
                    >
                      <option value="">Select option</option>
                      {input.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={input.type === 'number' ? 'tel' : 'text'}
                      value={formData[input.field] || ''}
                      onChange={(e) => handleInputChange(input.field, e.target.value)}
                      placeholder={input.placeholder}
                      required={input.required}
                      className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500"
                    />
                  )}
                </div>
              ))}

              {/* Fee & Checkout Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-500 block">Total Service Fee</span>
                  <span className="text-base font-bold text-slate-900">₦{selectedService.baseFee.toLocaleString()}</span>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <span>Turnaround: </span>
                  <strong className="text-slate-800">{selectedService.processingTime}</strong>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Proceed to Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
