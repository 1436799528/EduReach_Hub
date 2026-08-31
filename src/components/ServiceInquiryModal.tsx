import React, { useState } from 'react';
import { ServiceItem, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { X, Send, Phone, MessageSquare, CheckCircle2, ShieldCheck, Clock, Building2, User, BookOpen, Hash } from 'lucide-react';
import { createServiceRequest } from '../lib/productionActions';
import { supabase } from '../lib/supabase';

interface ServiceInquiryModalProps {
  service: ServiceItem | null;
  isOpen: boolean;
  onClose: () => void;
  defaultInstitution?: InstitutionId;
  studentProfile?: {
    name?: string;
    matricNumber?: string;
    department?: string;
    level?: string;
    phoneNumber?: string;
    institutionId?: InstitutionId;
  };
}

export const ServiceInquiryModal: React.FC<ServiceInquiryModalProps> = ({
  service,
  isOpen,
  onClose,
  defaultInstitution = 'UNICAL',
  studentProfile,
}) => {
  if (!isOpen || !service) return null;

  const [fullName, setFullName] = useState(studentProfile?.name || '');
  const [institution, setInstitution] = useState<InstitutionId>(studentProfile?.institutionId || defaultInstitution || 'UNICAL');
  const [matricNumber, setMatricNumber] = useState(studentProfile?.matricNumber || '');
  const [department, setDepartment] = useState(studentProfile?.department || '');
  const [level, setLevel] = useState(studentProfile?.level || '300L');
  const [phone, setPhone] = useState(studentProfile?.phoneNumber || '');
  const [notes, setNotes] = useState('');
  const [extraInputs, setExtraInputs] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const WHATSAPP_NUMBER = '2349130134969';

  const handleExtraInputChange = (field: string, value: string) => {
    setExtraInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleProceedWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);

    const instName = INSTITUTIONS.find((i) => i.id === institution)?.name || institution;

    let extraDetailsText = '';
    if (Object.keys(extraInputs).length > 0) {
      extraDetailsText = '\n' + Object.entries(extraInputs)
        .map(([key, val]) => `• ${key}: ${val}`)
        .join('\n');
    }

    const formData = {
      fullName: fullName.trim(),
      matricNumber: matricNumber.trim(),
      department: department.trim(),
      level,
      phone: phone.trim(),
      notes: notes.trim(),
      institution,
      institutionName: instName,
      serviceInputs: extraInputs,
      serviceTitle: service.title,
    };

    try {
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser();
        if (authData.user) {
          await createServiceRequest(authData.user.id, {
            serviceId: service.id,
            institutionId: institution,
            formData,
          });
        }
      }

      const message = `Hello EduReach Hub! 🎓\nI would like to request the following campus service:\n\n📋 *SERVICE:* ${service.title}\n🏛️ *INSTITUTION:* ${instName} (${institution})\n👤 *STUDENT NAME:* ${fullName.trim() || 'Prospective Scholar'}\n🔢 *MATRIC / REG NO:* ${matricNumber.trim() || 'N/A'}\n📚 *DEPARTMENT / LEVEL:* ${department.trim() || 'General'} (${level})\n📱 *PHONE / WHATSAPP:* ${phone.trim() || 'N/A'}\n⏱️ *EXPECTED TIMEFRAME:* ${service.processingTime}\n${extraDetailsText ? `\n🔍 *SERVICE INPUTS:*${extraDetailsText}` : ''}\n${notes.trim() ? `\n📝 *ADDITIONAL NOTES / REQUEST:* \n"${notes.trim()}"` : ''}\n\nPlease let me know the processing requirements so we can proceed immediately. Thank you!`;

      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setIsSubmitted(true);
    } catch (error) {
      console.error('Service request submission failed', error);
      setSubmitError('We could not save your service request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
          {service.imageUrl ? (
            <img src={service.imageUrl} alt={service.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
              <BookOpen className="w-12 h-12 text-white/80" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-transparent" />
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors backdrop-blur-xs" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-5 right-5 text-white">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-orange-600/90 text-xs font-semibold uppercase tracking-wider text-white shadow-xs backdrop-blur-xs mb-1.5">
              Official Campus Desk
            </span>
            <h3 className="text-xl font-bold leading-snug drop-shadow-xs">{service.title}</h3>
          </div>
        </div>

        <div className="p-6">
          {isSubmitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h4 className="text-2xl font-bold text-slate-900">Request Saved</h4>
              <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                Your service request has been recorded. WhatsApp was opened with the same request details for direct liaison.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/20">
                  <MessageSquare className="w-5 h-5" />
                  Open WhatsApp
                </a>
                <button type="button" onClick={() => { setIsSubmitted(false); onClose(); }} className="px-5 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProceedWhatsApp} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-slate-800 mb-0.5">Request Tracking</p>
                  Submit your request to EduReach Hub first. WhatsApp then opens with the same details for direct liaison.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Your Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input type="text" required placeholder="e.g. John Emmanuel" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Institution / University *</label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <select value={institution} onChange={(e) => setInstitution(e.target.value as InstitutionId)} className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer">
                      {INSTITUTIONS.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name} ({inst.shortName})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Matric / Reg / JAMB No.</label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input type="text" placeholder="e.g. 21/042144023" value={matricNumber} onChange={(e) => setMatricNumber(e.target.value)} className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Department & Level</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. Computer Science" value={department} onChange={(e) => setDepartment(e.target.value)} className="w-2/3 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-1/3 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all">
                      <option value="100L">100L</option><option value="200L">200L</option><option value="300L">300L</option><option value="400L">400L</option><option value="500L">500L</option><option value="Postgraduate">PG</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Your WhatsApp Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input type="tel" required placeholder="e.g. 08123456789" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
                </div>
              </div>

              {service.requiredInputs && service.requiredInputs.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Service Specific Requirements</p>
                  {service.requiredInputs.map((input) => {
                    if (['matricNumber', 'whatsappNumber', 'department'].includes(input.field)) return null;
                    return (
                      <div key={input.field}>
                        <label className="block text-xs font-medium text-slate-700 mb-1">{input.label} {input.required && <span className="text-orange-600">*</span>}</label>
                        {input.type === 'select' ? (
                          <select required={input.required} value={extraInputs[input.label] || ''} onChange={(e) => handleExtraInputChange(input.label, e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
                            <option value="">-- Select option --</option>
                            {input.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input type={input.type === 'number' ? 'number' : 'text'} required={input.required} placeholder={input.placeholder || ''} value={extraInputs[input.label] || ''} onChange={(e) => handleExtraInputChange(input.label, e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Additional Details or Urgent Instructions</label>
                <textarea rows={2} placeholder="e.g. Need this within 48 hours for bursary deadline..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none" />
              </div>

              {submitError && <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">{submitError}</div>}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-4 h-4 text-orange-500" /><span>SLA: {service.processingTime}</span></div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 transition-all hover:translate-y-px active:translate-y-0">
                    <Send className="w-4 h-4" />
                    {isSubmitting ? 'Saving…' : 'Save & Proceed'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
