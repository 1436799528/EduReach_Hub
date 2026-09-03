import {
  UserProfile,
  StudyMaterial,
  ServiceOrder,
  WalletTransaction,
  AppNotification,
  MaterialNote
} from '../types';
import { STUDY_MATERIALS, INITIAL_SERVICE_ORDERS, INITIAL_NOTIFICATIONS } from '../data/mockData';

const USER_PROFILE_KEY = 'edureach_user_profile_v3';
const STUDY_MATERIALS_KEY = 'edureach_study_materials_v3';
const SERVICE_ORDERS_KEY = 'edureach_service_orders_v3';
const TRANSACTIONS_KEY = 'edureach_transactions_v3';
const NOTIFICATIONS_KEY = 'edureach_notifications_v3';
const DATA_SAVER_KEY = 'edureach_data_saver_active';

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const createUuid = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return '00000000-0000-4000-8000-' + Math.random().toString(16).slice(2).padEnd(12, '0').slice(0, 12);
  }
};

/**
 * Local storage is retained only as a UI fallback/cache during the migration.
 * Authentication authority and persisted student identity now belong to Supabase.
 * No real-looking student identity, phone number, NIN, wallet balance or agent
 * credentials are shipped in the frontend bundle.
 */
export const INITIAL_USER: UserProfile = {
  id: '',
  name: '',
  email: '',
  phoneNumber: '',
  institutionId: 'ALL',
  department: '',
  faculty: '',
  level: '',
  walletBalance: 0,
  isAPlusSubscriber: false,
  enrolledCourses: [],
  unlockedMaterialIds: [],
  savedOfflineMaterialIds: [],
  materialNotes: [],
  viewHistory: [],
  downloadHistory: [],
  contributorStats: {
    totalEarned: 0,
    totalRoyaltyPaid: 0,
    materialsUploaded: 0,
    pendingPayout: 0,
  },
  role: 'student',
};

export const getStoredUserProfile = (): UserProfile => {
  try {
    const data = localStorage.getItem(USER_PROFILE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...INITIAL_USER,
        ...parsed,
        materialNotes: Array.isArray(parsed.materialNotes) ? parsed.materialNotes : []
      };
    }
  } catch (e) {
    console.error('Error reading cached user profile', e);
  }
  return INITIAL_USER;
};

export const saveUserProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving cached user profile', e);
  }
};

export const saveMaterialNoteToProfile = (note: MaterialNote): UserProfile => {
  const current = getStoredUserProfile();
  const existingNotes = current.materialNotes || [];
  const existingIndex = existingNotes.findIndex((existing) => existing.id === note.id);

  // The backend note table uses UUID primary keys. Migrate older local note IDs
  // in place so subsequent create/update/delete operations use one stable ID.
  if (!isUuid(note.id)) {
    note.id = createUuid();
  }

  let updatedNotes: MaterialNote[];
  if (existingIndex >= 0) {
    updatedNotes = existingNotes.map((existing, index) => (index === existingIndex ? note : existing));
  } else {
    updatedNotes = [note, ...existingNotes];
  }
  const updatedUser: UserProfile = { ...current, materialNotes: updatedNotes };
  saveUserProfile(updatedUser);
  return updatedUser;
};

export const deleteMaterialNoteFromProfile = (noteId: string): UserProfile => {
  const current = getStoredUserProfile();
  const existingNotes = current.materialNotes || [];
  const updatedNotes = existingNotes.filter((n) => n.id !== noteId);
  const updatedUser: UserProfile = { ...current, materialNotes: updatedNotes };
  saveUserProfile(updatedUser);
  return updatedUser;
};

export const getStoredMaterials = (): StudyMaterial[] => {
  try {
    const data = localStorage.getItem(STUDY_MATERIALS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading cached study materials', e);
  }
  return STUDY_MATERIALS;
};

export const saveMaterials = (materials: StudyMaterial[]): void => {
  try {
    localStorage.setItem(STUDY_MATERIALS_KEY, JSON.stringify(materials));
  } catch (e) {
    console.error('Error saving cached study materials', e);
  }
};

export const getStoredNotifications = (): AppNotification[] => {
  try {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading cached notifications', e);
  }
  return INITIAL_NOTIFICATIONS;
};

export const saveNotifications = (notifications: AppNotification[]): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving cached notifications', e);
  }
};

export const getStoredServiceOrders = (): ServiceOrder[] => {
  try {
    const data = localStorage.getItem(SERVICE_ORDERS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading cached service orders', e);
  }
  return INITIAL_SERVICE_ORDERS;
};

export const saveServiceOrders = (orders: ServiceOrder[]): void => {
  try {
    localStorage.setItem(SERVICE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving cached service orders', e);
  }
};

export const getStoredTransactions = (): WalletTransaction[] => {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading cached transactions', e);
  }
  return [];
};

export const saveTransactions = (txns: WalletTransaction[]): void => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
  } catch (e) {
    console.error('Error saving cached transactions', e);
  }
};

export const getDataSaverSetting = (): boolean => {
  try {
    return localStorage.getItem(DATA_SAVER_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setDataSaverSetting = (enabled: boolean): void => {
  try {
    localStorage.setItem(DATA_SAVER_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.error('Error saving data saver setting', e);
  }
};

export const generateWhatsAppShareLink = (material: StudyMaterial): string => {
  const text = `*EduReach Hub*\n*Course:* ${material.courseCode} - ${material.courseTitle}\n*University:* ${material.institutionId} (${material.level}, ${material.semester})\n*Pack Type:* ${material.materialType.replace('_', ' ').toUpperCase()}\n*Rating:* ⭐ ${material.rating} (${material.reviewCount} verified students)\n\n*Core Highlights:*\n${material.coreConcepts.slice(0, 3).map(c => `• ${c}`).join('\n')}\n\n*Access on EduReach Hub:* ${material.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export const generateOrderWhatsAppSummary = (order: ServiceOrder): string => {
  const text = `*EduReach Hub Service Desk*\n*Tracking Code:* ${order.trackingCode}\n*Service:* ${order.serviceType.replace(/_/g, ' ')}\n*Campus:* ${order.targetInstitution}\n*Student:* ${order.studentName} (${order.matricNumber})\n*Department:* ${order.department}\n*Status:* ${order.status.replace(/_/g, ' ')}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};
