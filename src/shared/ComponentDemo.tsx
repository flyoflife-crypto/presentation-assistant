import React, { useState } from 'react';
import { Button, TextArea, Select, Toggle, StatusBadge } from './ui';
import { SelectOption } from './types';

/**
 * Example usage of all shared UI components
 */
export const ComponentDemo: React.FC = () => {
  const [textValue, setTextValue] = useState('');
  const [selectValue, setSelectValue] = useState('option1');
  const [toggleValue, setToggleValue] = useState(false);

  const selectOptions: SelectOption[] = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>Shared UI Components Demo</h2>

      {/* Button Examples */}
      <section>
        <h3>Buttons</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="primary" onClick={() => alert('Primary clicked!')}>
            Primary Button
          </Button>
          <Button variant="secondary" onClick={() => alert('Secondary clicked!')}>
            Secondary Button
          </Button>
          <Button variant="danger" onClick={() => alert('Danger clicked!')}>
            Danger Button
          </Button>
          <Button variant="primary" disabled>
            Disabled Button
          </Button>
        </div>
      </section>

      {/* TextArea Example */}
      <section>
        <h3>TextArea</h3>
        <TextArea
          value={textValue}
          onChange={setTextValue}
          placeholder="Enter your text here..."
          maxLength={200}
          showCounter
          rows={4}
          ariaLabel="Demo text area"
        />
      </section>

      {/* Select Example */}
      <section>
        <h3>Select</h3>
        <Select
          options={selectOptions}
          value={selectValue}
          onChange={setSelectValue}
          placeholder="Choose an option"
          ariaLabel="Demo select"
        />
        <p>Selected: {selectValue}</p>
      </section>

      {/* Toggle Example */}
      <section>
        <h3>Toggle</h3>
        <Toggle
          checked={toggleValue}
          onChange={setToggleValue}
          label="Enable feature"
          ariaLabel="Feature toggle"
        />
        <p>Toggled: {toggleValue ? 'On' : 'Off'}</p>
      </section>

      {/* StatusBadge Examples */}
      <section>
        <h3>Status Badges</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <StatusBadge status="active" />
          <StatusBadge status="inactive" />
          <StatusBadge status="error" />
          <StatusBadge status="warning" />
          <StatusBadge status="active" label="Custom Label" />
        </div>
      </section>
    </div>
  );
};
