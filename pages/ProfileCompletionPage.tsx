import { useState, useEffect, type FormEvent } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  GraduationCap,
  School,
  Sparkles,
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  ChevronRight,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import { supabase } from '../src/lib/supabase';
import { localStorageKey, readLocalPreviewValue } from '../src/lib/localPreview';
import { useAuth } from '../src/lib/auth';

const commonInstitutions = [
  'University of Lagos (UNILAG)',
  'University of Calabar (UNICAL)',
  'University of Nigeria, Nsukka (UNN)',
  'University of Ibadan (UI)',
  'Obafemi Awolowo University (OAU)',
  'Ahmadu Bello University (ABU)',
  'University of Benin (UNIBEN)',
  'University of Ilorin (UNILORIN)',
  'University of Port Harcourt (UNIPORT)',
  'University of Uyo (UNIUYO)',
  'Lagos State University (LASU)',
  'Federal University of Technology, Akure (FUTA)',
  'Federal University of Technology, Owerri (FUTO)',
  'Other Nigerian University / Polytechnic',
];

const faculties = [
  'Faculty of Science',
  'Faculty of Engineering & Technology',
  'Faculty of Clinical Sciences / Medicine',
  'Faculty of Law',
  'Faculty of Social Sciences',
  'Faculty of Arts & Humanities',
  'Faculty of Management / Business Administration',
  'Faculty of Environmental Sciences',
  'Faculty of Education',
  'Faculty of Agriculture',
  'Basic Medical Sciences',
  'Other Faculty / School',
];

const levels = [
  '100 Level (Freshman)',
  '200 Level',
  '300 Level',
  '400 Level',
  '500 Level (Final Year)',
  'Post-Graduate (Masters / PhD)',
  'JAMB Aspirant / Pre-Degree',
];

const academicInterestOptions = [
  'JAMB UTME Prep',
  'Post-UTME Screening',
  'WAEC / NECO Revision',
  'Undergraduate Scholarships',
  'NELFUND Student Loan',
  'Software & Coding',
  'Research & Publications',
  'Internships & Campus Roles',
  'Study Abroad & Grants',
];

