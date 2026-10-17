import React from 'react';
import './FormInput.css';

export const FormInput = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  icon: Icon,
  rightSlot,
  error,
  required = false,
  autoComplete,
  ...rest
}) => {
  return (
    <div className={`compact-form-field ${error ? 'has-error' : ''}`}>
      {label && (
        <label htmlFor={id} className="compact-field-label">
          {label}
        </label>
      )}

      <div className="compact-input-wrapper">
        {Icon && (
          <span className="compact-input-icon left" aria-hidden="true">
            <Icon size={16} strokeWidth={1.8} />
          </span>
        )}

        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`compact-input ${Icon ? 'has-left-icon' : ''} ${
            rightSlot ? 'has-right-slot' : ''
          }`}
          {...rest}
        />

        {rightSlot && <div className="compact-input-right-slot">{rightSlot}</div>}
      </div>

      {error && <p className="compact-field-error">{error}</p>}
    </div>
  );
};
