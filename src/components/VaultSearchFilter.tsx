import React from 'react';
import { 
  Search, 
  Filter, 
  X,
  BookOpen,
  RotateCcw
} from 'lucide-react';
import { InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';

interface VaultSearchFilterProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedInstitution: InstitutionId;
  setSelectedInstitution: (inst: InstitutionId) => void;
  selectedLevel: string;
  setSelectedLevel: (level: string) => void;
  selectedSemester: string;
  setSelectedSemester: (sem: string) => void;
  selectedType: string;
  setSelectedType: (type: string) => void;
  selectedFaculty: string;
  setSelectedFaculty: (fac: string) => void;
  totalResults: number;
  onResetFilters: () => void;
}

export const VaultSearchFilter: React.FC<VaultSearchFilterProps> = ({
  searchQuery,
  setSearchQuery,
  selectedInstitution,
  setSelectedInstitution,
  selectedLevel,
  setSelectedLevel,
  selectedSemester,
  setSelectedSemester,
  selectedType,
  setSelectedType,
  selectedFaculty,
  setSelectedFaculty,
  totalResults,
  onResetFilters
}) => {
  const faculties = [
    'All Faculties',
    'General Studies',
    'Engineering & Technology',
    'Science',
    'Law',
    'Medical & Health Sciences',
    'Management Sciences',
    'Social Sciences',
    'Arts & Humanities',
    'Education'
  ];

  const levels = ['All Levels', '100L', '200L', '300L', '400L', '500L'];
  const semesters = ['All Semesters', '1st Semester', '2nd Semester'];
  
  const materialTypes = [
    { value: 'all', label: 'All Resources' },
    { value: 'past_question', label: 'Past Questions & Solutions' },
    { value: 'lecture_summary', label: 'High-Yield Summaries' },
    { value: 'handwritten_note', label: 'Scholar Notes' },
    { value: 'cbt_pack', label: 'CBT Practice Exams' },
    { value: 'project_guide', label: 'Project Guides & Topics' },
  ];

  const hasActiveFilters = 
    selectedInstitution !== 'ALL' ||
    selectedLevel !== 'All Levels' ||
    selectedSemester !== 'All Semesters' ||
    selectedType !== 'all' ||
    selectedFaculty !== 'All Faculties' ||
    searchQuery.trim() !== '';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-6 mb-6">
      {/* Search Input Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
          <Search className="w-5 h-5 text-orange-500" />
        </div>
        <input
          id="materials-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Course Code (e.g., GST 111, MTH 201, EEE 301), Topic, or Keyword..."
          className="w-full pl-12 pr-12 py-3.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white text-slate-900 placeholder-slate-400 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 text-sm font-medium transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-3 pr-2 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* University Fast Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-thin">
        <button
          onClick={() => setSelectedInstitution('ALL')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
            selectedInstitution === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All Universities
        </button>
        {INSTITUTIONS.map((inst) => (
          <button
            key={inst.id}
            onClick={() => setSelectedInstitution(inst.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedInstitution === inst.id
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {inst.shortName}
          </button>
        ))}
      </div>

      {/* Structured Dropdown Filter Controls */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Academic Level</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {levels.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Resource Type</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {materialTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Faculty</label>
          <select
            value={selectedFaculty}
            onChange={(e) => setSelectedFaculty(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer truncate"
          >
            {faculties.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Semester</label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            {semesters.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count & Reset Bar */}
      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800">
            {totalResults} {totalResults === 1 ? 'Study Material' : 'Study Materials'} Available
          </span>
          {selectedInstitution !== 'ALL' && (
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-800 font-bold text-[11px]">
              {selectedInstitution}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 text-slate-500 hover:text-orange-600 font-semibold cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>
    </div>
  );
};
