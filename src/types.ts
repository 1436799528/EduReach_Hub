export type InstitutionId = 
  | 'UNICAL' 
  | 'UNILAG' 
  | 'UI' 
  | 'ABU' 
  | 'UNN' 
  | 'OAU' 
  | 'FUTO' 
  | 'UNIBEN' 
  | 'LASU' 
  | 'DELSU'
  | 'ALL';

export interface Institution {
  id: InstitutionId;
  name: string;
  shortName: string;
  state: string;
  logoColor: string;
  motto: string;
  established: number;
  totalMaterials: number;
}

export type MaterialType = 
  | 'past_question' 
  | 'lecture_summary' 
  | 'handwritten_note' 
  | 'project_guide' 
  | 'cbt_pack' 
  | 'formula_sheet';

export interface CBTQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  year?: string;
}

export type VerificationStatus = 
  | 'PENDING' 
  | 'UNDER_REVIEW' 
  | 'APPROVED' 
  | 'REVISION_REQUESTED' 
  | 'REJECTED';

export interface VerificationChecklist {
  syllabusAlignment: boolean;
  solutionAccuracy: boolean;
  clarityLegibility: boolean;
  formattingOriginality: boolean;
  noCopyrightViolation: boolean;
}

export interface VerificationAuditLog {
  id: string;
  materialId: string;
  timestamp: string;
  moderatorId: string;
  moderatorName: string;
  moderatorBadge: string;
  action: 'ASSIGNED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUESTED' | 'RESUBMITTED';
  statusAfter: VerificationStatus;
  reasonCategory?: string;
  notes: string;
  checklist?: Partial<VerificationChecklist>;
  suggestedChanges?: string[];
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'VERIFICATION_APPROVED' | 'REVISION_REQUESTED' | 'VERIFICATION_REJECTED' | 'ROYALTY_EARNED' | 'RECOMMENDATION_ALERT' | 'TASK_ASSIGNED' | 'ORDER_UPDATE';
  timestamp: string;
  isRead: boolean;
  materialId?: string;
  materialCode?: string;
  actionLabel?: string;
  actionTab?: 'vault' | 'services' | 'contributor' | 'orders' | 'verification';
}

export interface StudyMaterial {
  id: string;
  title: string;
  courseCode: string;
  courseTitle: string;
  institutionId: InstitutionId;
  department: string;
  faculty: string;
  level: '100L' | '200L' | '300L' | '400L' | '500L' | '600L' | 'General';
  semester: '1st Semester' | '2nd Semester' | 'All Year';
  materialType: MaterialType;
  academicSession: string;
  unlockPrice: number;
  uploader: {
    id: string;
    name: string;
    avatar: string;
    badge: 'Class Rep' | 'First Class Scholar' | 'Verified Moderator' | 'Campus Rep' | 'Student Contributor';
    institution: InstitutionId;
    rating: number;
  };
  isVerified: boolean;
  verifiedBy?: string;
  verificationStatus?: VerificationStatus;
  assignedModerator?: {
    id: string;
    name: string;
    role: string;
    institution: InstitutionId;
  };
  moderationFeedback?: string;
  rejectionReason?: string;
  revisionRequests?: string[];
  auditLogs?: VerificationAuditLog[];
  rating: number;
  reviewCount: number;
  unlockCount: number;
  fileSizeKb: number;
  pageCount: number;
  summary: string;
  coreConcepts: string[];
  fullTextContent: string;
  formulas?: { name: string; formula: string; note: string }[];
  workedQuestions?: {
    questionNumber: string;
    year: string;
    questionText: string;
    stepByStepSolution: string[];
    keyTakeaway: string;
  }[];
  cbtQuestions?: CBTQuestion[];
  crossCampusEquivalents: {
    institution: InstitutionId;
    equivalentCode: string;
    notes: string;
  }[];
  createdAt: string;
}

