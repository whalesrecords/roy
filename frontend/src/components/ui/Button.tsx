'use client';

import { forwardRef, ReactNode } from 'react';
import { Spinner } from '@heroui/react';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      type = 'button',
      onClick,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-accent text-accent-ink hover:opacity-90',
      secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
      ghost: 'bg-transparent text-ink hover:bg-surface-2',
      danger: 'bg-surface text-neg border border-line-strong hover:bg-surface-2',
    };

    const sizeStyles = {
      sm: 'text-[11px] px-3 py-1.5 h-8',
      md: 'text-[12px] px-4 py-2.5 h-10',
      lg: 'text-[13px] px-5 py-3 h-12',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        onClick={onClick}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" color={variant === 'primary' ? 'white' : 'current'} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
