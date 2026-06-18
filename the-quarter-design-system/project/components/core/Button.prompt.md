Primary action control for The Quarter — soft pill, confident, warm. Use `primary` (ink) for the main action on a surface, `accent` (gold) for premium/highlight CTAs, `secondary` for outline, `ghost` for low-emphasis.

```jsx
<Button>Book a day pass</Button>
<Button variant="accent" iconAfter="arrow-right">Reserve a room</Button>
<Button variant="secondary" icon="calendar">Check availability</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

Sizes: `sm` (compact, 14px), `md` (default, pill), `lg` (hero). `sm` uses a softer radius; `md`/`lg` are full pills. Only one `accent` button per view — gold is precious.
