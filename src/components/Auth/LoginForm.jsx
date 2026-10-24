import React, { useState, useEffect, useCallback } from 'react';
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
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [serverStatus, setServerStatus] = useState({
    checked: false,
    configured: false,
    googleAuth: false,
    emailVerification: false,
    emailVerificationDevMode: false,
    googleClientId: null,
  });

  const handleGoogleCredentialResponse = useCallback(async (response) => {
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
      if (!res.ok) throw new Error(data.error || 'Google authentication failed');
      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [onLoginSuccess]);

  // Check server configuration status on mount
  useEffect(() => {
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        setServerStatus({
          checked: true,
          configured: Boolean(data.configured),
          googleAuth: Boolean(data.googleAuth),
          emailVerification: Boolean(data.emailVerification),
          emailVerificationDevMode: Boolean(data.emailVerificationDevMode),
          googleClientId: data.googleClientId,
        });
      })
      .catch(() => {
        setServerStatus({
          checked: true,
          configured: false,
          googleAuth: false,
          emailVerification: false,
          emailVerificationDevMode: false,
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
  }, [serverStatus.googleClientId, handleGoogleCredentialResponse]);

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

      if (isSignUp && data.verificationRequired) {
        setVerificationEmail(data.email || email.trim().toLowerCase());
        setVerificationCode('');
        setVerificationMessage('We sent a 6-digit verification code to your email. It expires in 10 minutes.');
        return;
      }

      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setVerificationMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not verify your email.');
      onLoginSuccess?.(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setVerificationMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verificationEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend the code.');
      setVerificationCode('');
      setVerificationMessage('A new verification code is on its way.');
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
      {serverStatus.checked && isSignUp && serverStatus.configured && !serverStatus.emailVerification && (
        <NoticeBanner message="Email verification is not configured on this server. Add RESEND_API_KEY and EMAIL_FROM before enabling account creation." />
      )}
      {serverStatus.checked && isSignUp && serverStatus.emailVerificationDevMode && !verificationEmail && (
        <NoticeBanner message="Local Dev Mode: Resend credentials not set. 6-digit verification codes will be printed to your server terminal." />
      )}

      {verificationEmail ? (
        <form className="login-form" onSubmit={handleVerifyEmail} noValidate>
          {error && <div className="login-general-error" role="alert">{error}</div>}
          {verificationMessage && <div className="login-verification-message" role="status">{verificationMessage}</div>}
          <p className="login-verification-intro">Enter the code we sent to <strong>{verificationEmail}</strong> to activate your account.</p>
          {serverStatus.emailVerificationDevMode && (
            <p style={{ fontSize: '0.82rem', color: '#a78bfa', marginTop: '-4px', marginBottom: '14px', lineHeight: 1.4 }}>
              💡 <strong>Dev Mode:</strong> Check the terminal running <code>npm run dev</code> to copy the 6-digit verification code.
            </p>
          )}
          <FormInput
            id="signup-verification-code"
            label="Verification code"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="6-digit code"
            icon={Mail}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
          <button type="submit" className="login-submit-btn" disabled={isLoading || verificationCode.length !== 6}>
            {isLoading ? <><Loader2 className="btn-spinner" size={16} /><span>Verifying...</span></> : <span>Verify email and create account</span>}
          </button>
          <button type="button" className="login-secondary-action" onClick={handleResendVerification} disabled={isLoading}>
            Resend verification code
          </button>
          <button type="button" className="login-secondary-action" onClick={() => { setVerificationEmail(''); setVerificationCode(''); setVerificationMessage(''); setError(''); }}>
            Use a different email
          </button>
          <button type="button" className="login-secondary-action" onClick={() => { setVerificationEmail(''); setVerificationCode(''); setVerificationMessage(''); setError(''); onLogInClick?.(); }}>
            Back to log in
          </button>
        </form>
      ) : (
      /* Login or registration form */
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
          disabled={isLoading || (isSignUp && serverStatus.checked && (!serverStatus.configured || !serverStatus.emailVerification))}
        >
          {isLoading ? (
            <>
              <Loader2 className="btn-spinner" size={16} />
              <span>{isSignUp ? 'Sending code...' : 'Signing in...'}</span>
            </>
          ) : (
            <span>{isSignUp ? 'Create account' : 'Log in'}</span>
          )}
        </button>
      </form>
      )}

      {/* Social Auth Option */}
      {!isSignUp && !verificationEmail && <SocialAuth onGoogleClick={handleGoogleLogin} isLoading={isLoading} />}

      {/* Footer Link */}
      {!verificationEmail && <footer className="login-card-footer">
        <span className="footer-text">{isSignUp ? 'Already have an account? ' : 'Don’t have an account? '}</span>
        <button
          type="button"
          className="signup-link-btn"
          onClick={isSignUp ? onLogInClick : onSignUpClick}
        >
          {isSignUp ? 'Log in' : 'Sign up'}
        </button>
      </footer>}
    </div>
  );
};
