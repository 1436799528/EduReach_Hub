import { useState, useEffect, type FormEvent } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  GraduationCap,
  Pencil,
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
import {
  academicSessions,
  academicYears,
  commonInstitutions,
  courseProgrammes,
  departments,
  faculties,
  levels,
} from '../src/data/studentOptions';
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
  const [phone, setPhone] = useState('');

  // 9. Profile photo (optional)
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');
  const [avatarImageUrl, setAvatarImageUrl] = useState('');

  // 10-17. Academic details. Empty defaults keep an incomplete profile visibly incomplete.
  const [school, setSchool] = useState('');
  const [customSchool, setCustomSchool] = useState('');
  const [courseProgramme, setCourseProgramme] = useState('');
  const [customCourseProgramme, setCustomCourseProgramme] = useState('');
  const [courseOtherSelected, setCourseOtherSelected] = useState(false);
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');
  const [departmentOtherSelected, setDepartmentOtherSelected] = useState(false);
  const [faculty, setFaculty] = useState('');
  const [level, setLevel] = useState('');
  const [session, setSession] = useState('');
  const [admissionYear, setAdmissionYear] = useState('');
  const [expectedGradYear, setExpectedGradYear] = useState('');
  const [avatarFileName, setAvatarFileName] = useState('');

  // 17. Academic interests (optional)
  const [interests, setInterests] = useState<string[]>(['JAMB UTME Prep', 'Undergraduate Scholarships']);

  // 18. Notification preferences
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Local initials avatar: no external images. Legacy unsplash presets are ignored.
  const rawAvatar = (customAvatar || avatarImageUrl || avatarUrl || '').trim();
  const displayAvatar = rawAvatar.includes('unsplash.com') ? '' : rawAvatar;
  const avatarInitials =
    userName.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'ER';
  const avatarTones = ['#C85841', '#0F172A', '#B45309', '#0E7490'];
  const avatarTone =
    avatarTones[[...userName].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % avatarTones.length];
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const editMode = new URLSearchParams(window.location.search).get('edit') === '1';
  const profileMissingLabels = [
    ['Institution', school.includes('Other') ? customSchool : school],
    ['Course / programme', courseProgramme || customCourseProgramme],
    ['Department', department || customDepartment],
    ['Faculty', faculty],
    ['Current level', level],
    ['Academic session', session],
    ['Admission year', admissionYear],
    ['Expected graduation year', expectedGradYear],
  ].filter(([, value]) => !String(value).trim()).map(([label]) => label);

  useEffect(() => {
    const applyStoredProfile = () => {
      try {
        const stored = JSON.parse(readLocalPreviewValue('profile') || 'null');
        if (!stored) return;
        if (stored.profile_completed) setProfileCompleted(true);
        if (stored.full_name) setUserName(stored.full_name);
        if (stored.email) setUserEmail(stored.email);
        if (stored.phone) setPhone(stored.phone);
        if (stored.school) {
          if (commonInstitutions.includes(stored.school)) setSchool(stored.school);
          else {
            setSchool('Other Nigerian University / Polytechnic');
            setCustomSchool(stored.school);
          }
        }
        if (stored.course_programme) {
          if (courseProgrammes.some((option) => option === stored.course_programme && option !== 'Other programme')) setCourseProgramme(stored.course_programme);
          else {
            setCourseOtherSelected(true);
            setCustomCourseProgramme(stored.course_programme);
          }
        }
        if (stored.department) {
          if (departments.some((option) => option === stored.department && option !== 'Other department')) setDepartment(stored.department);
          else {
            setDepartmentOtherSelected(true);
            setCustomDepartment(stored.department);
          }
        }
        if (stored.faculty) setFaculty(stored.faculty);
        if (stored.level) setLevel(stored.level);
        if (stored.session) setSession(stored.session);
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
        if (meta.phone) setPhone(meta.phone);
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
              setProfileCompleted(Boolean(profile.profile_completed));
              if (profile.full_name) setUserName(profile.full_name);
              if (profile.phone) setPhone(profile.phone);
              if (profile.school) {
                if (commonInstitutions.includes(profile.school)) setSchool(profile.school);
                else {
                  setSchool('Other Nigerian University / Polytechnic');
                  setCustomSchool(profile.school);
                }
              }
              if (profile.course_programme) {
                if (courseProgrammes.some((option) => option === profile.course_programme && option !== 'Other programme')) setCourseProgramme(profile.course_programme);
                else {
                  setCourseOtherSelected(true);
                  setCustomCourseProgramme(profile.course_programme);
                }
              }
              if (profile.department) {
                if (departments.some((option) => option === profile.department && option !== 'Other department')) setDepartment(profile.department);
                else {
                  setDepartmentOtherSelected(true);
                  setCustomDepartment(profile.department);
                }
              }
              if (profile.faculty) setFaculty(profile.faculty);
              if (profile.level) setLevel(profile.level);
              if (profile.session) setSession(profile.session);
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
          })
          .then(() => setProfileLoading(false), () => setProfileLoading(false));
      } else {
        applyStoredProfile();
        setProfileLoading(false);
      }
    }).catch(() => setProfileLoading(false));
  }, [user]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Choose an image file for your profile photo.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Profile photos must be 2 MB or smaller.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomAvatar(typeof reader.result === 'string' ? reader.result : '');
      setAvatarImageUrl('');
      setAvatarFileName(file.name);
      setMessage('');
    };
    reader.readAsDataURL(file);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const finalSchool = school.includes('Other') ? customSchool.trim() : school;
    const finalCourseProgramme = courseProgramme || customCourseProgramme.trim();
    const finalDepartment = department || customDepartment.trim();
    const finalAvatar = customAvatar || avatarImageUrl || avatarUrl;
    const missing = [
      ['institution', finalSchool],
      ['course/programme', finalCourseProgramme],
      ['department', finalDepartment],
      ['faculty', faculty],
      ['current level', level],
      ['academic session', session],
      ['admission year', admissionYear],
      ['expected graduation year', expectedGradYear],
    ].filter(([, value]) => !String(value).trim()).map(([label]) => label);
    if (missing.length) {
      setSaving(false);
      setMessage(`Complete the required profile details: ${missing.join(', ')}.`);
      return;
    }
    if (Number(expectedGradYear) < Number(admissionYear)) {
      setSaving(false);
      setMessage('Expected graduation year should not be earlier than the admission year.');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setSaving(false);
      setMessage('Enter a valid Nigerian phone number or leave the phone field blank.');
      return;
    }

    const payload = {
      full_name: userName.trim() || 'Student',
      phone: phone.trim() || null,
      school: finalSchool,
      course_programme: finalCourseProgramme,
      department: finalDepartment,
      faculty: faculty.trim(),
      level,
      session,
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
        const { error } = await supabase.from('profiles').upsert({ id: userId, ...payload }, { onConflict: 'id' });
        if (error) throw error;
      } catch (err) {
        setSaving(false);
        setMessage(err instanceof Error ? `Profile was not saved: ${err.message}` : 'Profile was not saved. Please try again.');
        return;
      }
    }

    setSaving(false);
    setProfileCompleted(true);
    setSavedSuccess(true);
    window.setTimeout(() => {
      setSavedSuccess(false);
      window.history.pushState({}, '', '/profile');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 1200);
  };

  if (profileLoading) {
    return (
      <HubLayout>
        <div className="hub-page" style={{ padding: '32px 0 60px' }}>
          <div className="hub-container" style={{ maxWidth: '780px' }}>
            <div className="hub-panel" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading your saved profile…</div>
          </div>
        </div>
      </HubLayout>
    );
  }

  if (profileCompleted && !editMode && !savedSuccess) {
    const savedSchool = school.includes('Other') ? customSchool : school;
    const savedCourse = courseProgramme || customCourseProgramme;
    const savedDepartment = department || customDepartment;
    const savedRows = [
      ['Name', userName],
      ['Email', userEmail],
      ['Phone', phone || 'Not added yet'],
      ['Institution', savedSchool],
      ['Level', level],
      ['Course / programme', savedCourse],
      ['Department', savedDepartment],
      ['Faculty', faculty],
      ['Academic session', session],
      ['Admission year', admissionYear],
      ['Expected graduation year', expectedGradYear],
    ];
    return (
      <HubLayout>
        <div className="hub-page" style={{ padding: '24px 0 60px' }}>
          <div className="hub-container" style={{ maxWidth: '780px' }}>
            <div className="profile-summary-page-head">
              <div><span className="hub-eyebrow">Account</span><h1>My Profile</h1><p>Your saved student information is shown below.</p></div>
              <a className="hub-primary-btn" href="/profile?edit=1"><Pencil size={15} /> Edit Profile</a>
            </div>
            <section className="profile-summary-card">
              <div className="profile-summary-identity">
                <div className="profile-summary-avatar" style={{ background: avatarTone }}>{displayAvatar ? <img src={displayAvatar} alt="" /> : avatarInitials}</div>
                <div><h2>{userName || 'Student'}</h2><p>{userEmail || 'Your account email'}</p></div>
              </div>
              <div className="profile-summary-grid">
                {savedRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || 'Not added yet'}</strong></div>)}
              </div>
            </section>
            <p className="profile-summary-note">Need to change your information? Select Edit Profile. Your updates will be used for your dashboard and service requests.</p>
          </div>
        </div>
      </HubLayout>
    );
  }

  return (
    <HubLayout>
      <div className="hub-page" style={{ padding: '24px 0 60px' }}>
        <div className="hub-container" style={{ maxWidth: '780px' }}>
          <div style={{ marginBottom: '14px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
            <h1 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Academic Profile &amp; Preferences
            </h1>
          </div>

          {!savedSuccess && profileMissingLabels.length > 0 && (
            <div
              role="status"
              style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#9a3412',
                padding: '13px 15px',
                borderRadius: '10px',
                marginBottom: '16px',
                fontSize: '12.5px',
                lineHeight: 1.5,
              }}
            >
              <strong>Complete your profile to personalise your dashboard.</strong>{' '}
              Missing: {profileMissingLabels.join(', ')}.
            </div>
          )}

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
            <section className="profile-contact-section">
              <div className="profile-contact-heading"><Smartphone size={17} color="#C85841" /><h2>Account contact</h2></div>
              <p>Keep a phone number on your account so EduReach can attach service updates to the right student.</p>
              <label className="hub-form-label">Phone number <span>(Optional)</span><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="080 1234 5678" autoComplete="tel" /></label>
              <div className="profile-contact-email"><Mail size={14} /> <span>Email: <strong>{userEmail || 'Your account email'}</strong></span></div>
            </section>

            {/* 9. PROFILE PHOTO (OPTIONAL) */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Camera size={18} color="#C85841" />
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Profile Photo <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748b' }}>(Optional)</span>
                </h2>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 14px' }}>
                Choose a photo from your device, or use a trusted image URL. The photo is saved with your profile; initials remain the fallback.
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
                    setAvatarImageUrl('');
                    setAvatarFileName('');
                  }}
                  className="hub-outline-btn"
                  style={{ fontSize: '12px', padding: '8px 14px' }}
                >
                  Use my initials instead
                </button>

                {/* LOCAL PHOTO + OPTIONAL IMAGE URL */}
                <div style={{ flex: '1 1 260px', display: 'grid', gap: '8px' }}>
                  <label
                    className="hub-outline-btn"
                    style={{ fontSize: '12px', padding: '8px 14px', cursor: 'pointer', width: 'fit-content' }}
                  >
                    <Camera size={14} /> Choose photo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      aria-label="Choose profile photo"
                      onChange={(event) => handleAvatarFile(event.target.files?.[0])}
                      style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                    />
                  </label>
                  {avatarFileName && <span style={{ fontSize: '11px', color: '#475569' }}>{avatarFileName}</span>}
                  <input
                    type="url"
                    value={avatarImageUrl}
                    aria-label="Profile image URL"
                    onChange={(e) => {
                      setAvatarImageUrl(e.target.value);
                      setCustomAvatar('');
                      setAvatarFileName('');
                    }}
                    placeholder="Or paste image URL (https://…)"
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
                    <option value="">Choose an institution</option>
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
                  <select
                    value={courseOtherSelected ? 'Other programme' : courseProgramme}
                    aria-label="Course or programme"
                    onChange={(e) => {
                      const isOther = e.target.value === 'Other programme';
                      setCourseOtherSelected(isOther);
                      setCourseProgramme(isOther ? '' : e.target.value);
                      if (!isOther) setCustomCourseProgramme('');
                    }}
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
                    <option value="">Choose a course or programme</option>
                    {courseProgrammes.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  {courseOtherSelected && (
                    <input
                      type="text"
                      value={customCourseProgramme}
                      aria-label="Other course or programme"
                      onChange={(e) => setCustomCourseProgramme(e.target.value)}
                      placeholder="Enter your course or programme"
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

                {/* 12. DEPARTMENT */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Department *
                  </label>
                  <select
                    value={departmentOtherSelected ? 'Other department' : department}
                    aria-label="Department"
                    onChange={(e) => {
                      const isOther = e.target.value === 'Other department';
                      setDepartmentOtherSelected(isOther);
                      setDepartment(isOther ? '' : e.target.value);
                      if (!isOther) setCustomDepartment('');
                    }}
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
                    <option value="">Choose a department</option>
                    {departments.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  {departmentOtherSelected && (
                    <input
                      type="text"
                      value={customDepartment}
                      aria-label="Other department"
                      onChange={(e) => setCustomDepartment(e.target.value)}
                      placeholder="Enter your department"
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
                    <option value="">Choose a faculty</option>
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
                    <option value="">Choose current level</option>
                    {levels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 15. ACADEMIC SESSION */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Academic Session *
                  </label>
                  <select
                    value={session}
                    aria-label="Academic session"
                    onChange={(e) => setSession(e.target.value)}
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
                    <option value="">Choose academic session</option>
                    {academicSessions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>

                {/* 16. ADMISSION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Admission Year *
                  </label>
                  <select
                    value={admissionYear}
                    aria-label="Admission year"
                    onChange={(e) => setAdmissionYear(e.target.value)}
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
                    <option value="">Choose admission year</option>
                    {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                </div>

                {/* 16. EXPECTED GRADUATION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                    Expected Graduation Year *
                  </label>
                  <select
                    value={expectedGradYear}
                    aria-label="Expected graduation year"
                    onChange={(e) => setExpectedGradYear(e.target.value)}
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
                    <option value="">Choose graduation year</option>
                    {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
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
