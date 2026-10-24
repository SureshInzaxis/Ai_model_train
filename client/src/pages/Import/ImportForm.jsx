import React, { useState } from 'react';
import { importService } from '../../services/api';
import { Upload, FileSpreadsheet, Database, AlertCircle } from 'lucide-react';

const ImportForm = () => {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('csv');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const subjects = [
    { name: 'Physics', code: 'PHY' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Biology', code: 'BIO' },
  ];

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError('Please select a file to import');
      return;
    }

    const formData = new FormData();
    formData.append('importFile', file);
    formData.append('format', format);
    if (subject) formData.append('subject', subject);
    if (chapter) formData.append('chapter', chapter);

    setLoading(true);

    try {
      const response = await importService.import(formData);
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const formatOptions = [
    { value: 'csv', label: 'CSV (.csv)', icon: FileSpreadsheet },
    { value: 'excel', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
    { value: 'json', label: 'JSON (.json)', icon: Database },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Import Existing Questions</h1>
        <p className="text-gray-600">
          Import your existing question bank (5,000+ questions) without creating duplicates.
          Supports CSV, Excel, and JSON formats.
        </p>
      </div>

      <div className="card mb-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Upload size={16} />
              Import File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={handleFileChange}
                className="hidden"
                id="import-file"
              />
              <label htmlFor="import-file" className="cursor-pointer">
                <FileSpreadsheet size={32} className="mx-auto text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {file ? file.name : 'Click to select import file'}
                </span>
                <span className="text-xs text-gray-500 block mt-1">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV, Excel, or JSON'}
                </span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              >
                {formatOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder="e.g. Algebra"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !file}
            >
              {loading ? 'Importing...' : 'Import Questions'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="card bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-800 mb-2">Import Complete</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-700">{result.data.successCount}</p>
              <p className="text-xs text-green-600">Imported</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700">{result.data.duplicateCount}</p>
              <p className="text-xs text-yellow-600">Duplicates</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{result.data.errorCount}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-700">{result.data.totalRows}</p>
              <p className="text-xs text-gray-500">Total Rows</p>
            </div>
          </div>
          <p className="text-sm text-green-800 mt-2">{result.message}</p>
        </div>
      )}

      <div className="card mt-6">
        <h3 className="font-semibold text-sm text-gray-700 mb-3">CSV Format Guide</h3>
        <div className="bg-gray-50 rounded-lg p-3 overflow-x-auto">
          <code className="text-xs text-gray-700 whitespace-pre">
{`question_number,subject,chapter,question_text,option_a,option_b,option_c,option_d,answer_key,explanation,exam_year,exam_type,source
1,PHY,Mechanics,What is the SI unit of force?,Newton,Nm,Joule,Watt,A,A force equals mass times acceleration,2024,JEE,Sample Paper
`}
          </code>
        </div>
      </div>
    </div>
  );
};

export default ImportForm;
