import type { ServiceItem, ServiceType, InstitutionId } from '../types';
import { supabase } from './supabase';
import { SERVICE_ITEMS } from '../data/mockData';

const requireClient = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };

const serviceKeyToType = (key: string): ServiceType => {
  const allowed: string[] = [
    'POSTGRADUATE_ADMISSION_LETTER',
    'POSTGRADUATE_ACCEPTANCE_FEE',
    'RESULT_PORTAL_PIN_RECOVERY',
    'NELFUND_LOAN_APPLICATION',
    'WAEC_NECO_RESULT_CHECKING',
    'WAEC_NECO_SCRATCH_CARDS',
    'JAMB_EXAM_SLIP_PRINTING',
    'ADMISSION_DEFERMENT_SUPPLEMENTARY',
    'ASSIGNMENT_ASSISTANCE','PROJECT_GUIDANCE','RESEARCH_SUPPORT','ACADEMIC_TUTORIALS',
    'RESULT_CHECKER_PIN','NELFUND_LOAN_ASSIST','ACADEMIC_TRANSCRIPT','REMITA_FEES_CLEARANCE',
    'DEFERMENT_LETTER','STATEMENT_OF_RESULT','POST_UTME_SCREENING_PIN',
    'JAMB','NECO','WAEC','SCHOLARSHIP','NELFUND',
  ];
  return (allowed.includes(key) ? key : 'POSTGRADUATE_ADMISSION_LETTER') as unknown as ServiceType;
};

export interface ServiceCatalogRow {
  id: string;
  service_key: string;
  title: string;
  description: string;
  application_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getActiveServiceCatalog(): Promise<ServiceItem[]> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from('service_catalog')
      .select('id,service_key,title,description,application_url,active,created_at,updated_at')
      .eq('active', true)
      .order('title');

    if (error || !data || data.length === 0) {
      return SERVICE_ITEMS;
    }

    const fetchedItems = ((data ?? []) as ServiceCatalogRow[]).map((row) => {
      const matchedMock = SERVICE_ITEMS.find(s => s.id === row.service_key || s.title.toLowerCase() === row.title.toLowerCase());
      return {
        id: serviceKeyToType(row.service_key),
        title: row.title,
        shortDesc: row.description,
        detailedDesc: row.description,
        imageUrl: matchedMock?.imageUrl || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&auto=format&fit=crop&q=80',
        baseFee: matchedMock?.baseFee ?? 0,
        processingTime: matchedMock?.processingTime ?? 'Contact support for current processing time',
        deliveryMethod: row.application_url ? 'Instant WhatsApp & SMS' : (matchedMock?.deliveryMethod || 'Physical Submission & Dispatch'),
        popularFor: ['ALL'] as InstitutionId[],
        requiredInputs: matchedMock?.requiredInputs || [],
      };
    });

    // Ensure all 8 essential user services are present even if Supabase has a partial catalog
    const existingIds = new Set(fetchedItems.map(item => item.id));
    const missingCoreServices = SERVICE_ITEMS.filter(item => !existingIds.has(item.id));
    return [...missingCoreServices, ...fetchedItems];
  } catch {
    // If Supabase is unconfigured or network is unavailable, gracefully fallback to local SERVICE_ITEMS
    return SERVICE_ITEMS;
  }
}
