import React, { useState, useEffect, useCallback } from 'react';
import { questionService } from '../services/api';
import QuestionCard from '../components/QuestionCard';
import FilterBar from '../components/FilterBar';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;

  const { page, limit, total, pages } = pagination;
  const pageNumbers = [];
  const maxPages = 5;

  let start = Math.max(1, page - Math.floor(maxPages / 2));
  let end = Math.min(pages, start + maxPages - 1);

  if (end - start < maxPages - 1) {
    start = Math.max(1, end - maxPages + 1);
  }

  for (let i = start; i <= end; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex items-center justify-center mt-6 gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      {start > 1 && <span className="px-2 text-gray-400">...</span>}

      {pageNumbers.map((num) => (
        <button
          key={num}
          onClick={() => onPageChange(num)}
          className={`px-3 py-1 rounded-lg text-sm ${
            num === page
              ? 'bg-primary-600 text-white'
              : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          {num}
        </button>
      ))}

      {end < pages && <span className="px-2 text-gray-400">...</span>}

      <button
        onClick={() => onPageChange(Math.min(pages, page + 1))}
        disabled={page >= pages}
        className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

const DataTable = ({ initialFilters = {} }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [options, setOptions] = useState({ subjects: [], chapters: {}, examTypes: [], years: [] });

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await questionService.list({
        page: filters.page || 1,
        limit: filters.limit || 20,
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
  }, [fetchOptions]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleFilterChange = (newFilters) => {
    setFilters({ ...newFilters, page: 1 });
  };

  const handleClear = () => {
    setFilters({ page: 1, limit: 20 });
  };

  const handlePageChange = (newPage) => {
    setFilters({ ...filters, page: newPage });
  };

  return (
    <div>
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
        <div className="text-center py-12 text-gray-500">
          No questions found. Try adjusting your filters.
        </div>
      ) : (
        <div>
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}

          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
};

export default DataTable;
