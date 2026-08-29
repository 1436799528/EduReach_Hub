import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  ShieldCheck, 
  Users, 
  ArrowRight, 
  Plus, 
  X, 
  BookmarkCheck, 
  GraduationCap,
  Building2,
  Lock,
  DownloadCloud,
  Check,
  Search,
  Filter,
  Sparkles,
  HelpCircle,
  Clock
} from 'lucide-react';
import { 
  UserProfile, 
  StudyMaterial, 
  InstitutionId 
} from '../types';
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

export const CurriculumHub: React.FC<CurriculumHubProps> = ({
  user,
  materials,
  onReadMaterial,
  onUnlockMaterial,
  onToggleOffline,
  onUpdateEnrolledCourses,
  onOpenCBT
}) => {
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'enrolled' | 'past_questions' | 'summaries'>('all');
  
  const [newCourseInput, setNewCourseInput] = useState('');
  const [showAddCourse, setShowAddCourse] = useState(false);

  // Institution matching
  const currentInstitution = INSTITUTIONS.find(i => i.id === user.institutionId) || INSTITUTIONS[0];

  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseInput.trim()) return;
    const clean = newCourseInput.trim().toUpperCase();
    if (!user.enrolledCourses.includes(clean)) {
      onUpdateEnrolledCourses([...user.enrolledCourses, clean]);
    }
    setNewCourseInput('');
    setShowAddCourse(false);
  };

  const handleRemoveCourse = (courseCode: string) => {
    const updated = user.enrolledCourses.filter(c => c !== courseCode);
    onUpdateEnrolledCourses(updated);
  };

  // Filter materials based on institution, level, semester, and tab
  const filteredMaterials = useMemo(() => {
    return materials.filter(mat => {
      // 1. Institution check (match user institution or ALL)
      const matchesInst = user.institutionId === 'ALL' || mat.institutionId === user.institutionId;
      if (!matchesInst) return false;

      // 2. Academic Level check
      if (selectedLevel !== 'ALL' && mat.level !== selectedLevel) {
        return false;
      }

      // 3. Semester check
      if (selectedSemester !== 'ALL' && mat.semester !== selectedSemester) {
        return false;
      }

      // 4. Tab check
      if (activeFilterTab === 'enrolled') {
        const isEnrolled = user.enrolledCourses.some(code => 
          mat.courseCode.toLowerCase().includes(code.toLowerCase()) ||
          code.toLowerCase().includes(mat.courseCode.toLowerCase())
        );
        if (!isEnrolled) return false;
      } else if (activeFilterTab === 'past_questions') {
        if (mat.materialType !== 'past_question') return false;
      } else if (activeFilterTab === 'summaries') {
        if (mat.materialType !== 'summary' && mat.materialType !== 'formula_sheet') return false;
      }

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          mat.courseCode.toLowerCase().includes(q) ||
          mat.courseTitle.toLowerCase().includes(q) ||
          mat.title.toLowerCase().includes(q) ||
          mat.department.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [materials, user.institutionId, selectedLevel, selectedSemester, activeFilterTab, searchQuery, user.enrolledCourses]);

  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = { '100L': 0, '200L': 0, '300L': 0, '400L': 0, '500L': 0 };
    materials.forEach(m => {
      if (user.institutionId === 'ALL' || m.institutionId === user.institutionId) {
        if (counts[m.level] !== undefined) {
          counts[m.level]++;
        }
      }
    });
    return counts;
  }, [materials, user.institutionId]);

  return (
    <div className="space-y-6">
      
      {/* Dynamic Academic Curriculum Header */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[11px] font-bold uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5" />
              <span>{user.institutionId === 'ALL' ? 'National Academic Hub' : currentInstitution.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Curriculum & Syllabus Matrix
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Select your academic level and registered courses to access verified past questions, high-yield summaries, and CBT tests.
            </p>
          </div>

          {/* Quick Enrolled Summary */}
          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/90 px-3.5 py-2.5 rounded-xl self-start md:self-auto text-xs">
            <GraduationCap className="w-5 h-5 text-orange-400" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Department</div>
              <div className="font-bold text-white truncate max-w-[160px]">{user.department}</div>
            </div>
          </div>
        </div>

        {/* Registered Course Codes Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <BookOpen className="w-4 h-4 text-orange-400" />
              <span>Your Enrolled Courses ({user.enrolledCourses.length}):</span>
            </div>

            {!showAddCourse && (
              <button
                onClick={() => setShowAddCourse(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Course</span>
              </button>
            )}
          </div>

          {/* Add Course Inline Form */}
          {showAddCourse && (
            <form onSubmit={handleAddCourse} className="flex items-center gap-2 max-w-md pt-1">
              <input
                type="text"
                value={newCourseInput}
                onChange={(e) => setNewCourseInput(e.target.value)}
                placeholder="e.g. GST 111, MTH 201, CSC 301, EEE 402"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-orange-500 font-medium"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddCourse(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Enrolled Courses Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {user.enrolledCourses.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700/80 text-slate-200 border border-slate-700 text-xs font-semibold"
              >
                <span>{code}</span>
                <button
                  onClick={() => handleRemoveCourse(code)}
                  className="text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title={`Remove ${code}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Level Navigation Tabs (100L through 500L Quick Toggles) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-orange-600" />
            Filter by Academic Level
          </span>
          <span className="text-[11px] text-slate-500">
            Showing {filteredMaterials.length} materials
          </span>
        </div>

        {/* Level Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedLevel('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedLevel === 'ALL'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Levels
          </button>

          {(['100L', '200L', '300L', '400L', '500L'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedLevel === lvl
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{lvl}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedLevel === lvl ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {levelCounts[lvl] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Secondary Sub-Filters: Semester, Material Category & Search */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          
          {/* Sub-Category Pills */}
          <div className="flex flex-wrap items-center gap-1">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeFilterTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setActiveFilterTab('enrolled')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeFilterTab === 'enrolled'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              My Enrolled
            </button>
            <button
              onClick={() => setActiveFilterTab('past_questions')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeFilterTab === 'past_questions'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Past Questions & CBT
            </button>
            <button
              onClick={() => setActiveFilterTab('summaries')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                activeFilterTab === 'summaries'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Summaries & Notes
            </button>
          </div>

          {/* Semester Selector & Quick Search */}
          <div className="flex items-center gap-2">
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">All Semesters</option>
              <option value="1st Semester">1st Semester</option>
              <option value="2nd Semester">2nd Semester</option>
            </select>

            <div className="relative flex-1 sm:w-44">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search course code..."
                className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
          </div>

        </div>
      </div>

      {/* Materials Grid */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No Materials Found for This Filter
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try switching academic levels or clearing search parameters to view other course archives.
          </p>
          <button
            onClick={() => {
              setSelectedLevel('ALL');
              setSelectedSemester('ALL');
              setActiveFilterTab('all');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map((mat) => (
            <MaterialCard
              key={mat.id}
              material={mat}
              isUnlocked={user.isAPlusSubscriber || user.unlockedMaterialIds.includes(mat.id)}
              isOffline={user.savedOfflineMaterialIds.includes(mat.id)}
              onRead={onReadMaterial}
              onUnlock={onUnlockMaterial}
              onToggleOffline={onToggleOffline}
              onOpenCBT={onOpenCBT}
            />
          ))}
        </div>
      )}

    </div>
  );
};
