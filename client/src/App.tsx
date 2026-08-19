import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { ChatScreen } from './screens/ChatScreen';
import { ForgotPasswordScreen } from './screens/ForgotPasswordScreen';
import { SignInScreen } from './screens/SignInScreen';
import { SignUpScreen } from './screens/SignUpScreen';
import { loginPath, paths, safeAppPath } from './routes';

function SessionLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 text-gray-500">
      Checking session…
    </div>
  );
}

function GuestOnly() {
  const { status } = useAuth();
  const [params] = useSearchParams();

  if (status === 'loading') {
    return <SessionLoading />;
  }

  if (status === 'authenticated') {
    return <Navigate replace to={safeAppPath(params.get('next'))} />;
  }

  return <Outlet />;
}

function RequireAuth() {
  const { status, user, accessToken, logout } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <SessionLoading />;
  }

  if (status !== 'authenticated' || !user || !accessToken) {
    return <Navigate replace to={loginPath(location.pathname)} />;
  }

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

function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path={paths.login} element={<SignInScreen />} />
        <Route path={paths.signup} element={<SignUpScreen />} />
        <Route path={paths.forgotPassword} element={<ForgotPasswordScreen />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path={paths.user} element={null} />
        <Route path="/chat/:userId" element={null} />
        <Route path="/videocall/:userId" element={null} />
        <Route path="/call/:userId" element={null} />
      </Route>

      <Route path="/" element={<Navigate to={paths.user} replace />} />
      <Route path="*" element={<Navigate to={paths.user} replace />} />
    </Routes>
  );
}

export default App;
