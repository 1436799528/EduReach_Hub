import React, { useState, useMemo } from 'react';
import { 
  StudyMaterial, 
  UserProfile, 
  InstitutionId 
} from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { MaterialCard } from './MaterialCard';
import { CurriculumHub } from './CurriculumHub';
import { 
  BookOpen, 
  Search, 
  Building2, 
  Layers, 
  ChevronDown, 
  RotateCcw,
  Bookmark
} from 'lucide-react';

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

export const MySchoolPage: React.FC<MySchoolPageProps> = ({
  user,
  materials,
  selectedInstitution,
  setSelectedInstitution,
  onUnlockMaterial,
  onReadMaterial,
  onToggleOffline,
  onOpenCBT
}) => {
  // Sub-view inside My School
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'curriculum' | 'saved'>('materials');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('All Levels');
  const [selectedSemester, setSelectedSemester] = useState('All Semesters');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState('All Faculties');

  // Institution Object
  const currentInst = INSTITUTIONS.find(i => i.id === selectedInstitution) || INSTITUTIONS[0];

  // Levels list
  const levels = ['All Levels', '100L', '200L', '300L', '400L', '500L'];
  const semesters = ['All Semesters', '1st Semester', '2nd Semester'];
  const types = [
    { id: 'all', label: 'All Study Content' },
    { id: 'PAST_QUESTION_SOLVED', label: 'Solved Past Questions' },
    { id: 'HANDOUT_SUMMARY', label: 'Lecture Summaries' },
    { id: 'FORMULA_SHEET', label: 'Formula Sheets' },
    { id: 'EXAM_PREP_PACK', label: 'Curriculum & Syllabi' }
  ];

  // Filter materials for this school
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      // School filter
      if (selectedInstitution !== 'ALL') {
        const directMatch = item.institutionId === selectedInstitution;
        const equivMatch = item.crossCampusEquivalents?.some(eq => eq.institution === selectedInstitution);
        if (!directMatch && !equivMatch) return false;
      }

      // Subtab filter for saved
      if (activeSubTab === 'saved') {
        if (!user.savedOfflineMaterialIds.includes(item.id)) return false;
      }

      // Level
      if (selectedLevel !== 'All Levels' && item.level !== selectedLevel) {
        return false;
      }

      // Semester
      if (selectedSemester !== 'All Semesters' && item.semester !== selectedSemester && item.semester !== 'All Year') {
        return false;
      }

      // Material Type
      if (selectedType !== 'all' && item.materialType !== selectedType) {
        return false;
      }

      // Faculty
      if (selectedFaculty !== 'All Faculties' && item.faculty !== selectedFaculty) {
        return false;
      }

      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchesCode = item.courseCode.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q) || item.courseTitle.toLowerCase().includes(q);
        const matchesDept = item.department.toLowerCase().includes(q) || item.faculty.toLowerCase().includes(q);
        const matchesSummary = item.summary.toLowerCase().includes(q);
        const matchesConcepts = item.coreConcepts?.some(c => c.toLowerCase().includes(q));

        if (!matchesCode && !matchesTitle && !matchesDept && !matchesSummary && !matchesConcepts) {
          return false;
        }
      }

      return true;
    });
  }, [materials, selectedInstitution, activeSubTab, selectedLevel, selectedSemester, selectedType, selectedFaculty, searchQuery, user.savedOfflineMaterialIds]);

  const handleResetFilters = () => {
    setSelectedLevel('All Levels');
    setSelectedSemester('All Semesters');
    setSelectedType('all');
    setSelectedFaculty('All Faculties');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* School Banner & Multi-Campus Switcher */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-sm relative overflow-hidden">
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-orange-400 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" />
              <span>{selectedInstitution === 'ALL' ? 'Multi-Campus National Vault' : currentInst.shortName}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {selectedInstitution === 'ALL' ? 'All Universities Academic Vault' : currentInst.name}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {selectedInstitution === 'ALL' 
                ? 'Access past questions, course outlines, and verified lecture solutions cross-referenced across Nigerian universities.'
                : `${currentInst.motto || 'Knowledge, Excellence and Service'} • Location: ${currentInst.state} State`}
            </p>
          </div>

          {/* Quick Switch Campus Dropdown */}
          <div className="bg-slate-800 p-3 rounded-2xl border border-slate-700 space-y-2 flex-shrink-0">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active University:
            </label>
            <div className="relative">
              <select
                value={selectedInstitution}
                onChange={(e) => setSelectedInstitution(e.target.value as InstitutionId)}
                className="w-full appearance-none bg-slate-900 text-white text-xs font-bold pl-3 pr-8 py-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="ALL">All Nigerian Campuses</option>
                {INSTITUTIONS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.shortName} - {inst.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs: Materials vs Curriculum Matrix vs Saved Offline */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab('materials')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'materials'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Study Materials & Past Questions ({materials.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('curriculum')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'curriculum'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Curriculum & Syllabus Matrix</span>
          </button>

          <button
            onClick={() => setActiveSubTab('saved')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'saved'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-orange-400" />
            <span>Saved Offline ({user.savedOfflineMaterialIds.length})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code (CSC 311, MAT 101)..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500"
          />
        </div>
      </div>

      {/* Main View Display */}
      {activeSubTab === 'curriculum' ? (
        <CurriculumHub
          user={user}
          materials={materials}
          onUnlockMaterial={onUnlockMaterial}
          onReadMaterial={onReadMaterial}
          onToggleOffline={onToggleOffline}
          onUpdateEnrolledCourses={(courses) => {}}
          onOpenCBT={onOpenCBT}
        />
      ) : (
        <div className="space-y-5">
          
          {/* Filter Toolbar for Study Materials */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            
            {/* Level Selector Pills */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Level:</span>
                {levels.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(lvl)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedLevel === lvl
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {semesters.map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>

                {(selectedLevel !== 'All Levels' || selectedSemester !== 'All Semesters' || searchQuery !== '' || selectedType !== 'all') && (
                  <button
                    onClick={handleResetFilters}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Reset all filters"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Material Type Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Type:</span>
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedType === t.id
                      ? 'bg-orange-600 text-white shadow-xs font-bold'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-800 font-bold">{filteredMaterials.length}</strong> study packages for {selectedInstitution === 'ALL' ? 'All Campuses' : currentInst.shortName}
            </span>
            {user.enrolledCourses.length > 0 && (
              <span className="text-orange-600 font-semibold hidden sm:inline">
                Mapped to your department ({user.department})
              </span>
            )}
          </div>

          {/* Material Cards Grid */}
          {filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No Study Materials Match Your Filters
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try clearing your search query or switching to "All Levels" to discover verified solved past question packs and syllabus summaries.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-500 transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMaterials.map((material) => {
                const isSavedOffline = user.savedOfflineMaterialIds.includes(material.id);

                return (
                  <MaterialCard
                    key={material.id}
                    material={material}
                    isUnlocked={true}
                    isSavedOffline={isSavedOffline}
                    onUnlock={() => onUnlockMaterial(material)}
                    onRead={() => onReadMaterial(material)}
                    onToggleOffline={() => onToggleOffline(material.id)}
                    onOpenCBT={onOpenCBT}
                  />
                );
              })}
            </div>
          )}

        </div>
      )}

    </div>
  );
};
