const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type User = {
  user_id: number;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
};

export type Chat = {
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
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

export function getUsers() {
  return request<User[]>('/users');
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

export function sendChat(body: {
  senderId: number;
  receiverId: number;
  message: string;
}) {
  return request<Chat>('/chats', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
