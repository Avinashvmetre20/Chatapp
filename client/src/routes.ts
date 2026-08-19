export const paths = {
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  user: '/user',
  chat: (userId: number | string) => `/chat/${userId}`,
  videocall: (userId: number | string) => `/videocall/${userId}`,
  audiocall: (userId: number | string) => `/call/${userId}`,
} as const;

const APP_PATH = /^(?:\/user|\/chat\/\d+|\/videocall\/\d+|\/call\/\d+)$/;

export function safeAppPath(from: unknown) {
  if (typeof from !== 'string') {
    return paths.user;
  }

  const path = from.split('?')[0]?.split('#')[0] ?? '';
  return APP_PATH.test(path) ? path : paths.user;
}

export function loginPath(fromPathname?: string) {
  const next = safeAppPath(fromPathname);
  if (!fromPathname || next === paths.user) {
    return paths.login;
  }
  return `${paths.login}?next=${encodeURIComponent(next)}`;
}
