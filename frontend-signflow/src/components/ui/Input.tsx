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
      <div className={`flex flex-col gap-2 ${className}`}>
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={`
            w-full h-12 px-4
            border-2 rounded-xl
            bg-background text-foreground
            placeholder:text-secondary-400
            focus:outline-none focus:border-primary transition-colors
            hover:border-default-300
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger' : 'border-default-200'}
          `}
          {...props}
        />
        {error && (
          <span className="text-sm text-danger">{error}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
