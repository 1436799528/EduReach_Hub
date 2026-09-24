import { ArrowLeft, ArrowRight, BookOpen, Calculator, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import HubLayout from '../src/components/HubLayout';
import CardIdentityMark from '../src/components/CardIdentityMark';
import { jambCourses, jambDepartments, postUtmeSchools, secondarySchoolSubjects, type ExamSetupKey } from '../src/data/examPreparation';

type SetupCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  duration: string;
  logo: string;
};

const setupCopy: Record<ExamSetupKey, SetupCopy> = {
  jamb: {
    eyebrow: 'JAMB CBT entry',
    title: 'Choose your JAMB course and subjects',
    intro: 'Enter the practice hall with a subject combination that matches the course you want to study. Use of English is selected by default because it is compulsory for UTME candidates.',
    duration: '30-minute practice session',
    logo: '/icons/brands/jamb.png',
  },
  waec: {
    eyebrow: 'WAEC CBT entry',
    title: 'Set up your WAEC practice plan',
    intro: 'Settle in first: learn how the CBT works, then choose the nine subjects you are offering. Your selections are carried into the practice hall.',
    duration: '45-minute practice session',
    logo: '/icons/brands/waec.webp',
  },
  neco: {
    eyebrow: 'NECO CBT entry',
    title: 'Set up your NECO practice plan',
    intro: 'Read the short exam guide and choose the nine subjects you are offering before you begin your NECO practice session.',
    duration: '40-minute practice session',
    logo: '/icons/brands/neco.webp',
  },
  'post-utme': {
    eyebrow: 'Post-UTME CBT entry',
    title: 'Choose your school before you practise',
    intro: 'Post-UTME tests are school-specific. Select an institution from the active Post-UTME practice catalogue so the hall can show the right preparation context.',
    duration: '25-minute practice session',
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

export default function ExamSetupPage({ exam }: { exam: ExamSetupKey }) {
  const copy = setupCopy[exam];
  const [department, setDepartment] = useState('All departments');
  const [courseName, setCourseName] = useState(jambCourses[0].name);
  const [jambSubjects, setJambSubjects] = useState(jambCourses[0].subjects);
  const [schoolId, setSchoolId] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get('school');
    return postUtmeSchools.some((school) => school.id === requested && school.offersPostUtme) ? requested || postUtmeSchools[0].id : postUtmeSchools[0].id;
  });
  const [schoolSubjects, setSchoolSubjects] = useState<string[]>([]);
  const [schoolError, setSchoolError] = useState('');
  const [secondarySubjects, setSecondarySubjects] = useState<string[]>([
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

  const filteredCourses = useMemo(
    () => department === 'All departments' ? jambCourses : jambCourses.filter((course) => course.department === department),
    [department],
  );
  const selectedCourse = jambCourses.find((course) => course.name === courseName) || filteredCourses[0] || jambCourses[0];
  const selectedSchool = postUtmeSchools.find((school) => school.id === schoolId) || postUtmeSchools[0];

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

  function updateSecondarySubject(index: number, value: string) {
    setSecondarySubjects((current) => current.map((subject, subjectIndex) => subjectIndex === index ? value : subject));
  }

  function startPractice() {
    setSchoolError('');
    if ((exam === 'waec' || exam === 'neco') && secondarySubjects.some((subject) => !subject)) {
      setSchoolError('Choose all nine subjects before entering the practice hall.');
      return;
    }
    if ((exam === 'waec' || exam === 'neco') && new Set(secondarySubjects).size !== secondarySubjects.length) {
      setSchoolError('Choose each subject only once.');
      return;
    }

    const examId = `practice-exam-${exam}`;
    const params = new URLSearchParams({ exam: examId });
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
          <a className="hub-back-link" href={exam === 'post-utme' ? '/post-utme' : '/cbt'}>
            <ArrowLeft size={16} /> Back to exam centre
          </a>

          <section className="er-setup-hero">
            <div className="er-setup-hero-mark"><img src={copy.logo} alt={`${exam.toUpperCase()} logo`} width={48} height={48} /></div>
            <div>
              <span className="hub-eyebrow">{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.intro}</p>
              <span className="er-setup-duration"><Clock3 size={14} /> {copy.duration}</span>
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
                  <span className="er-setup-label">Your four UTME subjects</span>
                  <div className="er-setup-subject-chips">
                    {jambSubjects.map((subject) => (
                      <label className="er-setup-subject-chip" key={subject}>
                        <input
                          type="checkbox"
                          checked
                          disabled
                          readOnly
                        />
                        {subject}{subject === 'Use of English' ? ' · compulsory' : ''}
                      </label>
                    ))}
                  </div>
                  <p className="er-setup-field-note">Use of English stays selected. This combination is selected from the course guide; confirm the current JAMB brochure for your institution and course.</p>
                </div>
              </div>
            )}

            {(exam === 'waec' || exam === 'neco') && (
              <div>
                <p className="er-setup-field-note" style={{ marginTop: 0 }}>English Language and Mathematics are preselected as common core subjects. Replace any slot if your registration combination differs.</p>
                <div className="er-setup-subject-grid">
                  {secondarySubjects.map((subject, index) => {
                    const usedByOtherSlot = new Set(secondarySubjects.filter((_, subjectIndex) => subjectIndex !== index));
                    return (
                      <label key={index}>
                        Subject {index + 1}{index < 2 ? ' · core' : ''}
                        <select value={subject} onChange={(event) => updateSecondarySubject(index, event.target.value)}>
                          <option value="">Choose a subject</option>
                          {secondarySchoolSubjects.map((option) => <option key={option} value={option} disabled={usedByOtherSlot.has(option)}>{option}</option>)}
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
                <div className="er-setup-school-card er-setup-full-width">
                  <CheckCircle2 size={18} />
                  <div><strong>{selectedSchool.examLabel}</strong><span>{selectedSchool.subjects.join(' · ')}</span><small>Only schools with an active Post-UTME practice profile are listed here. Check the school’s current admission notice before applying.</small></div>
                </div>
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
