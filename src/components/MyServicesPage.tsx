import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, ExternalLink, MessageSquare, Search, ShieldCheck, X } from 'lucide-react';
import { ServiceItem, InstitutionId, UserProfile } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { getActiveServiceCatalog } from '../lib/serviceCatalog';
import { ServiceInquiryModal } from './ServiceInquiryModal';

interface MyServicesPageProps { user?: UserProfile; }

const serviceGroups = [
  { id: 'all', label: 'All' },
  { id: 'admissions', label: 'Admissions' },
  { id: 'pins', label: 'JAMB / WAEC / NECO' },
  { id: 'nelfund', label: 'NELFUND' },
  { id: 'academic', label: 'Academic' },
  { id: 'registry', label: 'Registry' },
] as const;

type ServiceGroup = typeof serviceGroups[number]['id'];

const matchesGroup = (service: ServiceItem, group: ServiceGroup) => {
  if (group === 'all') return true;
  const text = `${service.id} ${service.title}`.toLowerCase();
  if (group === 'admissions') return text.includes('admission') || text.includes('postgraduate') || text.includes('deferment');
  if (group === 'pins') return text.includes('jamb') || text.includes('waec') || text.includes('neco') || text.includes('pin') || text.includes('scratch') || text.includes('result');
  if (group === 'nelfund') return text.includes('nelfund') || text.includes('loan') || text.includes('remita');
  if (group === 'academic') return text.includes('assignment') || text.includes('project') || text.includes('research') || text.includes('tutorial');
  return text.includes('transcript') || text.includes('statement') || text.includes('registry');
};

const getCategoryLabel = (service: ServiceItem) => {
  const text = `${service.id} ${service.title}`.toLowerCase();
  if (text.includes('jamb') || text.includes('waec') || text.includes('neco') || text.includes('pin') || text.includes('scratch')) return 'JAMB / WAEC / NECO';
  if (text.includes('nelfund') || text.includes('loan')) return 'NELFUND';
  if (text.includes('transcript') || text.includes('statement') || text.includes('registry')) return 'Registry';
  if (text.includes('assignment') || text.includes('project') || text.includes('research') || text.includes('tutorial')) return 'Academic';
  return 'Admissions';
};

export const MyServicesPage: React.FC<MyServicesPageProps> = ({ user }) => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ServiceGroup>('all');
  const [institution, setInstitution] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const catalog = await getActiveServiceCatalog();
        if (mounted) setServices(catalog);
      } catch (serviceError) {
        console.error('Service catalogue load failed', serviceError);
        if (mounted) setError('Unable to load services right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((service) => {
      if (!matchesGroup(service, group)) return false;
      if (institution !== 'ALL' && service.popularFor?.length && !service.popularFor.includes(institution as InstitutionId)) return false;
      if (!q) return true;
      return `${service.title} ${service.shortDesc} ${service.detailedDesc} ${service.id}`.toLowerCase().includes(q);
    });
  }, [services, group, institution, query]);

  const openService = (service: ServiceItem) => {
    if (service.applicationUrl) {
      window.open(service.applicationUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedService(service);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <section className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">Campus Services</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Student services</h1>
              <p className="mt-1 text-sm text-slate-500">Admissions, result services, NELFUND and academic support.</p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Request tracking enabled
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:bg-white" />
            </div>
            <select value={institution} onChange={(event) => setInstitution(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-orange-500">
              <option value="ALL">All schools</option>
              {INSTITUTIONS.filter((item) => item.id !== 'ALL').map((item) => <option key={item.id} value={item.id}>{item.shortName}</option>)}
            </select>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
            {serviceGroups.map((item) => (
              <button key={item.id} type="button" onClick={() => setGroup(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${group === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">Loading services…</div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No services found</p>
            <p className="mt-1 text-xs text-slate-400">Try a different search or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service) => (
              <article key={service.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-orange-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{getCategoryLabel(service)}</span>
                </div>
                <h2 className="mt-4 text-sm font-bold text-slate-900">{service.title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 line-clamp-3">{service.shortDesc || service.detailedDesc}</p>
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Processing</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-700">{service.processingTime || 'Confirm with desk'}</p>
                  </div>
                  <button type="button" onClick={() => openService(service)} className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700">
                    {service.applicationUrl ? <ExternalLink className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    {service.applicationUrl ? 'Open' : 'Request'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MessageSquare className="h-4 w-4 text-orange-600" />
          Requests submitted through a service card are saved to your account.
        </div>
      </div>

      <ServiceInquiryModal
        service={selectedService}
        isOpen={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        defaultInstitution={user?.institutionId || 'UNICAL'}
        studentProfile={user}
      />
    </div>
  );
};
