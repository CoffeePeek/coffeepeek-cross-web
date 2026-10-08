import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Shimmer from './Shimmer';

interface CheckInCardSkeletonProps {
  count?: number;
}

const CheckInCardSkeleton: React.FC<CheckInCardSkeletonProps> = ({ count = 3 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const cardBg = isDark ? 'bg-[#2D241F]' : 'bg-white';
  const borderColor = isDark ? 'border-[#3D2F28]' : 'border-[#E8E4E1]';

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`${cardBg} p-4 sm:p-5 rounded-[20px] border ${borderColor}`}
        >
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 flex-1">
              {/* Аватар */}
              <Shimmer width="48px" height="48px" circle />
              
              {/* Имя и дата */}
              <div className="flex-1">
                <Shimmer width="120px" height="16px" className="mb-2" />
                <Shimmer width="80px" height="12px" />
              </div>
            </div>
            
            <Shimmer width="24px" height="8px" />
          </div>
          
          {/* Заголовок чекина */}
          <Shimmer width="60%" height="20px" className="mb-2" />
          <Shimmer width="140px" height="20px" className="mb-3" />
          <Shimmer width="100%" height="56px" className="mb-4 rounded-2xl" />
          
          {/* Текст чекина */}
          <Shimmer width="100%" height="16px" className="mb-2" />
          <Shimmer width="90%" height="16px" className="mb-2" />
          <Shimmer width="80%" height="16px" />
          <Shimmer width="52px" height="24px" className="mt-5" />
        </div>
      ))}
    </>
  );
};

export default CheckInCardSkeleton;
