import React from 'react';

const StatsGrid = ({ stats = {}, onRefresh }) => {
  const cards = [
    {
      title: 'PDFs Uploaded',
      value: stats.pdf_documents || 0,
      icon: '📄',
      color: 'bg-blue-50 border-blue-200 text-blue-600',
    },
    {
      title: 'Questions Extracted',
      value: stats.questions || 0,
      icon: '❓',
      color: 'bg-purple-50 border-purple-200 text-purple-600',
    },
    {
      title: 'Pending AI Analysis',
      value: stats.pending_ai || stats.pending_review || 0,
      icon: '🤖',
      color: 'bg-yellow-50 border-yellow-200 text-yellow-600',
    },
    {
      title: 'Needs Review',
      value: stats.flagged_review || 0,
      icon: '⚠️',
      color: 'bg-orange-50 border-orange-200 text-orange-600',
    },
    {
      title: 'Approved',
      value: stats.approved || 0,
      icon: '✅',
      color: 'bg-green-50 border-green-200 text-green-600',
    },
    {
      title: 'Rejected',
      value: stats.rejected || 0,
      icon: '❌',
      color: 'bg-red-50 border-red-200 text-red-600',
    },
    {
      title: 'Unresolved',
      value: stats.unresolved || 0,
      icon: '❓',
      color: 'bg-gray-50 border-gray-200 text-gray-600',
    },
    {
      title: 'Extraction Failures',
      value: stats.extraction_failures || 0,
      icon: '💥',
      color: 'bg-red-50 border-red-200 text-red-600',
    },
    {
      title: 'Stored in Corrected Bank',
      value: stats.corrected_stored || 0,
      icon: '📚',
      color: 'bg-teal-50 border-teal-200 text-teal-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`card border-2 ${card.color} transition-transform hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.title}</p>
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            </div>
            <div className="text-3xl">{card.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
