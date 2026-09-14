import React, { useState, useEffect } from 'react';
import { formatPHP, parseNumber } from '../utils/formatters';

interface AccountingInputProps {
  id?: string;
  value: number | undefined | null;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  title?: string;
}

/**
 * An accounting-standard numeric input that displays values formatted
 * with comma separators and exactly 2 decimal places (e.g. 1,234,567.89 or 0.00).
 */
export const AccountingInput: React.FC<AccountingInputProps> = ({
  id,
  value,
  onChange,
  disabled = false,
  className = '',
  placeholder = '0.00',
  title,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState<string>(() => {
    const num = typeof value === 'number' && !isNaN(value) ? value : 0;
    return formatPHP(num, false);
  });

  // Sync external value updates when not focused
  useEffect(() => {
    if (!isFocused) {
      const num = typeof value === 'number' && !isNaN(value) ? value : 0;
      setInputValue(formatPHP(num, false));
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    const num = typeof value === 'number' && !isNaN(value) ? value : 0;
    // When focusing, if it's 0, present an empty string or raw number for swift entry
    setInputValue(num === 0 ? '' : num.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, commas, dot, and negative sign
    if (/^[0-9,.-]*$/.test(raw)) {
      setInputValue(raw);
      const parsed = parseNumber(raw);
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsed = parseNumber(inputValue);
    onChange(parsed);
    setInputValue(formatPHP(parsed, false));
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      title={title}
      className={`font-mono text-right ${className}`}
    />
  );
};
