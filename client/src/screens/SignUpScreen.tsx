import { AuthForm } from './AuthForm';
import { persistSession, register, type User } from '../api';

type SignUpScreenProps = {
  onSuccess: (user: User) => void;
  onGoToSignIn: () => void;
};

export function SignUpScreen({ onSuccess, onGoToSignIn }: SignUpScreenProps) {
  return (
    <AuthForm
      includeEmail
      includeName
      loadingLabel="Creating account..."
      onSubmit={async (values) => {
        const session = await register(values);
        persistSession(session);
        onSuccess(session.user);
      }}
      onSwitch={onGoToSignIn}
      passwordAutoComplete="new-password"
      submitLabel="Sign up"
      subtitle="Create an account to start chatting."
      switchAction="Sign in"
      switchLabel="Already have an account?"
      title="Sign up"
    />
  );
}
