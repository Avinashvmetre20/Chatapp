import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getChats, getUsers, sendChat, type Chat, type User } from '../api';

function displayName(user: User) {
  return `${user.first_name} ${user.last_name}`.trim();
}

type ChatScreenProps = {
  currentUser: User;
  onSignOut: () => void;
};

export function ChatScreen({ currentUser, onSignOut }: ChatScreenProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [otherUserId, setOtherUserId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const otherUser = users.find((user) => user.user_id === otherUserId);
  const otherUsers = useMemo(
    () => users.filter((user) => user.user_id !== currentUser.user_id),
    [users, currentUser.user_id],
  );

  useEffect(() => {
    let cancelled = false;

    void getUsers()
      .then((list) => {
        if (!cancelled) {
          setUsers(list);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const fromId = currentUser.user_id;
    const toId = otherUserId;

    if (!toId) {
      return;
    }

    let cancelled = false;

    async function loadChats() {
      try {
        const rows = await getChats(fromId, toId);
        if (!cancelled) {
          setChats(rows);
          setError('');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chats');
        }
      }
    }

    void loadChats();
    const timer = window.setInterval(() => {
      void loadChats();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [currentUser.user_id, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats.length]);

  async function onSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!otherUserId || !message.trim()) {
      return;
    }

    const text = message.trim();
    setMessage('');
    setError('');

    try {
      const chat = await sendChat({
        senderId: currentUser.user_id,
        receiverId: otherUserId,
        message: text,
      });
      setChats((prev) => [...prev, chat]);
    } catch (err: unknown) {
      setMessage(text);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  }

  return (
    <div className="flex min-h-screen bg-white text-gray-900">
      <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="border-b border-gray-200 p-4">
          <h1 className="text-lg font-semibold text-gray-900">Chat App</h1>
          <p className="mt-1 text-sm text-gray-500">
            Signed in as {displayName(currentUser)}
          </p>
          <button
            className="mt-3 text-sm text-sky-600 hover:text-sky-500"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            Chat with
          </p>
          {otherUsers.length === 0 ? (
            <p className="text-sm text-gray-500">
              No other users yet. Ask someone to sign up.
            </p>
          ) : (
            <ul className="space-y-1">
              {otherUsers.map((user) => (
                <li key={user.user_id}>
                  <button
                    className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                      otherUserId === user.user_id
                        ? 'bg-sky-600 text-white'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                    onClick={() => {
                      setOtherUserId(user.user_id);
                      setChats([]);
                    }}
                    type="button"
                  >
                    {displayName(user)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-medium text-gray-900">
            {otherUser
              ? `Chat with ${displayName(otherUser)}`
              : 'Select someone to start chatting'}
          </h2>
        </header>

        {error ? (
          <div className="mx-6 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {otherUserId && chats.length === 0 ? (
            <p className="text-sm text-gray-500">No messages yet. Send the first one.</p>
          ) : null}

          {chats.map((chat) => {
            const mine = chat.sender_id === currentUser.user_id;
            return (
              <div
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                key={chat.chat_id}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                    mine
                      ? 'bg-sky-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p>{chat.message}</p>
                  <p className={`mt-1 text-[11px] ${mine ? 'text-sky-100' : 'text-gray-500'}`}>
                    {new Date(chat.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex gap-2 border-t border-gray-200 bg-white p-4"
          onSubmit={onSendMessage}
        >
          <input
            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            disabled={!otherUserId}
            maxLength={1000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={otherUserId ? 'Type a message' : 'Select a user first'}
            value={message}
          />
          <button
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            disabled={!otherUserId || !message.trim()}
            type="submit"
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
