import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { subscribeSessionInvalidated } from '../realtime/forceLogout';
import { logger } from '../utils/logger';

const SessionRealtime: React.FC = () => {
  const { user, clearSession } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const handlingRef = useRef(false);
  const hub = useRef<typeof import('../realtime/sessionHub') | null>(null);
  // Путь читаем через ref: иначе хаб переподключается на каждой навигации.
  const pathnameRef = useRef(location.pathname);
  pathnameRef.current = location.pathname;

  useEffect(() => {
    let active = true;
    // Сбрасываем защиту от повторного выхода только для новой сессии.
    if (user?.id) handlingRef.current = false;

    const endSession = (reason: string) => {
      if (handlingRef.current) return;
      handlingRef.current = true;
      active = false;
      void hub.current?.stopSessionHub();
      clearSession();
      const loginPath = `/login?reason=${encodeURIComponent(reason)}`;
      if (!pathnameRef.current.startsWith('/login')) {
        navigate(loginPath, { replace: true });
      }
    };

    const unsubscribe = subscribeSessionInvalidated(endSession);

    if (user?.id) {
      void import('../realtime/sessionHub').then(module => {
        if (!active) return;
        hub.current = module;
        return module.startSessionHub(payload => endSession(payload.reason));
      }).catch(error => logger.warn('[Realtime] session hub unavailable', error));
    }

    return () => {
      active = false;
      unsubscribe();
      void hub.current?.stopSessionHub();
    };
  }, [user?.id, clearSession, navigate]);

  return null;
};

export default SessionRealtime;
