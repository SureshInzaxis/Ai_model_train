import React from 'react';

const ProgressBar = ({ value = 0, max = 100, label, showPercentage = true, size = 'md' }) => {
  const percentage = Math.min(100, Math.max(0, (value / (max || 1)) * 100));
  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  const barColors = {
    low: 'bg-red-500',
    medium: 'bg-yellow-500',
    high: 'bg-green-500',
  };

  const color = percentage >= 80 ? barColors.high : percentage >= 50 ? barColors.medium : barColors.low;

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">{label}</span>
          {showPercentage && <span className="text-gray-500">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`h-full ${color} transition-all duration-300 ease-in-out`}
          style={{ width: percentage > 0 ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
