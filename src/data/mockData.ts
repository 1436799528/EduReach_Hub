import { Institution, StudyMaterial, ServiceItem, CampusAgent, ServiceOrder, AppNotification, FeedPost, FAQItem } from '../types';

export const INSTITUTIONS: Institution[] = [
  {
    id: 'UNICAL',
    name: 'University of Calabar',
    shortName: 'UNICAL',
    state: 'Cross River State',
    logoColor: '#059669',
    motto: 'Knowledge for Service',
    established: 1975,
    totalMaterials: 4820,
  },
  {
    id: 'UNILAG',
    name: 'University of Lagos',
    shortName: 'UNILAG',
    state: 'Lagos State (Akoka)',
    logoColor: '#2563eb',
    motto: 'In Deed and In Truth',
    established: 1962,
    totalMaterials: 6150,
  },
  {
    id: 'UI',
    name: 'University of Ibadan',
    shortName: 'UI',
    state: 'Oyo State (Agbowo)',
    logoColor: '#d97706',
    motto: 'Recte Sapere Fons',
    established: 1948,
    totalMaterials: 5410,
  },
  {
    id: 'ABU',
    name: 'Ahmadu Bello University',
    shortName: 'ABU Zaria',
    state: 'Kaduna State (Samaru)',
    logoColor: '#16a34a',
    motto: 'The First Shall Be First',
    established: 1962,
    totalMaterials: 3950,
  },
  {
    id: 'UNN',
    name: 'University of Nigeria, Nsukka',
    shortName: 'UNN',
    state: 'Enugu State (Nsukka/Enugu)',
    logoColor: '#0284c7',
    motto: 'To Restore the Dignity of Man',
    established: 1960,
    totalMaterials: 4230,
  },
  {
    id: 'OAU',
    name: 'Obafemi Awolowo University',
    shortName: 'OAU Ife',
    state: 'Osun State (Ile-Ife)',
    logoColor: '#9333ea',
    motto: 'For Learning and Culture',
    established: 1961,
    totalMaterials: 4780,
  },
  {
    id: 'FUTO',
    name: 'Federal University of Technology, Owerri',
    shortName: 'FUTO',
    state: 'Imo State (Ihiagwa)',
    logoColor: '#ea580c',
    motto: 'Technology for Service',
    established: 1980,
    totalMaterials: 2890,
  },
  {
    id: 'UNIBEN',
    name: 'University of Benin',
    shortName: 'UNIBEN',
    state: 'Edo State (Ugbowo)',
    logoColor: '#4f46e5',
    motto: 'Knowledge and Character',
    established: 1970,
    totalMaterials: 3640,
  },
  {
    id: 'LASU',
    name: 'Lagos State University',
    shortName: 'LASU Ojo',
    state: 'Lagos State (Ojo)',
    logoColor: '#0d9488',
    motto: 'Per Scientiam Ad Gloriam',
    established: 1983,
    totalMaterials: 3120,
  },
];

