import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { paths, safeAppPath } from '../routes';
import { AuthForm } from './AuthForm';

export function SignUpScreen() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeAppPath(params.get('next'));

  usePageTitle('Sign up | Chat App');

  return (
    <AuthForm
      loadingLabel="Creating account..."
      mode="signup"
      onSubmit={async (values) => {
        await register(values);
        navigate(next, { replace: true });
      }}
      onSwitch={() =>
        navigate({ pathname: paths.login, search: location.search })
      }
      submitLabel="Sign up"
      subtitle="Create an account with your email to start chatting."
      switchAction="Sign in"
      switchLabel="Already have an account?"
      title="Sign up"
    />
  );
}
