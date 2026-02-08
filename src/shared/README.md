# Shared UI Components

This directory contains reusable UI components for the Presentation Assistant Pro application.

## Components

### Button
Standard button component with three variants: primary, secondary, and danger.

```tsx
import { Button } from './shared/ui';

<Button variant="primary" onClick={() => console.log('Clicked')}>
  Click Me
</Button>
```

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger'` - Button style variant (default: 'primary')
- `disabled?: boolean` - Whether the button is disabled
- `onClick?: () => void` - Click handler
- `children: React.ReactNode` - Button content
- `type?: 'button' | 'submit' | 'reset'` - Button type (default: 'button')
- `className?: string` - Additional CSS classes

### TextArea
Multi-line text input with optional character counter.

```tsx
import { TextArea } from './shared/ui';

<TextArea
  value={text}
  onChange={setText}
  placeholder="Enter text..."
  maxLength={200}
  showCounter
  rows={4}
/>
```

**Props:**
- `value: string` - Current text value
- `onChange: (value: string) => void` - Change handler
- `placeholder?: string` - Placeholder text
- `maxLength?: number` - Maximum character limit
- `showCounter?: boolean` - Show character counter
- `rows?: number` - Number of visible text rows (default: 4)
- `disabled?: boolean` - Whether the textarea is disabled
- `ariaLabel?: string` - Accessibility label
- `className?: string` - Additional CSS classes

### Select
Dropdown select component.

```tsx
import { Select } from './shared/ui';

const options = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
];

<Select
  options={options}
  value={selected}
  onChange={setSelected}
  placeholder="Choose..."
/>
```

**Props:**
- `options: SelectOption[]` - Array of options (value/label pairs)
- `value: string` - Currently selected value
- `onChange: (value: string) => void` - Change handler
- `placeholder?: string` - Placeholder text
- `disabled?: boolean` - Whether the select is disabled
- `ariaLabel?: string` - Accessibility label
- `className?: string` - Additional CSS classes

### Toggle
On/off switch component.

```tsx
import { Toggle } from './shared/ui';

<Toggle
  checked={enabled}
  onChange={setEnabled}
  label="Enable feature"
/>
```

**Props:**
- `checked: boolean` - Whether the toggle is on
- `onChange: (checked: boolean) => void` - Change handler
- `disabled?: boolean` - Whether the toggle is disabled
- `label?: string` - Label text displayed next to toggle
- `ariaLabel?: string` - Accessibility label
- `className?: string` - Additional CSS classes

### StatusBadge
Colored status indicator with dot and label.

```tsx
import { StatusBadge } from './shared/ui';

<StatusBadge status="active" />
<StatusBadge status="error" label="Custom Label" />
```

**Props:**
- `status: 'active' | 'inactive' | 'error' | 'warning'` - Status type
- `label?: string` - Custom label (defaults to capitalized status)
- `className?: string` - Additional CSS classes

## Styling

All components use the shared CSS variables defined in `src/shared/styles/common.css`. You can customize the appearance by overriding these CSS variables:

```css
:root {
  --color-primary: #007aff;
  --color-secondary: #8e8e93;
  --color-danger: #ff3b30;
  --color-success: #34c759;
  --color-warning: #ff9500;
  --border-radius: 6px;
  /* ... and more */
}
```

## Types

All TypeScript types and interfaces are exported from `src/shared/types/index.ts`:

```tsx
import type { ButtonProps, SelectOption, StatusType } from './shared/types';
```

## Accessibility

All components include proper ARIA attributes and keyboard navigation support:
- Buttons and toggles are keyboard accessible (Space/Enter)
- Form controls have aria-label support
- Focus states are clearly visible
- Disabled states prevent interaction

## Example Usage

See `src/shared/ComponentDemo.tsx` for a complete example of all components in action.
