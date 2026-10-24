import React from 'react';
import MathContent from './MathContent';

const getStatusColor = (status) => {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    edited: 'bg-blue-100 text-blue-800',
    unresolved: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getConfidenceColor = (confidence) => {
  if (confidence >= 80) return 'text-green-600';
  if (confidence >= 60) return 'text-yellow-600';
  if (confidence >= 40) return 'text-orange-600';
  return 'text-red-600';
};

const getIssueTypeLabel = (issueType) => {
  const labels = {
    correct: { text: 'Correct', color: 'bg-green-100 text-green-800' },
    possible_key_error: { text: 'Key Error', color: 'bg-red-100 text-red-800' },
    incorrect_explanation: { text: 'Bad Explanation', color: 'bg-orange-100 text-orange-800' },
    ambiguous_question: { text: 'Ambiguous', color: 'bg-yellow-100 text-yellow-800' },
    missing_info: { text: 'Missing Info', color: 'bg-purple-100 text-purple-800' },
    extraction_error: { text: 'Extraction Error', color: 'bg-red-100 text-red-800' },
    needs_review: { text: 'Needs Review', color: 'bg-gray-100 text-gray-800' },
  };
  return labels[issueType] || { text: issueType || 'N/A', color: 'bg-gray-100 text-gray-800' };
};

const QuestionCard = ({ question, onReviewClick, compact = false }) => {
  if (!question) return null;

  const hasOptions = question.option_a || question.option_b || question.option_c || question.option_d;
  const isUncertain = question.warnings?.length > 0 || question.is_uncertain;
  const latestVerification = question.verification_results?.[0];
  const issueType = latestVerification?.issue_type;
  const issueLabel = issueType ? getIssueTypeLabel(issueType) : null;

  if (compact) {
    return (
      <div className="card p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Q{question.question_number}
              </span>
              {question.subject && (
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  {question.subject.name}
                </span>
              )}
              {question.chapter && (
                <span className="text-xs text-gray-500">{question.chapter.name}</span>
              )}
            </div>
            <div className="text-sm text-gray-800 line-clamp-3">
              <MathContent text={question.question_text || ''} />
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {question.original_answer_key && (
              <span className="text-sm font-medium text-gray-600">Answer: {question.original_answer_key}</span>
            )}
            {issueLabel && (
              <span className={`badge ${issueLabel.color}`}>{issueLabel.text}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            Q{question.question_number}
          </span>
          {question.exam_year && (
            <span className="text-xs text-gray-500">{question.exam_year}</span>
          )}
          {question.exam_type && (
            <span className="text-xs text-gray-400">· {question.exam_type}</span>
          )}
          {question.subject && (
            <span className="text-xs font-medium text-primary-600">{question.subject.name}</span>
          )}
        </div>
        <span className={`badge ${getStatusColor(question.review_status)}`}>
          {question.review_status}
        </span>
      </div>

      <div className="text-gray-800 mb-4">
        <MathContent text={question.question_text || ''} />
      </div>

      {hasOptions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
          {['A', 'B', 'C', 'D'].map((letter) => {
            const optKey = `option_${letter.toLowerCase()}`;
            const value = question[optKey];
            if (!value) return null;
            const isCorrect = question.original_answer_key === letter;
            return (
              <div
                key={letter}
                className={`p-3 border rounded-lg text-sm ${
                  isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-200'
                }`}
              >
                <span className="font-medium">{letter})</span>{' '}
                <MathContent text={value} className="inline-block" />
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Original Answer:</span>
          <span className="font-bold text-gray-800">{question.original_answer_key || 'N/A'}</span>
        </div>

        <div>
          <span className="text-xs text-gray-500">Explanation:</span>
          {question.original_explanation || question.suggested_explanation || question.approved_explanation ? (
            <div className="text-sm text-gray-600 mt-1">
              <MathContent
                text={question.approved_explanation || question.suggested_explanation || question.original_explanation}
              />
            </div>
          ) : (
            <p className="text-sm italic text-amber-700 mt-1">No explanation in the database. Run Qwen analysis to generate one.</p>
          )}
        </div>

        {latestVerification && (
          <>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium text-gray-600">AI Suggested:</span>
              <span className="font-bold text-blue-700">{latestVerification.suggested_answer}</span>
            </div>

            <div>
              <span className={`text-xs font-medium ${getConfidenceColor(latestVerification.confidence)}`}>
                Confidence: {latestVerification.confidence}%
              </span>
              {latestVerification.reason && (
                <p className="text-sm text-gray-600 mt-1">{latestVerification.reason}</p>
              )}
            </div>

            {latestVerification.suggested_explanation && (
              <div>
                <span className="text-xs text-gray-500">AI Explanation:</span>
                <div className="text-sm text-gray-600 mt-1">
                  <MathContent text={latestVerification.suggested_explanation} />
                </div>
              </div>
            )}
          </>
        )}

        {isUncertain && question.warnings && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mt-2">
            <span className="text-xs text-yellow-800 font-medium">Warnings:</span>
            {question.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 mt-1">• {w}</p>
            ))}
          </div>
        )}
      </div>

      {onReviewClick && (
        <div className="mt-4 pt-3 border-t flex gap-2">
          <button
            onClick={() => onReviewClick(question)}
            className="btn-primary text-sm"
          >
            Review
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
