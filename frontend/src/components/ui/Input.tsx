'use client';

import { forwardRef } from 'react';

interface InputProps {
  label?: string;
  error?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, type = 'text', disabled, ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
          <label className="roy-eyebrow text-[9.5px]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={`
            w-full h-12 px-4
            border rounded-[10px]
            bg-surface text-[14px] text-ink
            placeholder:text-ink-faint
            focus:outline-none focus:border-line-strong transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-neg' : 'border-line'}
          `}
          {...props}
        />
        {error && (
          <span className="text-[12px] text-neg">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
