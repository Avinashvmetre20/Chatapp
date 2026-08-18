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
    <div className="flex min-h-screen items-center justify-center bg-white px-4 text-gray-900">
      <form
        className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-sky-500"
          maxLength={50}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="First name"
          required
          value={firstName}
        />
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-sky-500"
          maxLength={50}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Last name"
          required
          value={lastName}
        />
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none placeholder:text-gray-400 focus:border-sky-500"
          maxLength={20}
          minLength={6}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password (6-20 chars)"
          required
          type="password"
          value={password}
        />

        <button
          className="w-full rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
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
