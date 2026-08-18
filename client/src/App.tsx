import { useState } from 'react';
import { useAuth } from './auth/AuthContext';
import { ChatScreen } from './screens/ChatScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { SignInScreen } from './screens/SignInScreen';
import { SignUpScreen } from './screens/SignUpScreen';

function App() {
  const { status, user, accessToken, logout } = useAuth();
  const [authScreen, setAuthScreen] = useState<'signin' | 'signup' | 'forgot'>(
    'signin',
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 text-gray-500">
        Checking session…
      </div>
    );
  }

  if (status === 'authenticated' && user && accessToken) {
    return (
      <ChatScreen
        accessToken={accessToken}
        currentUser={user}
        onSignOut={() => {
          void logout();
        }}
      />
    );
  }

  if (authScreen === 'forgot') {
    return (
      <ForgotPasswordScreen onGoToSignIn={() => setAuthScreen('signin')} />
    );
  }

  if (authScreen === 'signup') {
    return (
      <SignUpScreen onGoToSignIn={() => setAuthScreen('signin')} />
    );
  }

  return (
    <SignInScreen
      onForgotPassword={() => setAuthScreen('forgot')}
      onGoToSignUp={() => setAuthScreen('signup')}
    />
  );
}

export default App;
