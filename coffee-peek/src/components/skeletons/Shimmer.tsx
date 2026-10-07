import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface ShimmerProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  circle?: boolean;
  style?: React.CSSProperties;
}

const Shimmer: React.FC<ShimmerProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  circle = false,
  style,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer ${isDark ? 'skeleton-shimmer-dark' : ''} ${circle ? 'rounded-full' : 'rounded-lg'} ${className}`}
      style={{
        width,
        height,
        background: isDark ? '#3D2F28' : '#ECEAE7',
        flexShrink: 0,
        ...style,
      }}
    />
  );
};

export default Shimmer;
