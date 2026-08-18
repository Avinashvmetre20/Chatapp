import { AuthForm } from './AuthForm';
import { createUser, type User } from '../api';

type SignUpScreenProps = {
  onSuccess: (user: User) => void;
  onGoToSignIn: () => void;
};

export function SignUpScreen({ onSuccess, onGoToSignIn }: SignUpScreenProps) {
  return (
    <AuthForm
      loadingLabel="Creating account..."
      onSubmit={async (values) => {
        const user = await createUser(values);
        onSuccess(user);
      }}
      onSwitch={onGoToSignIn}
      submitLabel="Sign up"
      subtitle="Create an account to start chatting."
      switchAction="Sign in"
      switchLabel="Already have an account?"
      title="Sign up"
    />
  );
}
