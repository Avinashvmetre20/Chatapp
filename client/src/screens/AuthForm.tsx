import { useState, type FormEvent } from 'react';

type AuthFormProps = {
  title: string;
  subtitle: string;
  submitLabel: string;
  loadingLabel: string;
  switchLabel: string;
  switchAction: string;
  onSwitch: () => void;
  onSubmit: (values: {
    firstName: string;
    lastName: string;
    password: string;
  }) => Promise<void>;
};

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export function AuthForm({
  title,
  subtitle,
  submitLabel,
  loadingLabel,
  switchLabel,
  switchAction,
  onSwitch,
  onSubmit,
}: AuthFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await onSubmit({ firstName, lastName, password });
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

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-gray-700">Password</span>
          <input
            autoComplete="current-password"
            className={fieldClass}
            maxLength={20}
            minLength={6}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <button
          className="w-full rounded-xl bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? loadingLabel : submitLabel}
        </button>

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
