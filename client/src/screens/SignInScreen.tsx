import { AuthForm } from './AuthForm';
import { signIn, type User } from '../api';

type SignInScreenProps = {
  onSuccess: (user: User) => void;
  onGoToSignUp: () => void;
};

export function SignInScreen({ onSuccess, onGoToSignUp }: SignInScreenProps) {
  return (
    <AuthForm
      loadingLabel="Signing in..."
      onSubmit={async (values) => {
        const user = await signIn({
          firstName: values.firstName,
          lastName: values.lastName,
          password: values.password,
        });
        onSuccess(user);
      }}
      onSwitch={onGoToSignUp}
      submitLabel="Sign in"
      subtitle="Use the first name, last name, and password you registered with."
      switchAction="Sign up"
      switchLabel="New here?"
      title="Sign in"
    />
  );
}
