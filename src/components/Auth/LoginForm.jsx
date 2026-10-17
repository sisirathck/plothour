import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { FormInput } from './FormInput';
import { NoticeBanner } from './NoticeBanner';
import { SocialAuth } from './SocialAuth';
import './LoginForm.css';

export const LoginForm = ({ isSignUp = false, onLoginSuccess, onSignUpClick, onLogInClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      onSignUpClick?.();
      return;
    }

    if (!email) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess({ email });
      }
    }, 600);
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess({ email: 'alex.rivers@gmail.com', provider: 'google' });
      }
    }, 500);
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

      {/* Setup Notice Banner (from reference screenshot) */}
      <NoticeBanner
        message={isSignUp
          ? 'Account creation is not available until server authentication is configured.'
          : 'Account sign-in is not set up on this server yet. Configure PostgreSQL and AUTH_SECRET to enable accounts.'}
      />

      {/* Login Form */}
      <form className="login-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="login-general-error">{error}</div>}

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
