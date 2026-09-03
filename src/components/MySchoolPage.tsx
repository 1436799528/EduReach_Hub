import React, { useMemo, useState } from 'react';
import { BookOpen, Bookmark, Building2, ChevronDown, Layers, RotateCcw, Search } from 'lucide-react';
import { StudyMaterial, UserProfile, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { MaterialCard } from './MaterialCard';
import { CurriculumHub } from './CurriculumHub';

interface MySchoolPageProps {
  user: UserProfile;
  materials: StudyMaterial[];
  selectedInstitution: InstitutionId;
  setSelectedInstitution: (inst: InstitutionId) => void;
  onUnlockMaterial: (material: StudyMaterial) => void;
  onReadMaterial: (material: StudyMaterial) => void;
  onToggleOffline: (materialId: string) => void;
  onOpenCBT?: (material: StudyMaterial) => void;
}

const levels = ['All Levels', '100L', '200L', '300L', '400L', '500L', '600L', 'General'];
const semesters = ['All Semesters', '1st Semester', '2nd Semester'];
const types = [
  { id: 'all', label: 'All' },
  { id: 'past_question', label: 'Past Questions' },
  { id: 'lecture_summary', label: 'Lecture Summaries' },
  { id: 'handwritten_note', label: 'Handwritten Notes' },
  { id: 'project_guide', label: 'Project Guides' },
  { id: 'cbt_pack', label: 'CBT Packs' },
  { id: 'formula_sheet', label: 'Formula Sheets' },
];

export const MySchoolPage: React.FC<MySchoolPageProps> = ({
  user,
  materials,
  selectedInstitution,
  setSelectedInstitution,
  onUnlockMaterial,
  onReadMaterial,
  onToggleOffline,
  onOpenCBT,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'curriculum' | 'saved'>('materials');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('All Levels');
  const [semester, setSemester] = useState('All Semesters');
  const [type, setType] = useState('all');
  const [faculty, setFaculty] = useState('All Faculties');

  const currentInst = INSTITUTIONS.find((item) => item.id === selectedInstitution) || INSTITUTIONS[0];
  const faculties = useMemo(
    () => ['All Faculties', ...Array.from(new Set(materials.map((item) => item.faculty).filter(Boolean)))],
    [materials]
  );

  const filteredMaterials = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((item) => {
      if (selectedInstitution !== 'ALL') {
        const directMatch = item.institutionId === selectedInstitution;
        const equivalentMatch = item.crossCampusEquivalents?.some((entry) => entry.institution === selectedInstitution);
        if (!directMatch && !equivalentMatch) return false;
      }
      if (activeSubTab === 'saved' && !user.savedOfflineMaterialIds.includes(item.id)) return false;
      if (level !== 'All Levels' && item.level !== level) return false;
      if (semester !== 'All Semesters' && item.semester !== semester && item.semester !== 'All Year') return false;
      if (type !== 'all' && item.materialType !== type) return false;
      if (faculty !== 'All Faculties' && item.faculty !== faculty) return false;
      if (!q) return true;
      return [
        item.courseCode,
        item.courseTitle,
        item.title,
        item.department,
        item.faculty,
        item.summary,
        ...(item.coreConcepts || []),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [materials, selectedInstitution, activeSubTab, user.savedOfflineMaterialIds, level, semester, type, faculty, query]);

  const resetFilters = () => {
    setQuery('');
    setLevel('All Levels');
    setSemester('All Semesters');
    setType('all');
    setFaculty('All Faculties');
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">My School</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                {selectedInstitution === 'ALL' ? 'Study Materials' : currentInst.shortName}
              </h1>
              <p className="mt-1 text-sm text-slate-500">Past questions, notes, CBT packs and your course curriculum.</p>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              <select
                value={selectedInstitution}
                onChange={(event) => setSelectedInstitution(event.target.value as InstitutionId)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-orange-500"
              >
                <option value="ALL">All schools</option>
                {INSTITUTIONS.filter((item) => item.id !== 'ALL').map((item) => (
                  <option key={item.id} value={item.id}>{item.shortName}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-2">
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setActiveSubTab('materials')} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${activeSubTab === 'materials' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <BookOpen className="h-4 w-4" /> Materials <span className="text-[10px] opacity-70">{materials.length}</span>
            </button>
            <button type="button" onClick={() => setActiveSubTab('curriculum')} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${activeSubTab === 'curriculum' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Layers className="h-4 w-4" /> Curriculum
            </button>
            <button type="button" onClick={() => setActiveSubTab('saved')} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${activeSubTab === 'saved' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Bookmark className="h-4 w-4" /> Saved <span className="text-[10px] opacity-70">{user.savedOfflineMaterialIds.length}</span>
            </button>
          </div>
        </section>

        {activeSubTab === 'curriculum' ? (
          <CurriculumHub
            user={user}
            materials={materials}
            onUnlockMaterial={onUnlockMaterial}
            onReadMaterial={onReadMaterial}
            onToggleOffline={onToggleOffline}
            onUpdateEnrolledCourses={() => undefined}
            onOpenCBT={onOpenCBT}
          />
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search course code, title or topic"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-500 focus:bg-white"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500">
                    {levels.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={semester} onChange={(event) => setSemester(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500">
                    {semesters.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <select value={faculty} onChange={(event) => setFaculty(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-orange-500">
                    {faculties.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  {(query || level !== 'All Levels' || semester !== 'All Semesters' || type !== 'all' || faculty !== 'All Faculties') && (
                    <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                      <RotateCcw className="h-3.5 w-3.5" /> Reset
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-1.5 overflow-x-auto border-t border-slate-100 pt-3">
                {types.map((item) => (
                  <button key={item.id} type="button" onClick={() => setType(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ${type === item.id ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
              <span>{filteredMaterials.length} {filteredMaterials.length === 1 ? 'resource' : 'resources'}</span>
              {user.department && <span className="hidden sm:block">{user.department} · {user.level}</span>}
            </div>

            {filteredMaterials.length === 0 ? (
              <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No study materials match your filters</p>
                <p className="mt-1 text-xs text-slate-400">Try another course or reset the filters.</p>
                <button type="button" onClick={resetFilters} className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800">Reset filters</button>
              </section>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredMaterials.map((material) => {
                  const isSaved = user.savedOfflineMaterialIds.includes(material.id);
                  const isUnlocked = material.unlockPrice === 0 || user.isAPlusSubscriber || user.unlockedMaterialIds.includes(material.id);
                  return (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      user={user}
                      isUnlocked={isUnlocked}
                      isSavedOffline={isSaved}
                      onUnlock={() => onUnlockMaterial(material)}
                      onRead={() => onReadMaterial(material)}
                      onToggleOffline={() => onToggleOffline(material.id)}
                      onOpenCBT={onOpenCBT}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
