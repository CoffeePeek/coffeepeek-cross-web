import React, { useState, useRef, useEffect } from 'react';
import { CaretUpDown } from '@/components/Icon';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/theme';

interface MaterialSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  icon?: React.ReactNode;
}

const MaterialSelect: React.FC<MaterialSelectProps> = ({
  label,
  value,
  onChange,
  options,
  required = false,
  icon,
}) => {
  const { theme } = useTheme();
  const themeClasses = getThemeClasses(theme);
  const [isFocused, setIsFocused] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const hasValue = value !== '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  return (
    <div className="relative w-full" ref={selectRef}>
      <div
        className={`
          relative ${themeClasses.bg.input} border-2 rounded-2xl transition-all duration-200 cursor-pointer
          min-h-[56px] flex items-center
          ${isFocused || isOpen
            ? 'border-[#EAB308] shadow-lg shadow-[#EAB308]/10'
            : `${themeClasses.border.default} ${theme === 'dark' ? 'hover:border-[#4A3D35]' : 'hover:border-gray-300'}`
          }
          ${hasValue ? 'pt-6 pb-2' : 'py-4'}
        `}
        onClick={() => {
          setIsOpen(!isOpen);
          setIsFocused(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
            setIsFocused(true);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
            setIsFocused(false);
          }
        }}
        tabIndex={0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Icon */}
        {icon && (
          <div className={`
            absolute left-4 ${themeClasses.text.secondary} pointer-events-none transition-all duration-200
            ${isFocused || isOpen || hasValue
              ? 'top-6'
              : 'top-1/2 -translate-y-1/2'
            }
          `}>
            {icon}
          </div>
        )}

        {/* Floating Label */}
        <label
          className={`
            absolute transition-all duration-200 pointer-events-none
            ${isFocused || isOpen || hasValue
              ? 'top-2 text-xs text-[#EAB308]'
              : `top-1/2 -translate-y-1/2 text-base ${themeClasses.text.secondary}`
            }
            ${icon ? 'left-12' : 'left-4'}
          `}
        >
          {label}
          {required && <span className="text-[#EAB308] ml-1">*</span>}
        </label>

        {/* Selected Value or Placeholder */}
        {hasValue ? (
          <div className={`
            px-4 ${themeClasses.text.primary} text-base mt-2
            ${icon ? 'pl-12' : ''}
          `}>
            {displayValue}
          </div>
        ) : (isFocused || isOpen) ? (
          <div className={`
            px-4 ${themeClasses.text.tertiary} text-base mt-2
            ${icon ? 'pl-12' : ''}
          `}>
            Выберите...
          </div>
        ) : null}

        {/* Dropdown Arrow */}
        <div className={`
          absolute right-4 ${themeClasses.text.secondary} transition-all duration-200
          ${isFocused || isOpen || hasValue
            ? 'top-6 -translate-y-1/2'
            : 'top-1/2 -translate-y-1/2'
          }
          ${isOpen ? 'rotate-180' : ''}
        `}>
          <CaretUpDown size={20} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={`absolute z-50 w-full mt-2 ${themeClasses.bg.card} border-2 ${themeClasses.border.default} rounded-2xl shadow-2xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200`}
          role="listbox"
        >
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
                setIsFocused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(option.value);
                  setIsOpen(false);
                  setIsFocused(false);
                }
              }}
              className={`
                px-4 py-3 cursor-pointer transition-all duration-150
                ${value === option.value
                  ? 'bg-[#EAB308]/10 text-[#EAB308]'
                  : `${themeClasses.text.primary} ${theme === 'dark' ? 'hover:bg-[#3D2F28]' : 'hover:bg-gray-100'}`
                }
                ${option.value === '' ? `border-b ${themeClasses.border.default}` : ''}
              `}
              role="option"
              aria-selected={value === option.value}
              tabIndex={0}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaterialSelect;

