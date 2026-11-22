import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
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
  ShieldCheck,
  Settings,
  UserRound,
  Globe,
  Copy,
  ExternalLink,
} from 'lucide-react';
import HubLayout from '../src/components/HubLayout';
import VerifiedBadge from '../src/components/VerifiedBadge';
import { rolePresentation } from '../src/lib/rolePresentation';
import WaveLoader from '../src/components/WaveLoader';
import { useToast } from '../src/components/ui/Toast';
import { isSupabaseConfigured, supabase } from '../src/lib/supabase';
import { localStorageKey, readLocalPreviewValue } from '../src/lib/localPreview';
import { useAuth } from '../src/lib/auth';
import { navigateInApp } from '../src/lib/navigation';
import { saveStudentProfile, type ProfileWriteClient, type StudentProfilePayload } from '../src/lib/profileSave';
import { generatePublicProfileSlug } from '../src/lib/publicProfile';
import { fetchInstitutionDirectory } from '../src/lib/institutions/repository';
import {
  institutionIdWrite,
  matchProfileInstitution,
  readInstitutionSelection,
  rememberInstitutionSelection,
} from '../src/lib/institutions/profileInstitution';
import type { InstitutionSummary } from '../src/lib/institutions/types';
import { publicProfileUrl } from '../src/lib/publicProfileClient';
import {
  academicSessions,
  academicYears,
  commonInstitutions,
  courseProgrammes,
  departments,
  faculties,
  levels,
  normalizeFacultyValue,
  normalizeLevelValue,
  optionsIncludingSaved,
} from '../src/data/studentOptions';
import FormFieldError from '../src/components/FormFieldError';
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

/**
 * The profile is one page. It renders inside the public shell at `/profile`
 * (where onboarding sends a new student) and inside the authenticated dashboard
 * at `/dashboard/profile`, with `embedded` suppressing the site header and the
 * page padding. Both mounts share every field, save path and panel below, so
 * the student cannot end up with two different profiles to maintain.
 */
