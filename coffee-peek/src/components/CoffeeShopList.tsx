import CatalogSearchPage from '../pages/CatalogSearchPage';

export default function CoffeeShopList(_props: { onShopSelect: (shopId: string) => void }) {
  return <CatalogSearchPage kind="shops" />;
}
