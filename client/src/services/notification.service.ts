export type ShowNotificationOptions = {
  title: string;
  body: string;
  tag?: string;
  onClick?: () => void;
};

export function isNotificationSupported() {
  return typeof Notification !== 'undefined';
}

export function getNotificationPermission():
  | NotificationPermission
  | 'unsupported' {
  if (!isNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return 'unsupported' as const;
  }
  if (Notification.permission === 'granted') {
    return 'granted' as const;
  }
  if (Notification.permission === 'denied') {
    return 'denied' as const;
  }
  const result = await Notification.requestPermission();
  return result;
}

export function showBrowserNotification(options: ShowNotificationOptions) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  const notification = new Notification(options.title, {
    body: options.body,
    tag: options.tag,
    icon: '/favicon.svg',
  });

  notification.onclick = (event) => {
    event.preventDefault();
    window.focus();
    options.onClick?.();
    notification.close();
  };

  return notification;
}

export function shouldNotifyForMessage(params: {
  senderId: number;
  openChatUserId: number | null;
  isIncoming: boolean;
}) {
  if (!params.isIncoming) {
    return false;
  }
  if (document.visibilityState === 'hidden') {
    return true;
  }
  return params.openChatUserId !== params.senderId;
}

export function shouldNotifyForCall() {
  return document.visibilityState === 'hidden';
}
