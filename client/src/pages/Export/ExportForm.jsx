import React, { useState } from 'react';
import { Download, FileSpreadsheet, Database, CheckCircle } from 'lucide-react';

const ExportForm = () => {
  const [filters, setFilters] = useState({
    format: 'csv',
    subject: '',
    chapter: '',
    year: '',
    examType: '',
    reviewStatus: '',
  });

  const subjects = [
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Biology', code: 'BIO' },
  ];

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleExport = () => {
    const params = { ...filters };
    delete params.format;
    if (params.subject) params.subject = params.subject;
    if (params.reviewStatus === '') delete params.reviewStatus;

    if (filters.format === 'excel') {
      window.open(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/questions?format=excel&${new URLSearchParams(params).toString()}`,
        '_blank'
      );
    } else {
      window.open(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/questions?format=csv&${new URLSearchParams(params).toString()}`,
        '_blank'
      );
    }
  };

  const handleExportReview = () => {
    window.open(
      `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/review-queue?format=${filters.format}`,
      '_blank'
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Export Questions</h1>
        <p className="text-gray-600">
          Export questions to CSV or Excel. Includes original values, AI suggestions, and approved answers.
        </p>
      </div>

      <div className="card mb-6">
        <h3 className="font-semibold text-lg mb-4">Export Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={filters.format}
              onChange={(e) => handleFilterChange('format', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="csv">CSV (.csv)</option>
              <option value="excel">Excel (.xlsx)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              value={filters.subject}
              onChange={(e) => handleFilterChange('subject', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chapter</label>
            <input
              type="text"
              value={filters.chapter}
              onChange={(e) => handleFilterChange('chapter', e.target.value)}
              placeholder="e.g. Mechanics"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input
              type="number"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              placeholder="e.g. 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
            <input
              type="text"
              value={filters.examType}
              onChange={(e) => handleFilterChange('examType', e.target.value)}
              placeholder="e.g. JEE"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Review Status</label>
            <select
              value={filters.reviewStatus}
              onChange={(e) => handleFilterChange('reviewStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="edited">Edited</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-lg mb-4">Export Actions</h3>
        <div className="space-y-3">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 btn-primary"
          >
            <Download size={18} />
            Export Questions ({filters.format.toUpperCase()})
          </button>
          <button
            onClick={handleExportReview}
            className="w-full flex items-center justify-center gap-2 btn-secondary"
          >
            <Download size={18} />
            Export Review Queue ({filters.format.toUpperCase()})
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          <p>Exported data includes:</p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Question text, options, and metadata</li>
            <li>Original answer key and explanation</li>
            <li>AI-suggested answer and explanation</li>
            <li>Approved answer and explanation (if reviewed)</li>
            <li>Review status, confidence, and reviewer info</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ExportForm;
