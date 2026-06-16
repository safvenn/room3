import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'login' | 'register';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } =
      mode === 'login'
        ? await signIn(form.email, form.password)
        : await signUp(form.email, form.password, form.name);

    if (authError) {
      setError(authError.message);
    }

    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">💰</div>
          <span className="auth-logo-text">BudgetBuddy</span>
        </div>

        <h1 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to your account to continue'
            : 'Start managing your money smarter'}
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 4 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} id="auth-form">
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label" htmlFor="auth-name">Display name</label>
              <input
                id="auth-name"
                type="text"
                className="form-control"
                placeholder="Your name"
                value={form.name}
                onChange={set('name')}
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={form.email}
              onChange={set('email')}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="auth-password"
                type={showPw ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)',
                  display: 'flex', alignItems: 'center',
                }}
                id="toggle-password"
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            id="auth-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          {mode === 'login' ? (
            <>Don't have an account?{' '}
              <span className="auth-link" onClick={() => { setMode('register'); setError(null); }} id="switch-to-register">
                Sign up
              </span>
            </>
          ) : (
            <>Already have an account?{' '}
              <span className="auth-link" onClick={() => { setMode('login'); setError(null); }} id="switch-to-login">
                Sign in
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
