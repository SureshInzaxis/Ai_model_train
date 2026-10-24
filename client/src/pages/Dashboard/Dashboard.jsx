import React, { useState, useEffect, useCallback } from 'react';
import { healthService, pdfService, questionService, jobService } from '../../services/api';
import StatsGrid from '../../components/StatsGrid';
import JobStatus from '../../components/JobStatus';
import { Activity, Database, Cpu, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({});
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        healthService.getStats().catch(() => ({ data: { stats: {} } })),
        healthService.check().catch(() => ({ data: { checks: {} } })),
      ]);

      setStats(statsRes.data?.stats || {});
      setHealth(healthRes.data || null);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const getHealthStatus = () => {
    if (!health?.checks) return { label: 'Unknown', color: 'text-gray-500 bg-gray-100' };
    const { database, redis, ollama } = health.checks;
    if (database && ollama) {
      return { label: 'All Systems Operational', color: 'text-green-700 bg-green-50' };
    }
    return { label: 'Degraded', color: 'text-yellow-700 bg-yellow-50' };
  };

  const healthStatus = getHealthStatus();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={fetchStats}
          className="p-2 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-gray-100 transition-colors"
          disabled={loading}
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className={`px-3 py-1 rounded-lg text-sm font-medium ${healthStatus.color}`}>
          <Activity size={14} className="inline mr-1" />
          {healthStatus.label}
        </div>
        {lastUpdated && (
          <span className="text-xs text-gray-500">
            Last updated: {format(lastUpdated, 'PPpp')}
          </span>
        )}
      </div>

      {health?.checks && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className={`card text-center ${health.checks.database ? 'border-green-200' : 'border-red-200'}`}>
            <Database size={24} className={`mx-auto mb-1 ${health.checks.database ? 'text-green-500' : 'text-red-500'}`} />
            <p className="font-medium">PostgreSQL</p>
            <p className={`text-xs ${health.checks.database ? 'text-green-600' : 'text-red-600'}`}>
              {health.checks.database ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className={`card text-center ${health.checks.redis ? 'border-green-200' : 'border-red-200'}`}>
            <Cpu size={24} className={`mx-auto mb-1 ${health.checks.redis ? 'text-green-500' : 'text-red-500'}`} />
            <p className="font-medium">Redis</p>
            <p className={`text-xs ${health.checks.redis ? 'text-green-600' : 'text-red-600'}`}>
              {health.checks.redis ? 'Connected' : 'Disconnected'}
            </p>
          </div>
          <div className={`card text-center ${!health.checks.ollama ? 'border-red-200' : 'border-green-200'}`}>
            <Cpu size={24} className={`mx-auto mb-1 ${health.checks.ollama ? 'text-green-500' : 'text-red-500'}`} />
            <p className="font-medium">Ollama</p>
            <p className="text-xs text-gray-500 mt-1">
              {health.checks.ollama
                ? `Model: ${health.checks.ollama_models?.join(', ') || 'Active'}`
                : 'Not available'}
            </p>
          </div>
        </div>
      )}

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Question Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pending AI Verification</span>
              <span className="font-medium text-yellow-600">{stats.pending_ai || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Flagged for Review</span>
              <span className="font-medium text-orange-600">{stats.flagged_review || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Approved</span>
              <span className="font-medium text-green-600">{stats.approved || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Rejected</span>
              <span className="font-medium text-red-600">{stats.rejected || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Unresolved</span>
              <span className="font-medium text-gray-600">{stats.unresolved || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Extraction Failures</span>
              <span className="font-medium text-red-600">{stats.extraction_failures || 0}</span>
            </div>
          </div>
        </div>

        <JobStatus />
      </div>
    </div>
  );
};

export default Dashboard;
