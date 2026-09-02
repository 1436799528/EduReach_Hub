import type { ServiceItem, ServiceType, InstitutionId } from '../types';
import { supabase } from './supabase';

const requireClient = () => { if (!supabase) throw new Error('Supabase is not configured.'); return supabase; };

const serviceKeyToType = (key: string): ServiceType => {
  const allowed: ServiceType[] = [
    'ASSIGNMENT_ASSISTANCE','PROJECT_GUIDANCE','RESEARCH_SUPPORT','ACADEMIC_TUTORIALS',
    'RESULT_CHECKER_PIN','NELFUND_LOAN_ASSIST','ACADEMIC_TRANSCRIPT','REMITA_FEES_CLEARANCE',
    'DEFERMENT_LETTER','STATEMENT_OF_RESULT','POST_UTME_SCREENING_PIN',
    'JAMB','NECO','WAEC','SCHOLARSHIP',
  ];
  return allowed.includes(key as ServiceType) ? key as ServiceType : 'PROJECT_GUIDANCE';
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
  const { data, error } = await requireClient()
    .from('service_catalog')
    .select('id,service_key,title,description,application_url,active,created_at,updated_at')
    .eq('active', true)
    .order('title');
  if (error) throw error;

  return ((data ?? []) as ServiceCatalogRow[]).map((row) => ({
    id: serviceKeyToType(row.service_key),
    title: row.title,
    shortDesc: row.description,
    detailedDesc: row.description,
    imageUrl: undefined,
    baseFee: 0,
    processingTime: 'Contact support for current processing time',
    deliveryMethod: row.application_url ? 'Instant WhatsApp & SMS' : 'Physical Submission & Dispatch',
    popularFor: ['ALL'] as InstitutionId[],
    requiredInputs: [],
  }));
}
