import type { CallSession } from './features/calls/types/call.types';

export const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://chatapp-j9na.onrender.com';

const TOKEN_KEY = 'chat-access-token';
const USER_KEY = 'chat-user';

export type User = {
  user_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  created_at: string;
  updated_at: string;
  last_seen?: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: User;
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

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let accessToken: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures (private browsing, etc.)
  }
}

export function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function persistSession(session: { user: User; accessToken: string }) {
  setAccessToken(session.accessToken);
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  } catch {
    // Ignore storage failures
  }
}

export function clearSession() {
  setAccessToken(null);
  try {
    localStorage.removeItem(USER_KEY);
  } catch {
    // Ignore storage failures
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new ApiError(
      message || `Request failed (${response.status})`,
      response.status,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getUsers() {
  return request<User[]>('/users');
}

export function register(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return request<AuthSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function signIn(body: { email: string; password: string }) {
  return request<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchCurrentUser() {
  return request<User>('/auth/me');
}

export function getChats(otherUserId: number) {
  return request<Chat[]>(`/chats?otherUserId=${otherUserId}`);
}

export function getIceServers() {
  return request<{ iceServers: { urls: string; username?: string; credential?: string }[] }>(
    '/calls/ice-servers',
  ).then((body) => body.iceServers);
}

export function getCalls() {
  return request<CallSession[]>('/calls');
}
