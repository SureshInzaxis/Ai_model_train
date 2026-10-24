import React, { useState } from 'react';

const ReviewPanel = ({ question, verification, onSave, onCancel }) => {
  const [action, setAction] = useState('approve');
  const [reviewerName, setReviewerName] = useState('');
  const [reason, setReason] = useState('');
  const [approvedAnswer, setApprovedAnswer] = useState(
    question.approved_answer_key || question.original_answer_key || ''
  );
  const [approvedExplanation, setApprovedExplanation] = useState(
    question.approved_explanation || question.original_explanation || ''
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    let result;

    if (action === 'approve') {
      result = await onSave('approve', { reviewerName, reason });
    } else if (action === 'reject') {
      result = await onSave('reject', { reviewerName, reason });
    } else if (action === 'edit') {
      result = await onSave('edit', {
        reviewerName,
        reason,
        approvedAnswerKey: approvedAnswer,
        approvedExplanation,
      });
    } else if (action === 'comment') {
      result = await onSave('comment', { reviewerName, reason });
    }

    return result;
  };

  const showEditFields = action === 'edit';

  return (
    <div className="card bg-gray-50">
      <h3 className="font-semibold text-lg mb-4">Review Action</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="approve">Approve AI Suggestion</option>
            <option value="reject">Reject (Keep Original)</option>
            <option value="edit">Edit (Custom Answer)</option>
            <option value="comment">Add Comment Only</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reviewer Name</label>
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Enter your name"
            required
          />
        </div>

        {showEditFields && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Answer Key</label>
              <select
                value={approvedAnswer}
                onChange={(e) => setApprovedAnswer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                {['A', 'B', 'C', 'D', 'E'].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explanation</label>
              <textarea
                value={approvedExplanation}
                onChange={(e) => setApprovedExplanation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 h-32"
                placeholder="Enter explanation..."
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 h-20"
            placeholder="Why are you choosing this action?"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewPanel;