export type ServiceType = 
  | 'ASSIGNMENT_ASSISTANCE'
  | 'PROJECT_GUIDANCE'
  | 'RESEARCH_SUPPORT'
  | 'ACADEMIC_TUTORIALS'
  | 'RESULT_CHECKER_PIN'
  | 'NELFUND_LOAN_ASSIST'
  | 'ACADEMIC_TRANSCRIPT'
  | 'REMITA_FEES_CLEARANCE'
  | 'DEFERMENT_LETTER'
  | 'STATEMENT_OF_RESULT'
  | 'POST_UTME_SCREENING_PIN'
  | 'JAMB'
  | 'NECO'
  | 'WAEC'
  | 'SCHOLARSHIP';

export interface ServiceItem {
  id: ServiceType;
  title: string;
  shortDesc: string;
  detailedDesc: string;
  imageUrl?: string;
  baseFee: number;
  processingTime: string;
  deliveryMethod: 'Instant WhatsApp & SMS' | 'Physical Submission & Dispatch' | 'Official Registry Stamping';
  popularFor: InstitutionId[];
  requiredInputs: {
    field: string;
    label: string;
    type: 'text' | 'number' | 'file' | 'select';
    placeholder?: string;
    options?: string[];
    required: boolean;
  }[];
}

export interface PostComment {
  id: string;
  authorId: string;
  authorName: string;
  authorInstitution: InstitutionId;
  text: string;
  timestamp: string;
}

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorBadge?: string;
  authorInstitution: InstitutionId;
  authorDepartment: string;
  authorLevel: string;
  title: string;
  content: string;
  courseCode?: string;
  category: 'lecture_note' | 'handout' | 'past_question' | 'resource_pdf' | 'general_update' | 'tutorial';
  attachment?: {
    name: string;
    fileSize: string;
    fileType: string;
    pagesCount?: number;
    previewSnippet?: string;
  };
  priceRequested: number;
  moderatedPrice: number;
  moderationStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REVISED';
  moderatorNotes?: string;
  verifiedByModerator?: string;
  likesCount: number;
  likedByUserIds: string[];
  comments: PostComment[];
  viewsCount: number;
  createdAt: string;
}

export interface FAQItem {
  id: string;
  category: 'admissions' | 'transcripts' | 'nelfund' | 'academics' | 'fees_hostels' | 'regulations';
  question: string;
  answer: string;
  keywords: string[];
}

export interface OrderProofSubmission {
  id: string;
  orderId: string;
  agentId: string;
  agentName: string;
  receiptNumber?: string;
  stampedImageUrl?: string;
  registryStaffSignoff?: string;
  notes: string;
  submittedAt: string;
  verifiedByStudentOrAdmin?: boolean;
  status: 'PENDING_VERIFICATION' | 'APPROVED_VERIFIED' | 'REJECTED';
}

