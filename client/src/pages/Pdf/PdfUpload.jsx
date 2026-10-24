import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionService } from '../../services/api';
import PdfUploadForm from '../../components/PdfUploadForm';
import { FileText, Clock, CheckCircle } from 'lucide-react';

const PdfUpload = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [chapters, setChapters] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const fetchOptions = useCallback(async () => {
    try {
      const questionOpts = await questionService.getOptions();
      const optsData = questionOpts.data?.data || {};
      setSubjects(optsData.subjects || [
        { name: 'Physics', code: 'PHY' },
        { name: 'Chemistry', code: 'CHEM' },
        { name: 'Mathematics', code: 'MATH' },
        { name: 'Biology', code: 'BIO' },
      ]);
      setChapters(optsData.chapters || {});
    } catch (err) {
      console.error('Failed to fetch options:', err);
      setSubjects([
        { name: 'Physics', code: 'PHY' },
        { name: 'Chemistry', code: 'CHEM' },
        { name: 'Mathematics', code: 'MATH' },
        { name: 'Biology', code: 'BIO' },
      ]);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleUpload = async (formData) => {
    setLoading(true);
    setUploadProgress(null);

    try {
      const xhr = new XMLHttpRequest();
      const formDataObj = formData;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percent);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          alert(`${response.message}\n\nThe PDF is being extracted and matched against your 50k question bank. Open PDFs to see subject, chapter, and answers from the database.`);
          setUploadProgress(null);
          navigate('/pdfs');
        } else {
          const response = JSON.parse(xhr.responseText);
          alert(`Upload failed: ${response.message || response.error}`);
        }
        setLoading(false);
      });

      xhr.addEventListener('error', () => {
        alert('Upload failed. Please try again.');
        setLoading(false);
      });

      xhr.open('POST', `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/pdfs/upload`);
      xhr.send(formDataObj);
    } catch (err) {
      console.error('Upload error:', err);
      alert(`Upload failed: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Upload PDF Question Papers</h1>
        <p className="text-gray-600">
          Upload the printed question paper. Each extracted question is matched to your 50k local database.
          If it exists, the database question, answer, subject, and chapter are shown. Qwen then flags wrong answers, explanations, or question text. Fixed questions are stored in the Corrected Bank.
        </p>
      </div>

      <div className="card mb-6">
        <PdfUploadForm
          subjects={subjects}
          chapters={chapters}
          onSubmit={handleUpload}
          loading={loading}
        />
      </div>

      {uploadProgress !== null && (
        <div className="card">
          <h3 className="font-medium mb-2">Upload Progress</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
            <div
              className="bg-primary-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">{uploadProgress}% uploaded</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-6 text-center">
        <div className="card">
          <FileText size={24} className="mx-auto text-primary-600 mb-1" />
          <p className="text-2xl font-bold text-gray-800">50,000+</p>
          <p className="text-xs text-gray-500">Questions to process</p>
        </div>
        <div className="card">
          <Clock size={24} className="mx-auto text-yellow-600 mb-1" />
          <p className="text-2xl font-bold text-gray-800">Batch</p>
          <p className="text-xs text-gray-500">Processing in batches of 10</p>
        </div>
        <div className="card">
          <CheckCircle size={24} className="mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold text-gray-800">Auto-Detect</p>
          <p className="text-xs text-gray-500">Text-based and scanned PDFs</p>
        </div>
      </div>
    </div>
  );
};

export default PdfUpload;
