'use client';

import { useEffect, useId, useState } from 'react';
import { getCompanies } from '@/lib/booking';

/**
 * A company field with type-or-pick autocomplete (native <datalist>): existing company
 * names are suggested as you type, and you can still enter a brand-new one. Keeps
 * spellings consistent across members + bookings without forcing a fixed list.
 */
export function CompanyInput({
  value,
  onChange,
  className,
  placeholder = 'Company',
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getCompanies();
      if (active && r.ok) setOptions(r.data.companies);
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <input
        className={className}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
