import React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { clsx } from 'clsx';

interface ComboboxProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  label: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  renderOption?: (option: T) => React.ReactNode;
  renderValue?: (value: T) => React.ReactNode;
}

export function Combobox<T extends string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select an option...',
  className,
  disabled = false,
  searchable = true,
  renderOption,
  renderValue
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const filteredOptions = React.useMemo(() => {
    return options.filter(option =>
      option.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex !== -1) {
          onChange(filteredOptions[highlightedIndex]);
          setOpen(false);
          setSearchQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setSearchQuery('');
        break;
    }
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearchQuery('');
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  React.useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  React.useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      <label
        className="block text-sm font-medium text-gray-700 mb-1"
        onClick={() => !disabled && setOpen(true)}
      >
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          className={clsx(
            'relative w-full h-[38px] rounded-md border border-gray-300 bg-white pl-3 pr-10 text-left shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm flex items-center',
            disabled && 'bg-gray-50 cursor-not-allowed',
            !disabled && 'cursor-pointer hover:bg-gray-50'
          )}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled}
        >
          {renderValue ? (
            renderValue(value)
          ) : (
            <span className="block truncate uppercase">{value}</span>
          )}
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronsUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </span>
        </button>

        {open && !disabled && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            <div className="sticky top-0 z-10 bg-white px-2 py-1.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                {searchable ? <input
                  type="text"
                  className="w-full rounded-md border-0 bg-gray-50 py-1.5 pl-10 pr-3 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  placeholder="Type to search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  ref={inputRef}
                /> : null}
              </div>
            </div>

            {filteredOptions.length === 0 ? (
              <div className="relative cursor-default select-none px-4 py-2 text-gray-700">
                No results found
              </div>
            ) : (
              <ul className="max-h-[200px] overflow-auto" role="listbox">
                {filteredOptions.map((option, index) => (
                  <li
                    key={option}
                    className={clsx(
                      'relative cursor-pointer select-none py-2 pl-10 pr-4',
                      value === option && 'bg-indigo-50 text-indigo-600',
                      highlightedIndex === index && 'bg-gray-100',
                      'hover:bg-gray-100'
                    )}
                    role="option"
                    aria-selected={value === option}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                      setSearchQuery('');
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {renderOption ? (
                      renderOption(option)
                    ) : (
                      <span className={clsx('block truncate font-normal uppercase')}>
                        {option}
                      </span>
                    )}
                    {value === option && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-indigo-600">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}