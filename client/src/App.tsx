import { useState } from 'react';
import type { User } from './api';
import { ChatScreen } from './screens/ChatScreen';
import { SignInScreen } from './screens/SignInScreen';
import { SignUpScreen } from './screens/SignUpScreen';

const USER_KEY = 'chat-user';

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(readStoredUser);
  const [authScreen, setAuthScreen] = useState<'signin' | 'signup'>('signin');

  function handleAuthSuccess(user: User) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setCurrentUser(user);
  }

  function handleSignOut() {
    localStorage.removeItem(USER_KEY);
    setCurrentUser(null);
    setAuthScreen('signin');
  }

  if (!currentUser) {
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

  return <ChatScreen currentUser={currentUser} onSignOut={handleSignOut} />;
}

export default App;
