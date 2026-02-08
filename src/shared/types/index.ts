export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type StatusType = 'active' | 'inactive' | 'error' | 'warning';

export interface BaseComponentProps {
  className?: string;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
}

export interface TextAreaProps extends BaseComponentProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  showCounter?: boolean;
  rows?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends BaseComponentProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export interface ToggleProps extends BaseComponentProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
}

export interface StatusBadgeProps extends BaseComponentProps {
  status: StatusType;
  label?: string;
}
