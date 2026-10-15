import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { syncAnalytics } from '../lib/analytics';
import { ANALYTICS_CONSENT_EVENT } from '../lib/analyticsConsent';

export default function ProductAnalytics() {
  const { user, isLoading } = useUser();
  const { pathname, key } = useLocation();
  const [consentVersion, setConsentVersion] = useState(0);

  useEffect(() => {
    const refreshConsent = () => setConsentVersion(value => value + 1);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, refreshConsent);
    window.addEventListener('storage', refreshConsent);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, refreshConsent);
      window.removeEventListener('storage', refreshConsent);
    };
  }, []);

  useEffect(() => {
    // Pause during auth restoration/logout, including when consent is withdrawn mid-request.
    void syncAnalytics({
      apiKey: import.meta.env.VITE_POSTHOG_KEY,
      apiHost: import.meta.env.VITE_POSTHOG_HOST,
      enabled: !isLoading && (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_ENABLE_DEV === 'true'),
      userId: user?.id || null,
      pathname,
      routeKey: key,
      appVersion: __APP_VERSION__,
      environment: import.meta.env.MODE,
    });
  }, [user?.id, isLoading, pathname, key, consentVersion]);

  return null;
}
