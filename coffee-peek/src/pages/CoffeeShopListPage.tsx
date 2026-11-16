import React from 'react';
import CoffeeShopList from '../components/CoffeeShopList';
import { usePageTitle } from '../hooks/usePageTitle';
import { useBrowseCity } from '../hooks/useBrowseCity';

const CoffeeShopListPage: React.FC<{ initialSection?: 'roasters'; initialMapExpanded?: boolean }> = ({ initialSection, initialMapExpanded }) => {
  const { city } = useBrowseCity();
  usePageTitle(initialMapExpanded ? `Карта кофеен · ${city.name}` : 'Поиск кофеен и обжарщиков', initialMapExpanded
    ? { description: `Карта кофеен · ${city.name}. Адреса, часы работы и оценки посетителей на CoffeePeek.` }
    : undefined);
  return <CoffeeShopList initialSection={initialSection} initialMapExpanded={initialMapExpanded} />;
};

export default CoffeeShopListPage;

