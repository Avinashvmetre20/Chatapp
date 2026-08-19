import { useEffect, useState } from 'react';
import {
  ApiError,
  clearSession,
  fetchCurrentUser,
  getAccessToken,
  persistSession,
  readStoredUser,
  type User,
} from './api';
import { ChatScreen } from './screens/ChatScreen';
import { SignInScreen } from './screens/SignInScreen';
import { SignUpScreen } from './screens/SignUpScreen';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authScreen, setAuthScreen] = useState<'signin' | 'signup'>('signin');
  const [checkingSession, setCheckingSession] = useState(
    () => Boolean(getAccessToken()),
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      clearSession();
      setCheckingSession(false);
      return;
    }

    const storedUser = readStoredUser();
    if (storedUser) {
      setCurrentUser(storedUser);
    }

    void fetchCurrentUser()
      .then((user) => {
        persistSession({ user, accessToken: token });
        setCurrentUser(user);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          setCurrentUser(null);
        }
      })
      .finally(() => {
        setCheckingSession(false);
      });
  }, []);

  function handleAuthSuccess(user: User) {
    setCurrentUser(user);
  }

  function handleSignOut() {
    clearSession();
    setCurrentUser(null);
    setAuthScreen('signin');
  }

  if (checkingSession && !currentUser) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 text-sm text-gray-500">
        Restoring session...
      </div>
    );
  }

  if (currentUser && getAccessToken()) {
    return <ChatScreen currentUser={currentUser} onSignOut={handleSignOut} />;
  }

  if (authScreen === 'signup') {
    return (
      <SignUpScreen
        onGoToSignIn={() => setAuthScreen('signin')}
        onSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <SignInScreen
      onGoToSignUp={() => setAuthScreen('signup')}
      onSuccess={handleAuthSuccess}
    />
  );
}

export default App;
