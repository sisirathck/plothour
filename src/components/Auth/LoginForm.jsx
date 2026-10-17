import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, User } from 'lucide-react';
import { FormInput } from './FormInput';
import { NoticeBanner } from './NoticeBanner';
import { SocialAuth } from './SocialAuth';
import './LoginForm.css';

export const LoginForm = ({ isSignUp = false, onLoginSuccess, onSignUpClick, onLogInClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState({
    checked: false,
    configured: false,
    googleAuth: false,
    googleClientId: null,
  });

  // Check server configuration status on mount
  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus({
          checked: true,
          configured: Boolean(data.configured),
          googleAuth: Boolean(data.googleAuth),
          googleClientId: data.googleClientId,
        });
      })
      .catch(() => {
        setServerStatus({
          checked: true,
          configured: false,
          googleAuth: false,
          googleClientId: null,
        });
      });
  }, []);

  // Initialize Google Identity Services if Client ID is configured
  useEffect(() => {
    if (!serverStatus.googleClientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: serverStatus.googleClientId,
          callback: handleGoogleCredentialResponse,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [serverStatus.googleClientId]);

  const handleGoogleCredentialResponse = async (response) => {
    if (!response.credential) return;
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed');
      }

      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (isSignUp && password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp
        ? { email, password, displayName: displayName || email.split('@')[0] }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (isSignUp ? 'Registration failed.' : 'Login failed.'));
      }

      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    if (serverStatus.googleAuth && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to .env to enable it. Email & password sign-in is ready!');
    }
  };

  return (
    <div className="login-card-container">
      {/* Main Headings */}
      <header className="login-card-header">
        <h1 className="login-main-title">{isSignUp ? 'Create your account' : 'Welcome back'}</h1>
        <p className="login-subtitle">
          {isSignUp ? 'Join StudyDuel and keep your progress moving.' : 'Sign in to your dashboard and keep your progress moving.'}
        </p>
      </header>

      {/* Setup Notice Banner (only shown if PostgreSQL / AUTH_SECRET are unconfigured) */}
      {serverStatus.checked && !serverStatus.configured && (
        <NoticeBanner
          message={isSignUp
            ? 'Account creation is not available until server authentication is configured.'
            : 'Account sign-in is not set up on this server yet. Configure PostgreSQL and AUTH_SECRET to enable accounts.'}
        />
      )}

      {/* Login Form */}
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="login-general-error">{error}</div>}

        {isSignUp && (
          <FormInput
            id="signup-name"
            label="Name (optional)"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should friends see you?"
            icon={User}
            autoComplete="name"
          />
        )}

        <FormInput
          id="login-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          icon={Mail}
          autoComplete="email"
          required
        />

        <div className="password-field-container">
          <FormInput
            id="login-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            icon={Lock}
            autoComplete="current-password"
            required
            rightSlot={
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={1.8} />
                ) : (
                  <Eye size={16} strokeWidth={1.8} />
                )}
              </button>
            }
          />

          {!isSignUp && <div className="forgot-password-row">
            <a
              href="#forgot-password"
              className="forgot-password-link"
              onClick={(e) => {
                e.preventDefault();
                alert('Password reset instructions will be sent to ' + (email || 'your registered email'));
              }}
            >
              Forgot password?
            </a>
          </div>}
        </div>

        {/* Primary Log In Button (exact peach-coral tone) */}
        <button
          type="submit"
          id="login-submit-btn"
          className="login-submit-btn"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="btn-spinner" size={16} />
              <span>Signing in...</span>
            </>
          ) : (
            <span>{isSignUp ? 'Create account' : 'Log in'}</span>
          )}
        </button>
      </form>

      {/* Social Auth Option */}
      {!isSignUp && <SocialAuth onGoogleClick={handleGoogleLogin} isLoading={isLoading} />}

      {/* Footer Link */}
      <footer className="login-card-footer">
        <span className="footer-text">{isSignUp ? 'Already have an account? ' : 'Don’t have an account? '}</span>
        <button
          type="button"
          className="signup-link-btn"
          onClick={isSignUp ? onLogInClick : onSignUpClick}
        >
          {isSignUp ? 'Log in' : 'Sign up'}
        </button>
      </footer>
    </div>
  );
};
