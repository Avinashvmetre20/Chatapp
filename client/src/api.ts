export const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://chatapp-j9na.onrender.com';

export type User = {
  user_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  last_seen?: string | null;
};

export type MessageStatus = 'sent' | 'delivered' | 'read';

export type Chat = {
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
  status?: MessageStatus;
  queued?: boolean;
};

export type AuthPayload = {
  user: User;
  accessToken: string;
};

type ErrorBody = {
  success?: boolean;
  error?: { code?: string; message?: string };
  message?: string | string[];
  data?: unknown;
};

let accessTokenMemory: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessTokenMemory = token;
}

export function getAccessToken() {
  return accessTokenMemory;
}

function unwrap<T>(body: unknown): T {
  if (
    body &&
    typeof body === 'object' &&
    'success' in body &&
    (body as ErrorBody).success === true &&
    'data' in body
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function errorMessage(body: ErrorBody | null, status: number) {
  if (body?.error?.message) {
    return body.error.message;
  }
  if (Array.isArray(body?.message)) {
    return body.message.join(', ');
  }
  return body?.message || `Request failed (${status})`;
}

async function parseBody(response: Response) {
  return (await response.json().catch(() => null)) as ErrorBody | null;
}

async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await parseBody(response);
    if (!response.ok) {
      setAccessToken(null);
      return null;
    }
    const data = unwrap<AuthPayload>(body);
    setAccessToken(data.accessToken);
    return data.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function request<T>(
  path: string,
  init?: RequestInit,
  retry = true,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessTokenMemory) {
    headers.set('Authorization', `Bearer ${accessTokenMemory}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (
    response.status === 401 &&
    retry &&
    !path.startsWith('/auth/')
  ) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return request<T>(path, init, false);
    }
  }

  const body = await parseBody(response);
  if (!response.ok) {
    throw new Error(errorMessage(body, response.status));
  }

  return unwrap<T>(body);
}

export function register(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return request<AuthPayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function login(body: { email: string; password: string }) {
  return request<AuthPayload>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function refreshSession() {
  const token = await refreshAccessToken();
  if (!token) {
    return null;
  }
  const me = await request<{ user: User }>('/auth/me');
  return { user: me.user, accessToken: token };
}

export function logout() {
  return request<{ ok: true }>('/auth/logout', { method: 'POST' });
}

export function logoutAll() {
  return request<{ ok: true }>('/auth/logout-all', { method: 'POST' });
}

export function forgotPassword(email: string) {
  return request<{ ok: true }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<{ ok: true }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export function getUsers() {
  return request<User[]>('/users');
}

export function getIceServers() {
  return request<{
    iceServers: { urls: string; username?: string; credential?: string }[];
  }>('/calls/ice-servers').then((body) => body.iceServers);
}

export function getCalls() {
  return request<import('./features/calls/types/call.types').CallSession[]>(
    '/calls',
  );
}
