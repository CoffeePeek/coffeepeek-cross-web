import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import Shimmer from './Shimmer';

const ShopDetailSkeleton: React.FC = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const panel = 'rounded-[24px] border p-5';
  const panelStyle = { background: dark ? '#2B211C' : '#FFFFFF', borderColor: dark ? '#46362F' : '#E7E5E4' };

  return <div role="status" aria-label="Загрузка кофейни" className="min-h-screen overflow-x-hidden pb-28" style={{ background: dark ? '#171210' : '#F8F7F5' }}>
    <section aria-hidden="true" className="relative mx-auto h-[320px] max-w-7xl overflow-hidden rounded-b-[28px] sm:mt-6 sm:h-[420px] sm:rounded-[28px] lg:h-[520px]">
      <div className="grid h-full grid-cols-1 md:grid-cols-12 md:grid-rows-2 md:gap-3">
        <Shimmer height="100%" className="!rounded-none md:col-span-8 md:row-span-2" />
        <Shimmer height="100%" className="hidden !rounded-none md:col-span-4 md:block" />
        <Shimmer height="100%" className="hidden !rounded-none md:col-span-4 md:block" />
      </div>
      <div className="absolute inset-x-5 top-5 flex justify-between lg:hidden">
        <Shimmer width={48} height={48} circle />
        <div className="flex gap-2">{[0, 1, 2].map(i => <Shimmer key={i} width={48} height={48} circle />)}</div>
      </div>
      <div className="absolute inset-x-5 bottom-5 space-y-2">
        <Shimmer width="55%" height={32} />
        <Shimmer width="40%" height={20} />
      </div>
    </section>
    <main aria-hidden="true" className="mx-auto max-w-[920px] space-y-7 px-4 py-6 sm:px-6 sm:py-8">
      <section>
        <div className="mb-6 hidden items-center justify-between gap-4 lg:flex">
          <Shimmer width="40%" height={32} /><div className="flex gap-2"><Shimmer width={44} height={44} circle /><Shimmer width={120} height={44} circle /></div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[0, 1, 2].map(i => <div key={i} className="space-y-2 rounded-[22px] p-4" style={panelStyle}><Shimmer width="75%" height={24} /><Shimmer height={12} /></div>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><Shimmer width={90} height={32} circle /><Shimmer width={112} height={32} circle /><Shimmer width={76} height={32} circle /></div>
      </section>
      <section className="space-y-3">
        <Shimmer width={160} height={28} />
        <div className={`${panel} space-y-3`} style={panelStyle}><Shimmer height={16} /><Shimmer width="95%" height={16} /><Shimmer width="70%" height={16} /></div>
      </section>
      <section className="space-y-3">
        <Shimmer width={112} height={28} />
        <div className={`${panel} space-y-5`} style={panelStyle}>{[0, 1, 2].map(i => <div key={i} className="flex items-center justify-between gap-6"><Shimmer width="45%" height={20} /><Shimmer width={56} height={20} /></div>)}</div>
      </section>
      <div className={`${panel} flex items-center gap-4`} style={panelStyle}><Shimmer width={48} height={48} className="!rounded-2xl" /><div className="min-w-0 flex-1"><Shimmer height={20} /></div><Shimmer width={72} height={16} /></div>
    </main>
    <div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-[1150] flex items-center gap-2 border-t px-4 py-3 lg:hidden" style={{ ...panelStyle, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
      <Shimmer width={48} height={48} circle /><div className="flex-1"><Shimmer height={48} circle /></div><div className="flex-1"><Shimmer height={48} circle /></div>
    </div>
  </div>;
};

export default ShopDetailSkeleton;
