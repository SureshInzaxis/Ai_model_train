import React, { useCallback, useEffect, useState } from 'react';
import { correctedService } from '../../services/api';
import { Check, Pencil, RefreshCw, Save } from 'lucide-react';
import MathContent from '../../components/MathContent';

const issueLabel = (type) => {
  const map = {
    correct: 'Correct',
    wrong_answer: 'Wrong answer',
    wrong_explanation: 'Wrong explanation',
    wrong_question: 'Wrong question',
    wrong_options: 'Wrong options',
    answer_conflict: 'Answer conflict',
    needs_review: 'Needs review',
  };
  return map[type] || type || 'Not checked';
};

const CorrectedList = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20, stored: '' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await correctedService.list(filters);
      setRows(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to load corrected questions:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleApprove = async (id) => {
    await correctedService.approve(id);
    fetchRows();
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await correctedService.edit(editing.id, {
        questionText: editing.question_text,
        optionA: editing.option_a,
        optionB: editing.option_b,
        optionC: editing.option_c,
        optionD: editing.option_d,
        answerKey: editing.answer_key,
        explanation: editing.explanation,
        subjectName: editing.subject_name,
        chapterName: editing.chapter_name,
      });
      setEditing(null);
      fetchRows();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Corrected Question Bank</h1>
          <p className="text-sm text-gray-500 mt-1">
            Final stored questions after PDF matching and Qwen review. Subject and chapter come from the original 50k database record.
          </p>
        </div>
        <button onClick={fetchRows} className="btn-secondary text-sm inline-flex items-center gap-2">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card mb-4 flex flex-wrap gap-3">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.stored || ''}
          onChange={(e) => setFilters({ ...filters, stored: e.target.value, page: 1 })}
        >
          <option value="true">Stored in new table</option>
          <option value="false">Not stored yet</option>
          <option value="">All drafts</option>
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.issueType || ''}
          onChange={(e) => setFilters({ ...filters, issueType: e.target.value, page: 1 })}
        >
          <option value="">All issues</option>
          <option value="correct">Correct</option>
          <option value="wrong_answer">Wrong answer</option>
          <option value="wrong_explanation">Wrong explanation</option>
          <option value="wrong_question">Wrong question</option>
          <option value="answer_conflict">Answer conflict</option>
          <option value="needs_review">Needs review</option>
        </select>
        <input
          className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px]"
          placeholder="Search question, subject, chapter..."
          value={filters.search || ''}
          onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No corrected questions yet. Upload a PDF, wait for matching, then save from the PDFs page.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border rounded-xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-medium">
                    Subject: {row.subject_name || row.subject?.name || 'Unknown'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-medium">
                    Chapter: {row.chapter_name || row.chapter?.name || 'Unknown'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    Q#{row.question_number || '-'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800">
                    {issueLabel(row.issue_type)}
                  </span>
                  {row.stored_at && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">Stored</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-secondary text-xs inline-flex items-center gap-1"
                    onClick={() => setEditing({ ...row })}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    className="btn-primary text-xs inline-flex items-center gap-1"
                    onClick={() => handleApprove(row.id)}
                  >
                    <Check size={12} /> Approve & store
                  </button>
                </div>
              </div>

              <div className="text-sm text-gray-900 mb-3">
                <MathContent text={row.question_text} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-3">
                {['a', 'b', 'c', 'd'].map((key) => (
                  <div
                    key={key}
                    className={`p-2 rounded border ${
                      String(row.answer_key || '').toUpperCase().includes(key.toUpperCase())
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-gray-50'
                    }`}
                  >
                    <strong>{key.toUpperCase()}.</strong>{' '}
                    <MathContent text={row[`option_${key}`] || '—'} className="inline-block" />
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <span className="font-medium">Correct option:</span>{' '}
                <span className="text-primary-700 font-semibold">{row.answer_key || 'N/A'}</span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                <span className="font-semibold text-gray-900 block mb-1">Explanation:</span>
                {row.explanation && String(row.explanation).trim()
                  ? <MathContent text={row.explanation} />
                  : <span className="italic text-amber-700">No explanation yet. Run Qwen analysis.</span>}
              </div>
              {row.ai_reason && (
                <p className="text-xs text-amber-800 mt-2 bg-amber-50 border border-amber-100 rounded p-2">
                  Qwen: {row.ai_reason}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex justify-center mt-6 gap-2">
          {Array.from({ length: Math.min(pagination.pages, 8) }, (_, i) => (
            <button
              key={i + 1}
              onClick={() => setFilters({ ...filters, page: i + 1 })}
              className={`px-3 py-1 rounded-lg text-sm ${
                i + 1 === filters.page ? 'bg-primary-600 text-white' : 'border text-gray-600'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-4">Edit corrected question</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                value={editing.subject_name || ''}
                onChange={(e) => setEditing({ ...editing, subject_name: e.target.value })}
                placeholder="Subject"
              />
              <input
                className="border rounded-lg px-3 py-2 text-sm"
                value={editing.chapter_name || ''}
                onChange={(e) => setEditing({ ...editing, chapter_name: e.target.value })}
                placeholder="Chapter"
              />
            </div>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
              rows={4}
              value={editing.question_text || ''}
              onChange={(e) => setEditing({ ...editing, question_text: e.target.value })}
            />
            {['a', 'b', 'c', 'd'].map((key) => (
              <input
                key={key}
                className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
                value={editing[`option_${key}`] || ''}
                onChange={(e) => setEditing({ ...editing, [`option_${key}`]: e.target.value })}
                placeholder={`Option ${key.toUpperCase()}`}
              />
            ))}
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
              value={editing.answer_key || ''}
              onChange={(e) => setEditing({ ...editing, answer_key: e.target.value })}
              placeholder="Answer key (A/B/C/D)"
            />
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
              rows={3}
              value={editing.explanation || ''}
              onChange={(e) => setEditing({ ...editing, explanation: e.target.value })}
              placeholder="Explanation"
            />
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary inline-flex items-center gap-1" onClick={handleSaveEdit} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : 'Save to corrected bank'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorrectedList;