export const STUDY_MATERIALS: StudyMaterial[] = [
  {
    id: 'MAT-GST111-UNICAL-01',
    title: 'GSS 111 (GST 111): Complete Use of English & Communication Mastery Pack',
    courseCode: 'GST 111 / GSS 111',
    courseTitle: 'Use of English and Study Skills',
    institutionId: 'UNICAL',
    department: 'General Studies Division',
    faculty: 'General Studies',
    level: '100L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2018 - 2025 Comprehensive',
    unlockPrice: 300,
    uploader: {
      id: 'usr_uche_01',
      name: 'Emmanuel Bassey',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Verified Moderator',
      institution: 'UNICAL',
      rating: 4.98,
    },
    isVerified: true,
    verifiedBy: 'UNICAL Academic Senate Peer Board',
    rating: 4.95,
    reviewCount: 318,
    unlockCount: 1420,
    fileSizeKb: 850,
    pageCount: 42,
    summary: 'Exhaustive 7-year solved past questions covering Lexis & Structure, Concord Rules, Figurative Language, Phonetics/Stress Patterns, and Paragraph Development.',
    coreConcepts: [
      'Subject-Verb Agreement (Proximity rule, Accompaniment principles, Indefinite pronoun rules)',
      'Phonology: Monophthongs, Diphthongs, Consonant Clusters & Syllable Stress Placement',
      'Common Tense Pitfalls in Academic Writing (Conditional Clauses & Reported Speech)',
      'Note-taking Strategies: Cornell method and Mind Mapping for Examination success',
    ],
    fullTextContent: `SECTION A: CONCORD RULES & GRAMMATICAL AGREEMENT
1. Rule of Proximity: In compound subjects joined by 'either...or' or 'neither...nor', the verb agrees with the closer subject.
   Example: Neither the lecturer nor the students were (plural) in the hall.
   Example: Neither the students nor the lecturer was (singular) in the hall.

2. Accompaniment Rule: Parenthetical expressions like 'as well as', 'together with', 'in collaboration with', 'accompanied by' do not alter the number of the subject.
   Example: The Dean, together with his sub-deans, has arrived for Senate.

SECTION B: PHONOLOGY & PRIMARY STRESS PATTERNS
- Two-syllable verbs usually receive stress on the second syllable: con-DUCT, pro-DUCE, ex-PORT.
- Two-syllable nouns usually receive stress on the first syllable: CON-duct, PRO-duce, EX-port.
- Words ending in '-tion', '-sion', '-ic' have stress on the penultimate (second to last) syllable: edu-CA-tion, scien-TI-fic, eco-NO-mic.`,
    formulas: [
      {
        name: 'Concord Principle Matrix',
        formula: 'Subject[Singular] + as well as / along with + [Plural Noun] = Verb[Singular]',
        note: 'Always ignore intervening prepositional phrases when matching subjects with verbs.'
      },
      {
        name: 'Stress Placement Rule (-tion / -ic)',
        formula: 'Stress Index = SyllableCount - 1 (Penultimate)',
        note: 'E.g. pho-to-GRA-phic (4-1=3rd syllable).'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 Exam Q4',
        year: '2024',
        questionText: 'Neither the Vice Chancellor nor his deputy directors _____ invited to the emergency summit yesterday. (A) was (B) were (C) is (D) are',
        stepByStepSolution: [
          'Step 1: Identify the correlative conjunction used in the stem: "Neither... nor".',
          'Step 2: Apply the Principle of Proximity: The verb must agree in number with the subject noun phrase closest to the blank space.',
          'Step 3: The closer noun phrase is "his deputy directors", which is PLURAL.',
          'Step 4: The sentence specifies past tense ("yesterday"). The plural past tense form of the auxiliary verb is "were".',
          'Conclusion: Option (B) "were" is the grammatically correct choice.'
        ],
        keyTakeaway: 'In "neither...nor" constructions, ignore the first subject and match the verb number solely with the nearest noun.'
      },
      {
        questionNumber: 'UNICAL 2023 Exam Q12',
        year: '2023',
        questionText: 'Choose the word that has the primary stress on the THIRD syllable: (A) Democratic (B) Continuous (C) Photograph (D) Celebrate',
        stepByStepSolution: [
          'Step 1: Break down each word into syllables: (A) Dem-o-CRAT-ic (4 syllables), (B) Con-TIN-u-ous (4 syllables), (C) PHO-to-graph (3 syllables), (D) CEL-e-brate (3 syllables).',
          'Step 2: Words ending with suffix "-ic" take penultimate stress (syllable before last). For "Dem-o-crat-ic", syllable 3 is "crat".',
          'Conclusion: "Dem-o-CRAT-ic" has the accent on the 3rd syllable. Option (A) is correct.'
        ],
        keyTakeaway: 'Always identify suffixes to immediately determine the exact stress syllable.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_gst111_1',
        question: 'The registrar, accompanied by the faculty deans, _____ scheduled to address the freshmen at the new senate auditorium.',
        options: ['are', 'is', 'were', 'have been'],
        correctAnswer: 1,
        explanation: 'Expressions introduced by "accompanied by" are parenthetical and do not change the number of the main subject ("The registrar" is singular -> "is").',
        year: '2024 UNICAL Exam'
      },
      {
        id: 'cbt_gst111_2',
        question: 'Identify the word with the stress on the FIRST syllable:',
        options: ['Introduce', 'Export (Verb)', 'Export (Noun)', 'Understand'],
        correctAnswer: 2,
        explanation: 'Two-syllable nouns like EX-port take primary stress on the first syllable, whereas verbs like ex-PORT take it on the second.',
        year: '2023 UNICAL Exam'
      },
      {
        id: 'cbt_gst111_3',
        question: 'Which of the following contains a diphthong sound?',
        options: ['Cat /æ/', 'Boat /əʊ/', 'Sit /ɪ/', 'Bed /e/'],
        correctAnswer: 1,
        explanation: 'The vowel sound in "boat" is the diphthong /əʊ/, which glides from one vowel sound to another.',
        year: '2022 UNICAL Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'GST 101 / GST 102',
        notes: 'Covers identical phonetics, lexis, and structural concord curriculum.'
      },
      {
        institution: 'UI',
        equivalentCode: 'GES 101',
        notes: 'Direct match for University of Ibadan Use of English General Studies.'
      },
      {
        institution: 'ABU',
        equivalentCode: 'GENS 101',
        notes: 'Aligns 100% with Ahmadu Bello University 100L syllabus.'
      },
      {
        institution: 'UNN',
        equivalentCode: 'GSP 101',
        notes: 'Identical syllabus used at University of Nigeria Nsukka.'
      }
    ],
    createdAt: '2025-01-12'
  },
  {
    id: 'MAT-EEE301-CROSS-02',
    title: 'EEE 301 / ENG 305: Electric Circuit Theory & Laplace Network Analysis (Worked 2017-2025)',
    courseCode: 'EEE 301 / ENG 305',
    courseTitle: 'Electric Circuit Theory & Network Analysis',
    institutionId: 'UNILAG',
    department: 'Electrical & Electronics Engineering',
    faculty: 'Engineering & Technology',
    level: '300L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2017 - 2025 Solutions',
    unlockPrice: 400,
    uploader: {
      id: 'usr_femi_eng',
      name: 'Engr. Femi Adeleke (First Class)',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      badge: 'First Class Scholar',
      institution: 'UNILAG',
      rating: 4.99,
    },
    isVerified: true,
    verifiedBy: 'Nigerian Society of Engineers Student Chapter',
    rating: 4.97,
    reviewCount: 284,
    unlockCount: 1190,
    fileSizeKb: 1200,
    pageCount: 58,
    summary: 'Full mathematical breakdown of RLC Transient Analysis, Thevenin & Norton s-domain transformations, Two-Port Network parameters (Z, Y, ABCD, h), and Fourier Series applications.',
    coreConcepts: [
      'Transient Response of Second-Order Systems (Overdamped, Critically Damped, Underdamped)',
      'Laplace Transform Transfer Functions H(s) = V_out(s) / V_in(s) for Passive Filters',
      'Two-Port Hybrid (h-parameters) and Transmission (ABCD) Matrix conversions',
      'Maximum Power Transfer Theorem in AC and complex impedance networks',
    ],
    fullTextContent: `CHAPTER 1: SECOND-ORDER RLC TRANSIENT ANALYSIS
The general differential equation for a series RLC circuit excited by a step voltage is:
L*(d²i/dt²) + R*(di/dt) + (1/C)*i = 0

Characteristic Equation:
s² + (R/L)*s + (1/LC) = 0
s² + 2αs + ω₀² = 0

Where:
- Damping factor α = R / (2L)
- Undamped natural resonant frequency ω₀ = 1 / sqrt(LC)

Damping Conditions:
1. α > ω₀ => Overdamped response (two distinct real negative roots)
2. α = ω₀ => Critically damped response (two equal real negative roots, fastest non-oscillatory settling)
3. α < ω₀ => Underdamped response (complex conjugate roots causing sinusoidal ringing at frequency ωd = sqrt(ω₀² - α²))`,
    formulas: [
      {
        name: 'Damping Ratio & Natural Frequency',
        formula: 'α = R / (2L),   ω₀ = 1 / √(LC),   ωd = √(ω₀² - α²)',
        note: 'Series RLC resonant circuit parameters in transient calculations.'
      },
      {
        name: 'Thevenin Impedance in s-Domain',
        formula: 'Z_th(s) = R + sL + 1/(sC)',
        note: 'Inductors become sL with initial current source L*i(0-); Capacitors become 1/sC with initial charge V(0-)/s.'
      },
      {
        name: 'Two-Port ABCD Matrix Relation',
        formula: 'V₁ = A*V₂ - B*I₂,    I₁ = C*V₂ - D*I₂',
        note: 'For symmetrical reciprocal passive networks, AD - BC = 1.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNILAG 2024 Exam Q2',
        year: '2024',
        questionText: 'A series RLC circuit has R = 20 Ω, L = 0.1 H, and C = 100 μF. Determine the damping type, resonant frequency ω₀, and write the expression for the roots of the characteristic equation.',
        stepByStepSolution: [
          'Step 1: Calculate the damping factor α: α = R / (2L) = 20 / (2 * 0.1) = 20 / 0.2 = 100 rad/s.',
          'Step 2: Calculate resonant frequency ω₀: ω₀ = 1 / sqrt(LC) = 1 / sqrt(0.1 * 100 * 10^-6) = 1 / sqrt(10^-5) = 1 / 0.003162 = 316.23 rad/s.',
          'Step 3: Compare α with ω₀: Since α (100) < ω₀ (316.23), the system is strictly UNDERDAMPED.',
          'Step 4: Calculate the damped natural oscillation frequency ωd: ωd = sqrt(ω₀² - α²) = sqrt(316.23² - 100²) = sqrt(100,000 - 10,000) = sqrt(90,000) = 300 rad/s.',
          'Step 5: Formulate the characteristic roots s1,2: s1,2 = -α ± j*ωd = -100 ± j300 rad/s.',
          'Final Result: Underdamped oscillation with roots at s = -100 ± j300 s⁻¹.'
        ],
        keyTakeaway: 'Whenever α < ω₀, calculate the damped oscillation frequency ωd and format the solution with j components.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_eee301_1',
        question: 'For a passive reciprocal two-port network characterized by transmission matrix [ABCD], which condition must be identically satisfied?',
        options: ['AB - CD = 1', 'AD - BC = 1', 'AC - BD = 0', 'A + D = B + C'],
        correctAnswer: 1,
        explanation: 'For all linear bilateral reciprocal two-port electrical networks, the determinant of the ABCD parameter matrix equals unity (AD - BC = 1).',
        year: '2024 UNILAG Exam'
      },
      {
        id: 'cbt_eee301_2',
        question: 'In Laplace s-domain transformation, an uncharged inductor of inductance L Henry behaves as an impedance of:',
        options: ['1 / (sL)', 'sL', 's / L', 'L / s'],
        correctAnswer: 1,
        explanation: 'The V-I characteristic v(t) = L di/dt transforms to V(s) = sL * I(s), making the impedance Z(s) = sL.',
        year: '2023 UNILAG Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'ENG 301 / EEE 311',
        notes: 'Same syllabus taught across UNICAL Faculty of Engineering.'
      },
      {
        institution: 'ABU',
        equivalentCode: 'EE 311',
        notes: 'ABU Samaru campus circuit theory course equivalence.'
      },
      {
        institution: 'OAU',
        equivalentCode: 'EEE 305',
        notes: 'Direct match for Obafemi Awolowo University engineering students.'
      },
      {
        institution: 'FUTO',
        equivalentCode: 'EEE 301',
        notes: 'FUTO School of Engineering standard circuit theory module.'
      }
    ],
    createdAt: '2025-02-01'
  },
  {
    id: 'MAT-CSC201-UI-03',
    title: 'CSC 201: Data Structures, Algorithms & Python/C++ Past Question Solutions with Diagrams',
    courseCode: 'CSC 201 / COS 201',
    courseTitle: 'Introduction to Computer Programming and Data Structures',
    institutionId: 'UI',
    department: 'Computer Science',
    faculty: 'Science',
    level: '200L',
    semester: '1st Semester',
    materialType: 'lecture_summary',
    academicSession: '2020 - 2025 High-Yield',
    unlockPrice: 250,
    uploader: {
      id: 'usr_tunde_cs',
      name: 'Tunde Adele (Scholar)',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      badge: 'First Class Scholar',
      institution: 'UI',
      rating: 4.96,
    },
    isVerified: true,
    verifiedBy: 'UI NACOS Academic Committee',
    rating: 4.92,
    reviewCount: 198,
    unlockCount: 970,
    fileSizeKb: 720,
    pageCount: 36,
    summary: 'Time & Space Complexity analysis (Big-O, Big-Omega, Big-Theta), Linked Lists, Binary Search Trees, Stacks, Queues, Recursion, and Sorting Algorithms with step traces.',
    coreConcepts: [
      'Big-O Asymptotic Notations: Best, Average, and Worst-case runtimes',
      'Singly vs Doubly Linked Lists: Insertion, Deletion, and Pointer Traversal',
      'Binary Search Trees (BST): In-order, Pre-order, and Post-order Traversals',
      'Sorting Comparison: QuickSort, MergeSort, HeapSort vs Bubble/Insertion Sort',
    ],
    fullTextContent: `MODULE 1: ASYMPTOTIC NOTATIONS
1. Big-O (O): Formal mathematical upper bound on runtime growth. Describes worst-case.
   f(n) = O(g(n)) iff ∃ constants c > 0, n₀ > 0 such that 0 ≤ f(n) ≤ c*g(n) ∀ n ≥ n₀.

2. Big-Omega (Ω): Formal lower bound (best-case).
3. Big-Theta (Θ): Tight bound (when upper and lower bounds match).

Complexity Hierarchy:
O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ) < O(n!)

MODULE 2: BINARY SEARCH TREE PROPERTIES
- For every node N, every key in N's left subtree is strictly < N.key.
- Every key in N's right subtree is strictly > N.key.
- In-order traversal (Left -> Node -> Right) of a BST ALWAYS yields keys in ascending sorted order.`,
    formulas: [
      {
        name: 'Master Theorem for Divide & Conquer',
        formula: 'T(n) = a*T(n/b) + f(n)',
        note: 'If f(n) = O(n^(log_b(a) - ε)), then T(n) = Θ(n^(log_b(a))).'
      },
      {
        name: 'BST Height to Node Count',
        formula: 'Height h ≈ log₂(N) for balanced trees; h = N - 1 for skewed degenerates',
        note: 'Search runtime degrades from O(log n) to O(n) if tree is un-balanced.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UI 2024 Exam Q3',
        year: '2024',
        questionText: 'Given the pre-order traversal sequence [50, 30, 20, 40, 70, 60, 80], reconstruct the BST and output its post-order traversal sequence.',
        stepByStepSolution: [
          'Step 1: In pre-order (Root -> Left -> Right), the first element 50 is the overall root.',
          'Step 2: Split remaining keys based on BST property (keys < 50 go to left subtree, keys > 50 to right): Left subtree = [30, 20, 40], Right subtree = [70, 60, 80].',
          'Step 3: Recursively reconstruct Left Subtree: Root is 30. Left child = 20, Right child = 40.',
          'Step 4: Recursively reconstruct Right Subtree: Root is 70. Left child = 60, Right child = 80.',
          'Step 5: Compute Post-order traversal (Left -> Right -> Root): Left subtree post-order: [20, 40, 30]; Right subtree post-order: [60, 80, 70]; Append Root 50: [20, 40, 30, 60, 80, 70, 50].',
          'Final Result: Post-order sequence = 20, 40, 30, 60, 80, 70, 50.'
        ],
        keyTakeaway: 'Pre-order gives the root first, and BST partitioning cleanly separates left and right subtrees.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_csc201_1',
        question: 'Which sorting algorithm has a guaranteed worst-case time complexity of O(n log n) and is stable?',
        options: ['QuickSort', 'MergeSort', 'HeapSort', 'SelectionSort'],
        correctAnswer: 1,
        explanation: 'MergeSort divides the array into halves and merges in linear time, guaranteeing O(n log n) worst-case while preserving the relative order of duplicate elements (stable).',
        year: '2024 UI Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'CSC 201',
        notes: 'Matches UNICAL Computer Science syllabus.'
      },
      {
        institution: 'UNILAG',
        equivalentCode: 'CSC 211',
        notes: 'UNILAG Department of Computer Sciences equivalent.'
      },
      {
        institution: 'OAU',
        equivalentCode: 'CSC 201',
        notes: 'Obafemi Awolowo University exact equivalent.'
      }
    ],
    createdAt: '2025-01-20'
  },
  {
    id: 'MAT-LAW201-UNICAL-04',
    title: 'LAW 201: Nigerian Legal System & Law of Contract Casebook with Ratio Decidendi Guides',
    courseCode: 'LAW 201 / PUL 201',
    courseTitle: 'Nigerian Legal System and Law of Contract I',
    institutionId: 'UNICAL',
    department: 'Commercial & Public Law',
    faculty: 'Law',
    level: '200L',
    semester: '1st Semester',
    materialType: 'handwritten_note',
    academicSession: '2019 - 2025 Case Law Digest',
    unlockPrice: 350,
    uploader: {
      id: 'usr_barr_ada',
      name: 'Adaobi Nwosu (LL.B Scholar)',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      badge: 'Verified Moderator',
      institution: 'UNICAL',
      rating: 4.99,
    },
    isVerified: true,
    verifiedBy: 'UNICAL Law Students Association (LAWSAN)',
    rating: 4.98,
    reviewCount: 342,
    unlockCount: 1650,
    fileSizeKb: 980,
    pageCount: 54,
    summary: 'Comprehensive analysis of essential elements of a valid contract: Offer vs Invitation to Treat, Acceptance & Postal Rule, Consideration & Past Consideration, Intention to create Legal Relations with classic Nigerian Supreme Court & English authorities.',
    coreConcepts: [
      'Offer vs Invitation to Treat (Carlill v Carbolic Smoke Ball, Pharmaceutical Society v Boots)',
      'The Postal Rule of Acceptance (Adams v Lindsell) and its limits in modern electronic contracts',
      'Doctrine of Consideration: Adequacy vs Sufficiency (Chappell & Co v Nestle, Thomas v Thomas)',
      'Privity of Contract and Exceptions under Nigerian Commercial Law',
    ],
    fullTextContent: `PART 1: OFFER AND INVITATION TO TREAT
An offer is a definite, clear indication by one party (the offeror) of their willingness to contract on specified terms, made with the intention that it shall become binding as soon as accepted by the offeree.

Distinction from Invitation to Treat:
An invitation to treat is merely an invitation to negotiate or make an offer.
Key Authorities:
1. Goods displayed on store shelves with price tags = Invitation to Treat (Pharmaceutical Society of Great Britain v Boots Cash Chemists [1953]).
2. Advertisements of bilateral contracts = Invitation to Treat (Partridge v Crittenden [1968]).
3. Exception: Unilateral reward offers = Valid Binding Offer to the whole world (Carlill v Carbolic Smoke Ball Co [1893]).`,
    formulas: [
      {
        name: 'Contractual Validity Formula',
        formula: 'Valid Contract = Offer + Unqualified Acceptance + Valuable Consideration + Legal Intention + Capacity',
        note: 'Failure of any core element renders the contract void ab initio or unenforceable.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 Law Exam Q1',
        year: '2024',
        questionText: 'Chief Okon placed a newspaper advert offering a ₦500,000 reward to anyone who recovers his stolen gold watch. Bassey, unaware of the advertisement, finds the watch and returns it to Chief Okon. Later discovering the advert, Bassey demands the reward. Advise Bassey with cited authorities.',
        stepByStepSolution: [
          'Step 1: Identify the legal issue: Can a party accept a unilateral reward offer and claim consideration without prior knowledge of the offer at the time of performance?',
          'Step 2: State the General Rule: In contract law, consensus ad idem (meeting of the minds) is required. An offeree cannot accept an offer of which they were completely ignorant.',
          'Step 3: Cite Binding Authority: R v Clarke (1927) and Fitch v Snedaker (1868) establish that performance done without knowledge of the reward offer does not constitute valid acceptance.',
          'Step 4: Apply to Facts: Bassey returned the watch as a civic gesture without knowing the offer existed. There was no mutual intention to contract between Chief Okon and Bassey at the moment the act occurred.',
          'Conclusion: Bassey is not legally entitled to claim the ₦500,000 reward in a court of law.'
        ],
        keyTakeaway: 'An offer cannot be accepted in ignorance of its existence (R v Clarke).'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_law201_1',
        question: 'Under the Postal Rule established in Adams v Lindsell (1818), an acceptance by post becomes legally effective:',
        options: [
          'The moment the letter is posted in the postbox',
          'Only when the offeror opens and reads the letter',
          'When the postal carrier arrives at the destination',
          'After 48 hours from dispatch'
        ],
        correctAnswer: 0,
        explanation: 'The postal rule stipulates that acceptance is complete and effective the moment the properly addressed and stamped letter is deposited into the custody of the Post Office.',
        year: '2024 UNICAL Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'PUL 201',
        notes: 'Covers identical Nigerian Law of Contract syllabus.'
      },
      {
        institution: 'UI',
        equivalentCode: 'LAW 201',
        notes: 'Matches UI Faculty of Law curriculum.'
      },
      {
        institution: 'OAU',
        equivalentCode: 'JUR 201',
        notes: 'Direct match for Obafemi Awolowo University law students.'
      }
    ],
    createdAt: '2025-01-28'
  },
  {
    id: 'MAT-MED201-UNN-05',
    title: 'ANA 201 / MED 201: Gross Anatomy & Histology of Upper Limb & Thorax with Spotter Practice',
    courseCode: 'ANA 201 / MED 201',
    courseTitle: 'Gross Anatomy and Histology of the Upper Limb and Thorax',
    institutionId: 'UNN',
    department: 'Human Anatomy / Medicine & Surgery',
    faculty: 'Medical & Health Sciences',
    level: '200L',
    semester: '1st Semester',
    materialType: 'cbt_pack',
    academicSession: '2019 - 2025 Spotters & MCQs',
    unlockPrice: 350,
    uploader: {
      id: 'usr_dr_chidiebere',
      name: 'Dr. Chidiebere Eze (MBBS/Anatomy)',
      avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
      badge: 'Verified Moderator',
      institution: 'UNN',
      rating: 4.99,
    },
    isVerified: true,
    verifiedBy: 'UNN Medical Students Association (UNMSA)',
    rating: 4.96,
    reviewCount: 412,
    unlockCount: 1890,
    fileSizeKb: 1450,
    pageCount: 62,
    summary: 'High-yield Brachial Plexus anatomy, nerve lesions (Erb Duchenne, Klumpke, Wrist Drop, Winging of Scapula), Cubital Fossa boundaries, Axillary Artery branches, and Thoracic Wall dissection guides with high-definition spotter diagrams.',
    coreConcepts: [
      'Brachial Plexus Root Architecture: C5-T1 (Roots, Trunks, Divisions, Cords, Branches mnemonic: Real Teenagers Drink Cold Beer)',
      'Clinical Nerve Injuries: Radial nerve at spiral groove (Wrist Drop), Ulnar nerve at medial epicondyle (Claw Hand)',
      'Cubital Fossa: Roof, Floor, and Contents from Medial to Lateral (Median Nerve, Brachial Artery, Biceps Tendon, Radial Nerve)',
      'Heart & Pericardium Blood Supply and Coronary Dominance Anatomy',
    ],
    fullTextContent: `SECTION 1: BRACHIAL PLEXUS ANATOMY (C5 - T1)
Organization:
- 5 Roots: Anterior rami of spinal nerves C5, C6, C7, C8, T1
- 3 Trunks: Upper (C5, C6), Middle (C7), Lower (C8, T1)
- 6 Divisions: Anterior and Posterior divisions for each trunk
- 3 Cords: Lateral (anterior upper & middle), Posterior (all 3 posterior divisions), Medial (anterior lower)
- Terminal Branches: Musculocutaneous, Axillary, Radial, Median, Ulnar

CLINICAL LESIONS:
1. Erb-Duchenne Palsy (Upper trunk injury C5-C6): Loss of abductors and external rotators of shoulder. Hand in "Waiter's Tip" posture (arm adducted, medially rotated, forearm pronated).
2. Klumpke's Palsy (Lower trunk injury C8-T1): Loss of intrinsic hand muscles -> "Claw Hand" deformity.`,
    formulas: [
      {
        name: 'Brachial Plexus Mnemonic',
        formula: 'Roots (5) -> Trunks (3) -> Divisions (6) -> Cords (3) -> Branches (5)',
        note: 'Remember: Real Teenagers Drink Cold Beer (Roots, Trunks, Divisions, Cords, Branches).'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNN 2024 2nd MBBS Exam Q1',
        year: '2024',
        questionText: 'A 24-year-old cyclist fell off his bicycle directly onto the point of his shoulder, widening the angle between his neck and shoulder. Physical exam reveals an arm hanging by his side, medially rotated, with forearm extended and pronated. Name the condition and the nerve roots involved.',
        stepByStepSolution: [
          'Step 1: Analyze the mechanism of trauma: Excessive increase in the angle between head/neck and shoulder traction tears the UPPER TRUNK of the brachial plexus.',
          'Step 2: Identify the spinal roots constituting the upper trunk: C5 and C6 nerve roots.',
          'Step 3: Correlate with clinical presentation: Waiter’s tip / Porter’s tip position resulting from paralysis of deltoid, supraspinatus, infraspinatus, and biceps brachii.',
          'Conclusion: Erb-Duchenne Palsy involving C5 and C6 nerve roots.'
        ],
        keyTakeaway: 'Upper trunk traction = Erb-Duchenne (C5-C6, Waiters Tip); Lower trunk traction = Klumpkes (C8-T1, Claw Hand).'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_med201_1',
        question: 'Which nerve passes directly through the carpal tunnel deep to the flexor retinaculum?',
        options: ['Ulnar nerve', 'Median nerve', 'Radial nerve', 'Musculocutaneous nerve'],
        correctAnswer: 1,
        explanation: 'The Median Nerve traverses the carpal tunnel along with the 9 flexor tendons (4 FDS, 4 FDP, 1 FPL); compression here causes Carpal Tunnel Syndrome.',
        year: '2024 UNN Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'ANA 201 / MED 201',
        notes: 'Identical 2nd MBBS syllabus at UNICAL College of Medical Sciences.'
      },
      {
        institution: 'UI',
        equivalentCode: 'ANA 201',
        notes: 'UI College of Medicine (UCH) Gross Anatomy course.'
      },
      {
        institution: 'ABU',
        equivalentCode: 'ANAT 201',
        notes: 'ABU Zaria Medical Faculty syllabus.'
      }
    ],
    createdAt: '2025-02-05'
  },
  {
    id: 'MAT-ACC201-UNICAL-06',
    title: 'ACC 201 / ACC 211: Financial Accounting Principles, Partnership Accounts & Final Accounts Pack',
    courseCode: 'ACC 201 / ACC 211',
    courseTitle: 'Principles of Financial Accounting I & II',
    institutionId: 'UNICAL',
    department: 'Accounting',
    faculty: 'Management Sciences',
    level: '200L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2018 - 2025 Worked Past Questions',
    unlockPrice: 300,
    uploader: {
      id: 'usr_victor_acc',
      name: 'Victor Okon (ICAN Student Member)',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      badge: 'Class Rep',
      institution: 'UNICAL',
      rating: 4.93,
    },
    isVerified: true,
    verifiedBy: 'UNICAL Department of Accounting Exam Committee',
    rating: 4.91,
    reviewCount: 220,
    unlockCount: 880,
    fileSizeKb: 890,
    pageCount: 46,
    summary: 'Clear step-by-step T-Account ledger postings, Bank Reconciliation Statements, Suspense Accounts correction of errors, Partnership Appropriation, Revaluation on Admission of Partner, and IAS 1 Statement of Financial Position layouts.',
    coreConcepts: [
      'Accounting Equation & Double Entry Principle: Assets = Liabilities + Equity',
      'Classification of Errors: Errors affecting vs Errors NOT affecting trial balance agreement',
      'Bank Reconciliation Statement: Adjusted Cash Book balance vs Bank Statement balance',
      'Partnership Accounting: Profit Sharing, Interest on Capital, Drawings, and Goodwill Revaluation',
    ],
    fullTextContent: `MODULE 1: CORRECTION OF ERRORS & SUSPENSE ACCOUNT
Errors that do NOT affect Trial Balance:
1. Error of Omission: Transaction completely unrecorded in both debit and credit.
2. Error of Commission: Correct amount debited or credited to the wrong personal account (e.g. debited to J. Musa instead of A. Musa).
3. Error of Principle: Transaction entered in the wrong class of account (e.g. treating motor vehicle purchase as motor expense).
4. Error of Original Entry: Incorrect figure recorded from source document into books of prime entry.
5. Error of Complete Reversal: Correct accounts used but debit/credit sides switched.
6. Compensating Errors: Two independent errors accidentally cancelling each other out.`,
    formulas: [
      {
        name: 'Fundamental Accounting Equation',
        formula: 'Assets = Capital + Liabilities + (Revenue - Expenses)',
        note: 'Always holds true in every balanced double-entry ledger.'
      },
      {
        name: 'Partnership Interest on Drawings',
        formula: 'Interest = Total Drawings × Rate × (Average Months / 12)',
        note: 'If drawings occur evenly throughout the year, average period is 6 months.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 Accounting Exam Q2',
        year: '2024',
        questionText: 'A business Cash Book showed a debit balance of ₦145,000 on 31 Dec 2024. The Bank Statement showed a credit balance of ₦172,000. Discrepancies: Uncredited cheques ₦45,000; Unpresented cheques ₦68,000; Bank charges ₦4,000 unrecorded in Cash Book; Direct dividend credit ₦8,000 unrecorded. Prepare Adjusted Cash Book.',
        stepByStepSolution: [
          'Step 1: Start with unadjusted Cash Book balance: ₦145,000 (Debit).',
          'Step 2: Add unrecorded credits (Dividend received): +₦8,000 -> Subtotal = ₦153,000.',
          'Step 3: Deduct unrecorded debits (Bank charges): -₦4,000 -> Adjusted Cash Book Balance = ₦149,000 (Debit).',
          'Step 4: Verify with Bank Reconciliation: Bank Statement balance (₦172,000) + Uncredited cheques (₦45,000) - Unpresented cheques (₦68,000) = ₦149,000.',
          'Conclusion: Adjusted Cash Book balance of ₦149,000 perfectly reconciles.'
        ],
        keyTakeaway: 'Adjust the Cash Book first for unrecorded items before reconciling unpresented/uncredited cheques.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_acc201_1',
        question: 'Purchasing a printing machine for office use and debiting the "Office Stationery Expenses" account is an example of which error?',
        options: ['Error of Principle', 'Error of Commission', 'Error of Omission', 'Compensating Error'],
        correctAnswer: 0,
        explanation: 'Treating a capital expenditure (Asset) as a revenue expenditure (Expense) violates fundamental accounting concepts and constitutes an Error of Principle.',
        year: '2024 UNICAL Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'ACC 211',
        notes: 'Covers identical accounting principles curriculum.'
      },
      {
        institution: 'ABU',
        equivalentCode: 'ACCT 201',
        notes: 'ABU Zaria Accounting Department course match.'
      }
    ],
    verificationStatus: 'APPROVED',
    createdAt: '2025-01-15'
  },
  {
    id: 'MAT-CSC301-UNICAL-07',
    title: 'CSC 301: Operating Systems, Process Synchronization & Deadlock Solutions (2018-2025)',
    courseCode: 'CSC 301',
    courseTitle: 'Operating Systems Principles and Architecture',
    institutionId: 'UNICAL',
    department: 'Computer Science',
    faculty: 'Science',
    level: '300L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2018 - 2025 Solved Series',
    unlockPrice: 350,
    uploader: {
      id: 'usr_uche_01',
      name: 'Blessing Emmanuel (Scholar)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Verified Moderator',
      institution: 'UNICAL',
      rating: 4.98,
    },
    isVerified: true,
    verificationStatus: 'APPROVED',
    verifiedBy: 'UNICAL Faculty of Science Board of Examiners',
    rating: 4.99,
    reviewCount: 389,
    unlockCount: 1540,
    fileSizeKb: 1100,
    pageCount: 52,
    summary: 'Exhaustive step-by-step Bankers Algorithm safety checks, Semaphore mutex patterns, CPU Scheduling Gantt Charts (FCFS, SJF, Round Robin), and Virtual Memory Page Replacement (FIFO, LRU, Optimal).',
    coreConcepts: [
      'Deadlock Conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait (Coffman Conditions)',
      'Bankers Algorithm: Allocation, Max, Need Matrix and Safety Sequence validation',
      'CPU Scheduling Algorithms: Average Waiting Time and Turnaround Time calculations',
      'Page Replacement: Beladys Anomaly in FIFO vs Optimal and LRU stack algorithms',
    ],
    fullTextContent: `CHAPTER 1: PROCESS SYNCHRONIZATION & CRITICAL SECTION PROBLEM
Requirements for Critical Section Solution:
1. Mutual Exclusion: If process P is executing in its critical section, no other process can execute in theirs.
2. Progress: If no process is in critical section and some wish to enter, selection cannot be postponed indefinitely.
3. Bounded Waiting: Bound exists on the number of times other processes are allowed to enter after a process makes a request.

Peterson's Algorithm for Two Processes:
boolean flag[2];
int turn;

Process P0:
flag[0] = true;
turn = 1;
while (flag[1] && turn == 1); // busy wait
// Critical Section
flag[0] = false;`,
    formulas: [
      {
        name: 'Need Matrix in Deadlock Avoidance',
        formula: 'Need[i, j] = Max[i, j] - Allocation[i, j]',
        note: 'Safety test requires Need <= Available for process to be allocated and terminate.'
      },
      {
        name: 'Turnaround & Waiting Time',
        formula: 'TAT = Completion Time - Arrival Time;  WT = TAT - Burst Time',
        note: 'Essential metric for CPU scheduling exam questions.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 CSC 301 Exam Q1',
        year: '2024',
        questionText: 'Consider 5 processes P0-P4 and 3 resource types A (10), B (5), C (7). At time T0, Allocation = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]], Max = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]], Available = [3,3,2]. Is the system in a safe state? Find the safe sequence.',
        stepByStepSolution: [
          'Step 1: Compute Need Matrix (Max - Allocation): P0=[7,4,3], P1=[1,2,2], P2=[6,0,0], P3=[0,1,1], P4=[4,3,1].',
          'Step 2: Compare Available [3,3,2] with Need: P1 Need [1,2,2] <= [3,3,2]. Process P1 executes! New Available = [3,3,2] + [2,0,0] = [5,3,2].',
          'Step 3: P3 Need [0,1,1] <= [5,3,2]. Process P3 executes! New Available = [5,3,2] + [2,1,1] = [7,4,3].',
          'Step 4: P4 Need [4,3,1] <= [7,4,3]. Process P4 executes! New Available = [7,4,3] + [0,0,2] = [7,4,5].',
          'Step 5: P0 Need [7,4,3] <= [7,4,5]. Process P0 executes! New Available = [7,4,5] + [0,1,0] = [7,5,5].',
          'Step 6: P2 Need [6,0,0] <= [7,5,5]. Process P2 executes! New Available = [7,5,5] + [3,0,2] = [10,5,7].',
          'Conclusion: System is in a SAFE state. Safe sequence: <P1, P3, P4, P0, P2>.'
        ],
        keyTakeaway: 'Always update Work vector by adding the newly finished process Allocation vector.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_csc301_1',
        question: 'Which page replacement algorithm is susceptible to Beladys Anomaly (increasing page faults when given more frames)?',
        options: ['FIFO (First-In First-Out)', 'LRU (Least Recently Used)', 'Optimal Algorithm', 'LFU (Least Frequently Used)'],
        correctAnswer: 0,
        explanation: 'Beladys anomaly occurs specifically in FIFO page replacement, where adding more memory frames paradoxically leads to an increase in page faults.',
        year: '2024 UNICAL Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'CSC 312',
        notes: 'Covers identical OS process and deadlock curriculum.'
      },
      {
        institution: 'UI',
        equivalentCode: 'CSC 331',
        notes: 'UI Department of Computer Science Operating Systems.'
      },
      {
        institution: 'ABU',
        equivalentCode: 'COSC 301',
        notes: 'ABU Zaria Operating Systems module.'
      }
    ],
    createdAt: '2025-02-10'
  },
  {
    id: 'MAT-CSC303-UNICAL-08',
    title: 'CSC 303: Database Management Systems, Normalization (1NF to BCNF) & SQL Exam Bible',
    courseCode: 'CSC 303',
    courseTitle: 'Database Design and Management Systems',
    institutionId: 'UNICAL',
    department: 'Computer Science',
    faculty: 'Science',
    level: '300L',
    semester: '1st Semester',
    materialType: 'lecture_summary',
    academicSession: '2019 - 2025 Normalization Pack',
    unlockPrice: 300,
    uploader: {
      id: 'usr_uche_01',
      name: 'Blessing Emmanuel (Scholar)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Verified Moderator',
      institution: 'UNICAL',
      rating: 4.98,
    },
    isVerified: true,
    verificationStatus: 'APPROVED',
    verifiedBy: 'UNICAL NACOS Academic Committee',
    rating: 4.97,
    reviewCount: 310,
    unlockCount: 1280,
    fileSizeKb: 920,
    pageCount: 44,
    summary: 'Complete breakdown of Functional Dependencies, Armstrong axioms, 1NF, 2NF, 3NF, BCNF decomposition algorithms, Transaction ACID properties, and complex nested SQL queries.',
    coreConcepts: [
      'Functional Dependency (FD) and Attribute Closure (X+) algorithms',
      'Lossless-Join and Dependency-Preserving Decomposition proofs',
      'Normal Forms: 2NF (No partial dependency), 3NF (No transitive dependency), BCNF (Determinant must be superkey)',
      'ACID Properties: Atomicity, Consistency, Isolation, Durability in Two-Phase Locking (2PL)',
    ],
    fullTextContent: `SECTION 1: NORMALIZATION HIERARCHY
1NF: All attribute values are atomic (no repeating groups, multi-valued attributes, or composite fields).
2NF: In 1NF + Every non-prime attribute is fully functionally dependent on the primary key (No Partial Dependencies).
3NF: In 2NF + No non-prime attribute is transitively dependent on the primary key (No Transitive Dependencies).
BCNF (Boyce-Codd): For every non-trivial functional dependency X -> Y, X must be a Superkey.`,
    formulas: [
      {
        name: 'Attribute Closure Algorithm',
        formula: 'X⁺: Start with X⁺ = X; For each FD Y -> Z in F, if Y ⊆ X⁺ then X⁺ = X⁺ ∪ Z',
        note: 'Repeat until no more attributes can be added. If X⁺ contains all attributes, X is a candidate key.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 Exam Q3',
        year: '2024',
        questionText: 'Given relation R(A, B, C, D, E) with F = {A -> BC, CD -> E, B -> D, E -> A}. Find all Candidate Keys and determine the highest normal form of R.',
        stepByStepSolution: [
          'Step 1: Compute closure of A: A⁺ = {A} -> {A, B, C} (from A->BC) -> {A, B, C, D} (from B->D) -> {A, B, C, D, E} (from CD->E). A⁺ contains all attributes, so A is a Candidate Key.',
          'Step 2: Since E -> A, E⁺ = {E, A, B, C, D}, so E is also a Candidate Key.',
          'Step 3: Check CD: (CD)⁺ = {C, D, E, A, B}, so CD is a Candidate Key.',
          'Step 4: Check BC: (BC)⁺ = {B, C, D, E, A}, so BC is a Candidate Key.',
          'Step 5: Test BCNF condition: For FD B -> D, B is NOT a superkey (B⁺ = {B, D}). Therefore R is NOT in BCNF.',
          'Step 6: Test 3NF condition: For B -> D, D is a prime attribute (part of candidate key CD). Hence 3NF condition is satisfied.',
          'Conclusion: Highest normal form of R is 3NF.'
        ],
        keyTakeaway: 'In 3NF, a dependency X->Y is allowed if X is a superkey OR Y is a prime attribute.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_csc303_1',
        question: 'Which normal form strictly eliminates transitive dependencies between non-prime attributes?',
        options: ['1NF', '2NF', '3NF', '4NF'],
        correctAnswer: 2,
        explanation: 'Third Normal Form (3NF) requires that no non-prime attribute is transitively dependent on any candidate key.',
        year: '2024 UNICAL Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'CSC 314',
        notes: 'Matches UNILAG database management course.'
      },
      {
        institution: 'UI',
        equivalentCode: 'CSC 333',
        notes: 'UI Database Design equivalent.'
      }
    ],
    createdAt: '2025-02-12'
  },
  {
    id: 'MAT-MTH201-UI-09',
    title: 'MTH 201 / MAT 201: Mathematical Methods & Ordinary Differential Equations Solved Compendium',
    courseCode: 'MTH 201 / MAT 201',
    courseTitle: 'Mathematical Methods and Differential Equations I',
    institutionId: 'UI',
    department: 'Mathematics',
    faculty: 'Science',
    level: '200L',
    semester: '1st Semester',
    materialType: 'formula_sheet',
    academicSession: '2019 - 2025 Solved Equations',
    unlockPrice: 250,
    uploader: {
      id: 'usr_tunde_cs',
      name: 'Tunde Adele (Scholar)',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      badge: 'First Class Scholar',
      institution: 'UI',
      rating: 4.96,
    },
    isVerified: true,
    verificationStatus: 'APPROVED',
    verifiedBy: 'UI Mathematics Department Senate Panel',
    rating: 4.94,
    reviewCount: 260,
    unlockCount: 1100,
    fileSizeKb: 780,
    pageCount: 38,
    summary: 'First and Second order ODEs: Integrating Factors, Exact Equations, Bernoulli Equations, Undetermined Coefficients, Variation of Parameters, and Frobenius Series.',
    coreConcepts: [
      'Integrating Factor Method: I(x) = exp(∫P(x)dx) for dy/dx + P(x)y = Q(x)',
      'Exactness Criterion: ∂M/∂y = ∂N/∂x for M(x,y)dx + N(x,y)dy = 0',
      'Method of Variation of Parameters for 2nd order non-homogeneous ODEs',
    ],
    fullTextContent: `SECTION 1: FIRST ORDER LINEAR DIFFERENTIAL EQUATIONS
Standard form: dy/dx + P(x)y = Q(x)
Integrating factor I(x) = e^(∫ P(x) dx)
General Solution: y * I(x) = ∫ [ Q(x) * I(x) ] dx + C`,
    formulas: [
      {
        name: 'Linear First-Order ODE Solution',
        formula: 'y(x) = (1 / I(x)) * [ ∫ Q(x)·I(x) dx + C ], where I(x) = e^(∫P(x)dx)',
        note: 'Ensure coefficient of dy/dx is 1 before evaluating P(x).'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UI 2024 Math Exam Q2',
        year: '2024',
        questionText: 'Solve the initial value problem: dy/dx + (2/x)y = 4x, given y(1) = 2.',
        stepByStepSolution: [
          'Step 1: Identify P(x) = 2/x and Q(x) = 4x.',
          'Step 2: Compute Integrating Factor: I(x) = e^(∫(2/x)dx) = e^(2 ln x) = e^(ln x²) = x².',
          'Step 3: Multiply through and integrate: y · x² = ∫ (4x · x²) dx = ∫ 4x³ dx = x⁴ + C.',
          'Step 4: Express general solution: y = x² + C / x².',
          'Step 5: Apply initial condition y(1) = 2: 2 = 1² + C / 1² -> 2 = 1 + C -> C = 1.',
          'Conclusion: Particular solution is y(x) = x² + 1 / x².'
        ],
        keyTakeaway: 'Always apply initial conditions at the final step to determine constant C.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_mth201_1',
        question: 'What is the integrating factor for the differential equation dy/dx - 3y = 6?',
        options: ['e^(3x)', 'e^(-3x)', '-3x', '3e^x'],
        correctAnswer: 1,
        explanation: 'Here P(x) = -3. Integrating factor I(x) = e^(∫-3dx) = e^(-3x).',
        year: '2024 UI Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'MTH 201 / MAT 211',
        notes: 'Direct match for UNICAL 200L/300L Science and Engineering students.'
      },
      {
        institution: 'UNILAG',
        equivalentCode: 'MAT 201',
        notes: 'UNILAG Department of Mathematics.'
      }
    ],
    createdAt: '2025-01-30'
  },
  {
    id: 'MAT-PHY101-ABU-10',
    title: 'PHY 101: General Physics I (Mechanics, Thermal Physics & Waves) Solved Pack',
    courseCode: 'PHY 101',
    courseTitle: 'General Physics: Mechanics and Properties of Matter',
    institutionId: 'ABU',
    department: 'Physics',
    faculty: 'Physical Sciences',
    level: '100L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2019 - 2025 CBT & Solved MCQs',
    unlockPrice: 200,
    uploader: {
      id: 'usr_ibrahim_abu',
      name: 'Ibrahim Bello (ABU Scholar)',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      badge: 'First Class Scholar',
      institution: 'ABU',
      rating: 4.95,
    },
    isVerified: true,
    verificationStatus: 'APPROVED',
    verifiedBy: 'ABU Zaria Physics Department Board',
    rating: 4.93,
    reviewCount: 290,
    unlockCount: 1350,
    fileSizeKb: 860,
    pageCount: 40,
    summary: 'Kinematics, Newtons Laws of Motion, Work-Energy-Power, Rotational Dynamics, Fluid Statics/Dynamics (Bernoulli & Poiseuille), and Heat Transfer with diagrammatic solutions.',
    coreConcepts: [
      'Conservation of Linear and Angular Momentum in Elastic/Inelastic collisions',
      'Rotational Dynamics: Torque, Moment of Inertia I = ∫r²dm, and Parallel Axis Theorem',
      'Fluid Mechanics: Continuity Equation A1*v1 = A2*v2 and Bernoullis Principle',
    ],
    fullTextContent: `MODULE 1: ROTATIONAL MECHANICS
Rotational Kinetic Energy: KE_rot = (1/2) * I * ω²
Torque τ = I * α = r × F
Angular Momentum L = I * ω

Parallel Axis Theorem:
I = I_cm + M * d²`,
    formulas: [
      {
        name: 'Bernoulli Equation for Fluid Flow',
        formula: 'P + (1/2)ρv² + ρgh = Constant',
        note: 'Applies to incompressible, non-viscous streamline fluid flow.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'ABU 2024 Exam Q1',
        year: '2024',
        questionText: 'A solid cylinder of mass 2 kg and radius 0.2 m rolls down an inclined plane of height 3 m without slipping. Find its linear speed at the bottom (g = 9.8 m/s²).',
        stepByStepSolution: [
          'Step 1: Apply Conservation of Energy: Potential Energy at top = Total Kinetic Energy at bottom.',
          'Step 2: PE = m·g·h; Total KE = KE_trans + KE_rot = (1/2)m·v² + (1/2)I·ω².',
          'Step 3: For solid cylinder, Moment of Inertia I = (1/2)m·R². Since rolling without slipping, ω = v / R.',
          'Step 4: Total KE = (1/2)m·v² + (1/2)((1/2)m·R²)(v/R)² = (1/2)m·v² + (1/4)m·v² = (3/4)m·v².',
          'Step 5: Equate: m·g·h = (3/4)m·v² -> v² = (4/3)g·h = (4/3) * 9.8 * 3 = 39.2.',
          'Step 6: Compute v: v = sqrt(39.2) ≈ 6.26 m/s.',
          'Conclusion: Linear velocity at the bottom is 6.26 m/s.'
        ],
        keyTakeaway: 'For rolling bodies, always include both translational and rotational kinetic energies.'
      }
    ],
    cbtQuestions: [
      {
        id: 'cbt_phy101_1',
        question: 'In a completely inelastic collision between two bodies, which physical quantity is conserved?',
        options: ['Kinetic Energy only', 'Linear Momentum only', 'Both Kinetic Energy and Linear Momentum', 'Neither Momentum nor Energy'],
        correctAnswer: 1,
        explanation: 'In all collisions without external forces, linear momentum is conserved. Inelastic collisions lose kinetic energy to heat/deformation.',
        year: '2024 ABU Exam'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'PHY 111 / PHY 101',
        notes: 'Covers identical introductory physics syllabus.'
      },
      {
        institution: 'UNILAG',
        equivalentCode: 'PHS 101',
        notes: 'UNILAG Department of Physics.'
      }
    ],
    createdAt: '2025-01-18'
  },
  {
    id: 'MAT-CSC315-UNICAL-PENDING-11',
    title: 'CSC 315: Compiler Construction, Lexical Analysis & LR(1) Parser Design Pack',
    courseCode: 'CSC 315',
    courseTitle: 'Compiler Construction and Automata Systems',
    institutionId: 'UNICAL',
    department: 'Computer Science',
    faculty: 'Science',
    level: '300L',
    semester: '1st Semester',
    materialType: 'past_question',
    academicSession: '2024/2025 Fresh Upload',
    unlockPrice: 300,
    uploader: {
      id: 'usr_samuel_unical',
      name: 'Samuel Bassey (300L Class Rep)',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      badge: 'Class Rep',
      institution: 'UNICAL',
      rating: 4.85,
    },
    isVerified: false,
    verificationStatus: 'PENDING',
    assignedModerator: {
      id: 'usr_uche_01',
      name: 'Blessing Emmanuel (Senate Reviewer)',
      role: 'Senior Academic Moderator',
      institution: 'UNICAL'
    },
    auditLogs: [
      {
        id: 'LOG-315-01',
        materialId: 'MAT-CSC315-UNICAL-PENDING-11',
        timestamp: '2025-02-18 09:10 AM',
        moderatorId: 'sys_queue',
        moderatorName: 'National Dispatch Engine',
        moderatorBadge: 'Automated Dispatch',
        action: 'ASSIGNED',
        statusAfter: 'PENDING',
        notes: 'Assigned to UNICAL Science Moderator Blessing Emmanuel for syllabus and worked solution validation.'
      }
    ],
    rating: 4.8,
    reviewCount: 14,
    unlockCount: 42,
    fileSizeKb: 890,
    pageCount: 32,
    summary: 'Lexical analysis (Flex/Lex), Context-Free Grammars, First and Follow sets computation, LL(1) parsing tables, and Shift-Reduce LR(0)/LR(1) DFA state machines with step-by-step 2024 exam solutions.',
    coreConcepts: [
      'Phases of a Compiler: Lexical -> Syntax -> Semantic -> Intermediate Code -> Optimizer -> Code Generator',
      'Computation of FIRST and FOLLOW sets for Context-Free Grammars',
      'Shift-Reduce and Reduce-Reduce conflicts in Bottom-Up LR parsers',
    ],
    fullTextContent: `MODULE 1: PHASES OF COMPILATION
1. Lexical Analysis (Scanner): Converts sequence of characters into meaningful tokens.
2. Syntax Analysis (Parser): Creates Abstract Syntax Tree according to formal grammar rules.
3. Semantic Analysis: Type checking, variable declarations verification, scope rules.
4. Intermediate Code Generation (Three-Address Code).
5. Code Optimization: Dead code elimination, loop invariant code motion.
6. Target Code Generation: Emits assembly/machine code.`,
    formulas: [
      {
        name: 'FIRST & FOLLOW Calculation Rules',
        formula: 'If X -> aY, then FIRST(X) includes {a}; If A -> αBβ, then FOLLOW(B) includes FIRST(β) - {ε}',
        note: 'Essential for constructing predictive LL(1) parsing tables.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNICAL 2024 CSC 315 Exam Q1',
        year: '2024',
        questionText: 'Given Grammar: E -> T E\', E\' -> + T E\' | ε, T -> F T\', T\' -> * F T\' | ε, F -> ( E ) | id. Compute FIRST and FOLLOW sets for all non-terminals.',
        stepByStepSolution: [
          'Step 1: Compute FIRST sets: FIRST(F) = {(, id}; FIRST(T\') = {*, ε}; FIRST(T) = FIRST(F) = {(, id}; FIRST(E\') = {+, ε}; FIRST(E) = FIRST(T) = {(, id}.',
          'Step 2: Compute FOLLOW sets: Add $ to start symbol: FOLLOW(E) = {$, )}.',
          'Step 3: FOLLOW(E\') = FOLLOW(E) = {$, )}.',
          'Step 4: FOLLOW(T) = (FIRST(E\') - {ε}) ∪ FOLLOW(E) = {+, $, )}.',
          'Step 5: FOLLOW(T\') = FOLLOW(T) = {+, $, )}.',
          'Step 6: FOLLOW(F) = (FIRST(T\') - {ε}) ∪ FOLLOW(T) = {*, +, $, )}.',
          'Conclusion: FIRST and FOLLOW sets successfully computed.'
        ],
        keyTakeaway: 'Always initialize the start symbol with end-marker $ in FOLLOW set calculation.'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNILAG',
        equivalentCode: 'CSC 321',
        notes: 'UNILAG Compiler Design equivalence.'
      }
    ],
    createdAt: '2025-02-18'
  },
  {
    id: 'MAT-GST102-UNILAG-REVISION-12',
    title: 'GST 102: Philosophy, Critical Thinking & Symbolic Logic Solved Questions',
    courseCode: 'GST 102',
    courseTitle: 'Philosophy and Logic',
    institutionId: 'UNILAG',
    department: 'Philosophy / General Studies',
    faculty: 'Arts',
    level: '100L',
    semester: '2nd Semester',
    materialType: 'past_question',
    academicSession: '2023/2024 Review Session',
    unlockPrice: 200,
    uploader: {
      id: 'usr_uche_01',
      name: 'Blessing Emmanuel (Scholar)',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Student Contributor',
      institution: 'UNILAG',
      rating: 4.7,
    },
    isVerified: false,
    verificationStatus: 'REVISION_REQUESTED',
    assignedModerator: {
      id: 'usr_femi_eng',
      name: 'Engr. Femi Adeleke',
      role: 'Senate Senior Moderator',
      institution: 'UNILAG'
    },
    moderationFeedback: 'The propositional truth tables in Section 2 are accurate, but worked solution for 2024 Fallacy Question 3b is missing step-by-step formal syllogism deduction. Please add the missing working and resubmit.',
    revisionRequests: [
      'Add step-by-step syllogism deduction for Fallacy of Affirming the Consequent (Question 3b).',
      'Clarify symbolic truth table notations (use standard ∧, ∨, ¬, → instead of raw text letters).'
    ],
    auditLogs: [
      {
        id: 'LOG-GST102-01',
        materialId: 'MAT-GST102-UNILAG-REVISION-12',
        timestamp: '2025-02-17 04:30 PM',
        moderatorId: 'usr_femi_eng',
        moderatorName: 'Engr. Femi Adeleke',
        moderatorBadge: 'Senate Senior Moderator',
        action: 'REVISION_REQUESTED',
        statusAfter: 'REVISION_REQUESTED',
        reasonCategory: 'Incomplete Worked Solutions',
        notes: 'Requested worked explanation on formal fallacy deductions and standard Unicode propositional logic symbols.',
        suggestedChanges: [
          'Add formal syllogism step-by-step working for Question 3b',
          'Standardize truth table operators to formal logic symbols'
        ]
      }
    ],
    rating: 4.6,
    reviewCount: 8,
    unlockCount: 19,
    fileSizeKb: 610,
    pageCount: 22,
    summary: 'Deductive vs Inductive reasoning, Categorical Syllogisms, Truth tables for conjunction/disjunction/implication, and Informal Fallacies (Ad Hominem, Straw Man, Begging the Question).',
    coreConcepts: [
      'Modus Ponens vs Modus Tollens valid propositional argument forms',
      'Fallacies of Relevance and Presumption in Academic Debate',
      'Truth Table validation for Tautologies, Contradictions, and Contingencies',
    ],
    fullTextContent: `SECTION 1: VALID DEDUCTIVE ARGUMENT FORMS
1. Modus Ponens (Affirming the Antecedent):
   Premise 1: If P, then Q (P → Q)
   Premise 2: P
   Conclusion: Therefore, Q

2. Modus Tollens (Denying the Consequent):
   Premise 1: If P, then Q (P → Q)
   Premise 2: Not Q (¬Q)
   Conclusion: Therefore, Not P (¬P)`,
    formulas: [
      {
        name: 'Modus Ponens Formal Structure',
        formula: '( (P → Q) ∧ P ) → Q',
        note: 'Always a valid tautology under classical propositional calculus.'
      }
    ],
    workedQuestions: [
      {
        questionNumber: 'UNILAG 2024 GST 102 Q1',
        year: '2024',
        questionText: 'Identify the fallacy: "Senator Musa claims we must improve university funding, but he failed his degree 20 years ago so we should ignore his plan."',
        stepByStepSolution: [
          'Step 1: Analyze the target of the attack: The speaker attacks Senator Musa\'s personal background instead of evaluating his policy proposal.',
          'Step 2: Match with Informal Fallacies taxonomy: Attacking the person rather than their argument is the Argumentum Ad Hominem (Abusive).',
          'Conclusion: Fallacy of Ad Hominem.'
        ],
        keyTakeaway: 'Ad Hominem dismisses arguments by attacking personal character rather than logical merit.'
      }
    ],
    crossCampusEquivalents: [
      {
        institution: 'UNICAL',
        equivalentCode: 'GST 102',
        notes: 'UNICAL Philosophy and Logic course equivalence.'
      }
    ],
    createdAt: '2025-02-15'
  },
  {
    id: 'MAT-ENG201-FUTO-REJECTED-13',
    title: 'ENG 201: Engineering Mechanics Raw Unformatted Photo Scans',
    courseCode: 'ENG 201',
    courseTitle: 'Engineering Mechanics: Statics and Dynamics',
    institutionId: 'FUTO',
    department: 'Civil Engineering',
    faculty: 'Engineering',
    level: '200L',
    semester: '1st Semester',
    materialType: 'handwritten_note',
    academicSession: '2022 Session',
    unlockPrice: 150,
    uploader: {
      id: 'usr_futo_student',
      name: 'Kelechi Amadi',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      badge: 'Student Contributor',
      institution: 'FUTO',
      rating: 3.2,
    },
    isVerified: false,
    verificationStatus: 'REJECTED',
    assignedModerator: {
      id: 'usr_dr_chidiebere',
      name: 'Dr. Chidiebere Eze',
      role: 'Senate Quality Inspector',
      institution: 'UNN'
    },
    rejectionReason: 'Low scan quality, blurry illegible handwriting in truss force diagrams, and incomplete chapter notes lacking worked examination answers.',
    auditLogs: [
      {
        id: 'LOG-ENG201-01',
        materialId: 'MAT-ENG201-FUTO-REJECTED-13',
        timestamp: '2025-02-16 11:20 AM',
        moderatorId: 'usr_dr_chidiebere',
        moderatorName: 'Dr. Chidiebere Eze',
        moderatorBadge: 'Senate Quality Inspector',
        action: 'REJECTED',
        statusAfter: 'REJECTED',
        reasonCategory: 'Legibility & Quality Standards',
        notes: 'Handwritten photos are too dark and out of focus for students on mobile screens. Does not meet National Study Vault minimum readability guidelines.'
      }
    ],
    rating: 3.0,
    reviewCount: 3,
    unlockCount: 2,
    fileSizeKb: 340,
    pageCount: 12,
    summary: 'Raw preliminary notes on Method of Joints and Method of Sections in 2D pin-jointed trusses with partial calculations.',
    coreConcepts: [
      'Equilibrium of Concurrent Force Systems: ΣFx = 0, ΣFy = 0, ΣM = 0',
      'Method of Joints for determining internal member forces in bridge trusses',
    ],
    fullTextContent: `Truss notes: ΣFx = 0, ΣFy = 0. Joint A has 2 unknown forces.`,
    crossCampusEquivalents: [],
    createdAt: '2025-02-14'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NOTIF-01',
    userId: 'usr_uche_01',
    title: '🎉 Material Verified by Senate Board',
    message: 'Your pack "CSC 301: Operating Systems Principles" has been officially verified by UNICAL Faculty of Science Board! You earned a +₦500 quality verification bonus.',
    type: 'VERIFICATION_APPROVED',
    timestamp: '2 hours ago',
    isRead: false,
    materialId: 'MAT-CSC301-UNICAL-07',
    materialCode: 'CSC 301',
    actionLabel: 'View Verified Pack',
    actionTab: 'contributor'
  },
  {
    id: 'NOTIF-02',
    userId: 'usr_uche_01',
    title: '⚠️ Revision Requested for GST 102',
    message: 'Moderator Engr. Femi Adeleke reviewed your GST 102 upload and requested step-by-step working for Question 3b. Click to review feedback and resubmit.',
    type: 'REVISION_REQUESTED',
    timestamp: 'Yesterday at 04:30 PM',
    isRead: false,
    materialId: 'MAT-GST102-UNILAG-REVISION-12',
    materialCode: 'GST 102',
    actionLabel: 'Review & Fix Revisions',
    actionTab: 'contributor'
  },
  {
    id: 'NOTIF-03',
    userId: 'usr_uche_01',
    title: '💡 AI Recommendation Alert',
    message: 'We noticed you are studying 300L Computer Science at UNICAL. 94% of peers taking CSC 301 also downloaded "CSC 303: Database Normalization Bible".',
    type: 'RECOMMENDATION_ALERT',
    timestamp: 'Today at 07:00 AM',
    isRead: true,
    materialId: 'MAT-CSC303-UNICAL-08',
    materialCode: 'CSC 303',
    actionLabel: 'Explore Recommendation',
    actionTab: 'vault'
  },
  {
    id: 'NOTIF-04',
    userId: 'usr_uche_01',
    title: '💰 Micro-Royalty Credited',
    message: '₦1,200 has been credited to your contributor ledger from 4 new student unlocks of your GST 111 Masterpack.',
    type: 'ROYALTY_EARNED',
    timestamp: 'Today at 09:45 AM',
    isRead: true,
    actionLabel: 'View Wallet Balance',
    actionTab: 'orders'
  }
];

