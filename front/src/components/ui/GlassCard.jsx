import React from 'react';

/**
 * Glassmorphism Card component with blur and transparency effects
 */
const GlassCard = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = true,
  glow = false,
  borderColor = 'gray'
}) => {
  const variants = {
    default: 'bg-card-dark/80 backdrop-blur-md',
    glass: 'bg-white/5 backdrop-blur-xl',
    frosted: 'bg-gray-900/60 backdrop-blur-lg',
    solid: 'bg-card-dark backdrop-blur-none'
  };

  const borderColors = {
    gray: 'border-gray-800 hover:border-gray-600',
    primary: 'border-primary/20 hover:border-primary/50',
    red: 'border-red-500/20 hover:border-red-500/50',
    yellow: 'border-yellow-500/20 hover:border-yellow-500/50',
    green: 'border-green-500/20 hover:border-green-500/50'
  };

  const glowEffect = glow 
    ? 'shadow-[0_0_30px_rgba(var(--color-primary-rgb),0.15)]' 
    : 'shadow-lg';

  const hoverEffect = hover 
    ? 'transition-all duration-300 hover:scale-[1.01] hover:shadow-xl' 
    : '';

  return (
    <div className={`
      ${variants[variant]}
      ${borderColors[borderColor]}
      ${glowEffect}
      ${hoverEffect}
      rounded-xl border
      ${className}
    `}>
      {children}
    </div>
  );
};

/**
 * Stat Card with glassmorphism effect
 */
export const GlassStatCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  trendUp = true,
  color = 'primary',
  className = '' 
}) => {
  const colorClasses = {
    primary: 'text-primary',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400'
  };

  return (
    <GlassCard 
      variant="glass" 
      borderColor={color === 'primary' ? 'primary' : color}
      glow
      className={`p-6 ${className}`}
    >
      <div className="flex justify-between items-start mb-4">
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        {Icon && (
          <div className={`p-2 rounded-lg bg-${color}-500/10`}>
            <Icon className={colorClasses[color]} size={20} />
          </div>
        )}
      </div>
      <p className="text-white text-3xl font-bold mb-2">{value}</p>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2">
          {trend && (
            <span className={`text-sm font-medium ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </span>
          )}
          {subtitle && (
            <span className="text-gray-500 text-sm">{subtitle}</span>
          )}
        </div>
      )}
    </GlassCard>
  );
};

/**
 * Alert Card with severity-based styling
 */
export const GlassAlertCard = ({ 
  severity = 'info', 
  title, 
  message, 
  timestamp,
  onAction,
  actionLabel = 'View'
}) => {
  const severityConfig = {
    critical: { 
      border: 'border-red-500/30', 
      bg: 'bg-red-500/5',
      icon: '🔴',
      text: 'text-red-400'
    },
    high: { 
      border: 'border-orange-500/30', 
      bg: 'bg-orange-500/5',
      icon: '🟠',
      text: 'text-orange-400'
    },
    medium: { 
      border: 'border-yellow-500/30', 
      bg: 'bg-yellow-500/5',
      icon: '🟡',
      text: 'text-yellow-400'
    },
    low: { 
      border: 'border-green-500/30', 
      bg: 'bg-green-500/5',
      icon: '🟢',
      text: 'text-green-400'
    },
    info: { 
      border: 'border-blue-500/30', 
      bg: 'bg-blue-500/5',
      icon: '🔵',
      text: 'text-blue-400'
    }
  };

  const config = severityConfig[severity] || severityConfig.info;

  return (
    <div className={`
      ${config.bg} ${config.border}
      backdrop-blur-md border rounded-lg p-4
      transition-all duration-300 hover:scale-[1.01]
    `}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium ${config.text} truncate`}>{title}</h4>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">{message}</p>
          {timestamp && (
            <p className="text-gray-600 text-xs mt-2">{timestamp}</p>
          )}
        </div>
        {onAction && (
          <button 
            onClick={onAction}
            className={`${config.text} text-sm font-medium hover:underline flex-shrink-0`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default GlassCard;
