import React, { useState, useEffect, useCallback } from 'react';
import { jobService } from '../services/api';
import ProgressBar from '../components/ProgressBar';
import { formatDistanceToNow } from 'date-fns';
import { Clock, CheckCircle, XCircle, Play } from 'lucide-react';

const JobStatus = ({ job }) => {
  const statusIcons = {
    pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100' },
    running: { icon: Play, color: 'text-blue-500 animate-pulse', bg: 'bg-blue-100' },
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
    cancelled: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
    paused: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  };

  const { icon: Icon, color, bg } = statusIcons[job.status] || statusIcons.pending;

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded ${bg}`}>
            <Icon size={16} className={color} />
          </div>
          <span className="font-medium capitalize">{job.status}</span>
          <span className="text-xs text-gray-500">
            {job.type === 'extraction' ? 'PDF Extraction' : 'AI Verification'}
          </span>
        </div>
        {job.created_at && (
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
          </span>
        )}
      </div>

      {job.total_items > 0 && (
        <ProgressBar
          value={job.processed_items || 0}
          max={job.total_items}
          label={`${job.processed_items || 0} / ${job.total_items} items`}
          showPercentage={false}
        />
      )}

      {job.error && (
        <p className="text-xs text-red-600 mt-2 break-words">{job.error.substring(0, 200)}</p>
      )}

      {job.status === 'failed' && job.result && (
        <button
          onClick={() => {}}
          className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
        >
          Retry job
        </button>
      )}
    </div>
  );
};

const ProgressBar_component = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await jobService.list({ limit: 50 });
      setJobs(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return <div className="text-center py-8 text-gray-500">No active jobs</div>;
  }

  return (
    <div>
      <h3 className="font-semibold mb-3">Active Jobs</h3>
      {jobs.map((job) => (
        <JobStatus key={job.id} job={job} />
      ))}
    </div>
  );
};

export default ProgressBar_component;
