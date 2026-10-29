import React from 'react';

/**
 * Reserved lower-half panel for the timer workspace.
 *
 * Keeping this as a standalone shell lets future timer tools replace the
 * placeholder body without coupling them to TimerPage or the active timer.
 */
export const TimerPlaceholderPanel = ({
  title = 'PLACEHOLDER',
  children,
  className = '',
}) => {
  const titleId = 'timer-placeholder-title';

  return (
    <section
      className={`timer-horology-placeholder${className ? ` ${className}` : ''}`}
      aria-labelledby={titleId}
    >
      <header className="timer-horology-placeholder-header">
        <span className="timer-horology-placeholder-mark" aria-hidden="true" />
        <h2 id={titleId}>{title}</h2>
      </header>
      <div className="timer-horology-placeholder-body">
        {children}
      </div>
    </section>
  );
};
