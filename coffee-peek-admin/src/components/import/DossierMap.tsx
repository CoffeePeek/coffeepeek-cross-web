import React from 'react';
import { ImportCandidate } from '../../api/import';
import { mapTabSrc } from '../../utils/importDossier';

interface DossierMapProps {
  candidate?: ImportCandidate | null;
}

export const DossierMap: React.FC<DossierMapProps> = ({ candidate }) => {
  const embed = candidate ? mapTabSrc(candidate).embed : '';

  return (
    <section className="relative flex flex-col min-h-[280px] lg:min-h-0 flex-1 bg-[#cfd8c8] dark:bg-stone-800">
      {embed ? (
        <iframe
          key={`${candidate?.id}-${embed}`}
          title="Точка кандидата"
          src={embed}
          className="flex-1 w-full min-h-[280px] border-0"
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="flex-1 min-h-[280px] flex items-center justify-center text-sm text-text-muted">
          {candidate ? 'Нет координат для карты' : 'Выберите точку из списка'}
        </div>
      )}
    </section>
  );
};
