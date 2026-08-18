import { AuthForm } from './AuthForm';
import { useAuth } from '../auth/AuthContext';

type SignInScreenProps = {
  onGoToSignUp: () => void;
  onForgotPassword: () => void;
};

export function SignInScreen({ onGoToSignUp, onForgotPassword }: SignInScreenProps) {
  const { login } = useAuth();

  return (
    <AuthForm
      loadingLabel="Signing in..."
      mode="signin"
      onForgot={onForgotPassword}
      onSubmit={async (values) => {
        await login(values.email, values.password);
      }}
      onSwitch={onGoToSignUp}
      submitLabel="Sign in"
      subtitle="Use the email and password for your account."
      switchAction="Sign up"
      switchLabel="New here?"
      title="Sign in"
    />
  );
}
