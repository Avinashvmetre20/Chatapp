import type { CallSession } from './features/calls/types/call.types';

export const API_URL = import.meta.env.DEV
  ? 'http://localhost:3000'
  : 'https://chatapp-j9na.onrender.com';

export type User = {
  user_id: number;
  first_name: string;
  last_name: string;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const message = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function getUsers(userId?: number) {
  const query = userId ? `?userId=${userId}` : '';
  return request<User[]>(`/users${query}`);
}

export function createUser(body: {
  firstName: string;
  lastName: string;
  password: string;
}) {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function signIn(body: {
  firstName: string;
  lastName: string;
  password: string;
}) {
  return request<User>('/users/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getChats(userId: number, otherUserId: number) {
  return request<Chat[]>(
    `/chats?userId=${userId}&otherUserId=${otherUserId}`,
  );
}

export function getIceServers() {
  return request<{ iceServers: { urls: string; username?: string; credential?: string }[] }>(
    '/calls/ice-servers',
  ).then((body) => body.iceServers);
}

export function getCalls(userId: number) {
  return request<CallSession[]>(`/calls?userId=${userId}`);
}
