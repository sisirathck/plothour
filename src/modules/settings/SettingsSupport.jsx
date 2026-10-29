import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateFormat';

export const getUserKey = (user, suffix) =>
  user?.id ? `studyduel_user_${user.id}_${suffix}` : `studyduel_demo_${suffix}`;

export const readJson = (key, fallback) => {
  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');
    return data ?? fallback;
  } catch {
    return fallback;
  }
};

export const downloadFile = (content, type, filename) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 100);
};

export const csvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

const DATE_FORMAT_GROUPS = [
  {
    label: 'System',
    options: [{ value: 'system', label: 'System default' }],
  },
  {
    label: 'Day first',
    options: [
      { value: 'dmy-slash', label: 'DD/MM/YYYY' },
      { value: 'dmy-slash-short', label: 'DD/MM/YY' },
      { value: 'dmy-dash', label: 'DD-MM-YYYY' },
      { value: 'dmy-dash-short', label: 'DD-MM-YY' },
      { value: 'dmy-dot', label: 'DD.MM.YYYY' },
      { value: 'dmy-dot-short', label: 'DD.MM.YY' },
    ],
  },
  {
    label: 'Month first',
    options: [
      { value: 'mdy-slash', label: 'MM/DD/YYYY' },
      { value: 'mdy-slash-short', label: 'MM/DD/YY' },
      { value: 'mdy-dash', label: 'MM-DD-YYYY' },
      { value: 'mdy-dot', label: 'MM.DD.YYYY' },
    ],
  },
  {
    label: 'Year first',
    options: [{ value: 'year-month-day', label: 'YYYY-MM-DD' }],
  },
  {
    label: 'Written',
    options: [
      { value: 'day-month-year', label: 'Day before month' },
      { value: 'month-day-year', label: 'Month before day' },
    ],
  },
];

const formatDateExample = (format, date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);
  const numeric = {
    'dmy-slash': `${day}/${month}/${year}`,
    'dmy-slash-short': `${day}/${month}/${year.slice(-2)}`,
    'dmy-dash': `${day}-${month}-${year}`,
    'dmy-dash-short': `${day}-${month}-${year.slice(-2)}`,
    'dmy-dot': `${day}.${month}.${year}`,
    'dmy-dot-short': `${day}.${month}.${year.slice(-2)}`,
    'mdy-slash': `${month}/${day}/${year}`,
    'mdy-slash-short': `${month}/${day}/${year.slice(-2)}`,
    'mdy-dash': `${month}-${day}-${year}`,
    'mdy-dot': `${month}.${day}.${year}`,
    'year-month-day': `${year}-${month}-${day}`,
  };
  if (numeric[format]) return numeric[format];
  if (format === 'month-day-year') return `${monthName} ${date.getDate()}, ${year}`;
  if (format === 'day-month-year') return `${date.getDate()} ${monthName} ${year}`;
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

const setSettingsCardMenuOpen = (pickerRef, isOpen) => {
  pickerRef.current?.closest('.settings-bento-card')?.classList.toggle('settings-card-menu-open', isOpen);
};

