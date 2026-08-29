import { 
  UserProfile, 
  StudyMaterial, 
  ServiceOrder, 
  WalletTransaction, 
  ServiceType, 
  InstitutionId,
  AppNotification
} from '../types';
import { STUDY_MATERIALS, INITIAL_SERVICE_ORDERS, INITIAL_NOTIFICATIONS } from '../data/mockData';

const USER_PROFILE_KEY = 'nasv_user_profile_v2';
const STUDY_MATERIALS_KEY = 'nasv_study_materials_v2';
const SERVICE_ORDERS_KEY = 'nasv_service_orders_v2';
const TRANSACTIONS_KEY = 'nasv_transactions_v2';
const NOTIFICATIONS_KEY = 'nasv_notifications_v2';
const DATA_SAVER_KEY = 'nasv_data_saver_active';

export const INITIAL_USER: UserProfile = {
  id: 'usr_uche_01',
  name: 'Blessing Emmanuel (UNICAL Scholar)',
  email: 'blessing.emmanuel@student.unical.edu.ng',
  phoneNumber: '08148920119',
  institutionId: 'UNICAL',
  department: 'Computer Science',
  faculty: 'Science',
  level: '300L',
  walletBalance: 3200, // ₦3,200 initial balance
  isAPlusSubscriber: false,
  aPlusExpiresAt: undefined,
  enrolledCourses: ['GST 111', 'CSC 301', 'CSC 303', 'MTH 201'],
  unlockedMaterialIds: ['MAT-GST111-UNICAL-01'], // 1 unlocked by default
  savedOfflineMaterialIds: ['MAT-GST111-UNICAL-01'],
  viewHistory: ['MAT-GST111-UNICAL-01', 'MAT-CSC201-UI-03'],
  downloadHistory: ['MAT-GST111-UNICAL-01'],
  contributorStats: {
    totalEarned: 18500,
    totalRoyaltyPaid: 12000,
    materialsUploaded: 3,
    pendingPayout: 6500,
  },
  agentProfile: {
    isAccredited: true,
    ninNumber: '92841029481',
    cgpa: 4.38,
    guarantorName: 'Dr. E. B. Asuquo',
    guarantorDept: 'Department of Computer Science',
    guarantorPhone: '+234 803 551 8920',
    guarantorStaffId: 'UNICAL/SS/2014/409',
    integrityAgreementSigned: true,
    integritySignedDate: '2025-01-10',
    tier: 'TOP_AGENT_80_20',
    escrowDepositHeld: 10000,
    escrowTarget: 10000,
    totalOrdersCompleted: 48,
    slaSuccessRate: 98.6,
    totalCommissionEarned: 64200,
    availableCommissionBalance: 18400,
    penaltiesCount: 0,
    badges: ['TOP_AGENT_MONTHLY', 'FAST_RESPONDER', 'REGISTRY_EXCELLENCE', 'SECURITY_CLEARED']
  },
  role: 'student'
};

const INITIAL_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'TXN-9012',
    reference: 'PSTK-REF-8920194',
    type: 'TOPUP',
    amount: 5000,
    description: 'Wallet funding via Paystack Instant Transfer',
    status: 'SUCCESS',
    channel: 'PAYSTACK_CARD',
    date: '2025-02-16 10:24 AM'
  },
  {
    id: 'TXN-9013',
    reference: 'NASV-ORD-8812',
    type: 'SERVICE_ORDER',
    amount: 2500,
    description: 'Payment for NELFUND Loan Institutional Verification Desk',
    status: 'SUCCESS',
    channel: 'WALLET',
    date: '2025-02-18 08:30 AM'
  },
  {
    id: 'TXN-9014',
    reference: 'ROY-UNICAL-4410',
    type: 'CONTRIBUTOR_ROYALTY',
    amount: 1200,
    description: 'Royalty payout for 4 student unlocks of GST 111 Masterpack',
    status: 'SUCCESS',
    channel: 'WALLET',
    date: '2025-02-18 09:45 AM'
  }
];

