import React, { useState } from 'react';
import { Upload, FileText, Calendar, BookOpen, Type, MapPin } from 'lucide-react';

const PdfUploadForm = ({ subjects = [], chapters = {}, onSubmit, loading, onCancel }) => {
  const [files, setFiles] = useState([]);
  const [formData, setFormData] = useState({
    subject: '',
    chapter: '',
    examYear: new Date().getFullYear(),
    examType: '',
    source: '',
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setErrors((prev) => ({ ...prev, files: null }));
    if (selected.length === 0) return;

    const invalid = selected.filter(f => f.type !== 'application/pdf');
    if (invalid.length > 0) {
      setErrors((prev) => ({ ...prev, files: 'Only PDF files are allowed' }));
      return;
    }

    const oversized = selected.filter(f => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      setErrors((prev) => ({ ...prev, files: 'One or more files exceed 50MB limit' }));
      return;
    }

    setFiles(selected);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (files.length === 0) {
      setErrors((prev) => ({ ...prev, files: 'Please select at least one PDF file' }));
      return;
    }
    if (!formData.subject) {
      setErrors((prev) => ({ ...prev, subject: 'Please select a subject' }));
      return;
    }

    const data = new FormData();
    files.forEach((f) => data.append('pdfs', f));
    data.append('subject', formData.subject);
    if (formData.chapter) data.append('chapter', formData.chapter);
    if (formData.examYear) data.append('examYear', formData.examYear);
    if (formData.examType) data.append('examType', formData.examType);
    if (formData.source) data.append('source', formData.source);

    await onSubmit(data);
  };

  const availableChapters = chapters[formData.subject] || [];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          <FileText size={16} />
          PDF Files *
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary-400 transition-colors">
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer flex flex-col items-center justify-center py-4">
            <Upload size={32} className="text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">Click to select PDFs or drag and drop</span>
            <span className="text-xs text-gray-500 mt-1">
              {files.length > 0
                ? `${files.length} file(s) selected`
                : 'PDF files up to 50MB each'}
            </span>
          </label>
        </div>
        {errors.files && <p className="text-red-500 text-xs mt-1">{errors.files}</p>}

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-gray-400" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="text-red-500 hover:bg-red-50 p-1 rounded"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <BookOpen size={16} />
            Subject *
          </label>
          <select
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              errors.subject ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
          {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <MapPin size={16} />
            Chapter
          </label>
          <select
            name="chapter"
            value={formData.chapter}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={!formData.subject}
          >
            <option value="">All chapters</option>
            {availableChapters.map((ch) => (
              <option key={ch.id} value={ch.name}>{ch.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Calendar size={16} />
            Exam Year
          </label>
          <input
            type="number"
            name="examYear"
            value={formData.examYear}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            min="1900"
            max="2100"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
            <Type size={16} />
            Exam Type
          </label>
          <input
            type="text"
            name="examType"
            value={formData.examType}
            onChange={handleChange}
            placeholder="e.g. JEE, NEET, Board"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
          Source / Notes
        </label>
        <input
          type="text"
          name="source"
          value={formData.source}
          onChange={handleChange}
          placeholder="e.g. HC Verma, NCERT, XYZ Publications"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={loading}
        >
          {loading ? 'Uploading...' : `Upload ${files.length} PDF${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </form>
  );
};

export default PdfUploadForm;