export default function ProfileCompletionPage() {
  const { user } = useAuth();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // 9. Profile photo (optional)
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');

  // 10-16. Academic details
  const [school, setSchool] = useState(commonInstitutions[0]);
  const [customSchool, setCustomSchool] = useState('');
  const [courseProgramme, setCourseProgramme] = useState('');
  const [department, setDepartment] = useState('');
  const [faculty, setFaculty] = useState(faculties[0]);
  const [level, setLevel] = useState(levels[0]);
  const [admissionYear, setAdmissionYear] = useState('');
  const [expectedGradYear, setExpectedGradYear] = useState('');

  // 17. Academic interests (optional)
  const [interests, setInterests] = useState<string[]>(['JAMB UTME Prep', 'Undergraduate Scholarships']);

  // 18. Notification preferences
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Local initials avatar: no external images. Legacy unsplash presets are ignored.
  const rawAvatar = (customAvatar || avatarUrl || '').trim();
  const displayAvatar = rawAvatar.includes('unsplash.com') ? '' : rawAvatar;
  const avatarInitials =
    userName.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'ER';
  const avatarTones = ['#C85841', '#0F172A', '#B45309', '#0E7490'];
  const avatarTone =
    avatarTones[[...userName].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % avatarTones.length];
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    const applyStoredProfile = () => {
      try {
        const stored = JSON.parse(readLocalPreviewValue('profile') || 'null');
        if (!stored) return;
        if (stored.full_name) setUserName(stored.full_name);
        if (stored.email) setUserEmail(stored.email);
        if (stored.school) setSchool(stored.school);
        if (stored.course_programme) setCourseProgramme(stored.course_programme);
        if (stored.department) setDepartment(stored.department);
        if (stored.faculty) setFaculty(stored.faculty);
        if (stored.level) setLevel(stored.level);
        if (stored.admission_year) setAdmissionYear(String(stored.admission_year));
        if (stored.expected_graduation_year) setExpectedGradYear(String(stored.expected_graduation_year));
        if (stored.avatar_url) setAvatarUrl(stored.avatar_url);
        if (Array.isArray(stored.academic_interests) && stored.academic_interests.length) setInterests(stored.academic_interests);
        if (stored.notification_preferences) {
          setEmailAlerts(Boolean(stored.notification_preferences.email_alerts));
          setWhatsappAlerts(Boolean(stored.notification_preferences.whatsapp_alerts));
          setSmsAlerts(Boolean(stored.notification_preferences.sms_alerts));
        }
      } catch {
        // ignore local profile parse issues
      }
    };

    if (user) {
      setUserId(user.isLocal ? '' : user.id);
      setUserEmail(user.email);
      setUserName(user.name);
      applyStoredProfile();
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email || '');
        const meta = data.user.user_metadata || {};
        const fullName = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || 'Student';
        setUserName(fullName);

        // Preload any existing profile data
        void supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile) {
              if (profile.school) setSchool(profile.school);
              if (profile.course_programme) setCourseProgramme(profile.course_programme);
              if (profile.department) setDepartment(profile.department);
              if (profile.faculty) setFaculty(profile.faculty);
              if (profile.level) setLevel(profile.level);
              if (profile.admission_year) setAdmissionYear(String(profile.admission_year));
              if (profile.expected_graduation_year) setExpectedGradYear(String(profile.expected_graduation_year));
              if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
              if (Array.isArray(profile.academic_interests) && profile.academic_interests.length) {
                setInterests(profile.academic_interests);
              }
              if (profile.notification_preferences) {
                setEmailAlerts(Boolean(profile.notification_preferences.email_alerts));
                setWhatsappAlerts(Boolean(profile.notification_preferences.whatsapp_alerts));
                setSmsAlerts(Boolean(profile.notification_preferences.sms_alerts));
              }
            }
          });
      } else {
        applyStoredProfile();
      }
    });
  }, [user]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const finalSchool = school.includes('Other') ? customSchool || school : school;
    const finalAvatar = customAvatar || avatarUrl;

    const payload = {
      school: finalSchool,
      course_programme: courseProgramme.trim(),
      department: department.trim(),
      faculty: faculty.trim(),
      level,
      admission_year: Number(admissionYear) || null,
      expected_graduation_year: Number(expectedGradYear) || null,
      academic_interests: interests,
      notification_preferences: {
        email_alerts: emailAlerts,
        whatsapp_alerts: whatsappAlerts,
        sms_alerts: smsAlerts,
      },
      avatar_url: finalAvatar || null,
      profile_completed: true,
    };

    // Save locally for instant persistence when running without configured auth services
    try {
      localStorage.setItem(localStorageKey('profile-completed'), 'true');
      localStorage.setItem(
        localStorageKey('profile'),
        JSON.stringify({ ...payload, full_name: userName, email: userEmail })
      );
    } catch {
      // ignore
    }

    if (userId) {
      try {
        const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
        if (error) console.warn('Supabase profile update warning:', error);
      } catch (err) {
        console.warn('Supabase offline update fallback:', err);
      }
    }

    setSaving(false);
    setSavedSuccess(true);
    window.setTimeout(() => {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 1200);
  };

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 60px' }}>
        <div className="hub-container" style={{ maxWidth: '780px' }}>
          <div style={{ marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <h1 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Academic Profile &amp; Preferences
            </h1>
          </div>

          {savedSuccess && (
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              <CheckCircle2 size={20} color="#059669" />
              <span>Profile completed successfully! Redirecting to your student dashboard…</span>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '28px',
              boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
            }}
          >
            {/* 9. PROFILE PHOTO (OPTIONAL) */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Camera size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Profile Photo <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>(Optional)</span>
                </h2>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 14px' }}>
                Your initials show by default, or paste a profile image URL.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* CURRENT SELECTION */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '3px solid #C85841',
                    overflow: 'hidden',
                    background: avatarTone,
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      color: '#ffffff',
                      fontWeight: 900,
                      fontSize: '20px',
                    }}
                  >
                    {avatarInitials}
                  </span>
                  {displayAvatar && (
                    <img
                      src={displayAvatar}
                      alt="Avatar"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAvatarUrl('');
                    setCustomAvatar('');
                  }}
                  className="hub-outline-btn"
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                >
                  Use my initials instead
                </button>

                {/* CUSTOM IMAGE INPUT */}
                <div style={{ flex: '1 1 220px' }}>
                  <input
                    type="url"
                    value={customAvatar}
                    aria-label="Profile image URL"
                    onChange={(e) => setCustomAvatar(e.target.value)}
                    placeholder="Or paste image URL (e.g. https://...)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </section>

            {/* 10-13. INSTITUTION & FACULTY DETAILS */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <School size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Institution &amp; Programme
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {/* 10. INSTITUTION */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Institution / School *
                  </label>
                  <select
                    value={school}
                    aria-label="Institution or school"
                    onChange={(e) => setSchool(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  >
                    {commonInstitutions.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst}
                      </option>
                    ))}
                  </select>
                  {school.includes('Other') && (
                    <input
                      type="text"
                      value={customSchool}
                      aria-label="Custom institution name"
                      onChange={(e) => setCustomSchool(e.target.value)}
                      placeholder="Enter your institution name"
                      required
                      style={{
                        width: '100%',
                        marginTop: '8px',
                        padding: '9px 12px',
                        fontSize: '13px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                      }}
                    />
                  )}
                </div>

                {/* 11. COURSE / PROGRAMME */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Course / Programme *
                  </label>
                  <input
                    type="text"
                    value={courseProgramme}
                    aria-label="Course or programme"
                    onChange={(e) => setCourseProgramme(e.target.value)}
                    placeholder="e.g. Computer Science / Medicine"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 12. DEPARTMENT */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Department *
                  </label>
                  <input
                    type="text"
                    value={department}
                    aria-label="Department"
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science / Biochemistry"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 13. FACULTY */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Faculty *
                  </label>
                  <select
                    value={faculty}
                    aria-label="Faculty"
                    onChange={(e) => setFaculty(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  >
                    {faculties.map((fac) => (
                      <option key={fac} value={fac}>
                        {fac}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* 14-16. LEVEL & ACADEMIC YEARS */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <GraduationCap size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Level &amp; Academic Timeline
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* 14. CURRENT LEVEL */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Current Level *
                  </label>
                  <select
                    value={level}
                    aria-label="Current level"
                    onChange={(e) => setLevel(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  >
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 15. ADMISSION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Admission Year *
                  </label>
                  <input
                    type="number"
                    min="2015"
                    max="2030"
                    value={admissionYear}
                    aria-label="Admission year"
                    onChange={(e) => setAdmissionYear(e.target.value)}
                    placeholder="e.g. 2024"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                </div>

                {/* 16. EXPECTED GRADUATION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Expected Graduation Year *
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2035"
                    value={expectedGradYear}
                    aria-label="Expected graduation year"
                    onChange={(e) => setExpectedGradYear(e.target.value)}
                    placeholder="e.g. 2028"
                    required
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>
            </section>

            {/* 17. ACADEMIC INTERESTS (OPTIONAL) */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Academic Interests <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>(Optional)</span>
                </h2>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 12px' }}>
                Select topics you wish to receive priority alerts and study material recommendations for.
              </p>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {academicInterestOptions.map((opt) => {
                  const selected = interests.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleInterest(opt)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '999px',
                        fontSize: '12px',
                        fontWeight: 700,
                        border: '1px solid',
                        borderColor: selected ? '#C85841' : '#cbd5e1',
                        background: selected ? '#F9F0EE' : '#ffffff',
                        color: selected ? '#C85841' : '#475569',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {selected && <Check size={13} />}
                      {opt}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 18. NOTIFICATION PREFERENCES */}
            <section style={{ marginBottom: '26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Bell size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Notification Preferences
                </h2>
              </div>

              <div style={{ display: 'grid', gap: '10px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: '#FAF8FF',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#C85841' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="#C85841" /> Email Notifications
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Receive official examination alerts, result check notifications, and scholarship updates.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: '#FAF8FF',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={whatsappAlerts}
                    onChange={(e) => setWhatsappAlerts(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#C85841' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={14} color="#C85841" /> WhatsApp Order &amp; Request Alerts
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      WhatsApp updates when your service request or result verification is ready.
                    </span>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    background: '#FAF8FF',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={smsAlerts}
                    onChange={(e) => setSmsAlerts(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#C85841' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Smartphone size={14} color="#C85841" /> SMS Urgent Deadline Reminders
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                      Receive high-priority SMS reminders for closing dates (e.g. JAMB registration &amp; Post-UTME).
                    </span>
                  </div>
                </label>
              </div>
            </section>

            {message && <div className="hub-form-error" style={{ marginBottom: '16px' }}>{message}</div>}

            {/* ACTION BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <a
                href="/dashboard"
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#64748b',
                  textDecoration: 'none',
                }}
              >
                Skip for now →
              </a>

              <button
                type="submit"
                disabled={saving || savedSuccess}
                style={{
                  background: '#C85841',
                  color: '#ffffff',
                  border: 0,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(200, 88, 65, 0.25)',
                }}
              >
                {saving ? 'Saving Profile…' : 'Save & Open Dashboard'} <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </HubLayout>
  );
}
