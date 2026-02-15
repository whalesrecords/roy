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
          <label className="text-xs font-medium text-secondary-400 uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={`
            w-full h-12 px-4
            border-none rounded-2xl
            bg-content2 text-foreground
            placeholder:text-secondary-400
            focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-content1 transition-all
            hover:bg-content3
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'ring-2 ring-danger/50' : ''}
          `}
          {...props}
        />
        {error && (
          <span className="text-xs text-danger">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
