import React from 'react';

export const WorkspaceHeader = ({ title, description, children }) => (
  <header className="workspace-section-header">
    <div>
      <span className="workspace-section-eyebrow">WORKSPACE</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {children && <div className="workspace-section-meta">{children}</div>}
  </header>
);