export const SERVICE_ITEMS: ServiceItem[] = [
  {
    id: 'ASSIGNMENT_ASSISTANCE',
    title: 'Assignment Assistance & Term Paper Research',
    shortDesc: 'Well-researched, 100% original, plagiarism-free academic assignments delivered strictly on time.',
    detailedDesc: 'Expert academic guidance for course assignments, lab reports, essays, and term papers across all university faculties. We ensure proper citation formatting (APA/MLA/Harvard), rigorous calculations, and comprehensive explanations.',
    imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=80',
    baseFee: 3500,
    processingTime: '24 - 48 Hours',
    deliveryMethod: 'Instant WhatsApp & SMS',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'OAU', 'FUTO', 'UNIBEN', 'LASU'],
    requiredInputs: [
      { field: 'courseCode', label: 'Course Code & Topic', type: 'text', placeholder: 'e.g. GST 111 - Expository Essay on National Unity', required: true },
      { field: 'matricNumber', label: 'Matric / Student ID', type: 'text', placeholder: 'e.g. 22/042144091', required: true },
      { field: 'deadline', label: 'Submission Deadline Date', type: 'text', placeholder: 'e.g. In 48 hours / Friday 12pm', required: true },
      { field: 'whatsappNumber', label: 'WhatsApp Number for Delivery', type: 'number', placeholder: '08012345678', required: true }
    ]
  },
  {
    id: 'PROJECT_GUIDANCE',
    title: 'Project Guidance & Chapter Formulation',
    shortDesc: 'From concept approval to final defense presentation — we guide you through every milestone.',
    detailedDesc: 'End-to-end undergraduate and postgraduate final year project support: Topic formulation, Chapter 1-5 writeups, methodology design, data gathering instrument design, and defense slide preparation.',
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&auto=format&fit=crop&q=80',
    baseFee: 8000,
    processingTime: '3 - 7 Working Days',
    deliveryMethod: 'Physical Submission & Dispatch',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'OAU', 'FUTO', 'UNIBEN', 'LASU'],
    requiredInputs: [
      { field: 'projectTopic', label: 'Approved Project Topic / Field of Interest', type: 'text', placeholder: 'e.g. Impact of Microfinance on SME Growth in Lagos', required: true },
      { field: 'department', label: 'Department & Degree Type', type: 'text', placeholder: 'e.g. B.Sc. Banking and Finance', required: true },
      { field: 'targetChapters', label: 'Scope Required (Proposal / Ch. 1-3 / Full Ch. 1-5)', type: 'select', options: ['Project Proposal & Topic Formulation', 'Chapters 1 to 3 (Proposal Stage)', 'Full Chapters 1 to 5 + Defense Slides', 'Defense PowerPoint Preparation'], required: true },
      { field: 'whatsappNumber', label: 'WhatsApp Contact Number', type: 'number', placeholder: '08148920119', required: true }
    ]
  },
  {
    id: 'RESEARCH_SUPPORT',
    title: 'Research Support & Statistical Analysis (SPSS/Python/R)',
    shortDesc: 'Reliable academic sources, peer-reviewed citations, SPSS/Python/R analysis, and clear insights.',
    detailedDesc: 'Comprehensive data analysis, hypothesis testing, regression/correlation tables, thematic qualitative coding, and academic journal formatting to elevate your research outcomes.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
    baseFee: 6000,
    processingTime: '2 - 4 Working Days',
    deliveryMethod: 'Instant WhatsApp & SMS',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'OAU', 'FUTO', 'UNIBEN', 'LASU'],
    requiredInputs: [
      { field: 'researchTitle', label: 'Research Objective / Topic', type: 'text', placeholder: 'e.g. Empirical evaluation of solar irradiance models', required: true },
      { field: 'analysisTool', label: 'Preferred Analysis Tool', type: 'select', options: ['SPSS Statistical Suite', 'Python (Pandas / NumPy / SciPy)', 'R Statistical Computing', 'Excel Advanced Modeling', 'Qualitative Thematic Analysis'], required: true },
      { field: 'whatsappNumber', label: 'WhatsApp Number for Dataset & Report', type: 'number', placeholder: '08023419982', required: true }
    ]
  },
  {
    id: 'ACADEMIC_TUTORIALS',
    title: 'Academic Tutorials & Exam Coaching Clinics',
    shortDesc: 'Understand difficult course concepts, master calculations, and perform at your highest level.',
    detailedDesc: 'Personalized private coaching and group revision clinics conducted by top departmental scholars and verified alumni tutors. Covers step-by-step past question solving and high-yield exam techniques.',
    imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=80',
    baseFee: 4500,
    processingTime: 'Scheduled within 24 Hours',
    deliveryMethod: 'Instant WhatsApp & SMS',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'OAU', 'FUTO', 'UNIBEN', 'LASU'],
    requiredInputs: [
      { field: 'courseCode', label: 'Target Course Code(s)', type: 'text', placeholder: 'e.g. MTH 201, EEE 301, PHY 101', required: true },
      { field: 'sessionPreference', label: 'Session Format', type: 'select', options: ['1-on-1 Intensive Virtual Coaching (Google Meet/Zoom)', 'WhatsApp Step-by-Step Audio & Solution Deck', 'Small Group Exam Revision Clinic'], required: true },
      { field: 'whatsappNumber', label: 'WhatsApp Contact', type: 'number', placeholder: '08182048831', required: true }
    ]
  },
  {
    id: 'RESULT_CHECKER_PIN',
    title: 'Portal Result Checker PIN & Scratch Token (WAEC/JAMB/Portal)',
    shortDesc: 'Instant automated delivery of academic portal scratch card PINs for semester results checking.',
    detailedDesc: 'Generates and delivers authentic semester result checking PINs directly to your screen and WhatsApp with step-by-step portal login instructions for your specific university portal.',
    imageUrl: 'https://images.unsplash.com/photo-1588072432836-e10032774350?w=600&auto=format&fit=crop&q=80',
    baseFee: 1500,
    processingTime: 'Instant (Under 60 seconds)',
    deliveryMethod: 'Instant WhatsApp & SMS',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'OAU'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Matric / Registration Number', type: 'text', placeholder: 'e.g. 19/042144081', required: true },
      { field: 'academicSession', label: 'Academic Session', type: 'select', options: ['2024/2025', '2023/2024', '2022/2023'], required: true },
      { field: 'semester', label: 'Target Semester', type: 'select', options: ['1st Semester', '2nd Semester', 'Annual Result'], required: true },
      { field: 'whatsappNumber', label: 'WhatsApp Phone Number', type: 'number', placeholder: '08012345678', required: true }
    ]
  },
  {
    id: 'NELFUND_LOAN_ASSIST',
    title: 'NELFUND Student Loan Prep & Institutional Validation',
    shortDesc: 'End-to-end guidance, document auditing, admission validation, and NELFUND portal submission clearance.',
    detailedDesc: 'Comprehensive student loan assistance package: We verify your JAMB admission letter, institutional portal matric verification, student loan portal clearance, and dispatch our campus agent to ensure your Dean of Student Affairs / Bursary office validates your application.',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
    baseFee: 2500,
    processingTime: '24 - 48 Hours',
    deliveryMethod: 'Official Registry Stamping',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN', 'FUTO'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Matriculation Number', type: 'text', placeholder: 'e.g. 21/084144023', required: true },
      { field: 'jambRegNumber', label: 'JAMB Registration Number', type: 'text', placeholder: 'e.g. 202110293847EF', required: true },
      { field: 'ninNumber', label: 'National Identification Number (NIN)', type: 'number', placeholder: '11-digit NIN', required: true },
      { field: 'bankAccount', label: 'Student Bank & Account Number', type: 'text', placeholder: 'Access Bank - 0123456789', required: true },
      { field: 'department', label: 'Department & Current Level', type: 'text', placeholder: 'Computer Science - 300L', required: true }
    ]
  },
  {
    id: 'ACADEMIC_TRANSCRIPT',
    title: 'Academic Transcript Processing & Registry Submission',
    shortDesc: 'Physical Senate registry tracking, Dean signatures, stamp verification, and courier dispatch worldwide.',
    detailedDesc: 'Skip the queues and travel expenses. Our verified senior campus agents pull your physical student file from the Examinations & Records registry, track Dean endorsements, pay registry clearing fees, and deliver certified digital/hard-copy transcripts to your target recipient institution or WES.',
    imageUrl: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=80',
    baseFee: 6500,
    processingTime: '3 - 7 Working Days',
    deliveryMethod: 'Physical Submission & Dispatch',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'UNN', 'OAU', 'ABU'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Graduation / Matric Number', type: 'text', placeholder: 'e.g. 18/052144012', required: true },
      { field: 'yearOfGraduation', label: 'Year of Entry / Graduation', type: 'text', placeholder: 'e.g. 2018 - 2023', required: true },
      { field: 'destinationAddress', label: 'Recipient Organization / University & WES Ref', type: 'text', placeholder: 'University of Toronto / WES Ref #123456', required: true },
      { field: 'faculty', label: 'Faculty & Department', type: 'text', placeholder: 'Faculty of Law - Public Law', required: true }
    ]
  },
  {
    id: 'REMITA_FEES_CLEARANCE',
    title: 'School Fees Remita RRR Generation & Clearance Stamping',
    shortDesc: 'Official RRR generation, bank clearing receipt verification, and faculty bursary clearance stamping.',
    detailedDesc: 'Generates your official school fees invoice with valid Remita Retrieval Reference (RRR), resolves payment validation errors, and obtains your authorized Bursary Department receipt stamp.',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&auto=format&fit=crop&q=80',
    baseFee: 1800,
    processingTime: '2 - 4 Hours',
    deliveryMethod: 'Official Registry Stamping',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'FUTO', 'UNIBEN'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Student Matric Number', type: 'text', placeholder: 'e.g. 22/032144091', required: true },
      { field: 'feeCategory', label: 'Fee Category', type: 'select', options: ['Undergraduate Full School Fees', 'Acceptance Fee', 'Faculty & Departmental Dues', 'Late Registration Surcharge'], required: true },
      { field: 'academicSession', label: 'Academic Session', type: 'select', options: ['2024/2025', '2023/2024'], required: true }
    ]
  },
  {
    id: 'DEFERMENT_LETTER',
    title: 'Deferment of Admission / Leave of Absence Letter Routing',
    shortDesc: 'Official formal letter preparation, HOD & Dean endorsement routing, and Senate Secretariat approval.',
    detailedDesc: 'Need to defer your admission or take an official academic leave of absence? We draft your formal petition according to your university academic regulations, submit to HOD, Faculty Board, and track Senate approval.',
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&auto=format&fit=crop&q=80',
    baseFee: 4000,
    processingTime: '3 - 5 Working Days',
    deliveryMethod: 'Physical Submission & Dispatch',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'ABU', 'UNN'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Student Matric / Reg Number', type: 'text', placeholder: 'e.g. 23/074144019', required: true },
      { field: 'reasonForDeferment', label: 'Reason for Deferment (Medical / Financial / Personal)', type: 'text', placeholder: 'Medical reasons with clinic doctor note', required: true },
      { field: 'sessionToResume', label: 'Intended Session to Resume', type: 'text', placeholder: '2025/2026 Session', required: true }
    ]
  },
  {
    id: 'STATEMENT_OF_RESULT',
    title: 'Statement of Results & NYSC Mobilization Clearance',
    shortDesc: 'Senate approved statement of results collection, green card vetting, and NYSC mobilization tracking.',
    detailedDesc: 'Fast-track collection of your official Statement of Results from the Senate building, validation of senate list upload, and NYSC call-up clearance coordination.',
    imageUrl: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=600&auto=format&fit=crop&q=80',
    baseFee: 5000,
    processingTime: '2 - 4 Working Days',
    deliveryMethod: 'Physical Submission & Dispatch',
    popularFor: ['UNICAL', 'UNILAG', 'UI', 'OAU', 'UNN'],
    requiredInputs: [
      { field: 'matricNumber', label: 'Graduation Matric Number', type: 'text', placeholder: 'e.g. 19/042144089', required: true },
      { field: 'department', label: 'Department & Degree Awarded', type: 'text', placeholder: 'B.Sc. Microbiology (Second Class Upper)', required: true },
      { field: 'yearOfGraduation', label: 'Graduation Year', type: 'text', placeholder: '2024 Convocation Set', required: true }
    ]
  }
];

