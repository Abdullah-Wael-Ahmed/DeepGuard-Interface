import React, { useState, useEffect, useRef } from 'react';

/**
 * Animated counter component with rolling number animation
 */
const AnimatedCounter = ({ 
  value, 
  duration = 1000, 
  prefix = '', 
  suffix = '',
  className = '',
  formatNumber = true 
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);
  const animationRef = useRef(null);

  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = typeof value === 'number' ? value : parseInt(value) || 0;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOut);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  const formattedValue = formatNumber 
    ? displayValue.toLocaleString() 
    : displayValue;

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formattedValue}{suffix}
    </span>
  );
};

/**
 * Animated percentage counter with optional progress ring
 */
export const AnimatedPercentage = ({ 
  value, 
  size = 60, 
  strokeWidth = 4,
  showRing = true,
  className = '' 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const progress = Math.min(Math.max(value, 0), 100);
    const newOffset = circumference - (progress / 100) * circumference;
    
    // Animate the offset
    const timeout = setTimeout(() => {
      setOffset(newOffset);
    }, 100);
    
    return () => clearTimeout(timeout);
  }, [value, circumference]);

  if (!showRing) {
    return <AnimatedCounter value={value} suffix="%" className={className} />;
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-sm font-bold">
        <AnimatedCounter value={value} suffix="%" formatNumber={false} />
      </span>
    </div>
  );
};

/**
 * Sparkline animation - mini inline chart
 */
export const Sparkline = ({ 
  data = [], 
  width = 80, 
  height = 24, 
  color = 'currentColor',
  animated = true 
}) => {
  const [isVisible, setIsVisible] = useState(!animated);
  
  useEffect(() => {
    if (animated) {
      const timeout = setTimeout(() => setIsVisible(true), 100);
      return () => clearTimeout(timeout);
    }
  }, [animated]);

  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg 
      width={width} 
      height={height} 
      className={`transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-1000"
        style={{
          strokeDasharray: isVisible ? 'none' : width * 2,
          strokeDashoffset: isVisible ? 0 : width * 2
        }}
      />
    </svg>
  );
};

export default AnimatedCounter;