export interface ServiceOrder {
  id: string;
  trackingCode: string;
  userId: string;
  serviceType: ServiceType;
  targetInstitution: InstitutionId;
  status: 'PAYMENT_RECEIVED' | 'AGENT_ASSIGNED' | 'PROCESSING_AT_REGISTRY' | 'STAMPED_AND_VERIFIED' | 'COMPLETED_DISPATCHED';
  amountPaid: number;
  studentName: string;
  matricNumber: string;
  department: string;
  phoneNumber: string;
  email: string;
  notes?: string;
  slaHoursTarget?: number;
  slaDeadline?: string;
  slaStatus?: 'ON_TRACK' | 'URGENT' | 'BREACHED' | 'MET';
  assignedAgent?: {
    id?: string;
    name: string;
    phone: string;
    institution: InstitutionId;
    rating: number;
    commissionEarned?: number;
    tier?: 'STANDARD_70_30' | 'TOP_AGENT_80_20';
  };
  backupAgent?: {
    id: string;
    name: string;
    phone: string;
    institution: InstitutionId;
  };
  proofSubmission?: OrderProofSubmission;
  isReRouted?: boolean;
  timeline: {
    stage: string;
    time: string;
    completed: boolean;
    description?: string;
    comment?: string;
  }[];
  createdAt: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  institutionId: InstitutionId;
  department: string;
  faculty: string;
  level: string;
  walletBalance: number;
  isAPlusSubscriber: boolean;
  aPlusExpiresAt?: string;
  enrolledCourses: string[];
  unlockedMaterialIds: string[];
  savedOfflineMaterialIds: string[];
  viewHistory: string[];
  downloadHistory: string[];
  contributorStats: {
    totalEarned: number;
    totalRoyaltyPaid: number;
    materialsUploaded: number;
    pendingPayout: number;
  };
  agentProfile?: {
    isAccredited: boolean;
    ninNumber: string;
    cgpa: number;
    guarantorName: string;
    guarantorDept: string;
    guarantorPhone: string;
    guarantorStaffId: string;
    integrityAgreementSigned: boolean;
    integritySignedDate: string;
    tier: 'STANDARD_70_30' | 'TOP_AGENT_80_20';
    escrowDepositHeld: number;
    escrowTarget: number;
    totalOrdersCompleted: number;
    slaSuccessRate: number;
    totalCommissionEarned: number;
    availableCommissionBalance: number;
    penaltiesCount: number;
    badges: ('TOP_AGENT_MONTHLY' | 'FAST_RESPONDER' | 'REGISTRY_EXCELLENCE' | 'SECURITY_CLEARED')[];
  };
  role: 'student' | 'contributor' | 'moderator' | 'senate_admin' | 'campus_agent';
}

export interface RecommendationReason {
  type: 'ENROLLED_COURSE' | 'PEER_DOWNLOAD_AFFINITY' | 'RECENTLY_VERIFIED' | 'DEPARTMENT_TRENDING' | 'EQUIVALENCE_MATCH' | 'EXAM_PREP';
  badgeLabel: string;
  explanation: string;
  confidenceScore: number;
}

export interface RecommendedMaterialItem {
  material: StudyMaterial;
  reasons: RecommendationReason[];
  peerMatchPercentage: number;
  isEnrolledCourse: boolean;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  type: 'TOPUP' | 'UNLOCK_PURCHASE' | 'A_PLUS_SUBSCRIPTION' | 'SERVICE_ORDER' | 'CONTRIBUTOR_ROYALTY' | 'WITHDRAWAL';
  amount: number;
  description: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  channel: 'PAYSTACK_CARD' | 'BANK_TRANSFER' | 'WALLET' | 'USSD' | 'OPAY';
  date: string;
}

export interface CampusAgent {
  id: string;
  name: string;
  institutionId: InstitutionId;
  campusLocation: string;
  rating: number;
  completedTasks: number;
  status: 'AVAILABLE' | 'ON_DISPATCH' | 'BUSY';
  phone: string;
  avatar: string;
  specialization: string;
  ninVerified?: boolean;
  cgpa?: number;
  tier?: 'STANDARD_70_30' | 'TOP_AGENT_80_20';
  escrowBalance?: number;
  avgResponseMins?: number;
  badges?: ('TOP_AGENT_MONTHLY' | 'FAST_RESPONDER' | 'REGISTRY_EXCELLENCE' | 'SECURITY_CLEARED')[];
  guarantorLecturer?: {
    name: string;
    department: string;
    staffId: string;
  };
}

export interface AgentOnboardingApplication {
  fullName: string;
  matricNumber: string;
  nin: string;
  cgpa: string;
  institutionId: InstitutionId;
  department: string;
  faculty: string;
  level: string;
  phone: string;
  schoolIdDocUrl?: string;
  guarantorLecturerName: string;
  guarantorLecturerDept: string;
  guarantorLecturerPhone: string;
  guarantorLecturerStaffId: string;
  agreedToIntegrityAgreement: boolean;
  agreedToEscrowBond: boolean;
}
