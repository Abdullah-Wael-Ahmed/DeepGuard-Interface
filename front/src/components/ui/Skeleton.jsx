import React from 'react';

/**
 * Skeleton loader component for placeholder loading states
 */
export const Skeleton = ({ className = '', variant = 'rectangular', animation = 'pulse' }) => {
  const baseClasses = 'bg-gray-700/50';
  const animationClass = animation === 'pulse' ? 'animate-pulse' : 'animate-shimmer';
  
  const variantClasses = {
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return (
    <div 
      className={`${baseClasses} ${animationClass} ${variantClasses[variant]} ${className}`}
    />
  );
};

/**
 * Skeleton card for dashboard-style loading
 */
export const SkeletonCard = () => (
  <div className="bg-card-dark rounded-xl border border-gray-800 p-6 space-y-4">
    <div className="flex justify-between items-start">
      <Skeleton className="h-4 w-24" />
      <Skeleton variant="circular" className="h-8 w-8" />
    </div>
    <Skeleton className="h-10 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
);

/**
 * Skeleton table row
 */
export const SkeletonTableRow = ({ columns = 5 }) => (
  <tr className="border-b border-gray-800">
    {[...Array(columns)].map((_, i) => (
      <td key={i} className="p-4">
        <Skeleton className="h-4 w-full max-w-[120px]" />
      </td>
    ))}
  </tr>
);

/**
 * Skeleton chart placeholder
 */
export const SkeletonChart = ({ height = 300 }) => (
  <div className={`w-full rounded-lg overflow-hidden`} style={{ height }}>
    <div className="h-full w-full bg-gradient-to-t from-gray-800/50 to-transparent animate-pulse flex items-end justify-around px-4 pb-4">
      {[40, 60, 30, 80, 50, 70, 45].map((h, i) => (
        <div 
          key={i} 
          className="w-8 bg-gray-700/50 rounded-t animate-pulse"
          style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  </div>
);

/**
 * Full page skeleton loader
 */
export const PageSkeleton = () => (
  <div className="flex-1 p-8 space-y-8 animate-pulse">
    {/* Header */}
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
    
    {/* Charts */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card-dark rounded-xl border border-gray-800 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <SkeletonChart />
      </div>
      <div className="bg-card-dark rounded-xl border border-gray-800 p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <SkeletonChart />
      </div>
    </div>
  </div>
);

export default Skeleton;
