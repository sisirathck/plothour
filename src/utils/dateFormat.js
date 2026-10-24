const getDateFormat = () => {
  if (typeof document === 'undefined') return 'system';
  return document.documentElement.dataset.dateFormat || 'system';
};

export const formatDisplayDate = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const format = getDateFormat();
  if (format === 'system' || !options.day) return date.toLocaleDateString(undefined, options);

  const parts = new Intl.DateTimeFormat(undefined, { ...options, calendar: 'gregory' }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const weekday = getPart('weekday');
  const numericValues = {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
  };
  const separators = {
    'dmy-slash': { order: ['day', 'month', 'year'], separator: '/' },
    'dmy-slash-short': { order: ['day', 'month', 'year'], separator: '/', shortYear: true },
    'dmy-dash': { order: ['day', 'month', 'year'], separator: '-' },
    'dmy-dash-short': { order: ['day', 'month', 'year'], separator: '-', shortYear: true },
    'dmy-dot': { order: ['day', 'month', 'year'], separator: '.' },
    'dmy-dot-short': { order: ['day', 'month', 'year'], separator: '.', shortYear: true },
    'mdy-slash': { order: ['month', 'day', 'year'], separator: '/' },
    'mdy-slash-short': { order: ['month', 'day', 'year'], separator: '/', shortYear: true },
    'mdy-dash': { order: ['month', 'day', 'year'], separator: '-' },
    'mdy-dot': { order: ['month', 'day', 'year'], separator: '.' },
    'year-month-day': { order: ['year', 'month', 'day'], separator: '-' },
  };
  const numericFormat = separators[format];
  const datePart = numericFormat
    ? numericFormat.order
      .filter((part) => part !== 'year' || options.year)
      .map((part) => part === 'year' && numericFormat.shortYear ? numericValues.year.slice(-2) : numericValues[part])
      .join(numericFormat.separator)
    : format === 'month-day-year'
      ? `${month} ${day}${year ? `, ${year}` : ''}`
      : `${day} ${month}${year ? ` ${year}` : ''}`;

  return weekday ? `${weekday}, ${datePart}` : datePart;
};
