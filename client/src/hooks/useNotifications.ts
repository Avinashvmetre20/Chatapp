import { useCallback, useEffect, useState } from 'react';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  showBrowserNotification,
  type ShowNotificationOptions,
} from '../services/notification.service';

export function useNotifications() {
  const [permission, setPermission] = useState(getNotificationPermission());

  useEffect(() => {
    function syncPermission() {
      setPermission(getNotificationPermission());
    }

    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(getNotificationPermission());
    return result;
  }, []);

  const notify = useCallback((options: ShowNotificationOptions) => {
    return showBrowserNotification(options);
  }, []);

  return {
    supported: isNotificationSupported(),
    permission,
    requestPermission,
    notify,
  };
}
