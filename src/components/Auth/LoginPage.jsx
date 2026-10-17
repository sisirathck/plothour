import React, { useState } from 'react';
import { BackgroundBackdrop } from '../Background/BackgroundBackdrop';
import { HeaderActions } from '../Header/HeaderActions';
import { StudyDuelLogo } from '../Logo/StudyDuelLogo';
import { LoginForm } from './LoginForm';
import './LoginPage.css';

export const LoginPage = ({ onTryDemo }) => {
  const [notification, setNotification] = useState(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleTryDemo = () => {
    onTryDemo?.();
  };

  const showToast = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const handleLoginSuccess = (userData) => {
    showToast(`Welcome back, ${userData.email}! Sign-in verified.`, 'success');
  };

  return (
    <div className="login-page-wrapper">
      {/* Dynamic Background Illustration with Cross-fade */}
      <BackgroundBackdrop />

      {/* Top Header Bar: Brand Logo & Tagline on Left, Try Demo & Theme Toggle on Right */}
      <header className="login-header-bar">
        <div className="login-brand-header">
          <StudyDuelLogo size="large" />
          <p className="login-brand-tagline">A little progress, every day</p>
        </div>
        <HeaderActions onTryDemo={handleTryDemo} />
      </header>

      {/* Toast Alert */}
      {notification && (
        <div className={`login-toast-notification toast-${notification.type}`} role="status">
          <span>{notification.message}</span>
        </div>
      )}

      <main className="login-page-main">
        <div className="login-left-pane">
          {/* Modular Login Card */}
          <div className="login-form-wrapper">
            <LoginForm
              isSignUp={isSignUp}
              onLoginSuccess={handleLoginSuccess}
              onSignUpClick={() => {
                if (isSignUp) {
                  showToast('Account creation is not available until server authentication is configured.', 'info');
                } else {
                  setIsSignUp(true);
                }
              }}
              onLogInClick={() => setIsSignUp(false)}
            />
          </div>
        </div>

        {/* Right pane keeps the desk & girl illustration fully visible */}
        <div className="login-right-pane" aria-hidden="true" />
      </main>
    </div>
  );
};
