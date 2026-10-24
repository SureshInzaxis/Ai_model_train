import React from 'react';
import { Search, Filter, X } from 'lucide-react';

const FilterBar = ({ filters, onChange, onClear, options = {} }) => {
  const { subjects = [], chapters = {}, examTypes = [], years = [] } = options;
  const chapterList = chapters[filters.subject] || [];

  const handleFilterChange = (key, value) => {
    onChange({ ...filters, [key]: value });
  };

  const handleRemove = (key) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onChange(newFilters);
  };

  const hasActiveFilters = Object.values(filters).some(v => v !== '' && v !== undefined && v !== null);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <div>
          <input
            type="text"
            placeholder="Search questions..."
            value={filters.search || ''}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ml-0.5" />
        </div>

        <select
          value={filters.subject || ''}
          onChange={(e) => handleFilterChange('subject', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>

        <select
          value={filters.chapter || ''}
          onChange={(e) => handleFilterChange('chapter', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
          disabled={!filters.subject}
        >
          <option value="">All Chapters</option>
          {chapterList.map((ch) => (
            <option key={ch.id} value={ch.name}>{ch.name}</option>
          ))}
        </select>

        <select
          value={filters.examType || ''}
          onChange={(e) => handleFilterChange('examType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Exam Types</option>
          {examTypes.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>

        <select
          value={filters.year || ''}
          onChange={(e) => handleFilterChange('year', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={filters.reviewStatus || ''}
          onChange={(e) => handleFilterChange('reviewStatus', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="edited">Edited</option>
          <option value="unresolved">Unresolved</option>
        </select>
      </div>

      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Active filters:</span>
          {Object.entries(filters).map(([key, value]) => {
            if (value === '' || value === undefined || value === null) return null;
            return (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-lg">
                {key}: {value}
                <X size={12} onClick={() => handleRemove(key)} className="cursor-pointer hover:text-primary-900" />
              </span>
            );
          })}
          <button
            onClick={(e) => { e.preventDefault(); onClear(); }}
            className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