export const getStoredUserProfile = (): UserProfile => {
  try {
    const data = localStorage.getItem(USER_PROFILE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      return {
        ...INITIAL_USER,
        ...parsed,
        enrolledCourses: parsed.enrolledCourses || INITIAL_USER.enrolledCourses,
        unlockedMaterialIds: parsed.unlockedMaterialIds || INITIAL_USER.unlockedMaterialIds,
        savedOfflineMaterialIds: parsed.savedOfflineMaterialIds || INITIAL_USER.savedOfflineMaterialIds,
        viewHistory: parsed.viewHistory || INITIAL_USER.viewHistory,
        downloadHistory: parsed.downloadHistory || INITIAL_USER.downloadHistory,
        contributorStats: {
          ...INITIAL_USER.contributorStats,
          ...(parsed.contributorStats || {})
        }
      };
    }
  } catch (e) {
    console.error('Error reading user profile', e);
  }
  return INITIAL_USER;
};

export const saveUserProfile = (profile: UserProfile): void => {
  try {
    localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Error saving user profile', e);
  }
};

export const getStoredMaterials = (): StudyMaterial[] => {
  try {
    const data = localStorage.getItem(STUDY_MATERIALS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading study materials', e);
  }
  return STUDY_MATERIALS;
};

export const saveMaterials = (materials: StudyMaterial[]): void => {
  try {
    localStorage.setItem(STUDY_MATERIALS_KEY, JSON.stringify(materials));
  } catch (e) {
    console.error('Error saving study materials', e);
  }
};

export const getStoredNotifications = (): AppNotification[] => {
  try {
    const data = localStorage.getItem(NOTIFICATIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading notifications', e);
  }
  return INITIAL_NOTIFICATIONS;
};

export const saveNotifications = (notifications: AppNotification[]): void => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (e) {
    console.error('Error saving notifications', e);
  }
};

export const getStoredServiceOrders = (): ServiceOrder[] => {
  try {
    const data = localStorage.getItem(SERVICE_ORDERS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading service orders', e);
  }
  return INITIAL_SERVICE_ORDERS;
};

export const saveServiceOrders = (orders: ServiceOrder[]): void => {
  try {
    localStorage.setItem(SERVICE_ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Error saving service orders', e);
  }
};

export const getStoredTransactions = (): WalletTransaction[] => {
  try {
    const data = localStorage.getItem(TRANSACTIONS_KEY);
    if (data) return JSON.parse(data);
  } catch (e) {
    console.error('Error reading transactions', e);
  }
  return INITIAL_TRANSACTIONS;
};

export const saveTransactions = (txns: WalletTransaction[]): void => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));
  } catch (e) {
    console.error('Error saving transactions', e);
  }
};

export const getDataSaverSetting = (): boolean => {
  try {
    const data = localStorage.getItem(DATA_SAVER_KEY);
    return data === 'true';
  } catch (e) {
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
  const text = `*National Academic Study Vault 🇳🇬*\n` +
    `*Course:* ${material.courseCode} - ${material.courseTitle}\n` +
    `*University:* ${material.institutionId} (${material.level}, ${material.semester})\n` +
    `*Pack Type:* ${material.materialType.replace('_', ' ').toUpperCase()}\n` +
    `*Rating:* ⭐ ${material.rating} (${material.reviewCount} verified students)\n\n` +
    `*Core Highlights:*\n` +
    material.coreConcepts.slice(0, 3).map(c => `• ${c}`).join('\n') +
    `\n\n*Access Full Solved Pack on National Study Vault:* https://nasv.ng/study/${material.id}`;
  
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};

export const generateOrderWhatsAppSummary = (order: ServiceOrder): string => {
  const text = `*🇳🇬 National Campus Service Desk - Order Receipt*\n` +
    `*Tracking Code:* ${order.trackingCode}\n` +
    `*Service:* ${order.serviceType.replace(/_/g, ' ')}\n` +
    `*Campus:* ${order.targetInstitution}\n` +
    `*Student:* ${order.studentName} (${order.matricNumber})\n` +
    `*Department:* ${order.department}\n` +
    `*Status:* ${order.status.replace(/_/g, ' ')}\n` +
    `*Assigned Agent:* ${order.assignedAgent?.name || 'Central Dispatch'} (${order.assignedAgent?.phone || '+234 814 892 0119'})\n\n` +
    `For live tracking updates, visit: https://nasv.ng/track/${order.trackingCode}`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
};
