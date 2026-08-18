import { useState, type FormEvent } from 'react';

type AuthFormProps = {
  mode: 'signin' | 'signup';
  title: string;
  subtitle: string;
  submitLabel: string;
  loadingLabel: string;
  switchLabel: string;
  switchAction: string;
  onSwitch: () => void;
  onForgot?: () => void;
  onSubmit: (values: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
};

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export function AuthForm({
  mode,
  title,
  subtitle,
  submitLabel,
  loadingLabel,
  switchLabel,
  switchAction,
  onSwitch,
  onForgot,
  onSubmit,
}: AuthFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({ firstName, lastName, email, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4 py-8 text-gray-900">
      <form
        className="w-full max-w-md space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8"
        onSubmit={handleSubmit}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium text-sky-600">Chat App</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {mode === 'signup' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">First name</span>
              <input
                autoComplete="given-name"
                className={fieldClass}
                maxLength={50}
                onChange={(event) => setFirstName(event.target.value)}
                required
                value={firstName}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Last name</span>
              <input
                autoComplete="family-name"
                className={fieldClass}
                maxLength={50}
                onChange={(event) => setLastName(event.target.value)}
                required
                value={lastName}
              />
            </label>
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            autoComplete="email"
            className={fieldClass}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <input
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className={fieldClass}
            maxLength={72}
            minLength={mode === 'signup' ? 8 : 1}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {mode === 'signup' ? (
            <span className="text-xs text-gray-500">
              At least 8 characters, with uppercase, lowercase, and a number.
            </span>
          ) : null}
        </label>

        {mode === 'signup' ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Confirm password</span>
            <input
              autoComplete="new-password"
              className={fieldClass}
              maxLength={72}
              minLength={8}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              type="password"
              value={confirmPassword}
            />
          </label>
        ) : null}

        <button
          className="w-full rounded-xl bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? loadingLabel : submitLabel}
        </button>

        {mode === 'signin' && onForgot ? (
          <p className="text-center text-sm">
            <button
              className="font-medium text-sky-600 hover:text-sky-500"
              onClick={onForgot}
              type="button"
            >
              Forgot password?
            </button>
          </p>
        ) : null}

        <p className="text-center text-sm text-gray-500">
          {switchLabel}{' '}
          <button
            className="font-medium text-sky-600 hover:text-sky-500"
            onClick={onSwitch}
            type="button"
          >
            {switchAction}
          </button>
        </p>
      </form>
    </div>
  );
}
