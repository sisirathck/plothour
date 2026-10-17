import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';

const getClock = () => new Date();

export const DemoClock = () => {
  const [now, setNow] = useState(getClock);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(getClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="demo-clock-card" aria-label="Current local date and time">
      <div className="demo-clock-date"><CalendarDays size={17} /><span>{now.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      <div className="demo-clock-time"><Clock3 size={18} /><time>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}</time></div>
    </section>
  );
};
