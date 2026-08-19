import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  SOCKET_URL,
  getUsers,
  type Chat,
  type MessageStatus,
  type User,
} from '../api';
import { IncomingCallModal } from '../features/calls/components/IncomingCallModal';
import { VideoCall } from '../features/calls/components/VideoCall';
import { useCall } from '../features/calls/hooks/useCall';
import { useNotifications } from '../hooks/useNotifications';
import { paths } from '../routes';
import {
  shouldNotifyForCall,
  shouldNotifyForMessage,
} from '../services/notification.service';

function displayName(user: User) {
  return `${user.first_name} ${user.last_name}`.trim();
}

function initials(user: User) {
  return `${user.first_name[0] ?? ''}${user.last_name[0] ?? ''}`.toUpperCase();
}

function ClockIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 4.75V8l2.25 1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SingleTickIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M2 8.5 5.5 12 13.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DoubleTickIcon({
  className,
  colorClass,
}: {
  className: string;
  colorClass: string;
}) {
  return (
    <svg className={`${className} ${colorClass}`} fill="none" viewBox="0 0 20 16">
      <path
        d="M1.5 8.5 5 12 12.5 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M7 8.5 10.5 12 18 3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 16 16">
      <path
        d="M1 8s2.5-4.5 7-4.5 7 4.5 7 4.5-2.5 4.5-7 4.5S1 8 1 8Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle
        cx="8"
        cy="8"
        r="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MessageTicks({ chat }: { chat: Chat }) {
  const iconClass = 'h-3.5 w-3.5 shrink-0';

  if (chat.queued) {
    return <ClockIcon className={iconClass} />;
  }

  if (chat.status === 'read') {
    return <EyeIcon className={`${iconClass} text-sky-200`} />;
  }

  if (chat.status === 'delivered') {
    return <DoubleTickIcon className={iconClass} colorClass="text-sky-100" />;
  }

  return <SingleTickIcon className={iconClass} />;
}

function parseAppRoute(pathname: string) {
  const video = matchPath({ path: '/videocall/:userId', end: true }, pathname);
  const audio = matchPath({ path: '/call/:userId', end: true }, pathname);
  const chat = matchPath({ path: '/chat/:userId', end: true }, pathname);
  const raw = video?.params.userId ?? audio?.params.userId ?? chat?.params.userId;
  const parsed = raw ? Number(raw) : NaN;
  const otherUserId = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

  if (video) {
    return { kind: 'videocall' as const, otherUserId };
  }
  if (audio) {
    return { kind: 'call' as const, otherUserId };
  }
  if (chat) {
    return { kind: 'chat' as const, otherUserId };
  }
  return { kind: 'user' as const, otherUserId: null };
}

type ChatScreenProps = {
  currentUser: User;
  accessToken: string;
  onSignOut: () => void;
};

type SocketAck<T> = T | { error: string };

function isSocketError<T>(value: SocketAck<T>): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

export function ChatScreen({ currentUser, accessToken, onSignOut }: ChatScreenProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const route = useMemo(
    () => parseAppRoute(location.pathname),
    [location.pathname],
  );
  const otherUserId = route.otherUserId;

  const [users, setUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unreadByUserId, setUnreadByUserId] = useState<Record<number, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const otherUserIdRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const usersRef = useRef<User[]>([]);
  const openChatRef = useRef<(userId: number) => void>(() => {});
  const callRouteSyncRef = useRef<'off' | 'joining' | 'on'>('off');

  const notifications = useNotifications();
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  const otherUser = users.find((user) => user.user_id === otherUserId);
  const chatUsers = users.filter((user) => user.user_id !== currentUser.user_id);
  const recipientOnline = Boolean(
    otherUser && onlineIds.includes(otherUser.user_id),
  );
  const call = useCall({
    socket,
    currentUser,
    onIncomingCall: useCallback(
      (incoming) => {
        if (
          !shouldNotifyForCall() ||
          notificationsRef.current.permission !== 'granted'
        ) {
          return;
        }
        const caller = usersRef.current.find(
          (user) => user.user_id === incoming.callerId,
        );
        notificationsRef.current.notify({
          title: `Incoming ${incoming.callType} call`,
          body: caller ? `${displayName(caller)} is calling you` : 'Incoming call',
          tag: `call-${incoming.callId}`,
        });
      },
      [],
    ),
  });
  const callPeer = users.find((user) => user.user_id === call.otherUserId);
  const incomingCaller = users.find(
    (user) => user.user_id === call.call?.callerId,
  );
  const endCallRef = useRef(call.endCall);
  endCallRef.current = call.endCall;

  useEffect(() => {
    if (
      (route.kind === 'chat' ||
        route.kind === 'videocall' ||
        route.kind === 'call') &&
      !route.otherUserId
    ) {
      navigate(paths.user, { replace: true });
      return;
    }

    if (route.otherUserId === currentUser.user_id) {
      navigate(paths.user, { replace: true });
    }
  }, [currentUser.user_id, navigate, route.kind, route.otherUserId]);

  useEffect(() => {
    if (
      call.phase === 'idle' ||
      call.phase === 'incoming' ||
      !call.otherUserId
    ) {
      callRouteSyncRef.current = 'off';
      return;
    }

    const nextPath =
      call.call?.callType === 'audio'
        ? paths.audiocall(call.otherUserId)
        : paths.videocall(call.otherUserId);

    if (location.pathname === nextPath) {
      callRouteSyncRef.current = 'on';
      return;
    }

    if (callRouteSyncRef.current === 'on') {
      callRouteSyncRef.current = 'off';
      void endCallRef.current();
      return;
    }

    if (callRouteSyncRef.current === 'joining') {
      return;
    }

    callRouteSyncRef.current = 'joining';
    navigate(nextPath, { replace: true });
  }, [
    call.call?.callType,
    call.otherUserId,
    call.phase,
    location.pathname,
    navigate,
  ]);

  useEffect(() => {
    if (call.phase !== 'idle') {
      return;
    }
    if (route.kind !== 'videocall' && route.kind !== 'call') {
      return;
    }
    navigate(
      route.otherUserId ? paths.chat(route.otherUserId) : paths.user,
      { replace: true },
    );
  }, [call.phase, navigate, route.kind, route.otherUserId]);

  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  const markConversationSeen = useCallback(
    (socket: Socket, otherId: number) => {
      socket.emit('conversation:seen', {
        otherUserId: otherId,
      });
    },
    [currentUser.user_id],
  );

  const loadConversation = useCallback(
    (socket: Socket, otherId: number) => {
      socket.emit(
        'conversation:open',
        { otherUserId: otherId },
        (rows: SocketAck<Chat[]>) => {
          if (isSocketError(rows)) {
            setError(rows.error);
            return;
          }

          setChats((prev) => {
            const queued = prev.filter(
              (chat) =>
                chat.queued &&
                chat.sender_id === currentUser.user_id &&
                chat.receiver_id === otherId &&
                !rows.some(
                  (row) =>
                    row.message === chat.message &&
                    row.sender_id === chat.sender_id,
                ),
            );
            return [...rows, ...queued];
          });
          setError('');
        },
      );
    },
    [currentUser.user_id],
  );

  const sendViaSocket = useCallback(
    (socket: Socket, chat: Chat) => {
      socket.emit(
        'message:send',
        {
          receiverId: chat.receiver_id,
          message: chat.message,
        },
        (saved: SocketAck<Chat>) => {
          if (isSocketError(saved)) {
            setChats((prev) =>
              prev.map((item) =>
                item.chat_id === chat.chat_id
                  ? { ...item, queued: true }
                  : item,
              ),
            );
            setError(saved.error);
            return;
          }

          setChats((prev) =>
            prev.map((item) =>
              item.chat_id === chat.chat_id
                ? { ...saved, queued: false }
                : item,
            ),
          );
          setError('');
        },
      );
    },
    [],
  );

  const flushQueuedMessages = useCallback(
    (socket: Socket) => {
      if (!socket.connected || !navigator.onLine) {
        return;
      }

      setChats((prev) => {
        const queued = prev.filter((chat) => chat.queued);
        for (const chat of queued) {
          sendViaSocket(socket, chat);
        }
        return prev;
      });
    },
    [sendViaSocket],
  );

  useEffect(() => {
    let cancelled = false;

    void getUsers()
      .then((list) => {
        if (cancelled) {
          return;
        }

        const accountExists = list.some(
          (user) => user.user_id === currentUser.user_id,
        );

        if (!accountExists) {
          onSignOut();
          return;
        }

        setUsers(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load users');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser.user_id, onSignOut]);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL || undefined, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketRef.current = socket;
    setSocket(socket);

    socket.on('connect', () => {
      const openUserId = otherUserIdRef.current;
      if (openUserId !== null) {
        loadConversation(socket, openUserId);
      }
      flushQueuedMessages(socket);
    });

    socket.on('connect_error', (err) => {
      if (err.message !== 'Unauthorized') {
        return;
      }
      socket.disconnect();
      onSignOut();
    });

    socket.on('presence:list', (userIds: number[]) => {
      setOnlineIds(userIds);
    });

    socket.on('presence', ({ userId, online }: { userId: number; online: boolean }) => {
      setOnlineIds((prev) => {
        if (online) {
          return prev.includes(userId) ? prev : [...prev, userId];
        }
        return prev.filter((id) => id !== userId);
      });
    });

    socket.on('message', (chat: Chat) => {
      const openUserId = otherUserIdRef.current;
      const isIncoming =
        chat.receiver_id === currentUser.user_id &&
        chat.sender_id !== currentUser.user_id;

      if (isIncoming) {
        if (openUserId !== chat.sender_id) {
          setUnreadByUserId((prev) => ({
            ...prev,
            [chat.sender_id]: (prev[chat.sender_id] ?? 0) + 1,
          }));
        }

        if (
          shouldNotifyForMessage({
            senderId: chat.sender_id,
            openChatUserId: openUserId,
            isIncoming: true,
          }) &&
          notificationsRef.current.permission === 'granted'
        ) {
          const sender = usersRef.current.find(
            (user) => user.user_id === chat.sender_id,
          );
          notificationsRef.current.notify({
            title: sender ? displayName(sender) : 'New message',
            body: chat.message,
            tag: `chat-${chat.sender_id}`,
            onClick: () => openChatRef.current(chat.sender_id),
          });
        }
      }

      const inThisChat =
        openUserId !== null &&
        ((chat.sender_id === openUserId && chat.receiver_id === currentUser.user_id) ||
          (chat.sender_id === currentUser.user_id &&
            chat.receiver_id === openUserId));

      if (!inThisChat) {
        return;
      }

      setChats((prev) => {
        const withoutQueued = prev.filter(
          (item) =>
            !(
              item.queued &&
              item.message === chat.message &&
              item.sender_id === chat.sender_id
            ),
        );

        if (withoutQueued.some((item) => item.chat_id === chat.chat_id)) {
          return withoutQueued.map((item) =>
            item.chat_id === chat.chat_id ? chat : item,
          );
        }

        return [...withoutQueued, chat];
      });

      if (openUserId === chat.sender_id) {
        markConversationSeen(socket, chat.sender_id);
      }
    });

    socket.on(
      'message:status',
      (payload: { chat_id: number; status: MessageStatus }) => {
        setChats((prev) =>
          prev.map((item) =>
            item.chat_id === payload.chat_id
              ? { ...item, status: payload.status, queued: false }
              : item,
          ),
        );
      },
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [
    currentUser.user_id,
    accessToken,
    flushQueuedMessages,
    loadConversation,
    markConversationSeen,
    onSignOut,
  ]);

  useEffect(() => {
    otherUserIdRef.current = otherUserId;
  }, [otherUserId]);

  useEffect(() => {
    if (!otherUserId) {
      setChats([]);
      return;
    }

    const socket = socketRef.current;
    setChats([]);
    setError('');

    if (!socket?.connected) {
      return;
    }

    loadConversation(socket, otherUserId);
  }, [currentUser.user_id, loadConversation, otherUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats.length]);

  useEffect(() => {
    const total = Object.values(unreadByUserId).reduce(
      (sum, count) => sum + count,
      0,
    );
    const unread = total > 0 ? `(${total}) ` : '';
    const peer = otherUser ? displayName(otherUser) : '';

    if (route.kind === 'videocall') {
      document.title = `${unread}Video call${peer ? ` · ${peer}` : ''} | Chat App`;
      return;
    }
    if (route.kind === 'call') {
      document.title = `${unread}Call${peer ? ` · ${peer}` : ''} | Chat App`;
      return;
    }
    if (route.kind === 'chat') {
      document.title = `${unread}${peer || 'Chat'} | Chat App`;
      return;
    }
    document.title = `${unread}Chats | Chat App`;
  }, [otherUser, route.kind, unreadByUserId]);

  function openChat(userId: number) {
    if (route.kind !== 'chat' || otherUserId !== userId) {
      navigate(paths.chat(userId));
    }
    setError('');
    setUnreadByUserId((prev) => {
      if (!prev[userId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  openChatRef.current = openChat;

  function closeChat() {
    navigate(paths.user);
  }

  function onSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!otherUserId || !message.trim()) {
      return;
    }

    const socket = socketRef.current;
    const text = message.trim();
    const queuedChat: Chat = {
      chat_id: -Date.now(),
      sender_id: currentUser.user_id,
      receiver_id: otherUserId,
      message: text,
      created_at: new Date().toISOString(),
      queued: true,
    };

    setMessage('');
    setError('');
    setChats((prev) => [...prev, queuedChat]);

    if (!socket?.connected || !navigator.onLine) {
      return;
    }

    sendViaSocket(socket, queuedChat);
  }

  const showSidebar = !otherUserId;
  const showChat = Boolean(otherUserId);
  const networkDown = !isOnline;

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-gray-900">
      <aside
        className={`${showSidebar ? 'flex' : 'hidden'} w-full flex-col border-gray-200 bg-gray-50 md:flex md:w-80 md:shrink-0 md:border-r`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">Chat App</h1>
            <p className="truncate text-sm text-gray-500">
              {displayName(currentUser)}
            </p>
            {networkDown ? (
              <p className="text-xs text-amber-600">Offline — messages will send when connected</p>
            ) : null}
            {notifications.supported && notifications.permission === 'default' ? (
              <button
                className="mt-1 text-xs font-medium text-sky-600 hover:text-sky-500"
                onClick={() => void notifications.requestPermission()}
                type="button"
              >
                Enable notifications
              </button>
            ) : null}
            {notifications.supported && notifications.permission === 'denied' ? (
              <p className="mt-1 text-xs text-gray-400">
                Notifications blocked in browser settings
              </p>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-500">
            Chats
          </p>
          {chatUsers.length === 0 ? (
            <p className="px-1 text-sm text-gray-500">
              No other users yet. Ask someone to sign up.
            </p>
          ) : (
            <ul className="space-y-1">
              {chatUsers.map((user) => {
                const selected = otherUserId === user.user_id;
                const online = onlineIds.includes(user.user_id);
                const unread = unreadByUserId[user.user_id] ?? 0;
                return (
                  <li key={user.user_id}>
                    <button
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ${
                        selected
                          ? 'bg-sky-600 text-white'
                          : 'bg-white text-gray-900 hover:bg-gray-100'
                      }`}
                      onClick={() => openChat(user.user_id)}
                      type="button"
                    >
                      <span className="relative shrink-0">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                            selected
                              ? 'bg-sky-500 text-white'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {initials(user)}
                        </span>
                        <span
                          className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 ${
                            selected ? 'border-sky-600' : 'border-white'
                          } ${online ? 'bg-green-500' : 'bg-gray-400'}`}
                        />
                        {unread > 0 ? (
                          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block truncate font-medium">
                            {displayName(user)}
                          </span>
                        </span>
                        <span
                          className={`block text-xs ${
                            selected ? 'text-sky-100' : 'text-gray-500'
                          }`}
                        >
                          {online ? 'online' : 'offline'}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-auto border-t border-gray-200 bg-gray-50 p-3">
          <button
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-sky-600 hover:bg-sky-50"
            onClick={onSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main
        className={`${showChat ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col md:flex`}
      >
        <header className="flex items-center gap-3 border-b border-gray-200 px-3 py-3 sm:px-6">
          <button
            aria-label="Back"
            className="rounded-lg px-2 py-2 text-sky-600 hover:bg-sky-50 md:hidden"
            onClick={closeChat}
            type="button"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path
                d="M15 18 9 12l6-6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
          {otherUser ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="relative shrink-0">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
                  {initials(otherUser)}
                </span>
                <span
                  className={`absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white ${
                    recipientOnline ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                />
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-medium">{displayName(otherUser)}</h2>
                <p className="text-xs text-gray-500">
                  {recipientOnline ? 'online' : 'offline'}
                </p>
              </div>
              <div className="ml-auto flex shrink-0 gap-1">
                <button
                  className="rounded-lg px-2 py-2 text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                  disabled={!recipientOnline || call.phase !== 'idle'}
                  onClick={() => void call.startCall(otherUser.user_id, 'audio')}
                  title="Audio call"
                  type="button"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M6.5 4.5 9 8l-2 2a12 12 0 0 0 7 7l2-2 3.5 2.5v3A2 2 0 0 1 17.5 22C9.5 22 2 14.5 2 6.5A2 2 0 0 1 4.5 4.5h2Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
                <button
                  className="rounded-lg px-2 py-2 text-sky-600 hover:bg-sky-50 disabled:opacity-40"
                  disabled={!recipientOnline || call.phase !== 'idle'}
                  onClick={() => void call.startCall(otherUser.user_id, 'video')}
                  title="Video call"
                  type="button"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <rect
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      width="14"
                      x="3"
                      y="6"
                    />
                    <path
                      d="m17 10 4-2v8l-4-2"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <h2 className="text-sm text-gray-500 sm:text-base">
              Select someone to start chatting
            </h2>
          )}
        </header>

        {error || call.error ? (
          <p className="mx-3 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6">
            {error || call.error}
          </p>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-6">
          {!otherUserId ? (
            <p className="pt-12 text-center text-sm text-gray-500">
              Choose a contact from the left to open a conversation.
            </p>
          ) : null}

          {otherUserId && chats.length === 0 ? (
            <p className="pt-12 text-center text-sm text-gray-500">
              No messages yet. Say hello.
            </p>
          ) : null}

          {chats.map((chat) => {
            const mine = chat.sender_id === currentUser.user_id;
            return (
              <div
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                key={chat.chat_id}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm sm:max-w-[70%] ${
                    mine ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="break-words">{chat.message}</p>
                  <span
                    className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${
                      mine ? 'text-sky-100' : 'text-gray-500'
                    }`}
                  >
                    {new Date(chat.created_at).toLocaleTimeString()}
                    {mine ? <MessageTicks chat={chat} /> : null}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex gap-2 border-t border-gray-200 p-3 sm:p-4"
          onSubmit={onSendMessage}
        >
          <input
            className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-base outline-none placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            disabled={!otherUserId}
            maxLength={1000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={otherUserId ? 'Type a message' : 'Select a user first'}
            value={message}
          />
          <button
            className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 sm:px-5"
            disabled={!otherUserId || !message.trim()}
            type="submit"
          >
            Send
          </button>
        </form>
      </main>

      {call.phase === 'incoming' && call.call ? (
        <IncomingCallModal
          callerName={incomingCaller ? displayName(incomingCaller) : 'Incoming call'}
          callType={call.call.callType}
          onAccept={() => void call.acceptCall()}
          onReject={() => void call.rejectCall()}
        />
      ) : null}

      {call.phase !== 'idle' && call.phase !== 'incoming' && call.call ? (
        <VideoCall
          cameraOn={call.cameraOn}
          callType={call.call.callType}
          localStream={call.localStream}
          micOn={call.micOn}
          onEnd={() => void call.endCall()}
          onToggleCamera={call.toggleCamera}
          onToggleMic={call.toggleMic}
          peerName={callPeer ? displayName(callPeer) : 'Call'}
          phase={call.phase}
          remoteStream={call.remoteStream}
        />
      ) : null}
    </div>
  );
}
