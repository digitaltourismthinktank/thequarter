/** The Quarter — event themes (social-gathering-led) → Lucide glyph.
 *  The chosen theme's icon appears on the admin list, the member dashboard's
 *  "What's on", and large on the entrance lobby screen. */
import type { IconName } from '@/components/ds/Icon';

export const EVENT_THEMES: { name: string; icon: IconName }[] = [
  { name: 'Social & drinks', icon: 'wine' },
  { name: 'Breakfast', icon: 'coffee' },
  { name: 'Supper', icon: 'utensils' },
  { name: 'Celebration', icon: 'party-popper' },
  { name: 'Talk', icon: 'mic' },
  { name: 'Workshop', icon: 'palette' },
  { name: 'Music', icon: 'music' },
  { name: 'Film', icon: 'film' },
  { name: 'Book club', icon: 'book-open' },
  { name: 'Community', icon: 'users' },
  { name: 'Wellness', icon: 'heart' },
  { name: 'Seasonal', icon: 'snowflake' },
  { name: 'Culture', icon: 'landmark' },
  { name: 'Party', icon: 'party-popper' },
];

const MAP: Record<string, IconName> = {
  ...Object.fromEntries(EVENT_THEMES.map((t) => [t.name, t.icon])),
  // Legacy categories from earlier events
  Social: 'wine',
  'Business briefing': 'mic',
  'Charity Friday': 'heart',
  Other: 'sparkles',
};

export function eventThemeIcon(category?: string | null): IconName {
  if (!category) return 'sparkles';
  return MAP[category] ?? 'sparkles';
}
