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
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-gradient-to-r from-primary-600 to-primary text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35 hover:scale-[1.02] active:scale-[0.98]',
      secondary: 'bg-content1 text-foreground border border-divider shadow-sm hover:shadow-md hover:bg-content2',
      ghost: 'bg-transparent text-secondary-500 hover:bg-content2 hover:text-foreground',
      danger: 'bg-gradient-to-r from-danger-600 to-danger text-white shadow-lg shadow-danger/25 hover:shadow-xl hover:shadow-danger/35 hover:scale-[1.02] active:scale-[0.98]',
    };

    const sizeStyles = {
      sm: 'text-xs px-4 py-2 h-8',
      md: 'text-sm px-6 py-2.5 h-10',
      lg: 'text-base px-8 py-3 h-12',
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
        {loading && <Spinner size="sm" color={variant === 'primary' || variant === 'danger' ? 'white' : 'current'} />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
