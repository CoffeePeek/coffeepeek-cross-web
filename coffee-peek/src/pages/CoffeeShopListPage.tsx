import React from 'react';
import CoffeeShopList from '../components/CoffeeShopList';
import { usePageTitle } from '../hooks/usePageTitle';

const CoffeeShopListPage: React.FC<{ initialSection?: 'roasters'; initialMapExpanded?: boolean }> = ({ initialSection, initialMapExpanded }) => {
  usePageTitle(initialMapExpanded ? 'Карта кофеен' : 'Поиск кофеен и обжарщиков');
  return <CoffeeShopList initialSection={initialSection} initialMapExpanded={initialMapExpanded} />;
};

export default CoffeeShopListPage;

