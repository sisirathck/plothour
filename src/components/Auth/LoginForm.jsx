import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2, User } from 'lucide-react';
import { FormInput } from './FormInput';
import { NoticeBanner } from './NoticeBanner';
import { SocialAuth } from './SocialAuth';
import { useTheme } from '../../context/ThemeContext';
import './LoginForm.css';

let googleIdentityScriptPromise;

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', reject, { once: true });
  });

  return googleIdentityScriptPromise;
};

export const LoginForm = ({ isSignUp = false, onLoginSuccess, onSignUpClick, onLogInClick }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  const [error, setError] = useState('');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');

  // Forgot Password flow state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState('request'); // 'request' | 'verify'
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');

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

    const renderGoogleBtn = () => {
      const btnEl = document.getElementById('google-signin-btn-container');
      if (!btnEl || !window.google?.accounts?.id) return;

      const measuredWidth = Math.floor(
        btnEl.clientWidth ||
        btnEl.getBoundingClientRect().width ||
        document.querySelector('.login-submit-btn')?.clientWidth ||
        368
      );
      const targetWidth = Math.min(400, Math.max(200, measuredWidth || 368));
      const signature = `${targetWidth}:${theme}:${serverStatus.googleClientId}`;

      if (btnEl.dataset.renderedSignature === signature && btnEl.querySelector('[role="button"]')) {
        setGoogleButtonReady(true);
        return;
      }

      btnEl.dataset.ready = 'false';
      setGoogleButtonReady(false);
      btnEl.innerHTML = '';
      window.google.accounts.id.renderButton(btnEl, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large',
        type: 'standard',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: targetWidth,
      });
      btnEl.dataset.renderedSignature = signature;
      btnEl.dataset.ready = 'true';
      setGoogleButtonReady(true);
    };

    const setupGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: serverStatus.googleClientId,
          callback: handleGoogleCredentialResponse,
        });

        const btnEl = document.getElementById('google-signin-btn-container');
        if (theme === 'dark') {
          if (btnEl) {
            btnEl.innerHTML = '';
            delete btnEl.dataset.renderedSignature;
            btnEl.dataset.ready = 'false';
          }
          setGoogleButtonReady(false);
        } else {
          renderGoogleBtn();
        }
      }
    };

    if (window.google?.accounts?.id) setupGsi();
    else loadGoogleIdentityScript().then(setupGsi).catch(() => setGoogleButtonReady(false));

    if (theme === 'dark') return;

    const btnEl = document.getElementById('google-signin-btn-container');
    let resizeObserver = null;
    if (btnEl && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        renderGoogleBtn();
      });
      resizeObserver.observe(btnEl);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [serverStatus.googleClientId, handleGoogleCredentialResponse, isSignUp, theme]);

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

  const exitForgotPassword = () => {
    setIsForgotPassword(false);
    setForgotStep('request');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setForgotMessage('');
  };

  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');

    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send reset code.');
      }
      setForgotStep('verify');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setForgotMessage(data.message || `A 6-digit reset code has been sent to ${targetEmail}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendResetCode = async () => {
    setError('');
    setForgotMessage('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/resend-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resend the reset code.');
      setResetCode('');
      setForgotMessage('A fresh verification code is on its way to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setForgotMessage('');

    if (resetCode.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail.trim().toLowerCase(),
          code: resetCode.trim(),
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset password.');

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
    } else if (!serverStatus.googleAuth) {
      setError('Google Sign-In is not configured yet. Add GOOGLE_CLIENT_ID to .env to enable it.');
    } else {
      setError('Google Sign-In is still initializing. Please try again in a moment.');
    }
  };

  return (
    <div className="login-card-container">
      {/* Main Headings */}
      <header className="login-card-header">
        <h1 className="login-main-title">
          {isForgotPassword
            ? forgotStep === 'request'
              ? 'Reset your password'
              : 'Create new password'
            : isSignUp
            ? 'Create your account'
            : 'Welcome back'}
        </h1>
        <p className="login-subtitle">
          {isForgotPassword
            ? forgotStep === 'request'
              ? 'Enter your registered email address and we’ll send you a 6-digit code to reset your password.'
              : `Enter the code sent to ${resetEmail || 'your email'} and choose your new password.`
            : isSignUp
            ? 'Join StudyDuel and keep your progress moving.'
            : 'Sign in to your dashboard and keep your progress moving.'}
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
        <NoticeBanner message="Email verification is not configured on this server. Configure SMTP or Resend credentials before enabling account creation." />
      )}
      {serverStatus.checked && isSignUp && serverStatus.emailVerificationDevMode && !verificationEmail && (
        <NoticeBanner message="Local Dev Mode: Email credentials not set. 6-digit verification codes will be printed to your server terminal." />
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
      ) : isForgotPassword ? (
        /* Forgot Password Request & Verification Steps */
        forgotStep === 'request' ? (
          <form className="login-form" onSubmit={handleRequestResetCode} noValidate>
            {error && <div className="login-general-error" role="alert">{error}</div>}
            {forgotMessage && <div className="login-verification-message" role="status">{forgotMessage}</div>}

            <FormInput
              id="forgot-email"
              label="Email address"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Enter your registered email"
              icon={Mail}
              autoComplete="email"
              required
            />

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading || !resetEmail.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="btn-spinner" size={16} />
                  <span>Sending reset code...</span>
                </>
              ) : (
                <span>Send reset code</span>
              )}
            </button>

            <button
              type="button"
              className="login-secondary-action"
              onClick={exitForgotPassword}
            >
              Back to log in
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleResetPassword} noValidate>
            {error && <div className="login-general-error" role="alert">{error}</div>}
            {forgotMessage && <div className="login-verification-message" role="status">{forgotMessage}</div>}

            <p className="login-verification-intro">
              Enter the 6-digit code sent to <strong>{resetEmail}</strong> and your new password.
            </p>

            {serverStatus.emailVerificationDevMode && (
              <p style={{ fontSize: '0.82rem', color: '#a78bfa', marginTop: '-4px', marginBottom: '14px', lineHeight: 1.4 }}>
                💡 <strong>Dev Mode:</strong> Check the terminal running <code>npm run dev</code> to copy the 6-digit reset code.
              </p>
            )}

            <FormInput
              id="reset-code"
              label="Verification code"
              type="text"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              icon={Mail}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
            />

            <FormInput
              id="reset-new-password"
              label="New password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              icon={Lock}
              autoComplete="new-password"
              required
              rightSlot={
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                </button>
              }
            />

            <FormInput
              id="reset-confirm-password"
              label="Confirm new password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              icon={Lock}
              autoComplete="new-password"
              required
              rightSlot={
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                </button>
              }
            />

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isLoading || resetCode.length !== 6 || newPassword.length < 8 || !confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="btn-spinner" size={16} />
                  <span>Resetting password...</span>
                </>
              ) : (
                <span>Reset password & sign in</span>
              )}
            </button>

            <button
              type="button"
              className="login-secondary-action"
              onClick={handleResendResetCode}
              disabled={isLoading}
            >
              Resend reset code
            </button>
            <button
              type="button"
              className="login-secondary-action"
              onClick={() => {
                setForgotStep('request');
                setError('');
                setForgotMessage('');
              }}
            >
              Use a different email
            </button>
            <button
              type="button"
              className="login-secondary-action"
              onClick={exitForgotPassword}
            >
              Back to log in
            </button>
          </form>
        )
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

          {!isSignUp && (
            <div className="forgot-password-row">
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => {
                  setIsForgotPassword(true);
                  setForgotStep('request');
                  setResetEmail(email.trim());
                  setError('');
                  setForgotMessage('');
                }}
              >
                Forgot password?
              </button>
            </div>
          )}
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
      {!verificationEmail && !isForgotPassword && (
        <SocialAuth
          onGoogleClick={handleGoogleLogin}
          isLoading={isLoading}
          googleAvailable={Boolean(serverStatus.googleClientId) && theme !== 'dark'}
          googleButtonReady={googleButtonReady}
        />
      )}

      {/* Footer Link */}
      {!verificationEmail && !isForgotPassword && (
        <footer className="login-card-footer">
          <span className="footer-text">{isSignUp ? 'Already have an account? ' : 'Don’t have an account? '}</span>
          <button
            type="button"
            className="signup-link-btn"
            onClick={() => {
              exitForgotPassword();
              if (isSignUp) {
                onLogInClick?.();
              } else {
                onSignUpClick?.();
              }
            }}
          >
            {isSignUp ? 'Log in' : 'Sign up'}
          </button>
        </footer>
      )}
    </div>
  );
};
