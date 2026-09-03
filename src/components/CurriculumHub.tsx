import React, { useMemo, useState } from 'react';
import { BookOpen, Building2, Plus, Search, X } from 'lucide-react';
import { UserProfile, StudyMaterial } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { MaterialCard } from './MaterialCard';

interface CurriculumHubProps {
  user: UserProfile;
  materials: StudyMaterial[];
  onReadMaterial: (material: StudyMaterial) => void;
  onUnlockMaterial: (material: StudyMaterial) => void;
  onToggleOffline: (materialId: string) => void;
  onUpdateEnrolledCourses: (courses: string[]) => void;
  onOpenCBT?: (material: StudyMaterial) => void;
}

const levels = ['ALL', '100L', '200L', '300L', '400L', '500L', '600L', 'General'];
const semesters = ['ALL', '1st Semester', '2nd Semester'];
const tabs = [
  { id: 'all', label: 'All' },
  { id: 'enrolled', label: 'My Courses' },
  { id: 'past_questions', label: 'Past Questions' },
  { id: 'summaries', label: 'Notes & Summaries' },
] as const;

type FilterTab = typeof tabs[number]['id'];

export const CurriculumHub: React.FC<CurriculumHubProps> = ({
  user,
  materials,
  onReadMaterial,
  onUnlockMaterial,
  onToggleOffline,
  onUpdateEnrolledCourses,
  onOpenCBT,
}) => {
  const [level, setLevel] = useState('ALL');
  const [semester, setSemester] = useState('ALL');
  const [tab, setTab] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState('');

  const institution = INSTITUTIONS.find((item) => item.id === user.institutionId) || INSTITUTIONS[0];

  const filteredMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((material) => {
      if (user.institutionId !== 'ALL' && material.institutionId !== user.institutionId) return false;
      if (level !== 'ALL' && material.level !== level) return false;
      if (semester !== 'ALL' && material.semester !== semester && material.semester !== 'All Year') return false;
      if (tab === 'enrolled' && !user.enrolledCourses.some((code) => material.courseCode.toLowerCase().includes(code.toLowerCase()) || code.toLowerCase().includes(material.courseCode.toLowerCase()))) return false;
      if (tab === 'past_questions' && material.materialType !== 'past_question' && material.materialType !== 'cbt_pack') return false;
      if (tab === 'summaries' && !['lecture_summary', 'handwritten_note', 'formula_sheet'].includes(material.materialType)) return false;
      if (q && ![material.courseCode, material.courseTitle, material.title, material.department, material.faculty, material.summary, ...material.coreConcepts].some((value) => value.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [materials, user.institutionId, user.enrolledCourses, level, semester, tab, query]);

  const addCourse = (event: React.FormEvent) => {
    event.preventDefault();
    const code = newCourse.trim().toUpperCase();
    if (!code || user.enrolledCourses.includes(code)) return;
    onUpdateEnrolledCourses([...user.enrolledCourses, code]);
    setNewCourse('');
    setAddingCourse(false);
  };

  const removeCourse = (code: string) => {
    onUpdateEnrolledCourses(user.enrolledCourses.filter((item) => item !== code));
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">Curriculum</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Courses & syllabus</h2>
            <p className="mt-1 text-sm text-slate-500">{user.institutionId === 'ALL' ? 'National course archive' : institution.shortName} · {user.department}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="h-4 w-4 text-orange-600" /> {user.level}</div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">My enrolled courses</h3>
            <button type="button" onClick={() => setAddingCourse((value) => !value)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"><Plus className="h-3.5 w-3.5" /> Add course</button>
          </div>
          {addingCourse && (
            <form onSubmit={addCourse} className="mt-3 flex gap-2">
              <input value={newCourse} onChange={(event) => setNewCourse(event.target.value)} autoFocus placeholder="e.g. EEE 311" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-orange-500 focus:bg-white" />
              <button type="submit" className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700">Save</button>
              <button type="button" onClick={() => setAddingCourse(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </form>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {user.enrolledCourses.length ? user.enrolledCourses.map((code) => <span key={code} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">{code}<button type="button" onClick={() => removeCourse(code)} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button></span>) : <span className="text-xs text-slate-400">No courses added.</span>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses or topics" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:bg-white" />
          </div>
          <div className="flex gap-2">
            <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500">
              {levels.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All levels' : item}</option>)}
            </select>
            <select value={semester} onChange={(event) => setSemester(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500">
              {semesters.map((item) => <option key={item} value={item}>{item === 'ALL' ? 'All semesters' : item}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
          {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item.label}</button>)}
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-xs text-slate-500"><span>{filteredMaterials.length} resources</span><span className="hidden sm:block">Filtered for your school and courses</span></div>

      {filteredMaterials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center"><BookOpen className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No curriculum resources found</p><p className="mt-1 text-xs text-slate-400">Change the level, semester or search term.</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredMaterials.map((material) => {
            const saved = user.savedOfflineMaterialIds.includes(material.id);
            const unlocked = material.unlockPrice === 0 || user.isAPlusSubscriber || user.unlockedMaterialIds.includes(material.id);
            return <MaterialCard key={material.id} material={material} user={user} isUnlocked={unlocked} isSavedOffline={saved} onUnlock={() => onUnlockMaterial(material)} onRead={() => onReadMaterial(material)} onToggleOffline={() => onToggleOffline(material.id)} onOpenCBT={onOpenCBT} />;
          })}
        </div>
      )}
    </div>
  );
};
