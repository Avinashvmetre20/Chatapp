import { AuthForm } from './AuthForm';
import { useAuth } from '../auth/AuthContext';

type SignUpScreenProps = {
  onGoToSignIn: () => void;
};

export function SignUpScreen({ onGoToSignIn }: SignUpScreenProps) {
  const { register } = useAuth();

  return (
    <AuthForm
      loadingLabel="Creating account..."
      mode="signup"
      onSubmit={async (values) => {
        await register(values);
      }}
      onSwitch={onGoToSignIn}
      submitLabel="Sign up"
      subtitle="Create an account with your email to start chatting."
      switchAction="Sign in"
      switchLabel="Already have an account?"
      title="Sign up"
    />
  );
}
