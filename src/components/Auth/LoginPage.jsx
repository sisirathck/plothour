import React, { useState } from 'react';
import { ArrowRight, Clock3 } from 'lucide-react';
import { BackgroundBackdrop } from '../Background/BackgroundBackdrop';
import { HeaderActions } from '../Header/HeaderActions';
import { StudyDuelLogo } from '../Logo/StudyDuelLogo';
import { LoginForm } from './LoginForm';
import { getSiteFontStyle, useSiteCustomization } from '../../context/SiteCustomizationContext';
import './LoginPage.css';

export const LoginPage = ({ onTryDemo, onLoginSuccess }) => {
  const { config, text } = useSiteCustomization();
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
    showToast(`Welcome, ${userData.display_name || userData.email}!`, 'success');
    onLoginSuccess?.(userData);
  };

  return (
    <div className="login-page-wrapper" style={getSiteFontStyle(config, 'login')}>
      {/* Theme-aware minimal background with cross-fade */}
      <BackgroundBackdrop />

      {/* Top Header Bar: Brand Logo & Tagline on Left, Try Demo & Theme Toggle on Right */}
      <header className="login-header-bar">
        <div className="login-brand-header">
          <StudyDuelLogo size="large" />
          <p className="login-brand-tagline">{text('login', 'tagline', 'Turn time into progress')}</p>
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
            {new URLSearchParams(window.location.search).get('extension') === '1' && <p role="status">Sign in with Google below to connect your browser timer. Then reopen the extension.</p>}
            <LoginForm
              isSignUp={isSignUp}
              onLoginSuccess={handleLoginSuccess}
              onSignUpClick={() => setIsSignUp(true)}
              onLogInClick={() => setIsSignUp(false)}
            />
          </div>
        </div>

        {/* A quiet product vignette balances the sign-in card without competing with it. */}
        <aside className="login-right-pane" aria-hidden="true">
          <div className="login-story-panel">
            <div className="login-story-copy">
              <span className="login-story-eyebrow"><i /> STUDY WITH INTENTION</span>
              <h1>Make time for<br />what matters.</h1>
              <p>A calmer way to focus, build a rhythm, and see your progress.</p>
            </div>
            <div className="login-focus-art">
              <div className="login-focus-halo" />
              <div className="login-focus-dial">
                <div className="login-focus-dial-core">
                  <Clock3 size={20} strokeWidth={1.6} />
                  <span>YOUR NEXT HOUR</span>
                  <strong>ONE THING</strong>
                  <small>AT A TIME</small>
                </div>
              </div>
              <div className="login-session-note">
                <span className="login-session-index">01</span>
                <div><small>START WITH INTENTION</small><strong>Choose one clear goal</strong></div>
                <ArrowRight size={15} />
              </div>
              <div className="login-ritual-line"><span>PLAN</span><i /><span className="is-active">FOCUS</span><i /><span>REFLECT</span></div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
