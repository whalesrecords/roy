'use client';

import { forwardRef, SelectHTMLAttributes, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children?: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-foreground mb-2">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full h-12 px-4 rounded-xl border-2 border-default-200 bg-background text-foreground
            focus:outline-none focus:border-primary transition-colors
            hover:border-default-300
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-danger' : ''}
            ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