export const CAMPUS_AGENTS: CampusAgent[] = [
  {
    id: 'agt_unical_01',
    name: 'Daniel Okon Effiong',
    institutionId: 'UNICAL',
    campusLocation: 'UNICAL Senate Building & Malabor Hall Desk',
    rating: 4.98,
    completedTasks: 482,
    status: 'AVAILABLE',
    phone: '+234 814 892 0119',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
    specialization: 'Examinations & Records, Transcript Liaison, NELFUND Desk',
    ninVerified: true,
    cgpa: 4.42,
    tier: 'TOP_AGENT_80_20',
    escrowBalance: 10000,
    avgResponseMins: 32,
    badges: ['TOP_AGENT_MONTHLY', 'FAST_RESPONDER', 'REGISTRY_EXCELLENCE', 'SECURITY_CLEARED'],
    guarantorLecturer: {
      name: 'Prof. K. A. Bassey',
      department: 'Department of Computer Science & Senate Board',
      staffId: 'UNICAL/SEN/8821'
    }
  },
  {
    id: 'agt_unilag_02',
    name: 'Adebayo Oluwaseun',
    institutionId: 'UNILAG',
    campusLocation: 'UNILAG Senate House, Akoka Main Campus',
    rating: 4.96,
    completedTasks: 610,
    status: 'AVAILABLE',
    phone: '+234 802 341 9982',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    specialization: 'Post-UTME Screenings, Portal Clearance, Senate Letters',
    ninVerified: true,
    cgpa: 4.28,
    tier: 'TOP_AGENT_80_20',
    escrowBalance: 10000,
    avgResponseMins: 28,
    badges: ['TOP_AGENT_MONTHLY', 'FAST_RESPONDER', 'SECURITY_CLEARED'],
    guarantorLecturer: {
      name: 'Dr. O. Adeleke',
      department: 'Faculty of Business Administration',
      staffId: 'UNILAG/AC/9012'
    }
  },
  {
    id: 'agt_ui_03',
    name: 'Boluwatife Adeleke',
    institutionId: 'UI',
    campusLocation: 'UI Registry & Agbowo Admin Liaison',
    rating: 4.95,
    completedTasks: 395,
    status: 'AVAILABLE',
    phone: '+234 803 762 1104',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    specialization: 'Faculty Signatures, Deferment Processing, Transcript Dispatch',
    ninVerified: true,
    cgpa: 3.92,
    tier: 'STANDARD_70_30',
    escrowBalance: 10000,
    avgResponseMins: 44,
    badges: ['REGISTRY_EXCELLENCE', 'SECURITY_CLEARED'],
    guarantorLecturer: {
      name: 'Dr. F. Alabi',
      department: 'Faculty of Pharmacy',
      staffId: 'UI/PH/7732'
    }
  },
  {
    id: 'agt_abu_04',
    name: 'Ibrahim Shehu Garba',
    institutionId: 'ABU',
    campusLocation: 'ABU Senate Building, Samaru Main Campus',
    rating: 4.94,
    completedTasks: 310,
    status: 'AVAILABLE',
    phone: '+234 806 912 3450',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    specialization: 'Bursary Validation, Student Affairs Clearance, Result PINs',
    ninVerified: true,
    cgpa: 4.10,
    tier: 'STANDARD_70_30',
    escrowBalance: 10000,
    avgResponseMins: 40,
    badges: ['SECURITY_CLEARED', 'FAST_RESPONDER'],
    guarantorLecturer: {
      name: 'Dr. M. S. Danjuma',
      department: 'Faculty of Engineering',
      staffId: 'ABU/ENG/5512'
    }
  },
  {
    id: 'agt_unn_05',
    name: 'Chioma Nwankwo',
    institutionId: 'UNN',
    campusLocation: 'UNN Franco Admin Block & Records Division',
    rating: 4.99,
    completedTasks: 440,
    status: 'AVAILABLE',
    phone: '+234 818 204 8831',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    specialization: 'Medical Center Clearance, Statement of Results, NELFUND',
    ninVerified: true,
    cgpa: 4.65,
    tier: 'TOP_AGENT_80_20',
    escrowBalance: 10000,
    avgResponseMins: 22,
    badges: ['TOP_AGENT_MONTHLY', 'REGISTRY_EXCELLENCE', 'SECURITY_CLEARED'],
    guarantorLecturer: {
      name: 'Prof. C. C. Okeke',
      department: 'Faculty of Medical Sciences',
      staffId: 'UNN/MED/3309'
    }
  }
];

