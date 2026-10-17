import React, { useState } from 'react';
import './NoticeBanner.css';

export const NoticeBanner = ({
  message = 'Account sign-in is not set up on this server yet. Configure PostgreSQL and AUTH_SECRET to enable accounts.',
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="compact-notice-banner" role="alert">
      <p className="notice-banner-text">{message}</p>
    </div>
  );
};
