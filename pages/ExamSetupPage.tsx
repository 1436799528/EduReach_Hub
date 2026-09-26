import { ArrowRight, BookOpen, Calculator, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark, { identityClassFor } from '../src/components/CardIdentityMark';
import {
  jambCourses,
  jambDepartments,
  jambSubjectCatalog,
  postUtmeSchools,
  secondarySchoolSubjects,
  secondarySubjectCatalog,
  secondarySubjectTracks,
  type ExamSetupKey,
} from '../src/data/examPreparation';
import { fetchCbtExams } from '../src/lib/api';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { durationOptionsFor, resolveSetupExam, type CatalogExam } from '../src/lib/cbt-config';

type SetupCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  duration: string;
  logo: string;
};

// `duration` is only the unconfigured-local-preview label. When a backend is
// configured the setup page shows the exam's real configured default duration
// from the CBT catalogue — never a hard-coded time.
const setupCopy: Record<ExamSetupKey, SetupCopy> = {
  jamb: {
    eyebrow: 'JAMB CBT entry',
    title: 'Choose your JAMB course and subjects',
    intro: 'Enter the practice hall with a subject combination that matches the course you want to study. Use of English is selected by default because it is compulsory for UTME candidates.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
  waec: {
    eyebrow: 'WAEC CBT entry',
    title: 'Set up your WAEC practice plan',
    intro: 'Settle in first: learn how the CBT works, then choose the nine subjects you are offering. Your selections are carried into the practice hall.',
    duration: 'Practice session',
    logo: '/icons/brands/waec.webp',
  },
  neco: {
    eyebrow: 'NECO CBT entry',
    title: 'Set up your NECO practice plan',
    intro: 'Read the short exam guide and choose the nine subjects you are offering before you begin your NECO practice session.',
    duration: 'Practice session',
    logo: '/icons/brands/neco.webp',
  },
  'post-utme': {
    eyebrow: 'Post-UTME CBT entry',
    title: 'Choose your school before you practise',
    intro: 'Post-UTME tests are school-specific. Select an institution from the active Post-UTME practice catalogue so the hall can show the right preparation context.',
    duration: 'Practice session',
    logo: '/icons/brands/jamb.png',
  },
};

const guideItems = [
  { title: 'Read each question carefully', body: 'Choose an answer by tapping an option. You can move backwards, forwards or open the question palette.' },
  { title: 'Watch the timer', body: 'The countdown stays visible and the test submits when time expires. Your progress is saved while you practise.' },
  { title: 'Use the calculator when allowed', body: 'Open the on-screen scientific calculator from the exam bar. It does not leave the CBT page.' },
  { title: 'Review before submitting', body: 'Flag questions for review, check the palette and submit when you are ready. Explanations appear on the scorecard.' },
];

function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function encodedSubjects(subjects: string[]) {
  return encodeURIComponent(subjects.filter(Boolean).join('|'));
}

type SetupMemory = {
  department?: string;
  courseName?: string;
  jambSubjects?: string[];
  secondaryTrack?: (typeof secondarySubjectTracks)[number];
  schoolId?: string;
  schoolSubjects?: string[];
  secondarySubjects?: string[];
};

function readSetupMemory(exam: ExamSetupKey): SetupMemory {
  try {
    const stored = sessionStorage.getItem(`edureach-setup-${exam}`);
    return stored ? JSON.parse(stored) as SetupMemory : {};
  } catch {
    return {};
  }
}

export default function ExamSetupPage({ exam }: { exam: ExamSetupKey }) {
  const copy = setupCopy[exam];
  // Production CBT configuration (single source of truth). `targetExam` is the
  // concrete exam this setup session will start; its configured default
  // duration drives everything the student sees before the timer begins.
  const [catalogExams, setCatalogExams] = useState<CatalogExam[]>([]);
  const [targetExam, setTargetExam] = useState<CatalogExam | null>(null);
  const [chosenMinutes, setChosenMinutes] = useState<number | null>(null);
  const [memory] = useState(() => readSetupMemory(exam));
  const [department, setDepartment] = useState(memory.department || 'All departments');
  const [courseName, setCourseName] = useState(memory.courseName || jambCourses[0].name);
  const [jambSubjects, setJambSubjects] = useState(memory.jambSubjects?.length === 4 ? memory.jambSubjects : jambCourses[0].subjects);
  const [secondaryTrack, setSecondaryTrack] = useState<(typeof secondarySubjectTracks)[number]>(memory.secondaryTrack || 'General');
  const [schoolId, setSchoolId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('school');
    const remembered = memory.schoolId;
    const candidate = remembered || requested;
    return postUtmeSchools.some((school) => school.id === candidate && school.offersPostUtme) ? candidate || postUtmeSchools[0].id : postUtmeSchools[0].id;
  });
  const [schoolSubjects, setSchoolSubjects] = useState<string[]>(memory.schoolSubjects || []);
  const [schoolError, setSchoolError] = useState('');
  const [secondarySubjects, setSecondarySubjects] = useState<string[]>(memory.secondarySubjects?.length === 9 ? memory.secondarySubjects : [
    'Use of English',
    'Mathematics',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`edureach-setup-${exam}`, JSON.stringify({ department, courseName, jambSubjects, secondaryTrack, schoolId, schoolSubjects, secondarySubjects } satisfies SetupMemory));
    } catch {
      // Session storage may be unavailable; the form remains usable in memory.
    }
  }, [courseName, department, exam, jambSubjects, schoolId, schoolSubjects, secondarySubjects, secondaryTrack]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const requestedId = new URLSearchParams(window.location.search).get('exam');
    void fetchCbtExams()
      .then((exams) => {
        if (!active) return;
        const typed = exams as CatalogExam[];
        setCatalogExams(typed);
        const resolved = resolveSetupExam(typed, exam, requestedId);
        setTargetExam(resolved);
        setChosenMinutes(resolved ? resolved.duration_minutes : null);
      })
      .catch(() => {
        // The catalogue read failed; the setup page remains usable and the
        // practice hall will surface the honest question-bank error state.
        if (active) setTargetExam(null);
      });
    return () => { active = false; };
  }, [exam]);

  const defaultMinutes = targetExam?.duration_minutes ?? null;
  const durationChoices = defaultMinutes ? durationOptionsFor(defaultMinutes) : [];
  const effectiveMinutes = chosenMinutes ?? defaultMinutes;

  const filteredCourses = useMemo(
    () => department === 'All departments' ? jambCourses : jambCourses.filter((course) => course.department === department),
    [department],
  );
  const selectedCourse = jambCourses.find((course) => course.name === courseName) || filteredCourses[0] || jambCourses[0];
  const selectedSchool = postUtmeSchools.find((school) => school.id === schoolId) || postUtmeSchools[0];
  const jambOptions = jambSubjectCatalog[selectedCourse.department];
  const secondaryOptions = secondaryTrack === 'General'
    ? secondarySchoolSubjects
    : secondarySubjectCatalog[secondaryTrack];

  function changeDepartment(value: string) {
    setDepartment(value);
    const nextCourse = value === 'All departments' ? jambCourses[0] : jambCourses.find((course) => course.department === value) || jambCourses[0];
    setCourseName(nextCourse.name);
    setJambSubjects(nextCourse.subjects);
  }

  function changeCourse(value: string) {
    const nextCourse = jambCourses.find((course) => course.name === value) || jambCourses[0];
    setCourseName(nextCourse.name);
    setJambSubjects(nextCourse.subjects);
  }

  function changeSchool(value: string) {
    setSchoolId(value);
    const school = postUtmeSchools.find((item) => item.id === value);
    setSchoolSubjects(school?.subjects || []);
  }

  function updateJambSubject(index: number, value: string) {
    setJambSubjects((current) => current.map((subject, subjectIndex) => subjectIndex === index ? value : subject));
  }

  function updateSecondarySubject(index: number, value: string) {
    setSecondarySubjects((current) => current.map((subject, subjectIndex) => subjectIndex === index ? value : subject));
  }

  function changeSecondaryTrack(value: (typeof secondarySubjectTracks)[number]) {
    setSecondaryTrack(value);
    // Keep the two common core slots where the selected track supports them,
    // but clear electives so the student makes an explicit, duplicate-free choice.
    const options = value === 'General' ? secondarySchoolSubjects : secondarySubjectCatalog[value];
    setSecondarySubjects([
      options.includes('Use of English') ? 'Use of English' : '',
      options.includes('Mathematics') ? 'Mathematics' : '',
      '', '', '', '', '', '', '',
    ]);
  }

  function startPractice() {
    setSchoolError('');
    if (exam === 'jamb' && (jambSubjects.length !== 4 || jambSubjects.some((subject) => !subject))) {
      setSchoolError('Choose all four JAMB subjects before entering the practice hall.');
      return;
    }
    if (exam === 'jamb' && (jambSubjects[0] !== 'Use of English' || new Set(jambSubjects).size !== jambSubjects.length)) {
      setSchoolError('Use of English must be first, and each JAMB subject can be selected only once.');
      return;
    }
    if ((exam === 'waec' || exam === 'neco') && secondarySubjects.some((subject) => !subject)) {
      setSchoolError('Choose all nine subjects before entering the practice hall.');
      return;
    }
    if ((exam === 'waec' || exam === 'neco') && new Set(secondarySubjects).size !== secondarySubjects.length) {
      setSchoolError('Choose each subject only once.');
      return;
    }

    // Prefer the concrete production exam id; fall back to the stable local
    // preview id only when no catalogue is configured/resolvable.
    const examId = targetExam?.id || `practice-exam-${exam}`;
    const params = new URLSearchParams({ exam: examId });
    if (effectiveMinutes) params.set('duration', String(effectiveMinutes));
    if (exam === 'jamb') {
      params.set('course', courseName);
      params.set('department', selectedCourse.department);
      params.set('subjects', encodedSubjects(jambSubjects));
    } else if (exam === 'post-utme') {
      params.set('school', selectedSchool.id);
      params.set('schoolName', selectedSchool.name);
      params.set('subjects', encodedSubjects(schoolSubjects.length ? schoolSubjects : selectedSchool.subjects));
    } else {
      params.set('subjects', encodedSubjects(secondarySubjects));
    }
    navigateInApp(`/cbt/practice?${params.toString()}`);
  }

  return (
    <HubLayout>
      <main className="hub-page" style={{ padding: '22px 0 64px' }}>
        <div className="hub-container hub-narrow" style={{ maxWidth: '820px' }}>
          <section className="er-setup-hero">
            <div className="er-setup-hero-mark"><img src={copy.logo} alt={`${exam.toUpperCase()} logo`} width={48} height={48} /></div>
            <div>
              <span className="hub-eyebrow">{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.intro}</p>
              <span className="er-setup-duration"><Clock3 size={14} /> {defaultMinutes ? `Default time: ${defaultMinutes} minutes` : copy.duration}</span>
            </div>
          </section>

          {(exam === 'waec' || exam === 'neco') && (
            <section className="er-setup-guide" aria-labelledby="cbt-guide-title">
              <div className="er-setup-section-heading">
                <div>
                  <span className="hub-eyebrow">Before you begin</span>
                  <h2 id="cbt-guide-title">How this CBT practice works</h2>
                </div>
                <Calculator size={22} aria-hidden="true" />
              </div>
              <div className="er-setup-guide-grid">
                {guideItems.map((item, index) => (
                  <div className="er-setup-guide-item" key={item.title}>
                    <span>{index + 1}</span>
                    <div><strong>{item.title}</strong><p>{item.body}</p></div>
                  </div>
                ))}
              </div>
              <p className="er-setup-note"><ShieldCheck size={15} /> This is a practice environment. Confirm the current official examination instructions for your examination year.</p>
            </section>
          )}

          <section className="er-setup-panel" aria-labelledby="setup-selection-title">
            <div className="er-setup-section-heading">
              <div>
                <span className="hub-eyebrow">Your setup</span>
                <h2 id="setup-selection-title">{exam === 'jamb' ? 'Select a course combination' : exam === 'post-utme' ? 'Select your school' : 'Select your nine subjects'}</h2>
              </div>
              <CardIdentityMark value={exam} type="service" size="sm" />
            </div>

            {exam === 'jamb' && (
              <div className="er-setup-form-grid">
                <label>
                  Department / interest area
                  <select value={department} onChange={(event) => changeDepartment(event.target.value)}>
                    {jambDepartments.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Course you want to study
                  <select value={courseName} onChange={(event) => changeCourse(event.target.value)}>
                    {filteredCourses.map((course) => <option key={course.name} value={course.name}>{course.name}</option>)}
                  </select>
                </label>
                <div className="er-setup-full-width">
                  <span className="er-setup-label">Choose your four UTME subjects</span>
                  <div className="er-setup-subject-grid er-setup-jamb-subject-grid">
                    {jambSubjects.map((subject, index) => {
                      const usedByOtherSlot = new Set(jambSubjects.filter((_, subjectIndex) => subjectIndex !== index));
                      return (
                        <label key={index}>
                          Subject {index + 1}{index === 0 ? ' · compulsory' : ''}
                          <select
                            value={subject}
                            onChange={(event) => updateJambSubject(index, event.target.value)}
                          >
                            {index !== 0 && <option value="">Choose a subject</option>}
                            {(index === 0 ? ['Use of English'] : jambOptions).map((option) => (
                              <option key={option} value={option} disabled={index !== 0 && usedByOtherSlot.has(option)}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                  <p className="er-setup-field-note">Use of English is required for UTME. The other slots are personalised to the selected interest area and course; confirm the current JAMB brochure for your institution before registering.</p>
                </div>
              </div>
            )}

            {(exam === 'waec' || exam === 'neco') && (
              <div>
                <div className="er-setup-form-grid" style={{ marginBottom: '12px' }}>
                  <label>
                    Track / subject area
                    <select value={secondaryTrack} onChange={(event) => changeSecondaryTrack(event.target.value as (typeof secondarySubjectTracks)[number])}>
                      {secondarySubjectTracks.map((track) => <option key={track} value={track}>{track}</option>)}
                    </select>
                  </label>
                </div>
                <p className="er-setup-field-note" style={{ marginTop: 0 }}>English Language and Mathematics are preselected where they are present in the selected track. Choose nine distinct subjects and confirm your school’s current WAEC or NECO registration requirements.</p>
                <div className="er-setup-subject-grid">
                  {secondarySubjects.map((subject, index) => {
                    const usedByOtherSlot = new Set(secondarySubjects.filter((_, subjectIndex) => subjectIndex !== index));
                    return (
                      <label key={index}>
                        Subject {index + 1}{index < 2 ? ' · core' : ''}
                        <select value={subject} onChange={(event) => updateSecondarySubject(index, event.target.value)}>
                          <option value="">Choose a subject</option>
                          {secondaryOptions.map((option) => <option key={option} value={option} disabled={usedByOtherSlot.has(option)}>{option}</option>)}
                        </select>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {exam === 'post-utme' && (
              <div className="er-setup-form-grid">
                <label className="er-setup-full-width">
                  School of choice
                  <select value={schoolId} onChange={(event) => changeSchool(event.target.value)}>
                    {postUtmeSchools.filter((school) => school.offersPostUtme).map((school) => <option key={school.id} value={school.id}>{school.name} · {school.location}</option>)}
                  </select>
                </label>
                <div className={`er-setup-school-card er-setup-full-width ${identityClassFor('post-utme', 'service')}`}>
                  <CheckCircle2 size={18} />
                  <div><strong>{selectedSchool.examLabel}</strong><span>{selectedSchool.subjects.join(' · ')}</span><small>Only schools with an active Post-UTME practice profile are listed here. Check the school’s current admission notice before applying.</small></div>
                </div>
              </div>
            )}

            {durationChoices.length > 0 && defaultMinutes !== null && (
              <div className="er-setup-duration-picker er-setup-full-width">
                <span className="er-setup-label">Session length</span>
                <div className="er-setup-duration-options" role="radiogroup" aria-label="Choose your practice duration">
                  {durationChoices.map((minutes) => {
                    const isDefault = minutes === defaultMinutes;
                    const isSelected = (effectiveMinutes ?? defaultMinutes) === minutes;
                    return (
                      <button
                        key={minutes}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`er-setup-duration-option${isSelected ? ' is-selected' : ''}`}
                        onClick={() => setChosenMinutes(minutes)}
                      >
                        {minutes} min{isDefault ? ' · default' : ''}
                      </button>
                    );
                  })}
                </div>
                <p className="er-setup-field-note">
                  Default time for this exam is {defaultMinutes} minutes. The countdown starts only when you enter the practice hall.
                </p>
              </div>
            )}

            {schoolError && <div className="hub-form-error" role="alert">{schoolError}</div>}
            <div className="er-setup-actions">
              <button type="button" className="hub-primary-btn" onClick={startPractice}>Enter practice hall <ArrowRight size={15} /></button>
              <a className="hub-outline-btn" href="/past-questions"><BookOpen size={15} /> Browse past questions</a>
            </div>
          </section>
        </div>
      </main>
    </HubLayout>
  );
}