export const DateFormatPicker = ({ value, onChange }) => {
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const optionRefs = useRef([]);
  const [today, setToday] = useState(() => new Date());
  const options = useMemo(() => DATE_FORMAT_GROUPS.flatMap((group) => group.options), []);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selected = options[selectedIndex];

  useEffect(() => {
    const intervalId = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!open) {
      setSettingsCardMenuOpen(pickerRef, false);
      return undefined;
    }
    setSettingsCardMenuOpen(pickerRef, true);
    const handlePointerDown = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    optionRefs.current[activeIndex]?.focus();
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      setSettingsCardMenuOpen(pickerRef, false);
    };
  }, [open, activeIndex]);

  const moveActive = (index) => {
    const next = (index + options.length) % options.length;
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
  };

  return <div className="settings-date-format-picker" ref={pickerRef}>
    <button
      ref={triggerRef}
      type="button"
      className={`settings-date-format-trigger${open ? ' is-open' : ''}`}
      aria-label={`Date format: ${selected.label}, ${formatDateExample(selected.value, today)}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls="settings-date-format-options"
      onClick={() => { setActiveIndex(selectedIndex); setOpen((current) => !current); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex(selectedIndex);
          setOpen(true);
        }
      }}
    >
      <span className="settings-date-format-trigger-copy"><strong>{selected.label}</strong><small>{formatDateExample(selected.value, today)}</small></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="settings-date-format-menu" id="settings-date-format-options" role="listbox" aria-label="Date format options">
      {DATE_FORMAT_GROUPS.map((group) => <div className="settings-date-format-group" role="group" aria-label={group.label} key={group.label}>
        <span className="settings-date-format-group-label">{group.label}</span>
        {group.options.map((option) => {
          const index = options.findIndex((item) => item.value === option.value);
          const isSelected = value === option.value;
          return <button
            key={option.value}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`settings-date-format-option${isSelected ? ' is-selected' : ''}`}
            onClick={() => { onChange(option.value); setOpen(false); triggerRef.current?.focus(); }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); moveActive(index + 1); }
              if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(index - 1); }
              if (event.key === 'Home') { event.preventDefault(); moveActive(0); }
              if (event.key === 'End') { event.preventDefault(); moveActive(options.length - 1); }
            }}
          >
            <span className="settings-date-format-option-copy"><strong>{option.label}</strong><small>{formatDateExample(option.value, today)}</small></span>
            {isSelected && <Check size={17} aria-hidden="true" />}
          </button>;
        })}
      </div>)}
    </div>}
  </div>;
};

const formatTimezoneOffset = (timezone) => {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const TimezonePicker = ({ value, timezones, onChange }) => {
  const pickerRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredTimezones = useMemo(() => timezones.filter((timezone) => (
    timezone.replaceAll('_', ' ').replaceAll('/', ' ').toLocaleLowerCase().includes(normalizedQuery)
  )), [timezones, normalizedQuery]);
  const groups = useMemo(() => {
    const grouped = new Map();
    filteredTimezones.forEach((timezone) => {
      const region = timezone.includes('/') ? timezone.split('/')[0] : 'Other';
      if (!grouped.has(region)) grouped.set(region, []);
      grouped.get(region).push(timezone);
    });
    return [...grouped.entries()];
  }, [filteredTimezones]);
  const selectedLabel = value?.replaceAll('_', ' ').replaceAll('/', ' · ') || 'UTC';

  useEffect(() => {
    if (!open) {
      setSettingsCardMenuOpen(pickerRef, false);
      return undefined;
    }
    setSettingsCardMenuOpen(pickerRef, true);
    const handlePointerDown = (event) => {
      if (!pickerRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    searchRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      setSettingsCardMenuOpen(pickerRef, false);
    };
  }, [open]);

  const focusOption = (index) => {
    const next = (index + filteredTimezones.length) % filteredTimezones.length;
    optionRefs.current[next]?.focus();
  };
  const chooseTimezone = (timezone) => {
    onChange(timezone);
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  return <div className="settings-timezone-picker" ref={pickerRef}>
    <button
      ref={triggerRef}
      type="button"
      className={`settings-date-format-trigger settings-timezone-trigger${open ? ' is-open' : ''}`}
      aria-label={`Time zone: ${selectedLabel}, ${formatTimezoneOffset(value)}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls="settings-timezone-options"
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          setOpen(true);
        }
      }}
    >
              <span className="settings-date-format-trigger-copy"><strong>{selectedLabel}</strong><small>{formatTimezoneOffset(value)} · current offset</small></span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
    {open && <div className="settings-date-format-menu settings-timezone-menu">
      <label className="settings-timezone-search-wrap">
        <Search size={15} aria-hidden="true" />
        <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search city, region, or zone" aria-label="Search time zones" />
        {query && <button type="button" aria-label="Clear time zone search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={14} /></button>}
      </label>
      <div className="settings-timezone-options" id="settings-timezone-options" role="listbox" aria-label="Time zone options" aria-activedescendant={undefined}>
        {groups.map(([region, zones]) => <div className="settings-date-format-group" key={region}>
          <span className="settings-date-format-group-label">{region}</span>
          {zones.map((timezone) => {
            const index = filteredTimezones.indexOf(timezone);
            const isSelected = value === timezone;
            const label = timezone.replaceAll('_', ' ').replaceAll('/', ' · ');
            return <button
              key={timezone}
              id={`settings-timezone-option-${index}`}
              ref={(element) => { optionRefs.current[index] = element; }}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`settings-date-format-option${isSelected ? ' is-selected' : ''}`}
              onClick={() => chooseTimezone(timezone)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') { event.preventDefault(); focusOption(index + 1); }
                if (event.key === 'ArrowUp') { event.preventDefault(); index === 0 ? searchRef.current?.focus() : focusOption(index - 1); }
                if (event.key === 'Home') { event.preventDefault(); focusOption(0); }
                if (event.key === 'End') { event.preventDefault(); focusOption(filteredTimezones.length - 1); }
              }}
            >
              <span className="settings-date-format-option-copy"><strong>{label}</strong></span>
              {isSelected && <Check size={17} aria-hidden="true" />}
            </button>;
          })}
        </div>)}
        {!filteredTimezones.length && <p className="settings-timezone-empty">No time zones match “{query}”.</p>}
      </div>
    </div>}
  </div>;
};

// 528Hz Harmonic Sine Bell Synthesizer (Zen Bell) with smooth 1.3s exponential decay
export const playZenBell = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    if (context.state === 'suspended') {
      context.resume();
    }
    const now = context.currentTime;
    const duration = 1.3;

    // Primary 528 Hz sine wave (solfeggio chime)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now);

    // Harmonic overtone 1056 Hz (528 * 2) for rich acoustic bell resonance
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1056, now);

    // Smooth 1.3-second exponential gain decay
    gain1.gain.setValueAtTime(0.24, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(context.destination);
    gain2.connect(context.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);

    osc1.onended = () => {
      try {
        context.close();
      } catch {}
    };
  } catch (error) {
    console.warn('Unable to synthesize zen bell chime:', error);
  }
};

