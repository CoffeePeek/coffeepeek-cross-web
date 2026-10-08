import PublicAddressPage from '../components/PublicAddressPage';
import React, { Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import WobbleRing from '../components/WobbleRing';
import { ProtectedRoute } from './ProtectedRoute';
import { AuthenticatedLayout } from '../components/layouts/AuthenticatedLayout';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Lazy load pages; retry via full reload if a deploy invalidated hashed chunks
const LandingPage = lazyWithRetry(() => import('../pages/LandingPage'));
const LoginPage = lazyWithRetry(() => import('../pages/LoginPage'));
const RegisterPage = lazyWithRetry(() => import('../pages/RegisterPage'));
const CoffeeShopListPage = lazyWithRetry(() => import('../pages/CoffeeShopListPage'));
const CatalogSearchPage = lazyWithRetry(() => import('../pages/CatalogSearchPage'));
const CoffeeDetailPage = lazyWithRetry(() => import('../pages/CoffeeDetailPage'));
const CoffeeShopDetailPage = lazyWithRetry(() => import('../pages/CoffeeShopPage'));
const CheckInEditorPage = lazyWithRetry(() => import('../pages/CheckInEditorPage'));
const UserProfilePage = lazyWithRetry(() => import('../pages/UserProfilePage'));
const ProfilePage = lazyWithRetry(() => import('../pages/ProfilePage'));
const DeleteAccountPage = lazyWithRetry(() => import('../pages/DeleteAccountPage'));
const CreateCoffeeShopPage = lazyWithRetry(() => import('../pages/CreateCoffeeShopPage'));
const CreateRoasterPage = lazyWithRetry(() => import('../pages/CreateRoasterPage'));
const RoasterDetailPage = lazyWithRetry(() => import('../pages/RoasterDetailPage'));
const SettingsPage = lazyWithRetry(() => import('../pages/SettingsPage'));
const ErrorPage = lazyWithRetry(() => import('../pages/ErrorPage'));
const PrivacyPolicyPage = lazyWithRetry(() => import('../pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazyWithRetry(() => import('../pages/TermsOfServicePage'));
const ConfirmEmailPage = lazyWithRetry(() => import('../pages/ConfirmEmailPage'));
const ConfirmAccountDeletionPage = lazyWithRetry(() => import('../pages/ConfirmAccountDeletionPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('../pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('../pages/ResetPasswordPage'));
const FeedPage = lazyWithRetry(() => import('../pages/FeedPage'));
const CheckInsPage = lazyWithRetry(() => import('../pages/CheckInsPage'));
const EditCoffeeShopPage = lazyWithRetry(() => import('../pages/EditCoffeeShopPage'));
const MyContributionsPage = lazyWithRetry(() => import('../pages/MyContributionsPage'));

const LegacyDashboardRedirect = () => {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const page = params.get('page');
  params.delete('page');
  const target = page === 'map' ? '/map' : page === 'home' || page === 'feed' ? '/feed' : page === 'settings' ? '/settings' : '/search';
  const remaining = params.toString();
  return <Navigate to={`${target}${remaining ? `?${remaining}` : ''}`} replace />;
};

const LegacyCheckInRedirect = ({ base }: { base: 'shops' | 'coffee-shops' }) => {
  const { shopId } = useParams<{ shopId: string }>();
  return <Navigate to={`/${base}/${encodeURIComponent(shopId ?? '')}/check-ins/new`} replace />;
};

const LegacyCityRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  return <Navigate to={`/shops?citySlug=${encodeURIComponent(slug ?? '')}`} replace />;
};

const LoadingFallback = () => {
  const { theme } = useTheme();
  return (
    <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#1A1412]' : 'bg-[#FAFAF9]'}`}>
      <WobbleRing size={48} />
    </div>
  );
};

const LogoutRoute = () => {
  const { logout } = useUser();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void logout().finally(() => navigate('/', { replace: true }));
  }, [logout, navigate]);

  return <LoadingFallback />;
};

export const AppRoutes: React.FC = () => {
  return (
    <ErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/search" element={<AuthenticatedLayout><CoffeeShopListPage /></AuthenticatedLayout>} />
        <Route path="/map" element={<AuthenticatedLayout><CoffeeShopListPage initialMapExpanded /></AuthenticatedLayout>} />
        <Route path="/roasters" element={<AuthenticatedLayout><CoffeeShopListPage initialSection="roasters" /></AuthenticatedLayout>} />
        <Route path="/coffees" element={<AuthenticatedLayout><CatalogSearchPage kind="coffees" /></AuthenticatedLayout>} />
        <Route path="/coffees/:slug" element={<AuthenticatedLayout><CoffeeDetailPage /></AuthenticatedLayout>} />
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logout" element={<LogoutRoute />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/confirm-email" element={<ConfirmEmailPage />} />
        <Route path="/confirm-account-deletion" element={<ConfirmAccountDeletionPage />} />
        <Route path="/profile/delete" element={<DeleteAccountPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/download" element={<Navigate to="/settings" replace />} />

        <Route path="/coffee-shops/:shopId" element={<AuthenticatedLayout><PublicAddressPage kind="shops" param="shopId"><CoffeeShopDetailPage /></PublicAddressPage></AuthenticatedLayout>} />
        <Route path="/cities/:slug" element={<LegacyCityRedirect />} />
        <Route path="/coffee-zones/:slug" element={<Navigate to="/map" replace />} />
        <Route path="/coffee-shops/:shopId/check-ins/new" element={<ProtectedRoute><AuthenticatedLayout><PublicAddressPage kind="shops" param="shopId"><CheckInEditorPage /></PublicAddressPage></AuthenticatedLayout></ProtectedRoute>} />
        <Route path="/coffee-shops/:shopId/check-ins/:checkInId/edit" element={<ProtectedRoute><AuthenticatedLayout><PublicAddressPage kind="shops" param="shopId"><CheckInEditorPage /></PublicAddressPage></AuthenticatedLayout></ProtectedRoute>} />
        <Route path="/coffee-shops/:shopId/edit" element={<ProtectedRoute><AuthenticatedLayout><PublicAddressPage kind="shops" param="shopId"><EditCoffeeShopPage /></PublicAddressPage></AuthenticatedLayout></ProtectedRoute>} />
        <Route path="/coffee-shops/:shopId/checkin" element={<LegacyCheckInRedirect base="coffee-shops" />} />
        <Route path="/feed" element={<AuthenticatedLayout><FeedPage /></AuthenticatedLayout>} />
        <Route path="/check-ins/:checkInId/edit" element={<ProtectedRoute><AuthenticatedLayout><CheckInEditorPage /></AuthenticatedLayout></ProtectedRoute>} />
        <Route path="/my/reviews" element={<Navigate to="/check-ins" replace />} />
        {/* Protected routes */}
        <Route path="/dashboard" element={<LegacyDashboardRedirect />} />

        <Route
          path="/shops"
          element={
            <AuthenticatedLayout>
              <CoffeeShopListPage />
            </AuthenticatedLayout>
          }
        />

        <Route
          path="/shops/:shopId"
          element={
            <AuthenticatedLayout>
              <PublicAddressPage kind="shops" param="shopId"><CoffeeShopDetailPage /></PublicAddressPage>
            </AuthenticatedLayout>
          }
        />

        <Route
          path="/shops/:shopId/check-ins/new"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <PublicAddressPage kind="shops" param="shopId"><CheckInEditorPage /></PublicAddressPage>
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/shops/:shopId/edit"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <PublicAddressPage kind="shops" param="shopId"><EditCoffeeShopPage /></PublicAddressPage>
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/my/:kind"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <MyContributionsPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/shops/:shopId/check-ins/:checkInId/edit"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <PublicAddressPage kind="shops" param="shopId"><CheckInEditorPage /></PublicAddressPage>
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />


        <Route
          path="/profile"
          element={
            <AuthenticatedLayout>
              <ProfilePage />
            </AuthenticatedLayout>
          }
        />

        <Route
          path="/users/:userId"
          element={
            <AuthenticatedLayout>
              <PublicAddressPage kind="users" param="userId"><UserProfilePage /></PublicAddressPage>
            </AuthenticatedLayout>
          }
        />

        <Route
          path="/coffee-shops/new"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <CreateCoffeeShopPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roasters/new"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <CreateRoasterPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/roasters/:roasterId"
          element={
            <AuthenticatedLayout>
              <RoasterDetailPage />
            </AuthenticatedLayout>
          }
        />

        <Route path="/shops/:shopId/checkin" element={<LegacyCheckInRedirect base="shops" />} />

        <Route
          path="/settings"
          element={
            <AuthenticatedLayout>
              <SettingsPage />
            </AuthenticatedLayout>
          }
        />

        <Route
          path="/check-ins"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <CheckInsPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reviews"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <Navigate to="/check-ins" replace />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />

        {/* Legacy redirects */}
        <Route path="/coffeeshops" element={<Navigate to="/shops" replace />} />
        <Route path="/shop-change-requests" element={<Navigate to="/my/edits" replace />} />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/error" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
};
