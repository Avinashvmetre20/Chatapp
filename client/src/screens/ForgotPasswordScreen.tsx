import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api';
import { usePageTitle } from '../hooks/usePageTitle';
import { paths } from '../routes';

const fieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  usePageTitle('Forgot password | Chat App');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setDone(true);
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
          <h1 className="text-2xl font-semibold sm:text-3xl">Forgot password</h1>
          <p className="text-sm text-gray-500">
            If an account exists for this email, a reset was created. Check with the
            administrator to complete the reset.
          </p>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {done ? (
          <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
            If that email is registered, you can continue from the reset step.
          </p>
        ) : (
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
        )}

        {done ? null : (
          <button
            className="w-full rounded-xl bg-sky-600 px-4 py-3 text-base font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Sending...' : 'Send reset'}
          </button>
        )}

        <p className="text-center text-sm text-gray-500">
          <button
            className="font-medium text-sky-600 hover:text-sky-500"
            onClick={() =>
              navigate({ pathname: paths.login, search: location.search })
            }
            type="button"
          >
            Back to sign in
          </button>
        </p>
      </form>
    </div>
  );
}
