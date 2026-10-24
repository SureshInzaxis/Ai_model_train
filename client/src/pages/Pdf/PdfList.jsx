import React, { useState, useEffect, useCallback } from 'react';
import { pdfService } from '../../services/api';
import { format } from 'date-fns';
import { FileText, Clock, CheckCircle, XCircle, Eye, Download, X, ExternalLink, GitCompare, AlertTriangle, Check, RefreshCw, Trash2 } from 'lucide-react';
import MathContent from '../../components/MathContent';

const PdfList = () => {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [viewingPdf, setViewingPdf] = useState(null);
  const [comparingPdf, setComparingPdf] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [comparingLoading, setComparingLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [verifyingPdf, setVerifyingPdf] = useState(false);
  const [savingCorrected, setSavingCorrected] = useState(false);

  const fetchPdfs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await pdfService.list(filters);
      setPdfs(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to fetch PDFs:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters]);

  const handleDeletePdf = async (pdf) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${pdf.filename}" from the PDF list?\n\n(Note: All questions already extracted and saved into the database will remain safe and will NOT be deleted.)`
    );
    if (!confirmed) return;

    try {
      setDeletingId(pdf.id);
      await pdfService.delete(pdf.id);
      // Remove from local state
      setPdfs((prev) => prev.filter((p) => p.id !== pdf.id));
    } catch (err) {
      console.error('Failed to delete PDF:', err);
      alert('Failed to delete PDF: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, [fetchPdfs]);

  useEffect(() => {
    const busy = pdfs.some((pdf) => pdf.status === 'processing' || pdf.status === 'uploaded');
    if (!busy) return undefined;
    const timer = setInterval(() => fetchPdfs(true), 4000);
    return () => clearInterval(timer);
  }, [pdfs, fetchPdfs]);

  useEffect(() => {
    if (!comparingPdf) return undefined;
    const hasPendingAi = comparisonData?.comparisons?.some(
      (item) => item.aiStatus && item.aiStatus !== 'done' && item.aiStatus !== 'failed'
    );
    if (!hasPendingAi) return undefined;
    const timer = setInterval(async () => {
      try {
        const res = await pdfService.compare(comparingPdf.id);
        setComparisonData(res.data.data);
      } catch {
        // keep last snapshot
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [comparingPdf, comparisonData]);

  const openComparison = async (pdf) => {
    setComparingPdf(pdf);
    setComparingLoading(true);
    try {
      const res = await pdfService.compare(pdf.id);
      setComparisonData(res.data.data);
    } catch (e) {
      console.error('Failed to compare PDF:', e);
      alert('Failed to match PDF questions against the database.');
    } finally {
      setComparingLoading(false);
    }
  };

  const runDeepSeek = async () => {
    if (!comparingPdf) return;
    setVerifyingPdf(true);
    try {
      await pdfService.verify(comparingPdf.id);
      const res = await pdfService.compare(comparingPdf.id);
      setComparisonData(res.data.data);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to start Qwen verification');
    } finally {
      setVerifyingPdf(false);
    }
  };

  const saveCorrectedBank = async () => {
    if (!comparingPdf) return;
    setSavingCorrected(true);
    try {
      const res = await pdfService.saveCorrected(comparingPdf.id);
      alert(res.data.message);
      const refreshed = await pdfService.compare(comparingPdf.id);
      setComparisonData(refreshed.data.data);
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to store corrected questions');
    } finally {
      setSavingCorrected(false);
    }
  };

  const renderContentWithImages = (content) => {
    if (!content) return <span className="italic text-gray-400">Not provided</span>;
    return <MathContent text={content} />;
  };

  const renderExplanation = (explanation, emptyLabel) => (
    <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-200 text-gray-700">
      <span className="font-semibold text-gray-900 block mb-0.5">Explanation:</span>
      {explanation && String(explanation).trim()
        ? <MathContent text={explanation} />
        : <span className="italic text-amber-700">{emptyLabel}</span>}
    </div>
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'processing': return <Clock size={16} className="text-yellow-500 animate-spin" />;
      case 'processed': return <CheckCircle size={16} className="text-green-500" />;
      case 'failed': return <XCircle size={16} className="text-red-500" />;
      case 'uploaded': return <FileText size={16} className="text-gray-400" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Uploaded PDFs</h1>
          <p className="text-sm text-gray-500 mt-1">
            After processing, click the compare icon to see each PDF question next to the matching 50k-database question, including subject, chapter, and answer.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : pdfs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No PDFs uploaded yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Filename</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Subject</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Chapter</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Year</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Size</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Questions</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Uploaded</th>
                <th className="px-4 py-3 text-sm font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {pdfs.map((pdf) => (
                <tr key={pdf.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{getStatusIcon(pdf.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-gray-400" />
                      <span className="text-sm font-medium">{pdf.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {pdf.subject?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">{pdf.chapter?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{pdf.exam_year || '-'}</td>
                  <td className="px-4 py-3 text-sm">{formatFileSize(pdf.file_size)}</td>
                  <td className="px-4 py-3 text-sm font-medium">{pdf.question_count || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(pdf.created_at), 'PP')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setViewingPdf(pdf)}
                        className="text-primary-600 hover:text-primary-700 p-1.5 rounded hover:bg-primary-50 transition-colors"
                        title="View PDF Content"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => openComparison(pdf)}
                        className="text-indigo-600 hover:text-indigo-700 p-1.5 rounded hover:bg-indigo-50 transition-colors"
                        title="Match with Database (50k Question Bank)"
                      >
                        <GitCompare size={18} />
                      </button>
                      <button
                        onClick={() => handleDeletePdf(pdf)}
                        disabled={deletingId === pdf.id}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Delete this PDF (keeps database questions safe)"
                      >
                        {deletingId === pdf.id ? (
                          <RefreshCw size={18} className="animate-spin text-red-500" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
            const pageNum = i + 1;
            return (
              <button
                key={pageNum}
                onClick={() => setFilters({ ...filters, page: pageNum })}
                className={`px-3 py-1 rounded-lg text-sm ${
                  pageNum === filters.page
                    ? 'bg-primary-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
      )}

      {/* Comparison Modal */}
      {comparingPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <GitCompare className="text-indigo-600" size={22} />
                <div>
                  <h3 className="font-semibold text-gray-900 leading-tight">
                    PDF vs 50k Database: {comparingPdf.filename}
                  </h3>
                  <p className="text-xs text-gray-500">
                    If a question exists in the database, its subject, chapter, and answer are shown. Qwen then finds wrong answers or explanations.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={runDeepSeek}
                  disabled={verifyingPdf}
                  className="btn-secondary text-xs"
                >
                  {verifyingPdf ? 'Starting Qwen...' : 'Find issues with Qwen'}
                </button>
                <button
                  onClick={saveCorrectedBank}
                  disabled={savingCorrected}
                  className="btn-primary text-xs"
                >
                  {savingCorrected ? 'Saving...' : 'Save to corrected bank'}
                </button>
                <button
                  onClick={() => {
                    setComparingPdf(null);
                    setComparisonData(null);
                  }}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {comparingLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                  <RefreshCw className="animate-spin text-indigo-600" size={32} />
                  <p className="text-sm font-medium">Comparing extracted questions against 50,000+ database records...</p>
                </div>
              ) : comparisonData ? (
                <div>
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Extracted</div>
                      <div className="text-2xl font-bold text-gray-900 mt-1">{comparisonData.totalQuestions}</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-emerald-700 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Check size={14} /> New Questions
                      </div>
                      <div className="text-2xl font-bold text-emerald-800 mt-1">{comparisonData.summary.new}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-blue-700 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <FileText size={14} /> Found in Database
                      </div>
                      <div className="text-2xl font-bold text-blue-800 mt-1">{comparisonData.summary.matched ?? comparisonData.summary.duplicates}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
                      <div className="text-xs text-amber-700 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <AlertTriangle size={14} /> Answer Conflicts
                      </div>
                      <div className="text-2xl font-bold text-amber-800 mt-1">{comparisonData.summary.conflicts}</div>
                    </div>
                  </div>

                  {/* Comparisons List */}
                  {comparisonData.comparisons.length === 0 ? (
                    <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-200">
                      No extracted questions found in this PDF document yet.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {comparisonData.comparisons.map((item, idx) => {
                        const pdfQ = item.pdfQuestion || {
                          questionNumber: item.questionNumber,
                          questionText: item.questionText,
                          subject: 'N/A',
                          chapter: 'N/A',
                          answerKey: 'N/A',
                        };
                        const dbQ = item.matchedQuestion;

                        return (
                          <div
                            key={idx}
                            className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                              item.status === 'conflict'
                                ? 'border-amber-400 ring-2 ring-amber-100'
                                : item.status === 'duplicate' || item.status === 'matched'
                                ? 'border-blue-300'
                                : 'border-emerald-300'
                            }`}
                          >
                            {/* Card Header Status Bar */}
                            <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80 gap-2">
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-gray-900 text-sm">
                                  Comparison #{idx + 1}
                                </span>
                                <span
                                  className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider ${
                                    item.status === 'conflict'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : item.status === 'duplicate' || item.status === 'matched'
                                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  }`}
                                >
                                  {item.status === 'conflict'
                                    ? 'Answer Conflict'
                                    : item.status === 'duplicate' || item.status === 'matched'
                                    ? `Found in DB (${item.similarity}% match)`
                                    : 'Not in database'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {item.issueType && (
                                  <span className="text-xs font-medium text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200">
                                    Qwen: {item.issueType.replace(/_/g, ' ')}
                                  </span>
                                )}
                                {item.corrected?.subject && (
                                  <span className="text-xs font-medium text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                                    Subject: {item.corrected.subject}
                                  </span>
                                )}
                                {item.corrected?.chapter && (
                                  <span className="text-xs font-medium text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                                    Chapter: {item.corrected.chapter}
                                  </span>
                                )}
                                {item.issue && (
                                  <span className="text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                                    {item.issue}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Side-by-Side Comparison Layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                              {/* Left Column: PDF Extracted Question */}
                              <div className="p-5 bg-white flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-100">
                                    <span className="font-semibold text-xs tracking-wider uppercase text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                                      📄 Uploaded PDF Question
                                    </span>
                                    <span className="text-xs text-gray-500 font-medium">
                                      Q#{pdfQ.questionNumber}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 mb-3 text-xs">
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                                      Subject: {pdfQ.subject || 'General'}
                                    </span>
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                                      Chapter: {pdfQ.chapter || 'All Chapters'}
                                    </span>
                                  </div>

                                  <div className="text-sm font-medium text-gray-900 leading-relaxed mb-4 whitespace-pre-wrap">
                                    {renderContentWithImages(pdfQ.questionText)}
                                  </div>

                                  {/* Cropped PDF Diagram / Snippet */}
                                  {pdfQ.diagramUrl && (
                                    <div className="mb-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <span>📐 Extracted Diagram / Equation Snippet:</span>
                                      </div>
                                      <img
                                        src={pdfQ.diagramUrl}
                                        alt={`Diagram for Q#${pdfQ.questionNumber}`}
                                        className="max-h-56 max-w-full rounded border border-gray-300 shadow-xs bg-white object-contain"
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                      />
                                    </div>
                                  )}

                                  {/* Options */}
                                  <div className="space-y-1.5 mb-4">
                                    <div className="text-xs font-semibold text-gray-500 mb-1">Options:</div>
                                    {['A', 'B', 'C', 'D'].map((optKey) => {
                                      const optVal = pdfQ[`option${optKey}`];
                                      const isCorrect = pdfQ.answerKey && pdfQ.answerKey.toUpperCase().includes(optKey);
                                      return (
                                        <div
                                          key={optKey}
                                          className={`text-xs p-2 rounded border flex items-start gap-2 ${
                                            isCorrect
                                              ? 'bg-emerald-50 border-emerald-300 font-medium text-emerald-900'
                                              : optVal
                                              ? 'bg-gray-50/70 border-gray-200 text-gray-700'
                                              : 'bg-gray-50/30 border-dashed border-gray-200 text-gray-400 italic'
                                          }`}
                                        >
                                          <span className="font-bold min-w-[16px]">{optKey}.</span>
                                          <div className="flex-1">{optVal ? renderContentWithImages(optVal) : 'Not detected'}</div>
                                          {isCorrect && (
                                            <span className="ml-auto text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                              Correct
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="pt-3 border-t border-gray-100 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-gray-600">Correct Answer:</span>
                                    <span className="font-bold text-sm text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                      {pdfQ.answerKey || 'N/A'}
                                    </span>
                                  </div>
                                  {renderExplanation(
                                    pdfQ.explanation,
                                    'No explanation in the PDF extract. Qwen will generate a full explanation.'
                                  )}
                                </div>
                              </div>

                              {/* Right Column: Database Matched Question */}
                              <div className="p-5 bg-slate-50/50 flex flex-col justify-between">
                                {dbQ ? (
                                  <div>
                                    <div>
                                      <div className="flex items-center justify-between pb-2 mb-3 border-b border-gray-200">
                                        <span className="font-semibold text-xs tracking-wider uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                          Database question (subject & chapter from 50k bank)
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                          ID: {dbQ.stableId || dbQ.id}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 mb-3 text-xs">
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                          Subject: {dbQ.subject || 'All'}
                                        </span>
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">
                                          Chapter: {dbQ.chapter || 'All Chapters'}
                                        </span>
                                      </div>

                                      <div className="text-sm font-medium text-gray-900 leading-relaxed mb-4 whitespace-pre-wrap">
                                        {renderContentWithImages(dbQ.questionText)}
                                      </div>

                                      {/* Options */}
                                      <div className="space-y-1.5 mb-4">
                                        <div className="text-xs font-semibold text-gray-500 mb-1">Options:</div>
                                        {['A', 'B', 'C', 'D'].map((optKey) => {
                                          const optVal = dbQ[`option${optKey}`];
                                          const isCorrect = dbQ.answerKey && dbQ.answerKey.toUpperCase().includes(optKey);
                                          return (
                                            <div
                                              key={optKey}
                                              className={`text-xs p-2 rounded border flex items-start gap-2 ${
                                                isCorrect
                                                  ? 'bg-emerald-50 border-emerald-300 font-medium text-emerald-900'
                                                  : optVal
                                                  ? 'bg-white border-gray-200 text-gray-700'
                                                  : 'bg-white/40 border-dashed border-gray-200 text-gray-400 italic'
                                              }`}
                                            >
                                              <span className="font-bold min-w-[16px]">{optKey}.</span>
                                              <div className="flex-1">{optVal ? renderContentWithImages(optVal) : 'Not provided'}</div>
                                              {isCorrect && (
                                                <span className="ml-auto text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                                  Correct
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    <div className="pt-3 border-t border-gray-200 space-y-2">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-gray-600">Correct Answer:</span>
                                        <span className="font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                          {dbQ.answerKey || 'N/A'}
                                        </span>
                                      </div>
                                      {renderExplanation(
                                        dbQ.explanation,
                                        'No explanation in the database. Qwen will generate a full explanation.'
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                                      <Check size={24} />
                                    </div>
                                    <div className="text-sm font-semibold text-gray-700">No Duplicate Found</div>
                                    <p className="text-xs text-gray-500 mt-1 max-w-xs">
                                      This question is completely unique and does not match any of the 50,000+ questions in the database.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {item.corrected && (
                              <div className="px-5 py-4 bg-emerald-50/70 border-t border-emerald-100">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                                    Corrected result (option + explanation)
                                  </span>
                                  <span className="font-bold text-sm text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                                    Correct option: {item.corrected.answerKey || 'Pending Qwen'}
                                  </span>
                                </div>
                                {renderExplanation(
                                  item.corrected.explanation,
                                  'Explanation not generated yet. Click “Find issues with Qwen”.'
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {viewingPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <FileText className="text-primary-600" size={20} />
                <div>
                  <h3 className="font-semibold text-gray-900 leading-tight">{viewingPdf.filename}</h3>
                  <p className="text-xs text-gray-500">
                    {viewingPdf.subject?.name || 'General'} {viewingPdf.chapter?.name ? `• ${viewingPdf.chapter.name}` : ''} • {formatFileSize(viewingPdf.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={pdfService.getViewUrl(viewingPdf.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  title="Open in new browser tab"
                >
                  <ExternalLink size={14} />
                  Open in New Tab
                </a>
                <button
                  onClick={() => setViewingPdf(null)}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Close Preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body / PDF Frame */}
            <div className="flex-1 bg-gray-100 relative">
              <iframe
                src={pdfService.getViewUrl(viewingPdf.id)}
                title={viewingPdf.filename}
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfList;
