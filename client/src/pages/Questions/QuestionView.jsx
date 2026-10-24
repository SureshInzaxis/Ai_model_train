import React, { useState, useEffect, useCallback } from 'react';
import { questionService, reviewService } from '../../services/api';
import QuestionCard from '../../components/QuestionCard';
import ReviewPanel from '../../components/ReviewPanel';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';

const QuestionView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    try {
      const response = await questionService.getById(id);
      setQuestion(response.data.data);
    } catch (err) {
      console.error('Failed to fetch question:', err);
      alert('Failed to load question');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  const handleReviewSave = async (action, data) => {
    setActionLoading(true);
    try {
      let response;
      if (action === 'approve') {
        response = await reviewService.approve(id, data);
      } else if (action === 'reject') {
        response = await reviewService.reject(id, data);
      } else if (action === 'edit') {
        response = await reviewService.edit(id, data);
      } else if (action === 'comment') {
        response = await reviewService.comment(id, data);
      }
      await fetchQuestion();
      setShowReview(false);
      alert(`Action '${action}' completed successfully`);
    } catch (err) {
      console.error('Review action failed:', err);
      alert('Failed to save review action');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={32} className="animate-spin text-primary-600" />
      </div>
    );
  }

  if (!question) {
    return <div className="text-center py-12 text-gray-500">Question not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">Question {question.question_number}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <QuestionCard question={question} onReviewClick={() => setShowReview(true)} />
        </div>

        <div>
          {showReview ? (
            <ReviewPanel
              question={question}
              verification={question.verification_results?.[0]}
              onSave={handleReviewSave}
              onCancel={() => setShowReview(false)}
            />
          ) : (
            <div className="card">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-2">
                <button onClick={() => setShowReview(true)} className="btn-primary w-full text-sm">
                  Review Suggestion
                </button>
                <button
                  onClick={() => setShowReview(true)}
                  className="btn-secondary w-full text-sm"
                >
                  View History
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionView;
