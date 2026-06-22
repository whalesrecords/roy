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
          <label className="roy-eyebrow text-[9.5px] mb-1.5 block">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={`w-full h-12 px-4 rounded-[10px] border border-line bg-surface text-[14px] text-ink
            focus:outline-none focus:border-line-strong transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-neg' : ''}
            ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1.5 text-[12px] text-neg">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
