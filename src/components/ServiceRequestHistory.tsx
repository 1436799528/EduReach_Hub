import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, RefreshCw, XCircle } from 'lucide-react';
import { getMyServiceRequests, getServiceCatalog } from '../lib/productionActions';
import { isValidUuid } from '../lib/supabase';
import { UserProfile } from '../types';

interface ServiceRequestHistoryProps {
  user?: UserProfile;
}

type ServiceRequestRow = {
  id: string;
  service_id: string;
  status: string;
  form_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ServiceCatalogRow = {
  id: string;
  title: string;
};

const statusMeta = (status: string) => {
  const normalized = status.toLowerCase();
  if (['completed', 'fulfilled', 'approved', 'resolved'].includes(normalized)) {
    return { label: 'Completed', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (['rejected', 'cancelled', 'canceled', 'failed'].includes(normalized)) {
    return { label: status.replace(/_/g, ' '), icon: XCircle, className: 'bg-red-50 text-red-700 border-red-200' };
  }
  return { label: status.replace(/_/g, ' ') || 'Submitted', icon: Clock3, className: 'bg-amber-50 text-amber-700 border-amber-200' };
};

export const ServiceRequestHistory: React.FC<ServiceRequestHistoryProps> = ({ user }) => {
  const [requests, setRequests] = useState<ServiceRequestRow[]>([]);
  const [catalogue, setCatalogue] = useState<ServiceCatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!user?.id || !isValidUuid(user.id)) return;
    setLoading(true);
    setError(null);
    try {
      const [requestRows, services] = await Promise.all([
        getMyServiceRequests(user.id),
        getServiceCatalog(),
      ]);
      setRequests(requestRows as ServiceRequestRow[]);
      setCatalogue(services as ServiceCatalogRow[]);
    } catch (requestError) {
      console.error('Service request history load failed', requestError);
      setError('Unable to load your service request history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, [user?.id]);

  const serviceTitles = useMemo(
    () => new Map(catalogue.map((service) => [service.id, service.title])),
    [catalogue]
  );

  if (!user?.id || !isValidUuid(user.id)) return null;

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">My Service Requests</h2>
              <p className="text-[11px] text-slate-500">Track requests submitted through the EduReach Services Desk.</p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadHistory()}
          disabled={loading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}

      {loading && requests.length === 0 ? (
        <div className="mt-6 py-8 text-center text-xs text-slate-500">Loading your requests…</div>
      ) : requests.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <FileText className="w-6 h-6 mx-auto text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-700">No service requests yet</p>
          <p className="mt-1 text-[11px] text-slate-500">Requests you submit from a service card will appear here.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {requests.slice(0, 20).map((request) => {
            const meta = statusMeta(request.status);
            const StatusIcon = meta.icon;
            const serviceTitle = serviceTitles.get(request.service_id) || 'EduReach Service';
            const submittedAt = new Date(request.created_at).toLocaleString();
            return (
              <article key={request.id} className="rounded-2xl border border-slate-200 p-4 hover:border-orange-200 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">{serviceTitle}</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Submitted {submittedAt}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${meta.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
