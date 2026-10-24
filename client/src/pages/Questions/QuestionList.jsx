import React, { useState, useEffect, useCallback } from 'react';
import { questionService } from '../../services/api';
import QuestionCard from '../../components/QuestionCard';
import FilterBar from '../../components/FilterBar';
import { Loader2 } from 'lucide-react';

const QuestionList = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({ page: 1, limit: 20 });
  const [options, setOptions] = useState({ subjects: [], chapters: {}, exam_types: [], years: [] });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await questionService.list({
        page: filters.page,
        limit: filters.limit,
        ...filters,
      });
      setQuestions(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
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
    fetchQuestions();
  }, [fetchOptions, fetchQuestions]);

  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1, limit: 20 });
  };

  const handleClear = () => {
    setFilters({ page: 1, limit: 20 });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Question Bank</h1>
      </div>

      <FilterBar
        filters={{ ...filters, page: undefined, limit: undefined }}
        onChange={handleFilterChange}
        onClear={handleClear}
        options={options}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-600" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No questions found. Try adjusting your filters.</div>
      ) : (
        <div>
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} compact={true} />
          ))}
        </div>
      )}
    </div>
  );
};

export default QuestionList;
