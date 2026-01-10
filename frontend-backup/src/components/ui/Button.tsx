'use client';

import { Button as HeroButton } from '@heroui/react';
import { forwardRef, ReactNode } from 'react';

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
      ...props
    },
    ref
  ) => {
    const colorMap = {
      primary: 'primary' as const,
      secondary: 'default' as const,
      ghost: 'default' as const,
      danger: 'danger' as const,
    };

    const variantMap = {
      primary: 'solid' as const,
      secondary: 'bordered' as const,
      ghost: 'light' as const,
      danger: 'solid' as const,
    };

    const sizeMap = {
      sm: 'sm' as const,
      md: 'md' as const,
      lg: 'lg' as const,
    };

    return (
      <HeroButton
        ref={ref}
        color={colorMap[variant]}
        variant={variantMap[variant]}
        size={sizeMap[size]}
        isLoading={loading}
        isDisabled={disabled || loading}
        className={className}
        {...props}
      >
        {children}
      </HeroButton>
    );
  }
);

Button.displayName = 'Button';

export default Button;