function ProfileShell({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (embedded) return <div className="profile-embedded">{children}</div>;
  return <HubLayout>{children}</HubLayout>;
}

export default function ProfileCompletionPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const { push: pushToast } = useToast();
  const [emailVerified, setEmailVerified] = useState(false);
  const [savedSignature, setSavedSignature] = useState('');
  const [publicProfile, setPublicProfile] = useState(false);
  const [publicSlug, setPublicSlug] = useState('');
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [visibilityError, setVisibilityError] = useState('');
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [phone, setPhone] = useState('');

  // 9. Profile photo (optional)
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatar, setCustomAvatar] = useState('');

  // 10-17. Academic details. Empty defaults keep an incomplete profile visibly incomplete.
  const [school, setSchool] = useState('');
  // The canonical `institutions.id` behind the student's choice. Retained so
  // that once the intelligence data lands the choice resolves to one stable
  // institution row instead of a string comparison. The free-text `school`
  // column remains what is saved, and is never overwritten by this.
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<InstitutionSummary[]>([]);
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
  const [avatarUploading, setAvatarUploading] = useState(false);

  // 17. Academic interests (optional)
  const [interests, setInterests] = useState<string[]>(['JAMB UTME Prep', 'Undergraduate Scholarships']);

  // 18. Notification preferences
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Initials are the fallback. A legacy base64 data URL is not rendered or
  // re-saved: profile photos live in Supabase Storage and only their public URL
  // is stored in `profiles.avatar_url`.
  const rawAvatar = (customAvatar || avatarUrl || '').trim();
  const displayAvatar = rawAvatar.startsWith('data:') || rawAvatar.includes('unsplash.com') ? '' : rawAvatar;
  const avatarInitials =
    userName.trim().split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'ER';
  // Initials sit on the action blue, matching the dashboard avatar. A
  // hash-picked crimson/amber/navy avatar read as a status colour.
  const avatarTone = '#1E40AF';
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [accountRole, setAccountRole] = useState('student');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const editMode = new URLSearchParams(window.location.search).get('edit') === '1';
  // The same page is mounted inside the dashboard's Profile tab, so every
  // internal link stays in whichever shell the student is already in.
  const profileBase = embedded ? '/dashboard/profile' : '/profile';

  /**
   * The live institution directory.
   *
   * Loaded once, read-only. A student who picks from it keeps a canonical id
   * alongside the free-text `school` value they have always had.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    void fetchInstitutionDirectory()
      .then((rows) => {
        if (!active) return;
        setDirectory(rows);
      })
      .catch(() => {
        // A failed directory read must not block the form: the maintained
        // starter list stays available and nothing is invented in its place.
        if (active) setDirectory([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const knownSchoolNames = useMemo(
    () => new Set([...commonInstitutions, ...directory.map((institution) => institution.name)]),
    [directory],
  );

  /**
   * Record the canonical institution behind a school name.
   *
   * Never rewrites `school`. A name that is not in the directory keeps its
   * free-text value and simply has no canonical id.
   */
  const retainInstitutionFor = (schoolName: string) => {
    if (!userId) return;
    const matched = matchProfileInstitution(directory, schoolName);
    if (!matched) return;
    setInstitutionId(matched.institutionId);
    rememberInstitutionSelection(userId, matched);
  };

  useEffect(() => {
    if (!userId || !directory.length) return;
    const remembered = readInstitutionSelection(userId);
    if (remembered) setInstitutionId((current) => current ?? remembered.institutionId);
  }, [userId, directory.length]);

  // A school name that arrives from a saved profile is matched against the
  // directory once it is available, so an existing choice gains a canonical id
  // without the value the student typed being touched.
  useEffect(() => {
    if (!userId || !directory.length || institutionId) return;
    if (!school || school.includes('Other')) return;
    retainInstitutionFor(school);
  }, [userId, directory.length, school, institutionId]);
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
          if (knownSchoolNames.has(stored.school)) setSchool(stored.school);
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
        if (stored.faculty) setFaculty(normalizeFacultyValue(stored.faculty));
        if (stored.level) setLevel(normalizeLevelValue(stored.level));
        if (stored.session) setSession(stored.session);
        if (stored.admission_year) setAdmissionYear(String(stored.admission_year));
        if (stored.expected_graduation_year) setExpectedGradYear(String(stored.expected_graduation_year));
        if (stored.avatar_url) setAvatarUrl(stored.avatar_url);
        if (stored.public_profile) setPublicProfile(true);
        if (stored.public_profile_slug) setPublicSlug(String(stored.public_profile_slug));
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
        setEmailVerified(Boolean(data.user.email_confirmed_at));
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
              if (profile.role) setAccountRole(String(profile.role));
              if (profile.full_name) setUserName(profile.full_name);
              if (profile.phone) setPhone(profile.phone);
              if (profile.school) {
                if (knownSchoolNames.has(profile.school)) setSchool(profile.school);
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
              if (profile.faculty) setFaculty(normalizeFacultyValue(profile.faculty));
              if (profile.level) setLevel(normalizeLevelValue(profile.level));
              if (profile.session) setSession(profile.session);
              if (profile.admission_year) setAdmissionYear(String(profile.admission_year));
              if (profile.expected_graduation_year) setExpectedGradYear(String(profile.expected_graduation_year));
              if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
              if (profile.public_profile) setPublicProfile(true);
              if (profile.public_profile_slug) setPublicSlug(String(profile.public_profile_slug));
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

  async function compressAvatarImage(file: File, maxDimension = 512, targetBytes = 200 * 1024): Promise<{ blob: Blob; extension: string; mimeType: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to parse image content'));
        img.onload = () => {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas 2D rendering context unavailable'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Try WebP first, fallback to JPEG
          const tryWebP = (quality = 0.85) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  if (blob.size <= targetBytes || quality <= 0.5) {
                    resolve({ blob, extension: 'webp', mimeType: 'image/webp' });
                  } else {
                    tryWebP(quality - 0.15);
                  }
                } else {
                  tryJpeg(0.85);
                }
              },
              'image/webp',
              quality
            );
          };

          const tryJpeg = (quality = 0.85) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  if (blob.size <= targetBytes || quality <= 0.5) {
                    resolve({ blob, extension: 'jpg', mimeType: 'image/jpeg' });
                  } else {
                    tryJpeg(quality - 0.15);
                  }
                } else {
                  reject(new Error('Image encoding failed'));
                }
              },
              'image/jpeg',
              quality
            );
          };

          tryWebP(0.85);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleAvatarFile(file: File | undefined) {
    if (!file) return;
    const isImage = file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
    if (!isImage) {
      setMessage('Choose an image file (JPG, PNG, WebP, GIF, or HEIC) for your profile photo.');
      return;
    }
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB configurable source limit
    if (file.size > MAX_BYTES) {
      setMessage('Profile photos must be 10 MB or smaller.');
      return;
    }
    if (!isSupabaseConfigured || user?.isLocal || !userId) {
      setMessage('Photo upload needs your signed-in EduReach account. Your initials are used on this device instead.');
      return;
    }

    setAvatarUploading(true);
    setMessage('');
    try {
      // Compress and resize client-side before uploading
      let uploadPayload: Blob = file;
      let extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
      let contentType = file.type || 'image/jpeg';

      try {
        const compressed = await compressAvatarImage(file);
        uploadPayload = compressed.blob;
        extension = compressed.extension;
        contentType = compressed.mimeType;
      } catch {
        // Fall back to original file if canvas compression fails in browser environment
      }

      // Cleanup prior uploaded custom avatar if it belongs to this user in the avatars bucket
      if (customAvatar && customAvatar.includes('/avatars/') && customAvatar.includes(`/${userId}/`)) {
        try {
          const oldPathMatch = customAvatar.split('/avatars/')[1];
          if (oldPathMatch) {
            const oldPath = decodeURIComponent(oldPathMatch.split('?')[0]);
            if (oldPath.startsWith(`${userId}/`)) {
              void supabase.storage.from('avatars').remove([oldPath]).catch(() => {});
            }
          }
        } catch {
          // Non-blocking cleanup
        }
      }

      const path = `${userId}/avatar-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('avatars').upload(path, uploadPayload, {
        cacheControl: '3600',
        contentType,
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('No public URL returned');
      setCustomAvatar(data.publicUrl);
      setAvatarFileName(file.name);
    } catch {
      setMessage('We could not upload that photo. Choose a smaller JPEG, PNG, or WebP, or keep your initials for now.');
    } finally {
      setAvatarUploading(false);
    }
  }

  // UI-5: identity fields use explicit Save/Cancel, so the form has to be able
  // to say whether anything is unsaved. The signature is one string, which is
  // more reliable than one boolean per field drifting out of sync.
  const formSignature = JSON.stringify({
    userName,
    phone,
    school,
    customSchool,
    courseProgramme,
    customCourseProgramme,
    courseOtherSelected,
    department,
    customDepartment,
    departmentOtherSelected,
    faculty,
    level,
    session,
    admissionYear,
    expectedGradYear,
    avatarUrl,
    customAvatar,
    interests,
    emailAlerts,
    whatsappAlerts,
    smsAlerts,
  });
  const isDirty = formSignature !== savedSignature && !savedSuccess;

  // The snapshot is taken only after the saved profile has been applied, so an
  // untouched form never claims unsaved changes on first paint.
  useEffect(() => {
    if (!profileLoading) setSavedSignature(formSignature);
    // `formSignature` intentionally is not a dependency: the snapshot is the
    // state the form *loaded*, not every subsequent keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading]);

  function persistProfileLocally(payload: StudentProfilePayload) {
    // A cache, not the source of truth. It keeps the no-Supabase preview and a
    // flaky connection readable, but it is written only after the server has
    // accepted the change (or when there is no server to accept it).
    try {
      localStorage.setItem(localStorageKey('profile-completed'), 'true');
      // The public-link setting is written immediately and is not part of the
      // identity payload, so a later Save must not erase it from the cache.
      let stored: Record<string, unknown> = {};
      try {
        stored = JSON.parse(readLocalPreviewValue('profile') || '{}');
      } catch {
        stored = {};
      }
      localStorage.setItem(
        localStorageKey('profile'),
        JSON.stringify({
          ...stored,
          ...payload,
          full_name: userName,
          email: userEmail,
          public_profile: publicProfile,
          public_profile_slug: publicSlug || stored.public_profile_slug || null,
        })
      );
    } catch {
      // Storage can be unavailable; the account update already succeeded.
    }
  }

  /**
   * UI-5: public visibility is a low-risk, reversible setting, not an identity
   * field, so it applies immediately with its own feedback instead of waiting
   * for Save changes. The write touches exactly the two columns the migration
   * grants; everything else about the profile is unchanged.
   */
  const updateVisibility = async (enabled: boolean) => {
    if (visibilityBusy) return;
    setVisibilityBusy(true);
    setVisibilityError('');
    const slug = publicSlug || generatePublicProfileSlug(userName || userEmail || 'student');

    if (!isSupabaseConfigured || user?.isLocal) {
      try {
        const stored = JSON.parse(readLocalPreviewValue('profile') || '{}');
        localStorage.setItem(
          localStorageKey('profile'),
          JSON.stringify({ ...stored, public_profile: enabled, public_profile_slug: slug, full_name: userName, email: userEmail })
        );
      } catch {
        // The preview cache is best effort; the state below is still explicit.
      }
      setPublicProfile(enabled);
      setPublicSlug(slug);
      setVisibilityBusy(false);
      pushToast({
        tone: enabled ? 'success' : 'info',
        title: enabled ? 'Public link ready' : 'Public link turned off',
        detail: enabled ? 'Only your academic details are shown on the link.' : 'Your profile is private again.',
      });
      return;
    }

    let activeUserId = userId;
    if (!activeUserId) {
      try {
        const { data } = await supabase.auth.getUser();
        activeUserId = data.user?.id || '';
      } catch {
        activeUserId = '';
      }
    }
    if (!activeUserId) {
      setVisibilityError('Sign in again to change this setting.');
      setVisibilityBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({ public_profile: enabled, public_profile_slug: slug })
      .eq('id', activeUserId)
      .select('id')
      .maybeSingle();

    if (error) {
      setVisibilityError('Your public profile could not be updated. This setting may not be available in this environment yet.');
      setVisibilityBusy(false);
      return;
    }
    if (!data) {
      setVisibilityError('Your profile has not been created yet. Save your details first, then try again.');
      setVisibilityBusy(false);
      return;
    }

    setPublicProfile(enabled);
    setPublicSlug(slug);
    setVisibilityBusy(false);
    pushToast({
      tone: enabled ? 'success' : 'info',
      title: enabled ? 'Public link ready' : 'Public link turned off',
      detail: enabled ? 'Only your academic details are shown on the link.' : 'Your profile is private again.',
    });
  };

  const copyPublicLink = async () => {
    if (!publicSlug) return;
    try {
      await navigator.clipboard.writeText(publicProfileUrl(publicSlug));
      pushToast({ tone: 'success', title: 'Link copied', detail: 'Paste it wherever you want to share your profile.' });
    } catch {
      pushToast({ tone: 'warning', title: 'Copy unavailable', detail: 'Select the link and copy it manually.' });
    }
  };

  const confirmDiscard = (event: { preventDefault: () => void }) => {
    if (!isDirty) return;
    if (!window.confirm('Discard your unsaved profile changes?')) event.preventDefault();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('');
    setFieldErrors({});

    const finalSchool = school.includes('Other') ? customSchool.trim() : school;
    const finalCourseProgramme = courseProgramme || customCourseProgramme.trim();
    const finalDepartment = department || customDepartment.trim();
    // UX-3: only a Storage public URL is saved. A legacy data: URL is ignored;
    // the avatar is never a base64 blob inside the profile row.
    const finalAvatar = [customAvatar, avatarUrl].find((value) => value && !value.startsWith('data:')) || '';
    
    const errors: Record<string, string> = {};
    if (!finalSchool) errors.school = 'Please choose or enter your institution.';
    if (!finalCourseProgramme) errors.courseProgramme = 'Please choose or enter your course/programme.';
    if (!finalDepartment) errors.department = 'Please choose or enter your department.';
    if (!faculty.trim()) errors.faculty = 'Please choose or enter your faculty.';
    if (!level) errors.level = 'Please select your current level.';
    if (!session) errors.session = 'Please select your academic session.';
    if (!admissionYear) errors.admissionYear = 'Please choose your admission year.';
    if (!expectedGradYear) errors.expectedGradYear = 'Please choose your expected graduation year.';

    if (Object.keys(errors).length > 0) {
      setSaving(false);
      setFieldErrors(errors);
      setMessage('Complete all required profile details highlighted below.');
      return;
    }
    if (Number(expectedGradYear) < Number(admissionYear)) {
      setSaving(false);
      setFieldErrors({ expectedGradYear: 'Expected graduation year should not be earlier than admission year.' });
      setMessage('Expected graduation year should not be earlier than the admission year.');
      return;
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
      setSaving(false);
      setFieldErrors({ phone: 'Enter a valid Nigerian phone number or leave blank.' });
      setMessage('Enter a valid Nigerian phone number or leave the phone field blank.');
      return;
    }

    const payload: StudentProfilePayload = {
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
      // The canonical institution id travels with the save only once
      // `profiles.institution_id` is deployed. Until then this spreads an
      // empty object, so the write stays valid SQL and the free-text `school`
      // column keeps carrying the value.
      ...institutionIdWrite(
        institutionId
          ? { institutionId, institutionName: finalSchool, source: 'directory', selectedAt: new Date().toISOString() }
          : readInstitutionSelection(userId),
      ),
    };

    const finish = (detail: string) => {
      persistProfileLocally(payload);
      setSavedSignature(formSignature);
      setProfileCompleted(true);
      setSavedSuccess(true);
      setSaving(false);
      pushToast({ tone: 'success', title: 'Profile saved successfully', detail });
      window.setTimeout(() => {
        setSavedSuccess(false);
        navigateInApp(embedded ? profileBase : editMode ? '/profile' : '/dashboard');
      }, 1400);
    };

    if (!isSupabaseConfigured || user?.isLocal) {
      finish('Your profile is saved on this device.');
      return;
    }

    // Resolve the account id at save time. Reporting success with an empty id
    // was how a signed-in save could look fine while writing only localStorage.
    let activeUserId = userId;
    if (!activeUserId) {
      try {
        const { data } = await supabase.auth.getUser();
        activeUserId = data.user?.id || '';
      } catch {
        activeUserId = '';
      }
    }
    if (!activeUserId) {
      setSaving(false);
      const detail = 'We could not confirm your account session. Sign in again, then retry the save.';
      setMessage(detail);
      pushToast({ tone: 'danger', title: 'Profile not saved', detail });
      return;
    }

    const result = await saveStudentProfile(supabase as unknown as ProfileWriteClient, activeUserId, payload);
    if (!result.ok) {
      setSaving(false);
      // Never surface a database or PostgREST message to a student. The field
      // level detail is already in the form; this is the sentence they act on.
      const detail = 'Couldn’t save your profile. Try again.';
      setMessage(detail);
      pushToast({ tone: 'danger', title: 'Profile not saved', detail: 'Your changes are still on this page.' });
      // Never leave a stale success state claiming the write happened.
      setSavedSuccess(false);
      return;
    }

    finish(editMode ? 'Your profile changes are now on your account.' : 'Profile completed. Opening your dashboard…');
  };

  if (profileLoading) {
    return (
      <ProfileShell embedded={embedded}>
        <div className="hub-page profile-page">
          <div className="hub-container profile-shell" aria-busy="true" aria-label="Loading your profile">
            <div className="profile-identity-card">
              <div className="profile-identity-main">
                <div className="profile-avatar er-skel" style={{ background: '#e8edf2' }} aria-hidden="true" />
                <div className="profile-identity-copy" style={{ minWidth: 220 }}>
                  <div className="er-skel" style={{ width: 180, height: 24, borderRadius: 6 }} aria-hidden="true" />
                  <div className="er-skel" style={{ width: 250, height: 14, marginTop: 9, borderRadius: 5 }} aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="profile-panel-grid">
              {[0, 1].map((panel) => (
                <div className="profile-panel" key={panel} aria-hidden="true">
                  <div className="er-skel" style={{ width: 130, height: 13, borderRadius: 5 }} />
                  {[0, 1, 2].map((row) => (
                    <div className="er-skel" key={row} style={{ height: 38, marginTop: 12, borderRadius: 7 }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </ProfileShell>
    );
  }

  if (profileCompleted && !editMode && !savedSuccess) {
    const savedSchool = school.includes('Other') ? customSchool : school;
    const savedCourse = courseProgramme || customCourseProgramme;
    const savedDepartment = department || customDepartment;
    // Honest completeness from fields already on this account. It is a count,
    // not a score: an empty field is simply not added yet.
    const completenessFields = [userName, userEmail, phone, savedSchool, savedCourse, savedDepartment, faculty, level];
    const completenessCount = completenessFields.filter((value) => Boolean(String(value || '').trim())).length;
    const personalFacts: Array<[string, string]> = [
      ['Full name', userName || 'Student'],
      ['Email address', userEmail || 'Not added yet'],
      ['Phone number', phone || 'Not added yet'],
    ];
    const academicFacts: Array<[string, string]> = [
      ['Institution', savedSchool],
      ['Course / programme', savedCourse],
      ['Department', savedDepartment],
      ['Faculty', faculty],
      ['Level', level],
      ['Academic session', session],
      ['Admission year', admissionYear],
      ['Expected graduation', expectedGradYear],
    ];
    const channels = [
      emailAlerts ? 'Email' : '',
      whatsappAlerts ? 'WhatsApp' : '',
      smsAlerts ? 'SMS' : '',
    ].filter(Boolean);

    // UI-5: a profile is identity first, then grouped facts. The old screen was
    // one card of labelled database fields; this one answers "who am I here?"
    // before listing the record, and keeps account actions separate from the
    // academic record they protect.
    return (
      <ProfileShell embedded={embedded}>
        <div className="hub-page profile-page">
          <div className="hub-container profile-shell">
            <header className="profile-identity-card">
              <div className="profile-identity-main">
                <div className="profile-avatar" style={{ background: avatarTone }}>
                  {displayAvatar
                    ? <img src={displayAvatar} alt="" decoding="async" />
                    : avatarInitials}
                </div>
                <div className="profile-identity-copy">
                  <div className="profile-identity-name">
                    <h1>{userName || 'Student'}</h1>
                    {emailVerified && <VerifiedBadge role={accountRole} />}
                  </div>
                  <p className="profile-identity-role">
                    {level ? `${level} ${rolePresentation(accountRole).label.toLowerCase()}` : rolePresentation(accountRole).label}
                    {savedSchool ? ` · ${savedSchool}` : ''}
                  </p>
                  {(savedCourse || savedDepartment) && (
                    <p className="profile-identity-programme">
                      {[savedCourse, savedDepartment].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="profile-identity-programme">
                    {completenessCount === completenessFields.length
                      ? `All ${completenessFields.length} profile details added`
                      : `${completenessCount} of ${completenessFields.length} profile details added`}
                    {completenessCount < completenessFields.length && ' · add the rest in Edit profile'}
                  </p>
                </div>
              </div>
              <div className="profile-identity-actions">
                <a className="hub-primary-btn" href={`${profileBase}?edit=1`}><Pencil size={15} /> Edit profile</a>
              </div>
            </header>

            <div className="profile-panel-grid">
              <section className="profile-panel" aria-labelledby="profile-personal">
                <div className="profile-panel-heading">
                  <UserRound size={17} aria-hidden="true" />
                  <h2 id="profile-personal">Personal information</h2>
                </div>
                <dl className="profile-facts">
                  {personalFacts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className={value && value !== 'Not added yet' ? undefined : 'is-empty'}>{value || 'Not added yet'}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="profile-panel" aria-labelledby="profile-academic">
                <div className="profile-panel-heading">
                  <GraduationCap size={17} aria-hidden="true" />
                  <h2 id="profile-academic">Academic information</h2>
                </div>
                <dl className="profile-facts profile-facts--two">
                  {academicFacts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd className={value ? undefined : 'is-empty'}>{value || 'Not added yet'}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="profile-panel" aria-labelledby="profile-account">
                <div className="profile-panel-heading">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <h2 id="profile-account">Account &amp; security</h2>
                </div>
                <dl className="profile-facts">
                  <div><dt>Account email</dt><dd>{userEmail || 'Not added yet'}</dd></div>
                  <div><dt>Password</dt><dd>Managed through your secure account settings</dd></div>
                  <div><dt>Account type</dt><dd>Student</dd></div>
                </dl>
                <div className="profile-panel-actions">
                  <a className="hub-outline-btn" href="/settings"><Settings size={14} /> Security &amp; password</a>
                </div>
              </section>

              <section className="profile-panel" aria-labelledby="profile-preferences">
                <div className="profile-panel-heading">
                  <Bell size={17} aria-hidden="true" />
                  <h2 id="profile-preferences">Preferences</h2>
                </div>
                <div className="profile-preference-group">
                  <span>Academic interests</span>
                  {interests.length ? (
                    <ul className="profile-tags">
                      {interests.map((interest) => <li key={interest}>{interest}</li>)}
                    </ul>
                  ) : <p className="profile-muted">No interests selected yet.</p>}
                </div>
                <div className="profile-preference-group">
                  <span>Notification channels</span>
                  <p className="profile-muted">{channels.length ? channels.join(' · ') : 'All optional alerts are off.'}</p>
                </div>
                <div className="profile-panel-actions">
                  <a className="hub-outline-btn" href={`${profileBase}?edit=1#profile-preferences`}>Change preferences</a>
                </div>
              </section>

              <section className="profile-panel profile-panel--wide" aria-labelledby="profile-public">
                <div className="profile-panel-heading">
                  <Globe size={17} aria-hidden="true" />
                  <h2 id="profile-public">Public profile</h2>
                </div>
                <p className="profile-muted">
                  A public link shows only your name, institution, programme and level.
                  Your email, phone number, matric number, results and notifications are never included.
                </p>
                {publicProfile && publicSlug ? (
                  <>
                    <div className="profile-public-link">
                      <code>{publicProfileUrl(publicSlug)}</code>
                      <button type="button" className="hub-outline-btn" onClick={() => void copyPublicLink()}>
                        <Copy size={13} /> Copy link
                      </button>
                    </div>
                    <div className="profile-public-actions">
                      <a className="hub-outline-btn" href={`/u/${publicSlug}`} target="_blank" rel="noopener noreferrer">
                        View public profile <ExternalLink size={13} />
                      </a>
                      <button
                        type="button"
                        className="profile-skip-link"
                        onClick={() => void updateVisibility(false)}
                        disabled={visibilityBusy}
                      >
                        {visibilityBusy ? 'Turning off…' : 'Turn off public link'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="profile-public-actions">
                    <button
                      type="button"
                      className="hub-outline-btn"
                      onClick={() => void updateVisibility(true)}
                      disabled={visibilityBusy}
                    >
                      {visibilityBusy ? 'Creating…' : 'Create public link'}
                    </button>
                    <span className="profile-muted">Off by default. You can turn it off again at any time.</span>
                  </div>
                )}
                {visibilityError && <p className="profile-error" role="alert">{visibilityError}</p>}
              </section>

              {/* Privacy is stated where the account lives, next to the
                  visibility control it qualifies. The deletion route goes
                  through support because removing an account also removes
                  saved results and requests, and that is a confirmed action,
                  not a one-tap toggle. */}
              <section className="profile-panel profile-panel--wide" aria-labelledby="profile-data">
                <div className="profile-panel-heading">
                  <ShieldCheck size={17} aria-hidden="true" />
                  <h2 id="profile-data">Privacy and data</h2>
                </div>
                <p className="profile-muted">
                  Your results, practice sessions, service requests and notifications are private to your account.
                  They are never shown on the public homepage or on your public profile link.
                </p>
                <div className="profile-panel-actions">
                  <a className="hub-outline-btn" href="/privacy">Privacy policy</a>
                  <a className="hub-outline-btn" href="/cookies">Cookie policy</a>
                  <a className="hub-outline-btn" href="/contact">Request data or account deletion</a>
                </div>
                <p className="profile-muted">
                  Deleting an account removes your profile, saved practice sessions and results. EduReach support
                  confirms the request with you before anything is removed, so nothing is lost by accident.
                </p>
              </section>
            </div>

          </div>
        </div>
      </ProfileShell>
    );
  }

  return (
    <ProfileShell embedded={embedded}>
      <div className="hub-page profile-page">
        <div className="hub-container profile-shell">
          <div className="profile-page-head">
            <div>
              <span className="hub-eyebrow">Account</span>
              <h1>{editMode ? 'Edit your profile' : 'Complete your profile'}</h1>
              <p>These details identify you on EduReach. Nothing is saved until you choose Save changes.</p>
            </div>
            <a className="profile-cancel-link" href={profileBase} onClick={confirmDiscard}>Cancel</a>
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
                fontWeight: 620,
                fontSize: '14px',
              }}
            >
              <CheckCircle2 size={20} color="#047857" />
              <span>{editMode ? 'Profile saved successfully. Returning to your profile…' : 'Profile saved successfully. Opening your dashboard…'}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="profile-form" noValidate>
            <h2 className="profile-group-title">Personal information</h2>
            <section className="profile-contact-section">
              <div className="profile-contact-heading"><Smartphone size={17} color="#64748b" /><h2>Contact</h2></div>
              <p>Keep a phone number on your account so EduReach can attach service updates to the right student.</p>
              <label className="hub-form-label">
                Phone number <span>(Optional)</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  placeholder="080 1234 5678"
                  autoComplete="tel"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'profile-phone-error' : undefined}
                />
                <FormFieldError id="profile-phone-error" error={fieldErrors.phone} />
              </label>
              <div className="profile-contact-email"><Mail size={14} /> <span>Email: <strong>{userEmail || 'Your account email'}</strong></span></div>
            </section>

            {/* 9. PROFILE PHOTO (OPTIONAL) */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Camera size={18} color="#64748b" />
                <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: 0 }}>
                  Profile Photo <span style={{ fontSize: '12px', fontWeight: 500, color: '#5e6c82' }}>(Optional)</span>
                </h2>
              </div>
              <p style={{ fontSize: '12.5px', color: '#5e6c82', margin: '0 0 14px' }}>
                Choose a photo from your device. It is uploaded to secure storage and saved as a link with your profile; initials remain the fallback.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                {/* CURRENT SELECTION */}
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '2px solid var(--er-primary-soft-border)',
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
                      fontWeight: 620,
                      fontSize: '20px',
                    }}
                  >
                    {avatarInitials}
                  </span>
                  {displayAvatar && (
                    <img
                      src={displayAvatar}
                      alt="Avatar"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        (event.target as HTMLImageElement).style.display = 'none';
                      }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>

                <div className="profile-photo-controls">
                  <div className="profile-photo-actions">
                    <label className="hub-outline-btn">
                      <Camera size={14} /> {avatarUploading ? 'Uploading…' : 'Choose photo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Choose profile photo"
                        disabled={avatarUploading}
                        onChange={(event) => void handleAvatarFile(event.target.files?.[0])}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl('');
                        setCustomAvatar('');
                        setAvatarFileName('');
                      }}
                      className="hub-outline-btn"
                      aria-label="Use my initials instead of a photo"
                    >
                      Use initials
                    </button>
                  </div>
                  {avatarFileName && <span className="profile-photo-note">{avatarFileName}</span>}
                  {avatarUploading && <span className="profile-photo-note" role="status">Uploading your photo…</span>}
                  {message && message.includes('photo') && <p className="hub-form-error" role="alert" style={{ marginTop: '8px' }}>{message}</p>}
                </div>
              </div>
            </section>

            {/* 10-13. INSTITUTION & FACULTY DETAILS */}
            <h2 className="profile-group-title">Academic information</h2>
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <School size={18} color="#64748b" />
                <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: 0 }}>
                  Institution &amp; Programme
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                {/* 10. INSTITUTION */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Institution / School *
                  </label>
                  <select
                    value={school}
                    aria-label="Institution or school"
                    aria-invalid={Boolean(fieldErrors.school)}
                    aria-describedby={fieldErrors.school ? 'profile-school-error' : undefined}
                    onChange={(e) => {
                      setSchool(e.target.value);
                      if (fieldErrors.school) setFieldErrors((prev) => ({ ...prev, school: '' }));
                      retainInstitutionFor(e.target.value);
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
                    <option value="">Choose an institution</option>
                    <optgroup label="Common institutions">
                      {commonInstitutions.map((inst) => (
                        <option key={inst} value={inst}>
                          {inst}
                        </option>
                      ))}
                    </optgroup>
                    {/* The live directory, so a student can pick the exact
                        institution row EduReach maintains. */}
                    {directory.length > 0 && (
                      <optgroup label="Full institution directory">
                        {directory.map((institution) => (
                          <option key={institution.id} value={institution.name}>
                            {institution.name}
                            {institution.state ? ` — ${institution.state}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {school.includes('Other') && (
                    <input
                      type="text"
                      value={customSchool}
                      aria-label="Custom institution name"
                      aria-invalid={Boolean(fieldErrors.school)}
                      aria-describedby={fieldErrors.school ? 'profile-school-error' : undefined}
                      onChange={(e) => {
                        setCustomSchool(e.target.value);
                        if (fieldErrors.school) setFieldErrors((prev) => ({ ...prev, school: '' }));
                      }}
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
                  <FormFieldError id="profile-school-error" error={fieldErrors.school} />
                </div>

                {/* 11. COURSE / PROGRAMME */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Course / Programme *
                  </label>
                  <select
                    value={courseOtherSelected ? 'Other programme' : courseProgramme}
                    aria-label="Course or programme"
                    aria-invalid={Boolean(fieldErrors.courseProgramme)}
                    aria-describedby={fieldErrors.courseProgramme ? 'profile-course-error' : undefined}
                    onChange={(e) => {
                      const isOther = e.target.value === 'Other programme';
                      setCourseOtherSelected(isOther);
                      setCourseProgramme(isOther ? '' : e.target.value);
                      if (fieldErrors.courseProgramme) setFieldErrors((prev) => ({ ...prev, courseProgramme: '' }));
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
                      aria-invalid={Boolean(fieldErrors.courseProgramme)}
                      aria-describedby={fieldErrors.courseProgramme ? 'profile-course-error' : undefined}
                      onChange={(e) => {
                        setCustomCourseProgramme(e.target.value);
                        if (fieldErrors.courseProgramme) setFieldErrors((prev) => ({ ...prev, courseProgramme: '' }));
                      }}
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
                  <FormFieldError id="profile-course-error" error={fieldErrors.courseProgramme} />
                </div>

                {/* 12. DEPARTMENT */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Department *
                  </label>
                  <select
                    value={departmentOtherSelected ? 'Other department' : department}
                    aria-label="Department"
                    aria-invalid={Boolean(fieldErrors.department)}
                    aria-describedby={fieldErrors.department ? 'profile-dept-error' : undefined}
                    onChange={(e) => {
                      const isOther = e.target.value === 'Other department';
                      setDepartmentOtherSelected(isOther);
                      setDepartment(isOther ? '' : e.target.value);
                      if (fieldErrors.department) setFieldErrors((prev) => ({ ...prev, department: '' }));
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
                      aria-invalid={Boolean(fieldErrors.department)}
                      aria-describedby={fieldErrors.department ? 'profile-dept-error' : undefined}
                      onChange={(e) => {
                        setCustomDepartment(e.target.value);
                        if (fieldErrors.department) setFieldErrors((prev) => ({ ...prev, department: '' }));
                      }}
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
                  <FormFieldError id="profile-dept-error" error={fieldErrors.department} />
                </div>

                {/* 13. FACULTY */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Faculty *
                  </label>
                  <select
                    value={faculty}
                    aria-label="Faculty"
                    aria-invalid={Boolean(fieldErrors.faculty)}
                    aria-describedby={fieldErrors.faculty ? 'profile-faculty-error' : undefined}
                    onChange={(e) => {
                      setFaculty(e.target.value);
                      if (fieldErrors.faculty) setFieldErrors((prev) => ({ ...prev, faculty: '' }));
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
                    <option value="">Choose a faculty</option>
                    {optionsIncludingSaved(faculties, faculty).map((fac) => (
                      <option key={fac} value={fac}>
                        {fac}
                      </option>
                    ))}
                  </select>
                  <FormFieldError id="profile-faculty-error" error={fieldErrors.faculty} />
                </div>
              </div>
            </section>

            {/* 14-16. LEVEL & ACADEMIC YEARS */}
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <GraduationCap size={18} color="#64748b" />
                <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: 0 }}>
                  Level &amp; Academic Timeline
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {/* 14. CURRENT LEVEL */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Current Level *
                  </label>
                  <select
                    value={level}
                    aria-label="Current level"
                    aria-invalid={Boolean(fieldErrors.level)}
                    aria-describedby={fieldErrors.level ? 'profile-level-error' : undefined}
                    onChange={(e) => {
                      setLevel(e.target.value);
                      if (fieldErrors.level) setFieldErrors((prev) => ({ ...prev, level: '' }));
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
                    <option value="">Choose current level</option>
                    {optionsIncludingSaved(levels, level).map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                  <FormFieldError id="profile-level-error" error={fieldErrors.level} />
                </div>

                {/* 15. ACADEMIC SESSION */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Academic Session *
                  </label>
                  <select
                    value={session}
                    aria-label="Academic session"
                    aria-invalid={Boolean(fieldErrors.session)}
                    aria-describedby={fieldErrors.session ? 'profile-session-error' : undefined}
                    onChange={(e) => {
                      setSession(e.target.value);
                      if (fieldErrors.session) setFieldErrors((prev) => ({ ...prev, session: '' }));
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
                    <option value="">Choose academic session</option>
                    {academicSessions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <FormFieldError id="profile-session-error" error={fieldErrors.session} />
                </div>

                {/* 16. ADMISSION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Admission Year *
                  </label>
                  <select
                    value={admissionYear}
                    aria-label="Admission year"
                    aria-invalid={Boolean(fieldErrors.admissionYear)}
                    aria-describedby={fieldErrors.admissionYear ? 'profile-admission-year-error' : undefined}
                    onChange={(e) => {
                      setAdmissionYear(e.target.value);
                      if (fieldErrors.admissionYear) setFieldErrors((prev) => ({ ...prev, admissionYear: '' }));
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
                    <option value="">Choose admission year</option>
                    {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                  <FormFieldError id="profile-admission-year-error" error={fieldErrors.admissionYear} />
                </div>

                {/* 16. EXPECTED GRADUATION YEAR */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 560, color: '#334155', marginBottom: '6px' }}>
                    Expected Graduation Year *
                  </label>
                  <select
                    value={expectedGradYear}
                    aria-label="Expected graduation year"
                    aria-invalid={Boolean(fieldErrors.expectedGradYear)}
                    aria-describedby={fieldErrors.expectedGradYear ? 'profile-grad-year-error' : undefined}
                    onChange={(e) => {
                      setExpectedGradYear(e.target.value);
                      if (fieldErrors.expectedGradYear) setFieldErrors((prev) => ({ ...prev, expectedGradYear: '' }));
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
                    <option value="">Choose graduation year</option>
                    {academicYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                  <FormFieldError id="profile-grad-year-error" error={fieldErrors.expectedGradYear} />
                </div>
              </div>
            </section>

            {/* 17. ACADEMIC INTERESTS (OPTIONAL) */}
            <h2 className="profile-group-title" id="profile-preferences">Preferences</h2>
            <section style={{ marginBottom: '26px', paddingBottom: '22px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Sparkles size={18} color="#64748b" />
                <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: 0 }}>
                  Academic Interests <span style={{ fontSize: '12px', fontWeight: 500, color: '#5e6c82' }}>(Optional)</span>
                </h2>
              </div>
              <p style={{ fontSize: '12.5px', color: '#5e6c82', margin: '0 0 12px' }}>
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
                        fontWeight: 620,
                        border: '1px solid',
                        borderColor: selected ? 'var(--er-primary)' : '#cbd5e1',
                        background: selected ? 'var(--er-primary-soft)' : '#ffffff',
                        color: selected ? 'var(--er-primary)' : '#475569',
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
                <Bell size={18} color="#64748b" />
                <h2 style={{ fontSize: '15px', fontWeight: 620, color: '#0f172a', margin: 0 }}>
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
                    style={{ width: '16px', height: '16px', accentColor: 'var(--er-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} color="#64748b" /> Email Notifications
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#5e6c82' }}>
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
                    style={{ width: '16px', height: '16px', accentColor: 'var(--er-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MessageSquare size={14} color="#64748b" /> WhatsApp Order &amp; Request Alerts
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#5e6c82' }}>
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
                    style={{ width: '16px', height: '16px', accentColor: 'var(--er-primary)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: '13px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Smartphone size={14} color="#64748b" /> SMS Urgent Deadline Reminders
                    </strong>
                    <span style={{ fontSize: '11.5px', color: '#5e6c82' }}>
                      Receive high-priority SMS reminders for closing dates (e.g. JAMB registration &amp; Post-UTME).
                    </span>
                  </div>
                </label>
              </div>
            </section>

            {message && <div className="hub-form-error" role="alert" style={{ marginBottom: '16px' }}>{message}</div>}

            <div className="profile-save-bar">
              <div className="profile-save-state" role="status" aria-live="polite">
                {saving
                  ? 'Saving...'
                  : savedSuccess
                    ? 'Saved'
                    : isDirty
                      ? 'Unsaved changes'
                      : 'All changes saved'}
                {isDirty && !saving && !savedSuccess && (
                  <span className="profile-save-hint"> Choose Save changes to keep them.</span>
                )}
              </div>
              <div className="profile-save-actions">
                {!editMode && (
                  <a className="profile-skip-link" href="/dashboard">Skip for now</a>
                )}
                <a className="hub-outline-btn" href={profileBase} onClick={confirmDiscard}>Cancel</a>
                <button type="submit" className="hub-primary-btn" disabled={saving || savedSuccess || !isDirty} aria-busy={saving}>
                  {saving ? <><WaveLoader variant="inline" decorative /> Saving…</> : <>Save changes <ChevronRight size={16} /></>}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ProfileShell>
  );
}