export const INITIAL_SERVICE_ORDERS: ServiceOrder[] = [
  {
    id: 'ORD-2025-9981',
    trackingCode: 'UNICAL-NELF-8902',
    userId: 'usr_uche_01',
    serviceType: 'NELFUND_LOAN_ASSIST',
    targetInstitution: 'UNICAL',
    status: 'PROCESSING_AT_REGISTRY',
    amountPaid: 2500,
    studentName: 'Blessing Okon Bassey',
    matricNumber: '21/042144081',
    department: 'Computer Science',
    phoneNumber: '08149820119',
    email: 'blessing.okon@student.unical.edu.ng',
    notes: 'Urgent institutional verification before NELFUND portal batch 2 closes.',
    slaHoursTarget: 4,
    slaDeadline: '2h 15m remaining',
    slaStatus: 'ON_TRACK',
    assignedAgent: {
      id: 'agt_unical_01',
      name: 'Daniel Okon Effiong',
      phone: '+234 814 892 0119',
      institution: 'UNICAL',
      rating: 4.98,
      commissionEarned: 2000,
      tier: 'TOP_AGENT_80_20'
    },
    backupAgent: {
      id: 'agt_unical_backup',
      name: 'Victoria Edet (Backup Rep)',
      phone: '+234 805 119 4021',
      institution: 'UNICAL'
    },
    proofSubmission: {
      id: 'PRF-UNICAL-8902',
      orderId: 'ORD-2025-9981',
      agentId: 'agt_unical_01',
      agentName: 'Daniel Okon Effiong',
      receiptNumber: 'UNICAL/BURS/NELF/8920',
      stampedImageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80',
      registryStaffSignoff: 'Mr. E. O. Akpan (Student Affairs Desk Officer)',
      notes: 'Cleared with Bursary Desk & Student Affairs. Stamped authorization receipt uploaded for Senate verification.',
      submittedAt: 'Today at 11:45 AM',
      verifiedByStudentOrAdmin: false,
      status: 'PENDING_VERIFICATION'
    },
    timeline: [
      {
        stage: 'Order Placed & Escrow Funded',
        time: 'Today at 08:30 AM',
        completed: true,
        description: 'Payment of ₦2,500 successfully confirmed via Paystack. SLA window of 4 hours initiated.'
      },
      {
        stage: 'Campus Agent Assigned (Daniel Okon)',
        time: 'Today at 09:15 AM',
        completed: true,
        description: 'Agent Daniel Okon Effiong accepted dispatch at UNICAL Senate Building (Tier 80/20).'
      },
      {
        stage: 'Processing at Student Affairs / Registry',
        time: 'Today at 11:45 AM',
        completed: true,
        description: 'Matriculation record cross-checked with Bursary database and cleared.'
      },
      {
        stage: 'Official Verification Stamp Uploaded',
        time: 'In Review',
        completed: true,
        description: 'Official Registry Stamp proof uploaded. Awaiting student or admin sign-off to release payout.'
      },
      {
        stage: 'Escrow Payout Release & WhatsApp Dispatch',
        time: 'Next Step',
        completed: false,
        description: 'Digital stamp receipt delivered to WhatsApp and ₦2,000 commission released to agent balance.'
      }
    ],
    createdAt: '2025-02-18'
  },
  {
    id: 'ORD-2025-9942',
    trackingCode: 'UNILAG-PIN-1102',
    userId: 'usr_uche_01',
    serviceType: 'RESULT_CHECKER_PIN',
    targetInstitution: 'UNILAG',
    status: 'COMPLETED_DISPATCHED',
    amountPaid: 1500,
    studentName: 'Toluwani Adeyemi',
    matricNumber: '20/0912401',
    department: 'Accounting',
    phoneNumber: '08023419982',
    email: 'toluwani@live.unilag.edu.ng',
    notes: '2023/2024 2nd semester result PIN',
    slaHoursTarget: 2,
    slaDeadline: 'Completed in 12 mins',
    slaStatus: 'MET',
    assignedAgent: {
      id: 'agt_unilag_02',
      name: 'Adebayo Oluwaseun',
      phone: '+234 802 341 9982',
      institution: 'UNILAG',
      rating: 4.96,
      commissionEarned: 1200,
      tier: 'TOP_AGENT_80_20'
    },
    proofSubmission: {
      id: 'PRF-UNILAG-1102',
      orderId: 'ORD-2025-9942',
      agentId: 'agt_unilag_02',
      agentName: 'Adebayo Oluwaseun',
      receiptNumber: 'UNILAG/PIN/GEN/9941',
      registryStaffSignoff: 'UNILAG ICT Portal Desk',
      notes: 'Portal scratch token generated and verified live against student portal.',
      submittedAt: 'Yesterday at 02:11 PM',
      verifiedByStudentOrAdmin: true,
      status: 'APPROVED_VERIFIED'
    },
    timeline: [
      {
        stage: 'Payment Confirmed',
        time: 'Yesterday at 02:10 PM',
        completed: true,
        description: 'Payment of ₦1,500 confirmed via Paystack Card. SLA timer started.'
      },
      {
        stage: 'PIN Generated & Registry Signoff',
        time: 'Yesterday at 02:11 PM',
        completed: true,
        description: 'PIN Serial #8920194812 Serial Code: 4910-8201-9921 activated.'
      },
      {
        stage: 'Delivered via WhatsApp & Payout Released',
        time: 'Yesterday at 02:12 PM',
        completed: true,
        description: 'Delivered to student WhatsApp. ₦1,200 commission credited to Adebayo Oluwaseun.'
      }
    ],
    createdAt: '2025-02-17'
  }
];

