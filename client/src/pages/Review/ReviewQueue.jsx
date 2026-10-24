import React, { useState, useEffect, useCallback } from 'react';
import { reviewService, questionService, jobService } from '../../services/api';
import QuestionCard from '../../components/QuestionCard';
import { Loader2, Filter, Play } from 'lucide-react';

const ReviewQueue = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20, needsReview: true });
  const [options, setOptions] = useState({ subjects: [], chapters: {}, exam_types: [], years: [] });
  const [queueing, setQueueing] = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reviewService.getQueue(filters);
      setQuestions(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchOptions = useCallback(async () => {
    try {
      const response = await questionService.getOptions();
      setOptions(response.data.data);
    } catch (err) {
      console.error('Failed to fetch options:', err);
    }
  }, []);

  useEffect(() => {
    fetchOptions();
    fetchQueue();
  }, [fetchOptions, fetchQueue]);

  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1, limit: 20 });
  };

  const handleClear = () => {
    setFilters({ page: 1, limit: 20, needsReview: true });
  };

  const queueForVerification = async () => {
    if (filters.subject || filters.chapter) {
      setQueueing(true);
      try {
        const response = await jobService.queueVerification({
          subject: filters.subject,
          chapter: filters.chapter,
          needsReviewOnly: true,
        });
        alert(response.data.message);
      } catch (err) {
        alert('Failed to queue verification');
      } finally {
        setQueueing(false);
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Review Queue</h1>
        <button
          onClick={queueForVerification}
          disabled={queueing || !filters.subject}
          className="btn-primary text-sm"
        >
          {queueing ? 'Queueing...' : 'Queue AI Verification'}
        </button>
      </div>

      <div className="card mb-4">
        <FilterBar
          filters={{ ...filters, page: undefined, limit: undefined, needsReview: undefined }}
          onChange={handleFilterChange}
          onClear={handleClear}
          options={options}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No questions pending review.
          <button
            onClick={() => setFilters({ page: 1, limit: 20, needsReview: true })}
            className="ml-2 text-primary-600 hover:underline text-sm"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div>
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              onReviewClick={(q) => {
                window.location.href = `/questions/${q.id}`;
              }}
            />
          ))}
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
    </div>
  );
};

export default ReviewQueue;
