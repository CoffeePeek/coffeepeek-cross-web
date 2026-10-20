import { useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { recordNotificationActivity } from '../api/notifications';

export default function NotificationActivity() {
  const { user } = useUser();
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let lastRecorded = 0;
    const record = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastRecorded < 60_000) return;
      lastRecorded = Date.now();
      void recordNotificationActivity(controller.signal).catch(() => { lastRecorded = 0; });
    };
    record();
    document.addEventListener('visibilitychange', record);
    const interval = window.setInterval(record, 15 * 60_000);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', record); };
  }, [userId]);
  return null;
}