export const FEED_POSTS: FeedPost[] = [
  {
    id: 'POST-001',
    authorId: 'usr_uche_01',
    authorName: 'Blessing Emmanuel',
    authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    authorBadge: 'First Class Scholar',
    authorInstitution: 'UNICAL',
    authorDepartment: 'Computer Science',
    authorLevel: '300L',
    title: 'CSC 301 (Operating Systems): Semaphore, Banker\'s Algorithm & Critical Section Solved Handout 📚',
    content: 'Hey everyone! I just uploaded my comprehensive 28-page study breakdown for CSC 301 mid-term tests and exams. Includes worked examples for Peterson\'s solution, Banker\'s Algorithm safety checks with tables, and Belady\'s Anomaly page replacement. Tested and vetted with past exam patterns from 2018 to 2024.',
    courseCode: 'CSC 301',
    category: 'handout',
    attachment: {
      name: 'CSC301_Complete_OS_Handout_2025.pdf',
      fileSize: '3.4 MB',
      fileType: 'PDF Document',
      pagesCount: 28,
      previewSnippet: 'Detailed walkthrough of Semaphores (wait() and signal() primitives), Mutex Locks, Deadlock Conditions (Coffman Criteria), and Memory Paging calculation guides.'
    },
    priceRequested: 500,
    moderatedPrice: 350,
    moderationStatus: 'APPROVED',
    verifiedByModerator: 'UNICAL Faculty of Science Moderator',
    moderatorNotes: 'High academic quality, complete formulas, and accurate step-by-step calculations. Regulated to ₦350 student subsidy rate.',
    likesCount: 142,
    likedByUserIds: ['usr_guest_demo', 'usr_john_01'],
    comments: [
      {
        id: 'c1',
        authorId: 'usr_john_01',
        authorName: 'Kelechi Okafor',
        authorInstitution: 'UNICAL',
        text: 'This handout literally saved me during our pop quiz yesterday! The Banker\'s algorithm explanation is so clear.',
        timestamp: '2 hours ago'
      },
      {
        id: 'c2',
        authorId: 'usr_mariam_02',
        authorName: 'Mariam Bello',
        authorInstitution: 'UNILAG',
        text: 'Does this also cover CSC 312 for UNILAG syllabus? The topics look identical.',
        timestamp: '45 mins ago'
      }
    ],
    viewsCount: 1240,
    createdAt: '3 hours ago'
  },
  {
    id: 'POST-002',
    authorId: 'usr_dr_chidiebere',
    authorName: 'Dr. Chidiebere Eze',
    authorAvatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
    authorBadge: 'Verified Moderator',
    authorInstitution: 'UNN',
    authorDepartment: 'Medicine & Surgery',
    authorLevel: '400L',
    title: 'ANA 201: Gross Anatomy High-Yield Spotters & Brachial Plexus Dissection Slides 🩺',
    content: 'Uploaded the 2025 spotter revision deck for 2nd MBBS Anatomy students across UNN, UNICAL, and UI. Contains HD labelled cadaveric specimens, clinical case questions (Erb Duchenne, Klumpke, Wrist drop), and thoracic cavity wall boundaries.',
    courseCode: 'ANA 201',
    category: 'lecture_note',
    attachment: {
      name: 'Anatomy_201_Spotters_BrachialPlexus.pdf',
      fileSize: '5.8 MB',
      fileType: 'PDF Document',
      pagesCount: 45,
      previewSnippet: 'Covers Anterior & Posterior divisions of Brachial Plexus roots C5-T1, Axillary Artery branches, Cubital Fossa boundaries, and clinical nerve root lesions.'
    },
    priceRequested: 700,
    moderatedPrice: 400,
    moderationStatus: 'APPROVED',
    verifiedByModerator: 'Senate Board Medical Reviewer',
    moderatorNotes: 'Verified against NUC medical curriculum. Accurate anatomical spotter references.',
    likesCount: 289,
    likedByUserIds: ['usr_guest_demo'],
    comments: [
      {
        id: 'c3',
        authorId: 'usr_victor_09',
        authorName: 'Victor Adeleke',
        authorInstitution: 'UI',
        text: 'Super helpful for our pre-clinical exams coming up next week. Thank you doc!',
        timestamp: '5 hours ago'
      }
    ],
    viewsCount: 2310,
    createdAt: '6 hours ago'
  },
  {
    id: 'POST-003',
    authorId: 'usr_barr_esther',
    authorName: 'Esther Olamide (Law)',
    authorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    authorBadge: 'Class Rep',
    authorInstitution: 'UNILAG',
    authorDepartment: 'Commercial & Industrial Law',
    authorLevel: '200L',
    title: 'PUL 201 / LAW 201: Nigerian Constitutional Law Landmark Cases & Ratio Decidendi ⚖️',
    content: 'Summary of top 40 Supreme Court judgments on Fundamental Human Rights (Chapter IV 1999 CFRN), Separation of Powers (Attorney General of Bendel State v. AG Federation), and Locus Standi (Fawehinmi v. Akilu). Free open access for all law scholars!',
    courseCode: 'PUL 201',
    category: 'past_question',
    attachment: {
      name: 'Constitutional_Law_Landmark_Cases_Compendium.pdf',
      fileSize: '2.1 MB',
      fileType: 'PDF Document',
      pagesCount: 32,
      previewSnippet: 'Case briefs, issues for determination, ratio decidendi, dissenting opinions, and exam question answering templates for legal problem questions.'
    },
    priceRequested: 0,
    moderatedPrice: 0,
    moderationStatus: 'APPROVED',
    verifiedByModerator: 'UNILAG Law Faculty Moderator',
    moderatorNotes: 'Verified authentic legal citations. Approved for Free Open Student Access.',
    likesCount: 341,
    likedByUserIds: ['usr_guest_demo'],
    comments: [
      {
        id: 'c4',
        authorId: 'usr_samuel_04',
        authorName: 'Samuel Bassey',
        authorInstitution: 'UNICAL',
        text: 'Clean case summaries! The Fawehinmi locus standi distinction is top tier.',
        timestamp: '1 day ago'
      }
    ],
    viewsCount: 3100,
    createdAt: '1 day ago'
  },
  {
    id: 'POST-004',
    authorId: 'usr_fatima_abu',
    authorName: 'Fatima Mohammed',
    authorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    authorBadge: 'Student Contributor',
    authorInstitution: 'ABU',
    authorDepartment: 'Economics & Accounting',
    authorLevel: '200L',
    title: 'ACC 201: Trial Balance Corrections & Adjusted Cash Book Step-by-Step Template 📊',
    content: 'Just uploaded our tutorial revision sheets for Error of Principle vs Commission, Suspense Account reconciliations, and Bank Reconciliation statements with unpresented/uncredited cheques.',
    courseCode: 'ACC 201',
    category: 'tutorial',
    attachment: {
      name: 'ACC201_Bank_Reconciliation_Suspense_Accounts.pdf',
      fileSize: '1.9 MB',
      fileType: 'PDF Document',
      pagesCount: 19,
      previewSnippet: 'Step 1-4 double-entry ledger adjustment guidelines, adjusted cash book templates, and 2024 solved university exam questions.'
    },
    priceRequested: 400,
    moderatedPrice: 250,
    moderationStatus: 'APPROVED',
    verifiedByModerator: 'ABU Accounting Department Moderator',
    moderatorNotes: 'Clear double-entry solutions. Regulated price set to ₦250.',
    likesCount: 98,
    likedByUserIds: [],
    comments: [],
    viewsCount: 890,
    createdAt: '2 days ago'
  }
];

