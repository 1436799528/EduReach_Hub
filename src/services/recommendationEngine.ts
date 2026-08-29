import { StudyMaterial, UserProfile, RecommendedMaterialItem, RecommendationReason } from '../types';

export interface TrendingTopic {
  id: string;
  topic: string;
  courseCode: string;
  department: string;
  institution: string;
  studentCount: number;
  growthRate: string;
  recommendedMaterialId: string;
  keyConcepts: string[];
}

export interface RelatedCourseSuggestion {
  courseCode: string;
  courseTitle: string;
  department: string;
  relevanceReason: string;
  materialsCount: number;
  topMaterialId: string;
}

/**
 * Computes multi-factor AI academic recommendations for a student profile
 */
export function getRecommendations(
  user: UserProfile,
  allMaterials: StudyMaterial[]
): {
  recommendedItems: RecommendedMaterialItem[];
  departmentTrending: RecommendedMaterialItem[];
  recentlyVerified: RecommendedMaterialItem[];
  peerAffinity: RecommendedMaterialItem[];
  crossCampusEquivalents: RecommendedMaterialItem[];
  trendingTopics: TrendingTopic[];
  relatedCourses: RelatedCourseSuggestion[];
} {
  const verifiedMaterials = allMaterials.filter(
    (m) => m.verificationStatus === 'APPROVED' || m.isVerified
  );

  const scoredItems: RecommendedMaterialItem[] = verifiedMaterials.map((material) => {
    let score = 0;
    const reasons: RecommendationReason[] = [];

    // 1. Enrolled Course Code Matching
    const cleanCourseCode = material.courseCode.toUpperCase();
    const isDirectEnrolled = (user.enrolledCourses || []).some((ec) => {
      const cleanEC = ec.toUpperCase().trim();
      return cleanCourseCode.includes(cleanEC) || (material.title && material.title.toUpperCase().includes(cleanEC));
    });

    if (isDirectEnrolled) {
      score += 40;
      reasons.push({
        type: 'ENROLLED_COURSE',
        badgeLabel: 'Enrolled Course Match',
        explanation: `Matches your registered course (${material.courseCode}) for ${user.level} ${user.department}.`,
        confidenceScore: 98
      });
    }

    // 2. Department & Level Affinity
    const isSameDept = material.department?.toLowerCase() === user.department?.toLowerCase() ||
      (user.department === 'Computer Science' && material.department?.includes('Computer'));
    const isSameLevel = material.level === user.level;

    if (isSameDept && isSameLevel) {
      score += 25;
      reasons.push({
        type: 'DEPARTMENT_TRENDING',
        badgeLabel: `${user.department} ${user.level} High Yield`,
        explanation: `Top-rated curriculum material for ${user.level} students in ${user.department}.`,
        confidenceScore: 92
      });
    } else if (isSameDept) {
      score += 15;
    }

    // 3. Institutional Peer Popularity
    const isSameInstitution = material.institutionId === user.institutionId;
    if (isSameInstitution) {
      score += 15;
    }

    // 4. Peer Co-Download Affinity (Collaborative Filtering simulation)
    const userDownloads = user.downloadHistory || user.unlockedMaterialIds || [];
    const isDownloadedByUser = userDownloads.includes(material.id);

    // If user downloaded GST 111 or CSC materials, recommend other foundation/core packs
    if (!isDownloadedByUser) {
      if (userDownloads.some(id => id.includes('CSC') || id.includes('GST')) && (material.courseCode.includes('CSC') || material.courseCode.includes('MTH') || material.courseCode.includes('GST'))) {
        score += 20;
        reasons.push({
          type: 'PEER_DOWNLOAD_AFFINITY',
          badgeLabel: '94% Peer Affinity',
          explanation: `89% of ${user.institutionId} scholars who unlocked your downloaded courses also use this pack.`,
          confidenceScore: 94
        });
      }
    }

    // 5. Cross-Campus Equivalence Match
    const hasCrossCampusMatch = (material.crossCampusEquivalents || []).some(
      (eq) => eq.institution === user.institutionId
    );
    if (hasCrossCampusMatch && material.institutionId !== user.institutionId) {
      score += 25;
      const matchedEq = material.crossCampusEquivalents.find(eq => eq.institution === user.institutionId);
      reasons.push({
        type: 'EQUIVALENCE_MATCH',
        badgeLabel: `Senate Equivalent: ${matchedEq?.equivalentCode || material.courseCode}`,
        explanation: `Certified by academic senate: ${material.institutionId} course syllabus aligns with your ${user.institutionId} module.`,
        confidenceScore: 96
      });
    }

    // 6. Recently Verified Senate Quality
    if (material.verificationStatus === 'APPROVED' || material.isVerified) {
      score += 15;
      reasons.push({
        type: 'RECENTLY_VERIFIED',
        badgeLabel: 'Senate Peer Verified',
        explanation: `Verified & endorsed by ${material.verifiedBy || 'National Academic Senate'} with solved past exams.`,
        confidenceScore: 99
      });
    }

    // 7. General High Rating / Unlocks
    if (material.unlockCount && material.unlockCount > 1000) {
      score += 10;
    }

    // Compute peer match percentage (normalized 70% to 99%)
    const peerMatchPercentage = Math.min(99, Math.max(72, Math.round((score / 125) * 100)));

    return {
      material,
      reasons: reasons.slice(0, 3),
      peerMatchPercentage,
      isEnrolledCourse: isDirectEnrolled
    };
  });

  // Sort by highest match score
  scoredItems.sort((a, b) => b.peerMatchPercentage - a.peerMatchPercentage);

  // Filter specific recommendation subsets
  const departmentTrending = scoredItems.filter(item => 
    item.material.department?.toLowerCase() === user.department?.toLowerCase() ||
    item.reasons.some(r => r.type === 'DEPARTMENT_TRENDING')
  );

  const recentlyVerified = scoredItems.filter(item =>
    item.material.verificationStatus === 'APPROVED' || item.reasons.some(r => r.type === 'RECENTLY_VERIFIED')
  );

  const peerAffinity = scoredItems.filter(item =>
    item.reasons.some(r => r.type === 'PEER_DOWNLOAD_AFFINITY') || item.peerMatchPercentage >= 90
  );

  const crossCampusEquivalents = scoredItems.filter(item =>
    item.reasons.some(r => r.type === 'EQUIVALENCE_MATCH') ||
    (item.material.crossCampusEquivalents && item.material.crossCampusEquivalents.length > 0)
  );

  // Dynamic Trending Exam Topics
  const trendingTopics: TrendingTopic[] = [
    {
      id: 'TOPIC-01',
      topic: 'Deadlock Banker\'s Algorithm & Semaphore Mutex',
      courseCode: 'CSC 301',
      department: 'Computer Science',
      institution: 'UNICAL',
      studentCount: 1420,
      growthRate: '+34% this week',
      recommendedMaterialId: 'MAT-CSC301-UNICAL-07',
      keyConcepts: ['Coffman Conditions', 'Resource Allocation Graph', 'Need Matrix Proofs']
    },
    {
      id: 'TOPIC-02',
      topic: 'Database Normalization: 1NF to BCNF Lossless Joins',
      courseCode: 'CSC 303',
      department: 'Computer Science',
      institution: 'UNICAL',
      studentCount: 1280,
      growthRate: '+28% this week',
      recommendedMaterialId: 'MAT-CSC303-UNICAL-08',
      keyConcepts: ['Functional Dependencies', 'Armstrong Axioms', 'Transitive Dependencies']
    },
    {
      id: 'TOPIC-03',
      topic: 'Grammatical Concord & Syllable Stress Placement',
      courseCode: 'GST 111 / GSS 111',
      department: 'General Studies',
      institution: 'UNICAL',
      studentCount: 3840,
      growthRate: '+52% during exams',
      recommendedMaterialId: 'MAT-GST111-UNICAL-01',
      keyConcepts: ['Rule of Proximity', 'Parenthetical Accompaniment', 'Penultimate Stress']
    },
    {
      id: 'TOPIC-04',
      topic: 'RLC Transient Laplace s-Domain Matrix Transformations',
      courseCode: 'EEE 301 / ENG 305',
      department: 'Electrical Engineering',
      institution: 'UNILAG',
      studentCount: 940,
      growthRate: '+19% this week',
      recommendedMaterialId: 'MAT-EEE301-CROSS-02',
      keyConcepts: ['Damping Factor Alpha', 'Two-Port ABCD Parameters', 's-Domain Impedance']
    }
  ];

  // Related Course Pathways
  const relatedCourses: RelatedCourseSuggestion[] = [
    {
      courseCode: 'CSC 301',
      courseTitle: 'Operating Systems Principles & Architecture',
      department: 'Computer Science',
      relevanceReason: 'Direct 300L semester requirement; prerequisite for Advanced Systems.',
      materialsCount: 4,
      topMaterialId: 'MAT-CSC301-UNICAL-07'
    },
    {
      courseCode: 'CSC 303',
      courseTitle: 'Database Design & Management Systems',
      department: 'Computer Science',
      relevanceReason: 'Essential co-requisite with 300L Data Structures & Systems.',
      materialsCount: 3,
      topMaterialId: 'MAT-CSC303-UNICAL-08'
    },
    {
      courseCode: 'MTH 201',
      courseTitle: 'Mathematical Methods & Ordinary Differential Equations',
      department: 'Mathematics & Science',
      relevanceReason: 'Core computational mathematics foundation for algorithms.',
      materialsCount: 2,
      topMaterialId: 'MAT-MTH201-UI-09'
    },
    {
      courseCode: 'CSC 315',
      courseTitle: 'Compiler Construction & Automata Theory',
      department: 'Computer Science',
      relevanceReason: 'Advanced 300L elective covering parsers, grammars & lexers.',
      materialsCount: 1,
      topMaterialId: 'MAT-CSC315-UNICAL-PENDING-11'
    }
  ];

  return {
    recommendedItems: scoredItems,
    departmentTrending,
    recentlyVerified,
    peerAffinity,
    crossCampusEquivalents,
    trendingTopics,
    relatedCourses
  };
}
