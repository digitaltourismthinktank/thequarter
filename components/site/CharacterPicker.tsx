'use client';

import { useState } from 'react';
import { CHARACTERS } from '@/lib/characters';
import { saveProfile } from '@/lib/booking';
import { QuarterCharacter } from './QuarterCharacter';
import styles from './CharacterPicker.module.css';

/**
 * Pick a Quarter Character — a pilgrim from The Canterbury Tales — to stand in for you
 * across the app. Saves on tap rather than behind a Save button: it's a single value, the
 * change is visible immediately in the header, and making someone confirm a picture feels
 * heavier than the decision deserves.
 */
export function CharacterPicker({ current, onSaved }: { current?: string | null; onSaved?: () => void }) {
  const [picked, setPicked] = useState<string | null>(current ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    // Tapping the current character clears it, back to initials.
    const next = picked === id ? '' : id;
    const previous = picked;
    setPicked(next || null);
    setBusy(id);
    setError(null);
    const r = await saveProfile({ character: next });
    setBusy(null);
    if (!r.ok) {
      setPicked(previous ?? null); // put it back — the save didn't land
      setError("That didn't save — please try again.");
      return;
    }
    onSaved?.();
  }

  return (
    <div>
      <div className={styles.grid} role="radiogroup" aria-label="Quarter Character">
        {CHARACTERS.map((c) => {
          const on = picked === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={`${styles.item} ${on ? styles.itemOn : ''}`}
              onClick={() => choose(c.id)}
              disabled={!!busy}
              title={c.blurb}
            >
              <span className={styles.art}>
                <QuarterCharacter id={c.id} size={56} />
              </span>
              <span className={styles.name}>{c.name.replace(/^The /, '')}</span>
            </button>
          );
        })}
      </div>
      <p className={styles.note}>
        {picked ? 'Tap your character again to go back to your initials.' : 'Pick one and it replaces your initials around the app.'}
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
