import React from 'react';
import CoffeeShopList from '../components/CoffeeShopList';
import { usePageTitle } from '../hooks/usePageTitle';

const CoffeeShopListPage: React.FC<{ initialSection?: 'roasters' }> = ({ initialSection }) => {
  usePageTitle('Поиск кофеен и обжарщиков');
  return <CoffeeShopList initialSection={initialSection} />;
};

export default CoffeeShopListPage;

