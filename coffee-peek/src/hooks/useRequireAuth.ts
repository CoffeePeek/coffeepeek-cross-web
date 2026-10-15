import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { captureAnalyticsEvent } from '../lib/analytics';

/**
 * Redirects unauthenticated users to /login with return path in location state.
 */
export function useRequireAuth() {
  const { user, isLoading } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = useCallback((feature?: unknown): boolean => {
    if (isLoading) return false;
    if (user) return true;
    captureAnalyticsEvent('auth_gate_shown', { feature: typeof feature === 'string' ? feature : 'unspecified' });
    navigate('/login', { state: { from: location } });
    return false;
  }, [user, isLoading, navigate, location]);

  return { user, isLoading, requireAuth };
}
