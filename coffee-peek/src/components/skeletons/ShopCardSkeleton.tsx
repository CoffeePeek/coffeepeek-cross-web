import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Shimmer from './Shimmer';

interface ShopCardSkeletonProps {
  count?: number;
  variant?: 'card' | 'row' | 'coffee' | 'roaster';
}

const ShopCardSkeleton: React.FC<ShopCardSkeletonProps> = ({ count = 6, variant = 'card' }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const surface = isDark ? '#2D241F' : '#ffffff';
  const border = isDark ? '#3D2F28' : '#E7E5E4';

  if (variant === 'row') {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: 12,
            background: surface, border: `1px solid ${border}`,
            borderRadius: 16,
          }}>
            {/* Square photo */}
            <Shimmer width={84} height={84} style={{ borderRadius: 12 }} />

            {/* Text content */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Name + rating */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Shimmer width="55%" height={16} />
                <Shimmer width={44} height={22} style={{ borderRadius: 6 }} />
              </div>
              {/* Status + address */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shimmer width={52} height={16} style={{ borderRadius: 6 }} />
                <Shimmer width="38%" height={13} />
              </div>
              {/* Tags */}
              <div style={{ display: 'flex', gap: 4 }}>
                <Shimmer width={60} height={22} style={{ borderRadius: 8 }} />
                <Shimmer width={72} height={22} style={{ borderRadius: 8 }} />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (variant === 'roaster') {
    return <>{Array.from({ length: count }, (_, i) => (
      <article key={i} aria-hidden="true" className="flex h-full min-w-0 flex-col rounded-2xl border p-4" style={{ background: surface, borderColor: border }}>
        <div className="mb-3 flex h-32 shrink-0 items-start gap-3">
          <Shimmer width={128} height={128} className="!rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-3">
            <Shimmer width="85%" height={28} />
            <div className="space-y-2"><Shimmer height={14} /><Shimmer height={14} /><Shimmer width="65%" height={14} /></div>
          </div>
        </div>
        <div className="mt-auto flex min-h-[53px] items-center gap-3 border-t pt-2" style={{ borderColor: border }}>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2"><Shimmer width={84} height={14} /><Shimmer width={76} height={14} /></div>
          <Shimmer width={44} height={44} circle />
        </div>
      </article>
    ))}</>;
  }

  const coffee = variant === 'coffee';
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <article key={i} aria-hidden="true" className="flex h-full min-w-0 flex-col" style={{
          background: surface, border: `1px solid ${border}`,
          borderRadius: 28, overflow: 'hidden',
        }}>
          <div className="relative aspect-[16/9] shrink-0 overflow-hidden">
            <Shimmer width="100%" height="100%" className="!rounded-none" />
            <div className={`absolute ${coffee ? 'bottom-3 right-4' : 'right-3 top-3'}`}><Shimmer width={coffee ? 48 : 44} height={coffee ? 48 : 44} circle style={{ background: surface }} /></div>
          </div>
          <div className="flex flex-1 flex-col gap-3 px-4 pb-4 pt-3">
            <Shimmer width="85%" height={24} />
            <Shimmer width={coffee ? '35%' : '65%'} height={coffee ? 16 : 20} />
            {!coffee && <Shimmer width="80%" height={20} />}
            <div className="flex flex-wrap gap-2">
              <Shimmer width={72} height={32} circle />
              <Shimmer width={80} height={32} circle />
              {coffee && <Shimmer width={60} height={32} circle />}
            </div>
            {coffee && <div className="mt-auto flex min-h-[49px] items-center justify-between gap-3 border-t pt-3" style={{ borderColor: border }}>
              <Shimmer width="34%" height={24} style={{ maxWidth: 88 }} />
              <Shimmer width="48%" height={36} circle style={{ maxWidth: 112 }} />
            </div>}
          </div>
        </article>
      ))}
    </>
  );
};

export default ShopCardSkeleton;
