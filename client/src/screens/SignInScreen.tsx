import { AuthForm } from './AuthForm';
import { persistSession, signIn, type User } from '../api';

type SignInScreenProps = {
  onSuccess: (user: User) => void;
  onGoToSignUp: () => void;
};

export function SignInScreen({ onSuccess, onGoToSignUp }: SignInScreenProps) {
  return (
    <AuthForm
      includeEmail
      includeName={false}
      loadingLabel="Signing in..."
      onSubmit={async (values) => {
        const session = await signIn({
          email: values.email,
          password: values.password,
        });
        persistSession(session);
        onSuccess(session.user);
      }}
      onSwitch={onGoToSignUp}
      passwordAutoComplete="current-password"
      submitLabel="Sign in"
      subtitle="Use the email and password you registered with."
      switchAction="Sign up"
      switchLabel="New here?"
      title="Sign in"
    />
  );
}
