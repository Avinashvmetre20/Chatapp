import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { paths, safeAppPath } from '../routes';
import { AuthForm } from './AuthForm';

export function SignInScreen() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const fromState = (location.state as { from?: string } | null)?.from;
  const next = safeAppPath(params.get('next') ?? fromState);

  usePageTitle('Sign in | Chat App');

  return (
    <AuthForm
      loadingLabel="Signing in..."
      mode="signin"
      onForgot={() =>
        navigate({ pathname: paths.forgotPassword, search: location.search })
      }
      onSubmit={async (values) => {
        await login(values.email, values.password);
        navigate(next, { replace: true });
      }}
      onSwitch={() =>
        navigate({ pathname: paths.signup, search: location.search })
      }
      submitLabel="Sign in"
      subtitle="Use the email and password for your account."
      switchAction="Sign up"
      switchLabel="New here?"
      title="Sign in"
    />
  );
}
