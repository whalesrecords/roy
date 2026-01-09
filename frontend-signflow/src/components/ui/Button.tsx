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
    const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-primary text-white shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:bg-primary-600',
      secondary: 'bg-content2 text-foreground border-2 border-default-200 hover:bg-content3 hover:border-default-300',
      ghost: 'bg-transparent text-foreground hover:bg-content2',
      danger: 'bg-danger text-white shadow-lg shadow-danger/30 hover:shadow-xl hover:shadow-danger/40 hover:bg-danger-600',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 h-8',
      md: 'text-sm px-5 py-2.5 h-10',
      lg: 'text-base px-6 py-3 h-12',
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