export const FAQ_ITEMS: FAQItem[] = [
  // 1. ADMISSIONS & SCREENING
  {
    id: 'faq-adm-1',
    category: 'admissions',
    question: 'How do I resolve JAMB CAPS admission status showing "Admission in Progress" (AIP) or "Not Admitted"?',
    answer: 'If your JAMB CAPS shows "Admission in Progress", your institution has recommended you for admission and JAMB is validating your O\'level and bio-data. Ensure your O\'level results (WAEC/NECO/NABTEB) are fully uploaded to JAMB portal via an accredited CBT center. If it shows "Not Admitted", verify your aggregate cutoff score against the departmental merit and catchment list, or consider a change of course to an eligible programme.',
    keywords: ['JAMB', 'CAPS', 'AIP', 'Admission in Progress', 'O\'Level upload', 'CBT center', 'Cutoff']
  },
  {
    id: 'faq-adm-2',
    category: 'admissions',
    question: 'What is JAMB Regularisation and who needs it?',
    answer: 'JAMB Regularisation (Late Application) is for students who gained admission without an official JAMB Admission Letter (e.g. through pre-degree, diploma, remedial programmes, or direct institutional transfer). It formalizes your admission on the JAMB National Matriculation List, which is strictly required for NYSC mobilization and graduation verification.',
    keywords: ['Regularisation', 'JAMB Letter', 'NYSC mobilization', 'Matric list', 'Remedial', 'Transfer']
  },
  {
    id: 'faq-adm-3',
    category: 'admissions',
    question: 'How do I do Change of Course or Institution on JAMB and school portals?',
    answer: 'Visit any accredited JAMB CBT centre with your profile code to initiate Change of Course/Institution. Once updated on JAMB, generate your updated slip. You must then register for the target university\'s supplementary or Post-UTME screening on their official portal before their advertised deadline.',
    keywords: ['Change of course', 'Change of institution', 'Supplementary', 'Post-UTME', 'CBT centre']
  },

  // 2. REGISTRY, TRANSCRIPTS & CLEARANCE
  {
    id: 'faq-reg-1',
    category: 'transcripts',
    question: 'How long does official Academic Transcript processing take, and how can I track it?',
    answer: 'Official transcripts typically take 3 to 7 working days when handled by dedicated on-ground registry agents. The process involves pulling your physical archive file from Examinations & Records, Dean\'s signature, Senate vetting, registrar seal stamping, and electronic or DHL courier dispatch to recipient universities or WES/ECE credentials evaluation services. Our campus desk provides real-time milestone tracking.',
    keywords: ['Transcript', 'Senate', 'Examinations and records', 'WES', 'Registry', 'Courier', 'Degree verification']
  },
  {
    id: 'faq-reg-2',
    category: 'transcripts',
    question: 'What is the difference between a Statement of Result and an Original Degree Certificate?',
    answer: 'A Statement of Result is a temporary official document issued by the Senate immediately after graduation approval to enable graduates to seek employment or proceed for NYSC. An Original Certificate is the permanent parchment issued after formal Convocation ceremonies and signed by the Vice-Chancellor and Registrar.',
    keywords: ['Statement of result', 'Certificate', 'Convocation', 'Senate', 'NYSC clearance']
  },
  {
    id: 'faq-reg-3',
    category: 'transcripts',
    question: 'How do I process Deferment of Admission or an Official Leave of Absence?',
    answer: 'Submit a formal application through your Course Adviser to your Head of Department (HOD), stating valid grounds (medical certified by university clinic, financial, or compassionate). If recommended, it proceeds to the Faculty Board of Studies and University Senate Secretariat. Ensure you receive an official approval letter before stepping away to avoid forfeiture of admission.',
    keywords: ['Deferment', 'Leave of absence', 'HOD', 'Senate approval', 'Course adviser', 'Clinic note']
  },

  // 3. NELFUND STUDENT LOAN
  {
    id: 'faq-nel-1',
    category: 'nelfund',
    question: 'Who is eligible for the NELFUND Federal Student Loan and what documents are required?',
    answer: 'All registered undergraduate and postgraduate students in accredited Nigerian Federal and State universities, polytechnics, and colleges of education are eligible. Required details include: Valid 11-digit NIN, verified JAMB Registration Number, institutional Matriculation Number, active commercial Bank Account (linked to BVN), and institutional portal confirmation.',
    keywords: ['NELFUND', 'Student loan', 'NIN', 'JAMB number', 'Matric number', 'BVN', 'Eligibility']
  },
  {
    id: 'faq-nel-2',
    category: 'nelfund',
    question: 'How is NELFUND institutional verification completed by the Dean of Student Affairs?',
    answer: 'After you submit on the NELFUND portal, the application queue is routed to your university\'s Student Affairs and Bursary verification desk. The desk validates your active enrollment, matriculation status, and semester fee invoices. Our campus team assists in following up with registry officers to ensure your verification status updates promptly.',
    keywords: ['Dean of Student Affairs', 'Bursary', 'Institutional verification', 'Disbursement', 'Upkeep stipend']
  },

  // 4. ACADEMICS, CGPA & CARRYOVERS
  {
    id: 'faq-acad-1',
    category: 'academics',
    question: 'How is CGPA calculated in Nigerian universities on a 5.0 scale?',
    answer: 'CGPA is calculated by dividing Total Grade Points (TGP) by Total Credit Units Registered (TCU). Grade Point breakdown: A (70-100%) = 5 points, B (60-69%) = 4 points, C (50-59%) = 3 points, D (45-49%) = 2 points, E (40-44%) = 1 point, F (0-39%) = 0 points. Multiply each course\'s credit unit by the grade point earned, sum them up, and divide by the total credit units.',
    keywords: ['CGPA calculation', 'TGP', 'TCU', 'Grade points', '5.0 scale', 'First class', 'Second class']
  },
  {
    id: 'faq-acad-2',
    category: 'academics',
    question: 'What happens when you have a carryover course, and how do you clear it?',
    answer: 'A carryover occurs when you score below 40% (an F grade) in a registered course. You must re-register the course in the next session that the course is offered (e.g. 1st semester carryovers in 1st semester). The new grade earned replaces the zero grade point in your cumulative calculations, though both registrations remain on your official transcript.',
    keywords: ['Carryover', 'F grade', 'Course re-registration', 'Grade replacement', 'Transcript audit']
  },
  {
    id: 'faq-acad-3',
    category: 'academics',
    question: 'How do I resolve a missing result (result omitted on broadsheet)?',
    answer: 'Immediately obtain a Missing Result Query Form from your Departmental Examination Officer or HOD. Provide your course registration slip, signed exam attendance sheet snippet/date, and continuous assessment (test) records. The lecturer submits a rectified score sheet directly to the Faculty Board of Examiners and Senate.',
    keywords: ['Missing result', 'Broadsheet', 'Exam officer', 'HOD', 'Attendance sheet', 'CA score']
  },

  // 5. CAMPUS ACCOMMODATION & FEES
  {
    id: 'faq-fee-1',
    category: 'fees_hostels',
    question: 'How does university hostel balloting and room allocation work?',
    answer: 'Hostel portal balloting opens shortly after school fees payment is confirmed on the school portal. Eligible students (usually freshers, final year students, and medical/special students first) log in, select preferred hall of residence, and generate a hostel RRR invoice. Payment must be made within 24-48 hours to prevent bed space forfeiture.',
    keywords: ['Hostel', 'Accommodation', 'Balloting', 'Bed space', 'Hall of residence', 'Remita RRR']
  },
  {
    id: 'faq-fee-2',
    category: 'fees_hostels',
    question: 'What should I do if my Remita payment is successful but not updating on the school portal?',
    answer: 'Do not pay twice! Keep your bank transaction debit receipt and Remita Retrieval Reference (RRR). Submit an RRR validation ticket on the school portal or present the printout to the University Bursary ICT Desk. Bursary verifies the transaction reference with the CBN gateway and manually validates your semester registration.',
    keywords: ['Remita', 'RRR', 'Payment pending', 'Bursary ICT', 'Receipt validation', 'School fees']
  },

  // 6. SENATE REGULATIONS & STUDENT DISCIPLINE
  {
    id: 'faq-reg-rules',
    category: 'regulations',
    question: 'What constitutes Examination Malpractice and what are Senate Disciplinary Committee procedures?',
    answer: 'Exam malpractice includes bringing unapproved notes/smart devices into exam halls, impersonation, copying, giraffing, and exchanging answer booklets. Alleged cases are reported to the Senate Examination Malpractice Committee (SEMC). Students receive formal notice, appear for a hearing with representation rights, and receive Senate ruling (ranging from course cancellation to rustication or expulsion depending on severity).',
    keywords: ['Exam malpractice', 'Senate committee', 'Disciplinary hearing', 'Rustication', 'Expulsion', 'Student rights']
  }
];
