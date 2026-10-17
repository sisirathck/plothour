import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import './HeaderActions.css';

export const HeaderActions = ({ onTryDemo }) => {
  return (
    <header className="minimal-header-actions" role="banner">
      <button
        type="button"
        id="try-me-btn"
        className="minimal-try-me-btn"
        onClick={onTryDemo}
        aria-label="Open demo dashboard"
      >
        Try demo
      </button>

      <ThemeToggle />
    </header>
  );
};
