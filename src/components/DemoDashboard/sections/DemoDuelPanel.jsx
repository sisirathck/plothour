import React from 'react';
import { Award, Swords } from 'lucide-react';

export const DemoDuelPanel = () => (
  <section className="duel-arena-card" aria-labelledby="demo-duel-title">
    <div className="section-header">
      <div className="header-title-group">
        <Swords className="section-icon duel-icon" size={20} />
        <h3 id="demo-duel-title">Live Study Duel</h3>
      </div>
      <span className="duel-badge live">ROUND 2 OF 3</span>
    </div>

    <p className="duel-subtitle">
      You are dueling <strong>Marcus Vance (Stanford CS)</strong> for the daily focus crown!
    </p>

    <div className="duel-match-progress">
      <div className="duel-participant you">
        <span className="name">You</span>
        <span className="hours">3h 42m</span>
      </div>
      <div className="duel-vs-divider">VS</div>
      <div className="duel-participant rival">
        <span className="name">Marcus V.</span>
        <span className="hours">3h 15m</span>
      </div>
    </div>

    <div className="duel-progress-bar-track" aria-label="Duel progress: 58 percent">
      <div className="duel-progress-bar-fill" style={{ width: '58%' }} />
    </div>

    <div className="duel-footer-banner">
      <Award className="award-icon" size={16} />
      <span>Leading by <strong>27 mins</strong>! +150 Duel Rating upon completion.</span>
    </div>
  </section>
);
