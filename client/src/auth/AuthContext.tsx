import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getAccessToken,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  setAccessToken,
  type User,
} from '../api';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (values: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);

  const applySession = useCallback((nextUser: User, token: string) => {
    setAccessToken(token);
    setUser(nextUser);
    setToken(token);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setToken(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    let cancelled = false;

    void refreshSession()
      .then((session) => {
        if (cancelled) {
          return;
        }
        if (session) {
          applySession(session.user, session.accessToken);
        } else {
          clearSession();
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshSession()
        .then((session) => {
          if (session) {
            applySession(session.user, session.accessToken);
          } else {
            clearSession();
          }
        })
        .catch(() => {
          clearSession();
        });
    }, 10 * 60 * 1000);

    return () => window.clearInterval(timer);
  }, [applySession, clearSession, status]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await loginRequest({ email, password });
      applySession(result.user, result.accessToken);
    },
    [applySession],
  );

  const register = useCallback(
    async (values: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
    }) => {
      const result = await registerRequest(values);
      applySession(result.user, result.accessToken);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      accessToken: accessToken ?? getAccessToken(),
      login,
      register,
      logout,
    }),
    [accessToken, login, logout, register, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
