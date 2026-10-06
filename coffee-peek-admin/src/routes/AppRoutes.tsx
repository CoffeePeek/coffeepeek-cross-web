import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { useUser } from '../contexts/UserContext';

const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ShopsModerationPage = lazy(() => import('../pages/ShopsModerationPage').then((m) => ({ default: m.ShopsModerationPage })));
const ShopEditPage = lazy(() => import('../pages/ShopEditPage').then((m) => ({ default: m.ShopEditPage })));
const ReviewsModerationPage = lazy(() => import('../pages/ReviewsModerationPage').then((m) => ({ default: m.ReviewsModerationPage })));
const ShopReportsPage = lazy(() => import('../pages/ShopReportsPage').then((m) => ({ default: m.ShopReportsPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const CachePage = lazy(() => import('../pages/CachePage').then((m) => ({ default: m.CachePage })));
const AuditModerationPage = lazy(() => import('../pages/AuditModerationPage').then((m) => ({ default: m.AuditModerationPage })));
const ShopTagsPage = lazy(() => import('../pages/ShopTagsPage').then((m) => ({ default: m.ShopTagsPage })));
const CatalogManagementPage = lazy(() => import('../pages/CatalogManagementPage').then((m) => ({ default: m.CatalogManagementPage })));
const PublishedShopsPage = lazy(() => import('../pages/PublishedShopsPage').then((m) => ({ default: m.PublishedShopsPage })));
const PublishedShopEditPage = lazy(() => import('../pages/PublishedShopEditPage').then((m) => ({ default: m.PublishedShopEditPage })));
const RoastersModerationPage = lazy(() => import('../pages/RoastersModerationPage').then((m) => ({ default: m.RoastersModerationPage })));
const RoasterModerationDetailPage = lazy(() => import('../pages/RoasterModerationDetailPage').then((m) => ({ default: m.RoasterModerationDetailPage })));
const RoasterEditPage = lazy(() => import('../pages/RoasterEditPage').then((m) => ({ default: m.RoasterEditPage })));
const CoffeesPage = lazy(() => import('../pages/CoffeesPage').then(m => ({ default: m.CoffeesPage })));
const CoffeeEditPage = lazy(() => import('../pages/CoffeeEditPage').then(m => ({ default: m.CoffeeEditPage })));
const CoffeeImportPage = lazy(() => import('../pages/CoffeeImportPage').then(m => ({ default: m.CoffeeImportPage })));
const CoffeeDictionariesPage = lazy(() => import('../pages/CoffeeDictionariesPage').then(m => ({ default: m.CoffeeDictionariesPage })));
const RoasterTagsPage = lazy(() => import('../components/RoasterTagAssignments').then(m => ({ default: m.RoasterTagsPage })));
const OwnerShopsPage = lazy(() => import('../pages/OwnerShopsPage').then((m) => ({ default: m.OwnerShopsPage })));
const OwnerShopEditPage = lazy(() => import('../pages/OwnerShopEditPage').then((m) => ({ default: m.OwnerShopEditPage })));
const BrowseShopsPage = lazy(() => import('../pages/BrowseShopsPage').then((m) => ({ default: m.BrowseShopsPage })));
const BrowseShopPage = lazy(() => import('../pages/BrowseShopPage').then((m) => ({ default: m.BrowseShopPage })));
const BrowseMapPage = lazy(() => import('../pages/BrowseMapPage').then((m) => ({ default: m.BrowseMapPage })));
const CoffeeZonesPage = lazy(() => import('../pages/CoffeeZonesPage').then((m) => ({ default: m.CoffeeZonesPage })));
const CoffeeZoneEditorPage = lazy(() => import('../pages/CoffeeZoneEditorPage').then((m) => ({ default: m.CoffeeZoneEditorPage })));
const ImportQueuePage = lazy(() => import('../pages/ImportQueuePage').then((m) => ({ default: m.ImportQueuePage })));
const ImportDuplicatesPage = lazy(() =>
  import('../pages/ImportDuplicatesPage').then((m) => ({ default: m.ImportDuplicatesPage }))
);
const AppDistributionPage = lazy(() =>
  import('../pages/AppDistributionPage').then((m) => ({ default: m.AppDistributionPage }))
);
const ShopChangeRequestsPage = lazy(() => import('../pages/ShopChangeRequestsPage').then((m) => ({ default: m.ShopChangeRequestsPage })));
const ReviewReportsPage = lazy(() => import('../pages/ReviewReportsPage').then((m) => ({ default: m.ReviewReportsPage })));
const ShopChangeRequestDetailPage = lazy(() => import('../pages/ShopChangeRequestDetailPage').then((m) => ({ default: m.ShopChangeRequestDetailPage })));

const Loader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);

const LogoutRoute = () => {
  const { logout } = useUser();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logout().finally(() => navigate('/login', { replace: true }));
  }, [logout, navigate]);

  return <Loader />;
};

export const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/logout" element={<LogoutRoute />} />
    <Route
      path="/login"
      element={
        <Suspense fallback={<Loader />}>
          <LoginPage />
        </Suspense>
      }
    />

    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/coffees" element={<ProtectedRoute requireModerator><CoffeesPage /></ProtectedRoute>} />
        <Route path="/coffees/:id" element={<ProtectedRoute requireModerator><CoffeeEditPage /></ProtectedRoute>} />
        <Route path="/coffee-import" element={<ProtectedRoute requireModerator><CoffeeImportPage /></ProtectedRoute>} />
        <Route path="/roaster-tags" element={<ProtectedRoute requireModerator><CoffeeDictionariesPage key="tags" kind="tags" /></ProtectedRoute>} />
        <Route path="/roaster-tags/assignments/:id" element={<ProtectedRoute requireModerator><RoasterTagsPage /></ProtectedRoute>} />
        <Route path="/coffee-filter-values" element={<ProtectedRoute requireModerator><CoffeeDictionariesPage key="values" kind="values" /></ProtectedRoute>} />
        <Route path="/review-reports" element={<ProtectedRoute requireAdmin><ReviewReportsPage /></ProtectedRoute>} />

        <Route path="/coffee-shops" element={<BrowseShopsPage />} />
        <Route path="/coffee-shops/:id" element={<BrowseShopPage />} />
        <Route path="/map" element={<BrowseMapPage />} />

        <Route path="/coffee-zones" element={<ProtectedRoute requireModerator><CoffeeZonesPage /></ProtectedRoute>} />
        <Route path="/coffee-zones/new" element={<ProtectedRoute requireModerator><CoffeeZoneEditorPage /></ProtectedRoute>} />
        <Route path="/coffee-zones/:id" element={<ProtectedRoute requireModerator><CoffeeZoneEditorPage /></ProtectedRoute>} />

        <Route
          path="/shops"
          element={
            <ProtectedRoute requireModerator>
              <ShopsModerationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shops/:id"
          element={
            <ProtectedRoute requireModerator>
              <ShopEditPage />
            </ProtectedRoute>
          }
        />

        <Route path="/import/inbox" element={<Navigate to="/import?panel=list" replace />} />
        <Route path="/import/stats" element={<Navigate to="/import?panel=stats" replace />} />
        <Route
          path="/import/duplicates"
          element={
            <ProtectedRoute requireModerator>
              <ImportDuplicatesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import/:id?"
          element={
            <ProtectedRoute requireModerator>
              <ImportQueuePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reviews"
          element={
            <ProtectedRoute requireModerator>
              <ReviewsModerationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shop-change-requests"
          element={<ProtectedRoute requireModerator><ShopChangeRequestsPage /></ProtectedRoute>}
        />
        <Route
          path="/shop-change-requests/:id"
          element={<ProtectedRoute requireModerator><ShopChangeRequestDetailPage /></ProtectedRoute>}
        />

        <Route
          path="/shop-reports"
          element={
            <ProtectedRoute requireModerator>
              <ShopReportsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/published-shops"
          element={
            <ProtectedRoute requireAdmin>
              <PublishedShopsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/published-shops/:id"
          element={
            <ProtectedRoute requireAdmin>
              <PublishedShopEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/roasters"
          element={
            <ProtectedRoute requireModerator>
              <RoastersModerationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roasters/:id"
          element={
            <ProtectedRoute requireModerator>
              <RoasterModerationDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/published-roasters"
          element={<Navigate to="/catalogs?kind=roasters" replace />}
        />
        <Route
          path="/published-roasters/:id"
          element={
            <ProtectedRoute requireAdmin>
              <RoasterEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/catalogs/roasters/:id"
          element={
            <ProtectedRoute requireAdmin>
              <RoasterEditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalogs"
          element={
            <ProtectedRoute requireAdmin>
              <CatalogManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/shop-tags"
          element={
            <ProtectedRoute requireAdmin>
              <ShopTagsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/audit"
          element={
            <ProtectedRoute requireAdmin>
              <AuditModerationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute requireAdmin>
              <UsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cache"
          element={
            <ProtectedRoute requireAdmin>
              <CachePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app-distribution"
          element={
            <ProtectedRoute requireAdmin>
              <AppDistributionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-shops"
          element={
            <ProtectedRoute requireOwner>
              <OwnerShopsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-shops/:id"
          element={
            <ProtectedRoute requireOwner>
              <OwnerShopEditPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
);
