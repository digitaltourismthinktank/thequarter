/* @ds-bundle: {"format":3,"namespace":"TheQuarterDesignSystem_2f2064","components":[{"name":"PerkCard","sourcePath":"components/cards/PerkCard.jsx"},{"name":"PlanCard","sourcePath":"components/cards/PlanCard.jsx"},{"name":"RoomCard","sourcePath":"components/cards/RoomCard.jsx"},{"name":"SpaceCard","sourcePath":"components/cards/SpaceCard.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"AvailabilityCalendar","sourcePath":"components/dashboard/AvailabilityCalendar.jsx"},{"name":"EmptyState","sourcePath":"components/dashboard/EmptyState.jsx"},{"name":"QuarterCard","sourcePath":"components/dashboard/QuarterCard.jsx"},{"name":"StatTile","sourcePath":"components/dashboard/StatTile.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Footer","sourcePath":"components/navigation/Footer.jsx"},{"name":"Navbar","sourcePath":"components/navigation/Navbar.jsx"}],"sourceHashes":{"components/cards/PerkCard.jsx":"99e8f8022fda","components/cards/PlanCard.jsx":"166e70319edd","components/cards/RoomCard.jsx":"d7ed7654cc0f","components/cards/SpaceCard.jsx":"1d211aa5f027","components/core/Avatar.jsx":"4f274ddbb4ed","components/core/Badge.jsx":"cc255e626773","components/core/Button.jsx":"d9d88c5b7288","components/core/Icon.jsx":"410d604a7134","components/core/IconButton.jsx":"a41f638c28b2","components/dashboard/AvailabilityCalendar.jsx":"54af761e6a01","components/dashboard/EmptyState.jsx":"688c2a6f0e44","components/dashboard/QuarterCard.jsx":"086f5e7c16bc","components/dashboard/StatTile.jsx":"b952b27afa11","components/forms/Checkbox.jsx":"43fe3920a742","components/forms/Input.jsx":"124a8dfc92a1","components/forms/Select.jsx":"608c20250e5f","components/forms/Switch.jsx":"50924e9e2998","components/navigation/Footer.jsx":"b070b745ee2c","components/navigation/Navbar.jsx":"9e2313d33689","ui_kits/dashboard/Dashboard.jsx":"c0b1137c1cc9","ui_kits/website/App.jsx":"1bb596f02122","ui_kits/website/DayPass.jsx":"611fc31b681a","ui_kits/website/Events.jsx":"594810c2f27f","ui_kits/website/Home.jsx":"d9f2d4baa2bb","ui_kits/website/Login.jsx":"f1cf49ea6f01","ui_kits/website/MeetingRooms.jsx":"89e0b66b2a4f","ui_kits/website/Perks.jsx":"a72b356cec28","ui_kits/website/Plans.jsx":"85068e7ffc04","ui_kits/website/Spaces.jsx":"2c1e9fe51b77","ui_kits/website/data.jsx":"320705cb699a","ui_kits/website/sections.jsx":"57c61df3be7e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TheQuarterDesignSystem_2f2064 = window.TheQuarterDesignSystem_2f2064 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Avatar. Member photo or initials, soft circle. */

const SIZES = {
  xs: 28,
  sm: 36,
  md: 44,
  lg: 56,
  xl: 72
};
function Avatar({
  name = '',
  src,
  size = 'md',
  style,
  ...rest
}) {
  const px = SIZES[size] || SIZES.md;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: px,
      height: px,
      borderRadius: '50%',
      overflow: 'hidden',
      flex: 'none',
      background: 'var(--gold-100)',
      color: 'var(--gold-700)',
      fontWeight: 'var(--fw-semibold)',
      fontSize: px * 0.36,
      letterSpacing: '0.01em',
      border: '1.5px solid var(--pure-white)',
      boxShadow: 'var(--shadow-xs)',
      ...style
    }
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : initials || '·');
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Lucide-style line icons — 24px grid, 1.75 stroke, round caps/joins.
   Matches The Quarter's calm, hospitality-grade iconography. Curated subset. */
const PATHS = {
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-up-right': 'M7 17 17 7M8 7h9v9',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  wifi: 'M5 12.55a11 11 0 0 1 14 0M8.5 16.1a6 6 0 0 1 7 0M2 8.82a15 15 0 0 1 20 0M12 20h.01',
  coffee: 'M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v2M10 2v2M14 2v2',
  leaf: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  'map-pin': 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  star: 'M12 2 15.1 8.3 22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  gift: 'M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  'credit-card': 'M2 5h20v14H2zM2 10h20',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6.2 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6h.09A1.65 1.65 0 0 0 12 3.1V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 19 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9V9z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6zM5 4l.7 1.8L7.5 6.5l-1.8.7L5 9l-.7-1.8L2.5 6.5l1.8-.7z',
  'door-open': 'M13 4h3a2 2 0 0 1 2 2v14M2 20h20M14 12v.01M3 20V6a2 2 0 0 1 1.4-1.9l6-2A2 2 0 0 1 13 4v16',
  briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16M4 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  'utensils': 'M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-3 4.5V12c0 1.66 1.34 3 3 3z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z'
};
function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = 'currentColor',
  style,
  ...rest
}) {
  const d = PATHS[name];
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    style: {
      display: 'block',
      flex: 'none',
      ...style
    }
  }, rest), d ? /*#__PURE__*/React.createElement("path", {
    d: d
  }) : null);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/cards/PerkCard.jsx
try { (() => {
/* The Quarter — PerkCard. Partner perk in the member rewards catalogue. */

function PerkCard({
  partner,
  perk,
  category,
  expires,
  redeemed = false,
  onRedeem,
  logoSrc,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '20px 22px 22px',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
      boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
      transform: hover ? 'translateY(-3px)' : 'none',
      transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 46,
      flex: 'none',
      borderRadius: 'var(--radius-md)',
      background: 'var(--sand-100)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'var(--fw-bold)',
      fontSize: 'var(--text-md)',
      color: 'var(--ink-900)',
      overflow: 'hidden'
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: partner,
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover'
    }
  }) : partner?.[0] || '·'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-900)'
    }
  }, partner), category ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--gold-700)',
      fontWeight: 'var(--fw-medium)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)'
    }
  }, category) : null)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-md)',
      color: 'var(--text-strong)',
      fontWeight: 'var(--fw-medium)',
      lineHeight: 'var(--leading-snug)',
      flex: 1
    }
  }, perk), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingTop: 4,
      borderTop: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, expires || 'Always on'), /*#__PURE__*/React.createElement("button", {
    onClick: redeemed ? undefined : onRedeem,
    disabled: redeemed,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      border: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: redeemed ? 'var(--success)' : 'var(--ink-900)',
      cursor: redeemed ? 'default' : 'pointer'
    }
  }, redeemed ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 16,
    color: "var(--success)"
  }), " Redeemed") : /*#__PURE__*/React.createElement(React.Fragment, null, "Redeem ", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-right",
    size: 16
  })))));
}
Object.assign(__ds_scope, { PerkCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/PerkCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Badge. Small status / availability pill. Warm, quiet. */

const TONES = {
  neutral: {
    background: 'var(--sand-100)',
    color: 'var(--stone-700)',
    dot: 'var(--stone-400)'
  },
  gold: {
    background: 'var(--gold-100)',
    color: 'var(--gold-700)',
    dot: 'var(--gold-500)'
  },
  ink: {
    background: 'var(--ink-900)',
    color: 'var(--sand-50)',
    dot: 'var(--gold-400)'
  },
  available: {
    background: 'rgba(75,122,82,0.12)',
    color: 'var(--success)',
    dot: 'var(--success)'
  },
  busy: {
    background: 'rgba(169,68,47,0.12)',
    color: 'var(--danger)',
    dot: 'var(--danger)'
  },
  soon: {
    background: 'rgba(181,134,47,0.14)',
    color: 'var(--warning)',
    dot: 'var(--warning)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  dot = false,
  icon,
  size = 'md',
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.neutral;
  const pad = size === 'sm' ? '3px 9px' : '5px 12px';
  const fs = size === 'sm' ? 'var(--text-2xs)' : 'var(--text-xs)';
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: pad,
      background: t.background,
      color: t.color,
      borderRadius: 'var(--radius-pill)',
      fontSize: fs,
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: '0.01em',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      ...style
    }
  }, rest), dot ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: t.dot,
      flex: 'none'
    }
  }) : null, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'sm' ? 12 : 14
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/cards/SpaceCard.jsx
try { (() => {
/* The Quarter — SpaceCard. Showcases a space (Main Space, Flexi Rooms, Café…). */

function SpaceCard({
  name,
  blurb,
  meta = [],
  imageSrc,
  imageCaption,
  tag,
  href,
  onOpen,
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("a", {
    href: href || '#',
    onClick: e => {
      e.preventDefault();
      onOpen?.();
    },
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      boxShadow: hover ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
      transform: hover ? 'translateY(-4px)' : 'none',
      transition: 'transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "q-photo",
    "data-caption": imageCaption || '',
    style: {
      aspectRatio: '4 / 3',
      backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }, tag ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 14
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "ink"
  }, tag)) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px 26px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, name), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)',
      flex: 1
    }
  }, blurb), meta.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 4
    }
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      fontWeight: 'var(--fw-medium)'
    }
  }, m.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: m.icon,
    size: 15,
    color: "var(--gold-600)"
  }) : null, m.label))) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 8,
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-900)'
    }
  }, "Explore ", /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-right",
    size: 16,
    style: {
      transform: hover ? 'translateX(3px)' : 'none',
      transition: 'transform var(--duration-base) var(--ease-out)'
    }
  }))));
}
Object.assign(__ds_scope, { SpaceCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/SpaceCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Button
   Confident, warm, soft-cornered. Primary = ink (black) fill; gold is reserved
   as the accent variant for premium / highlight CTAs. */

const SIZES = {
  sm: {
    padding: '8px 16px',
    font: 'var(--text-sm)',
    gap: '6px',
    icon: 16,
    radius: 'var(--radius-md)',
    minH: 36
  },
  md: {
    padding: '12px 22px',
    font: 'var(--text-base)',
    gap: '8px',
    icon: 18,
    radius: 'var(--radius-pill)',
    minH: 46
  },
  lg: {
    padding: '16px 30px',
    font: 'var(--text-md)',
    gap: '10px',
    icon: 20,
    radius: 'var(--radius-pill)',
    minH: 56
  }
};
const VARIANTS = {
  primary: {
    background: 'var(--ink-900)',
    color: 'var(--sand-50)',
    border: '1.5px solid var(--ink-900)'
  },
  accent: {
    background: 'var(--gold-500)',
    color: 'var(--ink-900)',
    border: '1.5px solid var(--gold-500)'
  },
  secondary: {
    background: 'transparent',
    color: 'var(--ink-900)',
    border: '1.5px solid var(--border-strong)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--ink-900)',
    border: '1.5px solid transparent'
  },
  inverse: {
    background: 'var(--sand-50)',
    color: 'var(--ink-900)',
    border: '1.5px solid var(--sand-50)'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconAfter,
  fullWidth = false,
  disabled = false,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.primary;
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: {
      background: 'var(--ink-800)',
      borderColor: 'var(--ink-800)'
    },
    accent: {
      background: 'var(--accent-hover)',
      borderColor: 'var(--accent-hover)'
    },
    secondary: {
      background: 'var(--ink-900)',
      color: 'var(--sand-50)',
      borderColor: 'var(--ink-900)'
    },
    ghost: {
      background: 'var(--sand-100)'
    },
    inverse: {
      background: 'var(--pure-white)'
    }
  }[variant] : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setActive(false);
    },
    onMouseDown: () => setActive(true),
    onMouseUp: () => setActive(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: s.gap,
      padding: s.padding,
      minHeight: s.minH,
      fontFamily: 'var(--font-sans)',
      fontSize: s.font,
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: '-0.01em',
      lineHeight: 1,
      borderRadius: s.radius,
      width: fullWidth ? '100%' : 'auto',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transform: active ? 'scale(0.97)' : 'scale(1)',
      transition: 'background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
      ...v,
      ...hoverStyle,
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }) : null, children, iconAfter ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconAfter,
    size: s.icon
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/cards/PlanCard.jsx
try { (() => {
/* The Quarter — PlanCard. Membership plan / pricing tile. */

function PlanCard({
  name,
  price,
  period,
  summary,
  features = [],
  featured = false,
  ctaLabel = 'Choose plan',
  onChoose,
  badge,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '30px 28px 32px',
      background: featured ? 'var(--ink-900)' : 'var(--surface-card)',
      color: featured ? 'var(--sand-50)' : 'var(--text-body)',
      borderRadius: 'var(--radius-xl)',
      border: featured ? '1px solid var(--ink-900)' : '1px solid var(--border-subtle)',
      boxShadow: featured ? 'var(--shadow-lg)' : 'var(--shadow-card)',
      position: 'relative',
      ...style
    }
  }, badge ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 22,
      right: 22,
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      background: 'var(--gold-500)',
      color: 'var(--ink-900)',
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--fw-bold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)'
    }
  }, badge) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)',
      fontWeight: 'var(--fw-semibold)',
      color: featured ? 'var(--gold-400)' : 'var(--gold-700)'
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: 'var(--tracking-tight)',
      color: featured ? 'var(--sand-50)' : 'var(--ink-900)'
    }
  }, price), period ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: featured ? 'rgba(251,248,242,0.7)' : 'var(--text-muted)'
    }
  }, period) : null), summary ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: featured ? 'rgba(251,248,242,0.78)' : 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, summary) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: featured ? 'rgba(251,248,242,0.16)' : 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1
    }
  }, features.map((f, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      fontSize: 'var(--text-sm)',
      color: featured ? 'rgba(251,248,242,0.9)' : 'var(--text-body)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 17,
    color: featured ? 'var(--gold-400)' : 'var(--gold-600)',
    strokeWidth: 2.25,
    style: {
      marginTop: 1
    }
  }), /*#__PURE__*/React.createElement("span", null, f)))), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: featured ? 'accent' : 'primary',
    fullWidth: true,
    onClick: onChoose,
    iconAfter: "arrow-right"
  }, ctaLabel));
}
Object.assign(__ds_scope, { PlanCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/PlanCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/RoomCard.jsx
try { (() => {
/* The Quarter — RoomCard. Meeting / flexi room with status + capacity. */

function RoomCard({
  name,
  blurb,
  capacity,
  features = [],
  status = 'available',
  statusLabel,
  priceNote = 'Quoted on enquiry',
  imageSrc,
  imageCaption,
  ctaLabel = 'Check availability',
  onReserve,
  layout = 'vertical',
  style
}) {
  const horizontal = layout === 'horizontal';
  const statusText = statusLabel || {
    available: 'Available now',
    busy: 'In use',
    soon: 'Free soon'
  }[status];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: horizontal ? 'row' : 'column',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-card)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "q-photo",
    "data-caption": imageCaption || '',
    style: {
      position: 'relative',
      flex: 'none',
      width: horizontal ? 280 : '100%',
      aspectRatio: horizontal ? 'auto' : '16 / 10',
      backgroundImage: imageSrc ? `url(${imageSrc})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 14
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: status,
    dot: true
  }, statusText))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '22px 24px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, name), capacity ? /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "neutral",
    icon: "users",
    size: "sm"
  }, capacity) : null), blurb ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-body)',
      lineHeight: 'var(--leading-normal)'
    }
  }, blurb) : null, features.length ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 12
    }
  }, features.map((f, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      fontWeight: 'var(--fw-medium)'
    }
  }, f.icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: f.icon,
    size: 15,
    color: "var(--gold-600)"
  }) : null, f.label || f))) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 'auto',
      paddingTop: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, priceNote), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "primary",
    onClick: onReserve,
    iconAfter: "arrow-right"
  }, ctaLabel))));
}
Object.assign(__ds_scope, { RoomCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/RoomCard.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — IconButton. Square, soft-cornered icon-only control. */

const SIZES = {
  sm: {
    box: 36,
    icon: 18
  },
  md: {
    box: 44,
    icon: 20
  },
  lg: {
    box: 52,
    icon: 22
  }
};
const VARIANTS = {
  soft: {
    background: 'var(--sand-100)',
    color: 'var(--ink-900)',
    border: '1px solid transparent'
  },
  outline: {
    background: 'transparent',
    color: 'var(--ink-900)',
    border: '1.5px solid var(--border-default)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--stone-600)',
    border: '1px solid transparent'
  },
  solid: {
    background: 'var(--ink-900)',
    color: 'var(--sand-50)',
    border: '1px solid var(--ink-900)'
  }
};
function IconButton({
  icon,
  label,
  variant = 'soft',
  size = 'md',
  disabled = false,
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.soft;
  const [hover, setHover] = React.useState(false);
  const hoverBg = !disabled && hover ? variant === 'solid' ? {
    background: 'var(--ink-800)'
  } : variant === 'ghost' ? {
    background: 'var(--sand-100)'
  } : {
    background: 'var(--sand-200)',
    borderColor: 'var(--border-default)'
  } : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    "aria-label": label,
    disabled: disabled,
    title: label,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: s.box,
      height: s.box,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)',
      ...v,
      ...hoverBg,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/dashboard/AvailabilityCalendar.jsx
try { (() => {
/* The Quarter — AvailabilityCalendar. Weekly room availability grid.
   The biggest revenue lever: glanceable, tappable, calm. Columns = days,
   rows = time slots, cells carry a status. Available cells are selectable. */

const CELL = {
  available: {
    bg: 'var(--surface-card)',
    border: '1px solid var(--border-default)',
    color: 'var(--ink-900)',
    label: 'Free',
    hover: 'var(--gold-100)'
  },
  busy: {
    bg: 'var(--sand-100)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--stone-400)',
    label: 'Booked',
    hover: null
  },
  soon: {
    bg: 'rgba(181,134,47,0.10)',
    border: '1px solid rgba(181,134,47,0.3)',
    color: 'var(--warning)',
    label: 'Held',
    hover: 'var(--gold-100)'
  }
};
function AvailabilityCalendar({
  days = [],
  slots = [],
  data = [],
  roomName,
  selectedKey,
  onSelect,
  style
}) {
  const [internalSel, setInternalSel] = React.useState(null);
  const sel = selectedKey !== undefined ? selectedKey : internalSel;
  const pick = (di, si, status) => {
    if (status === 'busy') return;
    const key = `${di}-${si}`;
    if (selectedKey === undefined) setInternalSel(key);
    onSelect?.({
      day: days[di],
      slot: slots[si],
      dayIndex: di,
      slotIndex: si,
      status
    });
  };
  const cols = `72px repeat(${days.length}, 1fr)`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 22px 22px',
      border: '1px solid var(--border-subtle)',
      boxShadow: 'var(--shadow-card)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      flexWrap: 'wrap',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, roomName ? /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, roomName) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, "This week")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement(Legend, {
    swatch: "var(--surface-card)",
    border: "var(--border-default)",
    label: "Free"
  }), /*#__PURE__*/React.createElement(Legend, {
    swatch: "rgba(181,134,47,0.18)",
    border: "rgba(181,134,47,0.3)",
    label: "Held"
  }), /*#__PURE__*/React.createElement(Legend, {
    swatch: "var(--sand-100)",
    border: "var(--border-subtle)",
    label: "Booked"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: cols,
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", null), days.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: 'center',
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-900)'
    }
  }, d.label), d.date ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, d.date) : null)), slots.map((slot, si) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: si
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: 8,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)',
      fontWeight: 'var(--fw-medium)'
    }
  }, slot), days.map((_, di) => {
    const status = data[si] && data[si][di] || 'available';
    const c = CELL[status];
    const key = `${di}-${si}`;
    const isSel = sel === key;
    return /*#__PURE__*/React.createElement("button", {
      key: di,
      onClick: () => pick(di, si, status),
      disabled: status === 'busy',
      style: {
        height: 44,
        borderRadius: 'var(--radius-sm)',
        cursor: status === 'busy' ? 'default' : 'pointer',
        background: isSel ? 'var(--ink-900)' : c.bg,
        border: isSel ? '1px solid var(--ink-900)' : c.border,
        color: isSel ? 'var(--gold-400)' : c.color,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--fw-semibold)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast)'
      },
      onMouseEnter: e => {
        if (!isSel && c.hover) e.currentTarget.style.background = c.hover;
      },
      onMouseLeave: e => {
        if (!isSel) e.currentTarget.style.background = c.bg;
      }
    }, isSel ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "check",
      size: 16,
      color: "var(--gold-400)",
      strokeWidth: 2.5
    }) : c.label);
  })))));
}
function Legend({
  swatch,
  border,
  label
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 4,
      background: swatch,
      border: `1px solid ${border}`
    }
  }), label);
}
Object.assign(__ds_scope, { AvailabilityCalendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dashboard/AvailabilityCalendar.jsx", error: String((e && e.message) || e) }); }

// components/dashboard/EmptyState.jsx
try { (() => {
/* The Quarter — EmptyState. Calm, warm "nothing here yet" panel. */

function EmptyState({
  icon = 'sparkles',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      padding: compact ? '36px 28px' : '56px 32px',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-xl)',
      border: '1px dashed var(--border-default)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 60,
      height: 60,
      borderRadius: 'var(--radius-lg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--gold-100)',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 26,
    color: "var(--gold-700)"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 'var(--text-md)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--ink-900)'
    }
  }, title), message ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)',
      maxWidth: 360,
      lineHeight: 'var(--leading-normal)'
    }
  }, message) : null, actionLabel ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: "primary",
    onClick: onAction,
    iconAfter: "arrow-right"
  }, actionLabel)) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dashboard/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/dashboard/QuarterCard.jsx
try { (() => {
/* The Quarter — QuarterCard. The digital membership card (Apple Wallet "Quarter Card").
   Ink ground, gold detail, the wordmark, member + plan + card id. The premium hero
   of the member dashboard. */

function QuarterCard({
  memberName,
  plan = 'Citizen',
  cardId = '0042',
  sinceLabel = 'Member since 2025',
  logoSrc,
  qr = true,
  onAddToWallet,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: 380,
      aspectRatio: '1.586 / 1',
      padding: '26px 28px',
      borderRadius: 'var(--radius-xl)',
      overflow: 'hidden',
      color: 'var(--sand-50)',
      background: 'linear-gradient(150deg, #2A251E 0%, #1E1A15 56%, #14110D 100%)',
      boxShadow: 'var(--shadow-gold)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: 'absolute',
      top: -90,
      right: -70,
      width: 220,
      height: 220,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 30% 70%, rgba(210,181,118,0.36), rgba(190,155,83,0.04) 70%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", null, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "The Quarter",
    style: {
      height: 22,
      filter: 'invert(1)'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 19,
      letterSpacing: '-0.03em'
    }
  }, "The Quarter"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-2xs)',
      letterSpacing: 'var(--tracking-caps)',
      textTransform: 'uppercase',
      color: 'var(--gold-400)',
      marginTop: 6,
      fontWeight: 'var(--fw-semibold)'
    }
  }, "Quarter Card")), /*#__PURE__*/React.createElement("span", {
    style: {
      padding: '5px 12px',
      borderRadius: 'var(--radius-pill)',
      border: '1px solid var(--gold-500)',
      color: 'var(--gold-300)',
      fontSize: 'var(--text-2xs)',
      fontWeight: 'var(--fw-bold)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)'
    }
  }, plan)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      position: 'relative',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 'var(--text-lg)',
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: '-0.01em',
      color: 'var(--sand-50)'
    }
  }, memberName), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      marginTop: 6,
      fontSize: 'var(--text-xs)',
      color: 'rgba(251,248,242,0.62)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "No. ", cardId), /*#__PURE__*/React.createElement("span", null, sinceLabel))), qr ? /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      width: 52,
      height: 52,
      flex: 'none',
      borderRadius: 8,
      background: 'var(--sand-50)',
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gridTemplateRows: 'repeat(5,1fr)',
      gap: 2,
      padding: 5
    }
  }, Array.from({
    length: 25
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      background: [0, 1, 2, 4, 5, 9, 10, 12, 14, 15, 18, 20, 21, 22, 24].includes(i) ? 'var(--ink-900)' : 'transparent',
      borderRadius: 1
    }
  }))) : null), onAddToWallet ? /*#__PURE__*/React.createElement("button", {
    onClick: onAddToWallet,
    style: {
      position: 'absolute',
      bottom: 26,
      right: 28,
      display: 'none'
    }
  }) : null);
}
Object.assign(__ds_scope, { QuarterCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dashboard/QuarterCard.jsx", error: String((e && e.message) || e) }); }

// components/dashboard/StatTile.jsx
try { (() => {
/* The Quarter — StatTile. Calm dashboard metric (days left, bookings…). */

function StatTile({
  label,
  value,
  unit,
  icon,
  hint,
  progress,
  tone = 'default',
  style
}) {
  const isInk = tone === 'ink';
  const isGold = tone === 'gold';
  const bg = isInk ? 'var(--ink-900)' : isGold ? 'var(--gold-100)' : 'var(--surface-card)';
  const fg = isInk ? 'var(--sand-50)' : 'var(--ink-900)';
  const sub = isInk ? 'rgba(251,248,242,0.66)' : 'var(--text-muted)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      padding: '22px 24px',
      background: bg,
      borderRadius: 'var(--radius-lg)',
      border: isInk ? '1px solid var(--ink-900)' : isGold ? '1px solid var(--gold-200)' : '1px solid var(--border-subtle)',
      boxShadow: isInk ? 'none' : 'var(--shadow-card)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: sub,
      fontWeight: 'var(--fw-medium)'
    }
  }, label), icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 34,
      borderRadius: 'var(--radius-sm)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: isInk ? 'rgba(251,248,242,0.1)' : isGold ? 'var(--gold-200)' : 'var(--sand-100)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: isInk ? 'var(--gold-400)' : 'var(--gold-700)'
  })) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-3xl)',
      fontWeight: 'var(--fw-bold)',
      letterSpacing: 'var(--tracking-tight)',
      color: fg,
      lineHeight: 1
    }
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: sub
    }
  }, unit) : null), typeof progress === 'number' ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: 6,
      borderRadius: 999,
      background: isInk ? 'rgba(251,248,242,0.16)' : 'var(--sand-200)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${Math.max(0, Math.min(100, progress))}%`,
      height: '100%',
      borderRadius: 999,
      background: 'var(--gold-500)'
    }
  })) : null, hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: sub
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/dashboard/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Checkbox. Soft square, gold-on-ink check. */

function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const cbId = id || `q-cb-${Math.random().toString(36).slice(2, 8)}`;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(v => !v);
    onChange?.(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: cbId,
    style: {
      display: 'flex',
      gap: 12,
      alignItems: description ? 'flex-start' : 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: cbId,
    type: "checkbox",
    checked: on,
    onChange: toggle,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 22,
      height: 22,
      flex: 'none',
      borderRadius: 7,
      marginTop: description ? 2 : 0,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: on ? 'var(--ink-900)' : 'var(--surface-card)',
      border: `1.5px solid ${on ? 'var(--ink-900)' : 'var(--border-strong)'}`,
      transition: 'background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)'
    }
  }, on ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 15,
    color: "var(--gold-400)",
    strokeWidth: 2.5
  }) : null), label || description ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-strong)',
      fontWeight: 'var(--fw-medium)'
    }
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-sm)',
      color: 'var(--text-muted)'
    }
  }, description) : null) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Input. Soft, airy text field with optional icon + label. */

function Input({
  label,
  hint,
  error,
  icon,
  type = 'text',
  id,
  value,
  defaultValue,
  placeholder,
  disabled = false,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || `q-input-${Math.random().toString(36).slice(2, 8)}`;
  const borderColor = error ? 'var(--danger)' : focus ? 'var(--ink-900)' : 'var(--border-default)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 16px',
      background: disabled ? 'var(--sand-100)' : 'var(--surface-card)',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      minHeight: 50,
      transition: 'border-color var(--duration-fast) var(--ease-standard)',
      boxShadow: focus ? '0 0 0 4px rgba(190,155,83,0.18)' : 'none'
    }
  }, icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: "var(--stone-500)"
  }) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    type: type,
    value: value,
    defaultValue: defaultValue,
    placeholder: placeholder,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-strong)',
      padding: '13px 0',
      minWidth: 0
    }
  }, rest))), error ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--danger)'
    }
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Select. Native select styled to match Input. */

function Select({
  label,
  hint,
  options = [],
  value,
  defaultValue,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || `q-select-${Math.random().toString(36).slice(2, 8)}`;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      ...style
    }
  }, label ? /*#__PURE__*/React.createElement("label", {
    htmlFor: selId,
    style: {
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-strong)'
    }
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      background: disabled ? 'var(--sand-100)' : 'var(--surface-card)',
      border: `1.5px solid ${focus ? 'var(--ink-900)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      minHeight: 50,
      boxShadow: focus ? '0 0 0 4px rgba(190,155,83,0.18)' : 'none',
      transition: 'border-color var(--duration-fast) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selId,
    value: value,
    defaultValue: defaultValue,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      WebkitAppearance: 'none',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      flex: 1,
      padding: '13px 44px 13px 16px',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-base)',
      color: 'var(--text-strong)',
      cursor: disabled ? 'not-allowed' : 'pointer'
    }
  }, rest), options.map(o => {
    const opt = typeof o === 'string' ? {
      value: o,
      label: o
    } : o;
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: 14,
      pointerEvents: 'none',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--stone-500)"
  }))), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--text-muted)'
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Switch. Soft toggle; gold when on. */

function Switch({
  label,
  checked,
  defaultChecked,
  onChange,
  disabled = false,
  id,
  style,
  ...rest
}) {
  const isControlled = checked !== undefined;
  const [internal, setInternal] = React.useState(!!defaultChecked);
  const on = isControlled ? checked : internal;
  const swId = id || `q-sw-${Math.random().toString(36).slice(2, 8)}`;
  const toggle = e => {
    if (disabled) return;
    if (!isControlled) setInternal(v => !v);
    onChange?.(e);
  };
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: swId,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: swId,
    type: "checkbox",
    checked: on,
    onChange: toggle,
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 1,
      height: 1
    }
  }, rest)), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      position: 'relative',
      width: 46,
      height: 27,
      flex: 'none',
      borderRadius: 999,
      background: on ? 'var(--ink-900)' : 'var(--sand-300)',
      transition: 'background var(--duration-base) var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: on ? 22 : 3,
      width: 21,
      height: 21,
      borderRadius: '50%',
      background: on ? 'var(--gold-400)' : 'var(--pure-white)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-standard)'
    }
  })), label ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-base)',
      color: 'var(--text-strong)',
      fontWeight: 'var(--fw-medium)'
    }
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Footer.jsx
try { (() => {
/* The Quarter — Footer. Warm, dark, generous. Used site-wide. */

function Footer({
  logoSrc,
  columns = [],
  note,
  address,
  style
}) {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      background: 'var(--ink-900)',
      color: 'var(--sand-50)',
      padding: '72px 32px 36px',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 'var(--container-max)',
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 48,
      justifyContent: 'space-between',
      paddingBottom: 56,
      borderBottom: '1px solid rgba(251,248,242,0.14)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 320
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "The Quarter",
    style: {
      height: 28,
      filter: 'invert(1)',
      marginBottom: 20
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 24,
      letterSpacing: '-0.03em',
      marginBottom: 20
    }
  }, "The Quarter"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-relaxed)',
      color: 'rgba(251,248,242,0.72)'
    }
  }, "So much more than a workspace. A boutique coworking home in Canterbury's Cathedral Quarter."), address ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 18,
      color: 'rgba(251,248,242,0.72)',
      fontSize: 'var(--text-sm)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "map-pin",
    size: 16,
    color: "var(--gold-400)"
  }), /*#__PURE__*/React.createElement("span", null, address)) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 56
    }
  }, columns.map(col => /*#__PURE__*/React.createElement("div", {
    key: col.title,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-2xs)',
      textTransform: 'uppercase',
      letterSpacing: 'var(--tracking-caps)',
      color: 'var(--gold-400)',
      fontWeight: 'var(--fw-semibold)'
    }
  }, col.title), col.links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.label,
    href: l.href || '#',
    style: {
      fontSize: 'var(--text-sm)',
      color: 'rgba(251,248,242,0.82)'
    }
  }, l.label)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'space-between',
      paddingTop: 28,
      fontSize: 'var(--text-xs)',
      color: 'rgba(251,248,242,0.55)'
    }
  }, /*#__PURE__*/React.createElement("span", null, note || '© The Quarter, run by the Digital Tourism Think Tank.'), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'rgba(251,248,242,0.7)'
    }
  }, "Privacy"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'rgba(251,248,242,0.7)'
    }
  }, "House rules"), /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: 'rgba(251,248,242,0.7)'
    }
  }, "Contact")))));
}
Object.assign(__ds_scope, { Footer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Footer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Navbar.jsx
try { (() => {
/* The Quarter — Navbar. Marketing-site top navigation.
   Transparent-over-hero or solid; pass the real wordmark via logoSrc. */

function Navbar({
  logoSrc,
  links = [],
  variant = 'light',
  activeHref,
  onNavigate,
  ctaLabel = 'Book a day pass',
  onCta,
  signInLabel = 'Member login',
  onSignIn,
  style
}) {
  const dark = variant === 'dark';
  const fg = dark ? 'var(--sand-50)' : 'var(--ink-900)';
  return /*#__PURE__*/React.createElement("header", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '20px 32px',
      gap: 24,
      width: '100%',
      boxSizing: 'border-box',
      background: dark ? 'transparent' : 'rgba(251,248,242,0.86)',
      backdropFilter: dark ? 'none' : 'saturate(140%) blur(12px)',
      borderBottom: dark ? '1px solid rgba(251,248,242,0.14)' : '1px solid var(--border-subtle)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNavigate?.('/');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      flex: 'none'
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "The Quarter",
    style: {
      height: 26,
      filter: dark ? 'invert(1)' : 'none'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: '-0.03em',
      color: fg
    }
  }, "The\xA0Quarter")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flex: 1,
      justifyContent: 'center'
    }
  }, links.map(l => {
    const active = l.href === activeHref;
    return /*#__PURE__*/React.createElement("a", {
      key: l.href,
      href: l.href,
      onClick: e => {
        e.preventDefault();
        onNavigate?.(l.href);
      },
      style: {
        padding: '9px 15px',
        borderRadius: 'var(--radius-pill)',
        fontSize: 'var(--text-sm)',
        fontWeight: 'var(--fw-medium)',
        color: active ? dark ? 'var(--sand-50)' : 'var(--ink-900)' : dark ? 'rgba(251,248,242,0.78)' : 'var(--stone-600)',
        background: active ? dark ? 'rgba(251,248,242,0.12)' : 'var(--sand-100)' : 'transparent',
        transition: 'color var(--duration-fast), background var(--duration-fast)'
      }
    }, l.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onSignIn,
    style: {
      background: 'transparent',
      border: 'none',
      color: fg,
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--text-sm)',
      fontWeight: 'var(--fw-semibold)',
      padding: '10px 6px',
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, signInLabel), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    size: "sm",
    variant: dark ? 'inverse' : 'primary',
    onClick: onCta,
    iconAfter: "arrow-right"
  }, ctaLabel)));
}
Object.assign(__ds_scope, { Navbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Navbar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/dashboard/Dashboard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — member dashboard. Calm, premium product (not an admin panel). */
const {
  Button,
  IconButton,
  Badge,
  Avatar,
  Icon,
  Input,
  Switch,
  Select,
  StatTile,
  QuarterCard,
  AvailabilityCalendar,
  PerkCard,
  RoomCard,
  EmptyState
} = window.TheQuarterDesignSystem_2f2064;
const LOGO = '../../assets/logo-wordmark-black.png';
const MEMBER = {
  name: 'Maya Holloway',
  first: 'Maya',
  plan: 'Resident',
  email: 'maya@studioholloway.co.uk'
};
const ROOMS = [{
  name: 'The Board Room',
  capacity: '8–10',
  status: 'available',
  blurb: 'Hybrid-ready boardroom for the meetings that matter.',
  img: '../../assets/photos/photo-3937.jpg',
  caption: 'Board Room — long table, hybrid AV',
  features: [{
    icon: 'monitor',
    label: 'Hybrid A/V'
  }],
  priceNote: 'Half & full-day'
}, {
  name: 'The Hop Yard',
  capacity: '6–8',
  status: 'soon',
  statusLabel: 'Free at 14:00',
  blurb: 'High-spec, warm and characterful. Made for focused work.',
  img: '../../assets/photos/photo-3937.jpg',
  caption: 'The Hop Yard — bright room, AV screen',
  features: [{
    icon: 'wifi',
    label: 'Fibre'
  }],
  priceNote: 'Half & full-day'
}, {
  name: 'The Chapter House',
  capacity: '4–6',
  status: 'busy',
  blurb: 'Our most intimate high-spec room, with the cathedral in the window.',
  img: '../../assets/photos/photo-3939.jpg',
  caption: 'Chapter House — round table, cathedral view',
  features: [{
    icon: 'leaf',
    label: 'Cathedral view'
  }],
  priceNote: 'Half & full-day'
}];
const WEEK_DAYS = [{
  label: 'Mon',
  date: '16'
}, {
  label: 'Tue',
  date: '17'
}, {
  label: 'Wed',
  date: '18'
}, {
  label: 'Thu',
  date: '19'
}, {
  label: 'Fri',
  date: '20'
}];
const WEEK_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const WEEK_DATA = [['available', 'busy', 'available', 'soon', 'available'], ['busy', 'available', 'available', 'busy', 'available'], ['available', 'available', 'busy', 'available', 'soon'], ['busy', 'busy', 'available', 'available', 'available'], ['available', 'soon', 'available', 'busy', 'available'], ['available', 'available', 'busy', 'available', 'busy'], ['available', 'busy', 'available', 'available', 'available']];
const PERKS = [{
  partner: 'The Pound Bar',
  category: 'Food & drink',
  perk: '20% off brunch, Monday to Friday',
  expires: 'Ends 30 Jun'
}, {
  partner: 'Curzon Canterbury',
  category: 'Culture',
  perk: '2-for-1 cinema tickets midweek',
  redeemed: true
}, {
  partner: 'The Goods Shed',
  category: 'Food & drink',
  perk: 'A free pastry with any coffee',
  expires: 'Ends 14 Jul'
}, {
  partner: 'Canterbury Cycles',
  category: 'Getting here',
  perk: '15% off servicing & rentals',
  expires: 'Always on'
}];
const NAV = [{
  id: 'overview',
  label: 'Overview',
  icon: 'monitor'
}, {
  id: 'book',
  label: 'Book a room',
  icon: 'calendar'
}, {
  id: 'perks',
  label: 'Perks',
  icon: 'gift'
}, {
  id: 'account',
  label: 'Account',
  icon: 'settings'
}];
function Sidebar({
  view,
  setView
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      width: 252,
      flex: 'none',
      background: 'var(--ink-900)',
      color: 'var(--sand-50)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 18px',
      position: 'sticky',
      top: 0,
      height: '100vh',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '4px 8px 22px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/app-icon.png",
    alt: "The Quarter",
    style: {
      width: 36,
      height: 36,
      borderRadius: 9
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontSize: 17,
      letterSpacing: '-0.02em'
    }
  }, "The Quarter")), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      flex: 1
    }
  }, NAV.map(n => {
    const active = view === n.id;
    return /*#__PURE__*/React.createElement("button", {
      key: n.id,
      onClick: () => setView(n.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 14px',
        borderRadius: 'var(--radius-md)',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'rgba(251,248,242,0.1)' : 'transparent',
        color: active ? 'var(--sand-50)' : 'rgba(251,248,242,0.66)',
        fontFamily: 'var(--font-sans)',
        fontSize: 15,
        fontWeight: active ? 600 : 500,
        textAlign: 'left',
        transition: 'background var(--duration-fast)'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 19,
      color: active ? 'var(--gold-400)' : 'rgba(251,248,242,0.6)'
    }), n.label);
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(251,248,242,0.14)',
      paddingTop: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: MEMBER.name,
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, MEMBER.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'rgba(251,248,242,0.6)'
    }
  }, MEMBER.plan)), /*#__PURE__*/React.createElement("a", {
    href: "../website/index.html#/login",
    title: "Sign out",
    style: {
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "log-out",
    size: 18,
    color: "rgba(251,248,242,0.6)"
  }))));
}
function Topbar({
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 28,
      flexWrap: 'wrap',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-0.03em'
    }
  }, title), sub ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: 'var(--text-muted)',
      marginTop: 4
    }
  }, sub) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(IconButton, {
    icon: "search",
    label: "Search",
    variant: "soft"
  }), /*#__PURE__*/React.createElement(IconButton, {
    icon: "bell",
    label: "Notifications",
    variant: "soft"
  })));
}
function Overview({
  setView
}) {
  const [sel, setSel] = React.useState(null);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Topbar, {
    title: `Morning, ${MEMBER.first}`,
    sub: "Tuesday 17 June \xB7 the caf\xE9 is open and the coffee's on"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.15fr 0.85fr',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(StatTile, {
    label: "Days remaining",
    value: "6",
    unit: "of 10",
    icon: "calendar",
    progress: 60,
    hint: "Resets 1 July"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Your plan",
    value: "Resident",
    icon: "user",
    tone: "gold",
    hint: "\xA3138 \xB7 ten days"
  }), /*#__PURE__*/React.createElement(StatTile, {
    label: "Perks redeemed",
    value: "3",
    icon: "gift",
    tone: "ink",
    hint: "This month"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '22px 24px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600
    }
  }, "Upcoming"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    iconAfter: "arrow-right",
    onClick: () => setView('book')
  }, "Book another")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '14px 16px',
      background: 'var(--sand-100)',
      borderRadius: 'var(--radius-md)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      width: 52,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--gold-700)',
      textTransform: 'uppercase'
    }
  }, "Wed"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 1
    }
  }, "18")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600
    }
  }, "The Hop Yard \xB7 11:00\u201312:00"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Half day \xB7 catering added")), /*#__PURE__*/React.createElement(Badge, {
    tone: "available",
    dot: true
  }, "Confirmed"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '22px 24px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600
    }
  }, "Book a room this week"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    iconAfter: "arrow-right",
    onClick: () => setView('book')
  }, "Full week")), /*#__PURE__*/React.createElement(AvailabilityCalendar, {
    roomName: "The Board Room",
    days: WEEK_DAYS,
    slots: WEEK_SLOTS.slice(0, 5),
    data: WEEK_DATA.slice(0, 5),
    selectedKey: sel ? `${sel.dayIndex}-${sel.slotIndex}` : '',
    onSelect: setSel,
    style: {
      boxShadow: 'none',
      border: '1px solid var(--border-subtle)'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(QuarterCard, {
    memberName: MEMBER.name,
    plan: "Citizen",
    cardId: "0042",
    logoSrc: LOGO
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    icon: "credit-card"
  }, "Add to Apple Wallet")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 17,
      fontWeight: 600
    }
  }, "Perks for you"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "ghost",
    onClick: () => setView('perks')
  }, "All")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(PerkCard, PERKS[0]))))));
}
function BookView() {
  const [roomIdx, setRoomIdx] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [pkg, setPkg] = React.useState('Half day');
  const room = ROOMS[roomIdx];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Topbar, {
    title: "Book a room",
    sub: "Live availability this week \u2014 tap a free slot to reserve"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 22
    }
  }, ROOMS.map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: r.name,
    onClick: () => {
      setRoomIdx(i);
      setSel(null);
    },
    style: {
      padding: '9px 16px',
      borderRadius: 999,
      border: '1.5px solid',
      borderColor: i === roomIdx ? 'var(--ink-900)' : 'var(--border-default)',
      background: i === roomIdx ? 'var(--ink-900)' : 'transparent',
      color: i === roomIdx ? 'var(--sand-50)' : 'var(--stone-600)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, r.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.7
    }
  }, "\xB7 ", r.capacity)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.6fr) minmax(280px,0.8fr)',
      gap: 24,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      aspectRatio: '21 / 9',
      borderRadius: 'var(--radius-xl)',
      backgroundImage: `url(${room.img})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center 42%'
    }
  }), /*#__PURE__*/React.createElement(AvailabilityCalendar, {
    roomName: room.name,
    days: WEEK_DAYS,
    slots: WEEK_SLOTS,
    data: WEEK_DATA,
    selectedKey: sel ? `${sel.dayIndex}-${sel.slotIndex}` : '',
    onSelect: setSel
  })), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'sticky',
      top: 24,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '22px 24px',
      boxShadow: 'var(--shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, room.name), /*#__PURE__*/React.createElement("div", {
    style: {
      background: sel ? 'var(--gold-100)' : 'var(--sand-100)',
      borderRadius: 'var(--radius-md)',
      padding: '13px 15px',
      display: 'flex',
      gap: 11,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 19,
    color: sel ? 'var(--gold-700)' : 'var(--stone-500)'
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, sel ? `${sel.day.label} ${sel.day.date} · ${sel.slot}` : 'Pick a free slot')), /*#__PURE__*/React.createElement(Select, {
    label: "Package",
    options: ['Half day', 'Full day'],
    value: pkg,
    onChange: e => setPkg(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Comes off your plan"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--ink-900)'
    }
  }, pkg === 'Full day' ? '1 day' : '½ day')), /*#__PURE__*/React.createElement(Button, {
    variant: sel ? 'accent' : 'primary',
    fullWidth: true,
    disabled: !sel,
    iconAfter: "arrow-right"
  }, sel ? 'Reserve slot' : 'Select a slot'))));
}
function PerksView() {
  const [perks, setPerks] = React.useState(PERKS);
  const redeem = i => setPerks(ps => ps.map((p, j) => j === i ? {
    ...p,
    redeemed: true,
    expires: undefined
  } : p));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Topbar, {
    title: "Perks",
    sub: "Browse and redeem from your Quarter Card"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))',
      gap: 18
    }
  }, perks.map((p, i) => /*#__PURE__*/React.createElement(PerkCard, _extends({
    key: p.partner
  }, p, {
    onRedeem: () => redeem(i)
  })))));
}
function AccountView() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Topbar, {
    title: "Account",
    sub: "Your details and how The Quarter reaches you"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24,
      maxWidth: 820,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px 26px',
      boxShadow: 'var(--shadow-card)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600
    }
  }, "Your details"), /*#__PURE__*/React.createElement(Input, {
    label: "Full name",
    defaultValue: MEMBER.name
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    icon: "user",
    defaultValue: MEMBER.email
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Company (for invoices)",
    defaultValue: "Studio Holloway"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Save changes"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px 26px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginBottom: 16
    }
  }, "Notifications"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Switch, {
    label: "Members' socials & events",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "Booking reminders",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement(Switch, {
    label: "New perks from partners"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-100)',
      borderRadius: 'var(--radius-xl)',
      padding: '22px 24px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 17,
      fontWeight: 600
    }
  }, "On the Resident plan"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--stone-700)',
      lineHeight: 1.5,
      margin: '8px 0 16px'
    }
  }, "Ten days a month, \xA3138. Here most days? Citizen is unrestricted at \xA3258."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    iconAfter: "arrow-right"
  }, "Upgrade to Citizen")))));
}
function Dashboard() {
  const [view, setView] = React.useState('overview');
  const VIEWS = {
    overview: /*#__PURE__*/React.createElement(Overview, {
      setView: setView
    }),
    book: /*#__PURE__*/React.createElement(BookView, null),
    perks: /*#__PURE__*/React.createElement(PerksView, null),
    account: /*#__PURE__*/React.createElement(AccountView, null)
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--surface-page)'
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    view: view,
    setView: setView
  }), /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      padding: '32px 40px 64px',
      minWidth: 0
    }
  }, VIEWS[view]));
}
Object.assign(window, {
  QDashboard: Dashboard
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/dashboard/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/App.jsx
try { (() => {
/* The Quarter — website app shell + hash router. */
const {
  Navbar,
  Footer
} = window.TheQuarterDesignSystem_2f2064;
function useHashRoute() {
  const [route, setRoute] = React.useState(window.location.hash || '#/');
  React.useEffect(() => {
    const on = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({
        top: 0
      });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = href => {
    window.location.hash = href;
  };
  return [route, go];
}
function App() {
  const [route, go] = useHashRoute();
  const D = window.QData;
  const path = route.replace(/^#/, '');
  // Dark transparent nav over hero on home & spaces & login
  const darkNav = path === '/' || path === '/spaces';
  const navVariant = darkNav ? 'dark' : 'light';
  const SCREENS = {
    '/': window.QHome,
    '/spaces': window.QSpaces,
    '/plans': window.QPlans,
    '/rooms': window.QMeetingRooms,
    '/perks': window.QPerks,
    '/events': window.QEvents,
    '/daypass': window.QDayPass,
    '/login': window.QLogin
  };
  const Screen = SCREENS[path] || window.QHome;
  const activeHref = '#' + (path === '/' ? '' : path.split('/').slice(0, 2).join('/'));
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: darkNav ? 'absolute' : 'sticky',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement(Navbar, {
    logoSrc: D.LOGO_BLACK,
    links: D.NAV_LINKS,
    variant: navVariant,
    activeHref: D.NAV_LINKS.find(l => l.href === '#' + path)?.href,
    onNavigate: go,
    ctaLabel: "Book a Day Pass",
    onCta: () => go('#/daypass'),
    signInLabel: "Member login",
    onSignIn: () => go('#/login')
  })), /*#__PURE__*/React.createElement("main", {
    style: {
      minHeight: '60vh'
    }
  }, /*#__PURE__*/React.createElement(Screen, {
    go: go
  })), path !== '/login' ? /*#__PURE__*/React.createElement(Footer, {
    logoSrc: D.LOGO_BLACK,
    address: "First floor, Cathedral Quarter, Canterbury",
    columns: D.FOOTER_COLUMNS
  }) : null);
}
Object.assign(window, {
  QWebsiteApp: App
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/DayPass.jsx
try { (() => {
/* The Quarter — Day Pass checkout. */
const {
  Button,
  Input,
  Select,
  Checkbox,
  Badge,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Section
} = window.QSections;
function DayPass({
  go
}) {
  const [done, setDone] = React.useState(false);
  const [breakfast, setBreakfast] = React.useState(true);
  const base = 21.60;
  const total = base; // breakfast included
  return /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-page)",
    pad: "48px 32px 96px"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => go('#/'),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      background: 'transparent',
      border: 'none',
      color: 'var(--stone-600)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 600,
      marginBottom: 28,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "arrow-left",
    size: 16
  }), " Back"), done ? /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 560,
      margin: '0 auto',
      textAlign: 'center',
      background: 'var(--surface-card)',
      borderRadius: 'var(--radius-2xl)',
      padding: '56px 40px',
      boxShadow: 'var(--shadow-card)',
      border: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 64,
      height: 64,
      borderRadius: '50%',
      background: 'var(--gold-100)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 30,
    color: "var(--gold-700)",
    strokeWidth: 2.5
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 34,
      fontWeight: 700,
      letterSpacing: '-0.03em'
    }
  }, "You're booked in"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.6,
      color: 'var(--text-body)',
      marginTop: 14
    }
  }, "We've sent your Day Pass to your inbox. Come up to the first floor, grab a coffee and a breakfast, and find your focus. See you soon."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 28,
      display: 'flex',
      gap: 12,
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: () => go('#/')
  }, "Back to home"), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconAfter: "arrow-right",
    onClick: () => go('#/perks')
  }, "See member perks"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.2fr) minmax(320px,0.85fr)',
      gap: 40,
      alignItems: 'start',
      maxWidth: 1080,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold",
    icon: "map-pin"
  }, "Cathedral Quarter, Canterbury"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(32px,4vw,46px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.04,
      margin: '14px 0 8px'
    }
  }, "Book your Day Pass"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      color: 'var(--text-body)',
      lineHeight: 1.55,
      maxWidth: 480
    }
  }, "A full day with us \u2014 breakfast, Lavazza, fibre and the Flexi Rooms included. No commitment, just a really good day."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 18,
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "First name",
    placeholder: "Maya"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Last name",
    placeholder: "Holloway"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    icon: "user",
    placeholder: "you@company.com",
    style: {
      gridColumn: '1 / -1'
    }
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Which day?",
    options: ['Tomorrow · Tue 17 Jun', 'Wed 18 Jun', 'Thu 19 Jun', 'Fri 20 Jun', 'Pick another date'],
    style: {
      gridColumn: '1 / -1'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 22,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '18px 20px'
    }
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: "Daily healthy breakfast",
    description: "Included \u2014 let us know you're coming",
    checked: breakfast,
    onChange: () => setBreakfast(b => !b)
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Email me about members' socials"
  })), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginTop: 30,
      marginBottom: 14
    }
  }, "Payment"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Card number",
    icon: "credit-card",
    placeholder: "1234 5678 9012 3456",
    style: {
      gridColumn: '1 / -1'
    }
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Expiry",
    placeholder: "MM / YY"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "CVC",
    placeholder: "123"
  }))), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'sticky',
      top: 24,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px 24px 26px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      marginBottom: 16
    }
  }, "Your order"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 15,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-strong)',
      fontWeight: 500
    }
  }, "Day Pass"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, "\xA321.60")), [['Daily breakfast', breakfast], ['Lavazza & premium drinks', true], ['Fibre & ergonomic desk', true], ['Flexi Rooms access', true]].map(([t, on]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 14,
      color: on ? 'var(--text-body)' : 'var(--stone-400)',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "check",
    size: 15,
    color: on ? 'var(--gold-600)' : 'var(--stone-300)',
    strokeWidth: 2.25
  }), t, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: 'auto',
      fontSize: 13,
      color: 'var(--text-muted)'
    }
  }, "Included"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-subtle)',
      margin: '16px 0'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600
    }
  }, "Total"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, "\xA3", total.toFixed(2))), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)',
      marginBottom: 18
    }
  }, "Includes VAT. One day, all in."), /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    fullWidth: true,
    iconAfter: "arrow-right",
    onClick: () => setDone(true)
  }, "Confirm & pay \xA321.60"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)',
      textAlign: 'center',
      marginTop: 12
    }
  }, "You'll get your pass by email straight away."))));
}
Object.assign(window, {
  QDayPass: DayPass
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/DayPass.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Events.jsx
try { (() => {
/* The Quarter — Events. */
const {
  Badge,
  Button,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead,
  Photo
} = window.QSections;
const EVENTS = [{
  date: '20 Jun',
  day: 'Fri',
  title: 'Friday breakfast social',
  time: '08:30 – 10:00',
  kind: 'Community',
  blurb: 'Start the weekend early. Pastries, Lavazza and good company in the café.'
}, {
  date: '25 Jun',
  day: 'Wed',
  title: 'Plantspiration: repotting workshop',
  time: '17:30 – 19:00',
  kind: 'Workshop',
  blurb: 'Bring a tired plant or take one home. A hands-in-the-soil hour with our resident grower.'
}, {
  date: '02 Jul',
  day: 'Wed',
  title: 'Members\u2019 lunch & learn',
  time: '12:30 – 13:30',
  kind: 'Talk',
  blurb: 'A relaxed talk over lunch from a member doing something interesting. Lunch on us.'
}, {
  date: '11 Jul',
  day: 'Fri',
  title: 'Summer rooftop drinks',
  time: '18:00 – late',
  kind: 'Social',
  blurb: 'The cathedral, golden hour and a glass of something. Our favourite evening of the month.'
}];
function Events({
  go
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)",
    pad: "64px 32px 48px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 680
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "What\\u2019s on"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(38px,5.5vw,60px)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 1.02,
      margin: '14px 0 0'
    }
  }, "Events at The Quarter"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 19,
      lineHeight: 1.6,
      color: 'var(--text-body)',
      marginTop: 16
    }
  }, "People stay for the community. Breakfasts, workshops, talks and the occasional rooftop drink \u2014 all part of being here."))), /*#__PURE__*/React.createElement(Section, {
    pad: "48px 32px 88px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      gap: 40,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, EVENTS.map(e => /*#__PURE__*/React.createElement("div", {
    key: e.title,
    style: {
      display: 'flex',
      gap: 20,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      width: 64,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--gold-700)',
      textTransform: 'uppercase',
      letterSpacing: '0.08em'
    }
  }, e.day), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      lineHeight: 1.1
    }
  }, e.date.split(' ')[0]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, e.date.split(' ')[1])), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    size: "sm"
  }, e.kind), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 19,
      fontWeight: 600,
      margin: '8px 0 4px'
    }
  }, e.title), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--text-body)',
      lineHeight: 1.5
    }
  }, e.blurb), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: 'var(--text-muted)',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "clock",
    size: 14,
    color: "var(--gold-600)"
  }), e.time)), /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'center'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "secondary"
  }, "RSVP"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'sticky',
      top: 24
    }
  }, /*#__PURE__*/React.createElement(Photo, {
    caption: "A members\\u2019 social \\u2014 people, plants, golden hour",
    src: "../../assets/photos/photo-1949.jpg",
    ratio: "4 / 5"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--gold-100)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px 22px',
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 17,
      fontWeight: 600
    }
  }, "Not a member yet?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--stone-700)',
      lineHeight: 1.5,
      margin: '8px 0 16px'
    }
  }, "Day Pass holders are welcome at most socials. Come and meet the place."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    iconAfter: "arrow-right",
    onClick: () => go('#/daypass')
  }, "Book a Day Pass"))))));
}
Object.assign(window, {
  QEvents: Events
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Events.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Home.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Homepage. */
const {
  Button,
  Badge,
  SpaceCard,
  PlanCard,
  RoomCard,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead,
  Photo,
  IncludedStrip
} = window.QSections;
function Home({
  go
}) {
  const D = window.QData;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("section", {
    style: {
      position: 'relative',
      minHeight: 660,
      display: 'flex',
      alignItems: 'flex-end',
      padding: '0 32px 72px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: `url(${D.PHOTOS.hero})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center 38%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(20,17,13,0.52) 0%, rgba(20,17,13,0.18) 36%, rgba(20,17,13,0.78) 100%)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      maxWidth: 1200,
      margin: '0 auto',
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold",
    icon: "map-pin"
  }, "Canterbury \xB7 Cathedral Quarter"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(44px, 7vw, 84px)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 0.98,
      color: 'var(--sand-50)',
      margin: '18px 0 0'
    }
  }, "So much more", /*#__PURE__*/React.createElement("br", null), "than a workspace"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 'clamp(17px, 2vw, 21px)',
      lineHeight: 1.55,
      color: 'rgba(251,248,242,0.88)',
      marginTop: 22,
      maxWidth: 560
    }
  }, "A boutique coworking home above Canterbury's Cathedral Quarter. Come for the warmth, the natural light and the breakfast \u2014 find your focus, and an escape from home."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 14,
      marginTop: 32
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "accent",
    iconAfter: "arrow-right",
    onClick: () => go('#/daypass')
  }, "Book a Day Pass \xB7 \xA321.60"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "inverse",
    onClick: () => go('#/spaces')
  }, "See the spaces"))))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)",
    pad: "64px 32px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 40,
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 36
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 440
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Every desk plan includes"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      marginTop: 12
    }
  }, "The good things, as standard")), /*#__PURE__*/React.createElement("p", {
    style: {
      maxWidth: 420,
      fontSize: 16,
      lineHeight: 1.6,
      color: 'var(--text-body)'
    }
  }, "No tiers of small print. Whatever plan you choose, the essentials \u2014 and the lovely bits \u2014 come included.")), /*#__PURE__*/React.createElement(IncludedStrip, {
    items: D.INCLUDED
  })), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "The Spaces",
    title: "Room to think, room to gather",
    intro: "From open desks in the light to private rooms for the meetings that matter \u2014 and a caf\xE9 with the cathedral view."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 24
    }
  }, D.SPACES.map(s => /*#__PURE__*/React.createElement(SpaceCard, {
    key: s.name,
    name: s.name,
    tag: s.tag,
    blurb: s.blurb,
    imageSrc: s.img,
    imageCaption: s.caption,
    meta: s.meta,
    onOpen: () => go('#/spaces')
  })))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--ink-900)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.05fr)',
      gap: 56,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHead, {
    dark: true,
    eyebrow: "Meeting rooms",
    title: "The room that makes the meeting",
    intro: "Two high-spec rooms and a hybrid-ready boardroom, with plug-and-play A/V and catering on request. Check this week's availability and reserve in a couple of taps.",
    max: 520
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "accent",
    iconAfter: "arrow-right",
    onClick: () => go('#/rooms')
  }, "Check availability"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "inverse",
    onClick: () => go('#/rooms')
  }, "See the rooms"))), /*#__PURE__*/React.createElement(RoomCard, _extends({}, roomProps(D.ROOMS[0]), {
    onReserve: () => go('#/rooms')
  })))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHead, {
    align: "center",
    eyebrow: "Plans & pricing",
    title: "Find the plan that fits your week",
    intro: "Prices include VAT. Start with a Day Pass \u2014 no commitment, just a desk and a really good morning.",
    max: 620
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: 22,
      alignItems: 'stretch'
    }
  }, D.PLANS.slice(0, 4).map(p => /*#__PURE__*/React.createElement(PlanCard, _extends({
    key: p.name
  }, p, {
    ctaLabel: p.name === 'Day Pass' ? 'Book a Day Pass' : 'Choose ' + p.name,
    onChoose: () => go(p.name === 'Day Pass' ? '#/daypass' : '#/plans')
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 30
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconAfter: "arrow-right",
    onClick: () => go('#/plans')
  }, "See all plans, including Hybrid Office"))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 0.9fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Photo, {
    caption: "Plantspiration \u2014 greenery, the caf\xE9, people at a social",
    src: D.PHOTOS.mainSpaceWide,
    ratio: "5 / 4"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "Plantspiration"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(28px,3.4vw,40px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.08,
      marginTop: 14
    }
  }, "Fresh, light and full of plants"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.65,
      color: 'var(--text-body)',
      marginTop: 16
    }
  }, "Renovated in 2025, The Quarter feels fresh and full of life. Greenery runs throughout, the light pours in, and the cathedral sits in the window of the caf\xE9. It's the kind of place you actually want to spend your day."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 24,
      marginTop: 26
    }
  }, [['leaf', 'Plants throughout'], ['coffee', 'Daily breakfast & Lavazza'], ['users', 'A real community']].map(([ic, t]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 130
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: ic,
    size: 24,
    color: "var(--gold-600)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--text-strong)',
      lineHeight: 1.3
    }
  }, t))))))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--gold-100)",
    pad: "96px 32px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      maxWidth: 640,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(30px,4vw,46px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.04
    }
  }, "Come and find your focus"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      lineHeight: 1.6,
      color: 'var(--stone-700)',
      marginTop: 16
    }
  }, "Book a Day Pass and spend a morning with us. We think you'll want to stay."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      justifyContent: 'center',
      marginTop: 28,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "primary",
    iconAfter: "arrow-right",
    onClick: () => go('#/daypass')
  }, "Book a Day Pass"), /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "secondary",
    onClick: () => go('#/rooms')
  }, "Enquire about a room")))));
}
function roomProps(r) {
  return {
    name: r.name,
    capacity: r.capacity,
    status: r.status,
    statusLabel: r.statusLabel,
    blurb: r.blurb,
    imageSrc: r.img,
    imageCaption: r.caption,
    features: r.features,
    priceNote: r.priceNote
  };
}
Object.assign(window, {
  QHome: Home,
  QRoomProps: roomProps
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Home.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Login.jsx
try { (() => {
/* The Quarter — Member login & onboarding entry. */
const {
  Button,
  Input,
  Icon,
  Badge
} = window.TheQuarterDesignSystem_2f2064;
function Login({
  go
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: 'calc(100vh - 73px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 380
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, "Welcome back"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 36,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      margin: '16px 0 8px'
    }
  }, "Member login"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      color: 'var(--text-body)',
      lineHeight: 1.55,
      marginBottom: 28
    }
  }, "Sign in to see your plan, book a room and redeem your perks."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Email",
    type: "email",
    icon: "user",
    placeholder: "you@company.com",
    defaultValue: "maya@studioholloway.co.uk"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Password",
    type: "password",
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    defaultValue: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault(),
    style: {
      fontSize: 13,
      color: 'var(--gold-700)',
      fontWeight: 600
    }
  }, "Forgotten password?")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    fullWidth: true,
    iconAfter: "arrow-right",
    onClick: () => {
      window.location.href = '../dashboard/index.html';
    }
  }, "Sign in"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      fontSize: 13,
      margin: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border-subtle)'
    }
  }), " or ", /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      background: 'var(--border-subtle)'
    }
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--text-body)',
      textAlign: 'center'
    }
  }, "New here? ", /*#__PURE__*/React.createElement("a", {
    href: "#/daypass",
    onClick: e => {
      e.preventDefault();
      go('#/daypass');
    },
    style: {
      color: 'var(--ink-900)',
      fontWeight: 600
    }
  }, "Book a Day Pass"), " to get started.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      backgroundImage: 'url(../../assets/photos/main-space-wide.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }
  }));
}
Object.assign(window, {
  QLogin: Login
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Login.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/MeetingRooms.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Meeting rooms: weekly availability + reservation. The revenue lever. */
const {
  Button,
  Badge,
  RoomCard,
  AvailabilityCalendar,
  Select,
  Checkbox,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead,
  Photo
} = window.QSections;
function MeetingRooms({
  go
}) {
  const D = window.QData;
  const [roomIdx, setRoomIdx] = React.useState(0);
  const [sel, setSel] = React.useState(null);
  const [pkg, setPkg] = React.useState('Half day');
  const [catering, setCatering] = React.useState(true);
  const room = D.ROOMS[roomIdx];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
    bg: "var(--ink-900)",
    pad: "56px 32px 64px"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    dark: true,
    eyebrow: "Meeting rooms",
    title: "Check availability & reserve",
    intro: "Pick a room, find a free slot this week, and reserve in a couple of taps \u2014 or send an enquiry with your catering needs. Pricing is quoted on enquiry, around half-day and full-day packages.",
    max: 620
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, D.ROOMS.map((r, i) => /*#__PURE__*/React.createElement("button", {
    key: r.name,
    onClick: () => {
      setRoomIdx(i);
      setSel(null);
    },
    style: {
      padding: '10px 18px',
      borderRadius: 999,
      border: '1.5px solid',
      borderColor: i === roomIdx ? 'var(--gold-500)' : 'rgba(251,248,242,0.22)',
      background: i === roomIdx ? 'var(--gold-500)' : 'transparent',
      color: i === roomIdx ? 'var(--ink-900)' : 'var(--sand-50)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, r.name, /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.7,
      fontWeight: 500
    }
  }, "\xB7 ", r.capacity))))), /*#__PURE__*/React.createElement(Section, {
    pad: "56px 32px 40px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.5fr) minmax(300px,0.9fr)',
      gap: 28,
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 22
    }
  }, /*#__PURE__*/React.createElement(Photo, {
    caption: room.caption,
    src: room.img,
    position: "center 42%",
    ratio: "21 / 9",
    radius: "var(--radius-xl)"
  }), /*#__PURE__*/React.createElement(AvailabilityCalendar, {
    roomName: room.name,
    days: D.WEEK_DAYS,
    slots: D.WEEK_SLOTS,
    data: D.WEEK_DATA,
    selectedKey: sel ? `${sel.dayIndex}-${sel.slotIndex}` : '',
    onSelect: setSel
  })), /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'sticky',
      top: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      background: 'var(--surface-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px 24px 26px',
      boxShadow: 'var(--shadow-card)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: '-0.02em'
    }
  }, room.name), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral",
    icon: "users",
    size: "sm"
  }, room.capacity)), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: 'var(--text-body)',
      marginTop: 8,
      lineHeight: 1.5
    }
  }, room.blurb)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      flexWrap: 'wrap'
    }
  }, room.features.map((f, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      color: 'var(--text-muted)',
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: f.icon,
    size: 15,
    color: "var(--gold-600)"
  }), f.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: 'var(--border-subtle)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: sel ? 'var(--gold-100)' : 'var(--sand-100)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "calendar",
    size: 20,
    color: sel ? 'var(--gold-700)' : 'var(--stone-500)'
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--ink-900)'
    }
  }, sel ? `${sel.day.label} ${sel.day.date} · ${sel.slot}` : 'Pick a slot from the grid'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-muted)'
    }
  }, sel ? 'Slot selected' : 'Free slots are tappable'))), /*#__PURE__*/React.createElement(Select, {
    label: "Package",
    options: ['Half day', 'Full day'],
    value: pkg,
    onChange: e => setPkg(e.target.value)
  }), /*#__PURE__*/React.createElement(Checkbox, {
    label: "Add catering",
    description: "Lavazza, pastries & a healthy lunch platter",
    checked: catering,
    onChange: () => setCatering(c => !c)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", null, "Total"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--ink-900)'
    }
  }, "Quoted on enquiry")), /*#__PURE__*/React.createElement(Button, {
    variant: sel ? 'accent' : 'primary',
    fullWidth: true,
    disabled: !sel,
    iconAfter: "arrow-right"
  }, sel ? 'Reserve this slot' : 'Select a slot to reserve'), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    fullWidth: true,
    icon: "phone"
  }, "Send an enquiry instead")))), /*#__PURE__*/React.createElement(Section, {
    pad: "20px 32px 96px"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "The rooms",
    title: "Three rooms, one warm standard",
    max: 560
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))',
      gap: 24
    }
  }, D.ROOMS.map((r, i) => /*#__PURE__*/React.createElement(RoomCard, _extends({
    key: r.name
  }, window.QRoomProps(r), {
    ctaLabel: "Select room",
    onReserve: () => {
      setRoomIdx(i);
      setSel(null);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }))))));
}
Object.assign(window, {
  QMeetingRooms: MeetingRooms
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/MeetingRooms.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Perks.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Perks. */
const {
  PerkCard,
  Badge,
  Button
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead
} = window.QSections;
function Perks({
  go
}) {
  const D = window.QData;
  const cats = ['All', ...Array.from(new Set(D.PERKS.map(p => p.category)))];
  const [cat, setCat] = React.useState('All');
  const list = cat === 'All' ? D.PERKS : D.PERKS.filter(p => p.category === cat);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
    bg: "var(--gold-100)",
    pad: "64px 32px 56px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 680
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Member perks"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(38px,5.5vw,60px)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 1.02,
      margin: '14px 0 0'
    }
  }, "Good things, around the corner"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 19,
      lineHeight: 1.6,
      color: 'var(--stone-700)',
      marginTop: 16
    }
  }, "Being a member opens doors across the Cathedral Quarter \u2014 food, coffee, culture and the little favours that make a neighbourhood feel like yours. Browse and redeem from your Quarter Card."))), /*#__PURE__*/React.createElement(Section, {
    pad: "48px 32px 96px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      marginBottom: 32
    }
  }, cats.map(c => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => setCat(c),
    style: {
      padding: '9px 17px',
      borderRadius: 999,
      border: '1.5px solid',
      borderColor: c === cat ? 'var(--ink-900)' : 'var(--border-default)',
      background: c === cat ? 'var(--ink-900)' : 'transparent',
      color: c === cat ? 'var(--sand-50)' : 'var(--stone-600)',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))',
      gap: 20
    }
  }, list.map(p => /*#__PURE__*/React.createElement(PerkCard, _extends({
    key: p.partner
  }, p))))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--ink-900)",
    pad: "72px 32px 88px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      maxWidth: 560,
      margin: '0 auto'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(28px,3.6vw,40px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      color: 'var(--sand-50)'
    }
  }, "Perks live on your Quarter Card"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.6,
      color: 'rgba(251,248,242,0.78)',
      marginTop: 14
    }
  }, "Members carry the Quarter Card in Apple Wallet. Tap to browse partner perks and redeem them in a moment."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "lg",
    variant: "accent",
    iconAfter: "arrow-right",
    onClick: () => go('#/daypass')
  }, "Become a member")))));
}
Object.assign(window, {
  QPerks: Perks
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Perks.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Plans.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — Plans & pricing. */
const {
  PlanCard,
  Button,
  Badge,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead,
  IncludedStrip
} = window.QSections;
function Plans({
  go
}) {
  const D = window.QData;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
    pad: "64px 32px 8px"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    align: "center",
    eyebrow: "Plans & pricing",
    title: "Find the plan that fits your week",
    intro: "All prices include VAT. Every desk plan comes with fibre, ergonomic desks, plug-and-play A/V, a daily healthy breakfast, Lavazza coffee and access to the Flexi Rooms. Start with a Day Pass \u2014 the public way in.",
    max: 680
  })), /*#__PURE__*/React.createElement(Section, {
    pad: "24px 32px 56px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(232px,1fr))',
      gap: 20,
      alignItems: 'stretch'
    }
  }, D.PLANS.map(p => /*#__PURE__*/React.createElement(PlanCard, _extends({
    key: p.name
  }, p, {
    ctaLabel: p.name === 'Day Pass' ? 'Book a Day Pass' : 'Choose ' + p.name,
    onChoose: () => go(p.name === 'Day Pass' ? '#/daypass' : '#/daypass')
  }))))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)",
    pad: "64px 32px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "What's always included"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 32,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      margin: '12px 0 22px'
    }
  }, "No tiers of small print"), /*#__PURE__*/React.createElement(IncludedStrip, {
    items: D.INCLUDED
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--ink-900)',
      borderRadius: 'var(--radius-xl)',
      padding: '34px 32px',
      color: 'var(--sand-50)'
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold"
  }, "For teams"), /*#__PURE__*/React.createElement("h3", {
    style: {
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: '-0.02em',
      color: 'var(--sand-50)',
      margin: '16px 0 12px'
    }
  }, "Need a room, not a desk?"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 16,
      lineHeight: 1.6,
      color: 'rgba(251,248,242,0.78)'
    }
  }, "Our meeting rooms are quoted on enquiry, around half-day and full-day packages with catering. Check live availability and reserve, or send us a note."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      marginTop: 24,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    iconAfter: "arrow-right",
    onClick: () => go('#/rooms')
  }, "Meeting rooms"), /*#__PURE__*/React.createElement(Button, {
    variant: "inverse",
    icon: "phone"
  }, "Enquire"))))), /*#__PURE__*/React.createElement(Section, {
    pad: "64px 32px 96px"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    align: "center",
    title: "Questions, answered",
    max: 560
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 760,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, [['Can I just try it for a day?', 'Yes — the Day Pass at £21.60 is our public way in. A full day with breakfast, coffee and the Flexi Rooms included.'], ['Do days roll over?', 'Visitor and Resident days are used within the month. Citizen is unrestricted, so there is nothing to count.'], ['What is the Hybrid Office?', 'A Canterbury mailing address plus twelve days a year in the space — for those who work from home but want a base in town.'], ['How does meeting-room pricing work?', 'Quoted on enquiry, around half-day and full-day packages. Add catering — Lavazza, pastries and a healthy lunch — when you reserve.']].map(([q, a]) => /*#__PURE__*/React.createElement("details", {
    key: q,
    style: {
      borderBottom: '1px solid var(--border-subtle)',
      padding: '18px 4px'
    }
  }, /*#__PURE__*/React.createElement("summary", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: 'var(--ink-900)',
      cursor: 'pointer',
      listStyle: 'none',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, q, /*#__PURE__*/React.createElement(Icon, {
    name: "chevron-down",
    size: 18,
    color: "var(--stone-500)"
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      lineHeight: 1.6,
      color: 'var(--text-body)',
      marginTop: 10
    }
  }, a))))));
}
Object.assign(window, {
  QPlans: Plans
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Plans.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/Spaces.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* The Quarter — The Spaces overview. */
const {
  SpaceCard,
  RoomCard,
  Badge,
  Button,
  Icon
} = window.TheQuarterDesignSystem_2f2064;
const {
  Eyebrow,
  Section,
  SectionHead,
  Photo,
  IncludedStrip
} = window.QSections;
function Spaces({
  go
}) {
  const D = window.QData;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Section, {
    bg: "var(--ink-900)",
    pad: "64px 32px 72px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 720
    }
  }, /*#__PURE__*/React.createElement(Badge, {
    tone: "gold",
    icon: "leaf"
  }, "Fresh, light, full of plants"), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 'clamp(38px,5.5vw,64px)',
      fontWeight: 700,
      letterSpacing: '-0.035em',
      lineHeight: 1,
      color: 'var(--sand-50)',
      margin: '18px 0 0'
    }
  }, "The Spaces"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 19,
      lineHeight: 1.6,
      color: 'rgba(251,248,242,0.82)',
      marginTop: 18,
      maxWidth: 560
    }
  }, "Open desks, private breakout rooms, high-spec meeting rooms and a caf\xE9 with the cathedral view. Every corner renovated in 2025 and made to feel like home."))), /*#__PURE__*/React.createElement(Section, {
    pad: "72px 32px 40px"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))',
      gap: 24
    }
  }, D.SPACES.map(s => /*#__PURE__*/React.createElement(SpaceCard, {
    key: s.name,
    name: s.name,
    tag: s.tag,
    blurb: s.blurb,
    imageSrc: s.img,
    imageCaption: s.caption,
    meta: s.meta,
    onOpen: () => {}
  })))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 48,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, null, "The Quarter Caf\xE9"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(28px,3.4vw,40px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.08,
      marginTop: 14
    }
  }, "The cathedral view, and the breakfast"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 17,
      lineHeight: 1.65,
      color: 'var(--text-body)',
      marginTop: 16
    }
  }, "Our caf\xE9 is an open social space \u2014 not bookable, just ours to share. It's where the day starts with a daily healthy breakfast and Lavazza coffee, and where the community happens. The cathedral sits right there in the window."), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    iconAfter: "arrow-right",
    onClick: () => go('#/daypass')
  }, "Spend a morning with us"))), /*#__PURE__*/React.createElement(Photo, {
    caption: "Caf\xE9 \u2014 cathedral view, breakfast, plants, warm light",
    src: D.PHOTOS.catering,
    ratio: "5 / 4"
  }))), /*#__PURE__*/React.createElement(Section, null, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "Meeting rooms",
    title: "Rooms for the meetings that matter",
    intro: "Two high-spec rooms and a hybrid-ready boardroom \u2014 half-day and full-day packages with catering.",
    max: 560
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, D.ROOMS.map(r => /*#__PURE__*/React.createElement(RoomCard, _extends({
    key: r.name
  }, window.QRoomProps(r), {
    layout: "horizontal",
    ctaLabel: "Check availability",
    onReserve: () => go('#/rooms')
  }))))), /*#__PURE__*/React.createElement(Section, {
    bg: "var(--surface-card)",
    pad: "64px 32px 96px"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Included with every desk plan"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-0.03em',
      margin: '12px 0 32px'
    }
  }, "The good things, as standard"), /*#__PURE__*/React.createElement(IncludedStrip, {
    items: D.INCLUDED
  })));
}
Object.assign(window, {
  QSpaces: Spaces
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/Spaces.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/data.jsx
try { (() => {
/* The Quarter — shared content for the website & app kits.
   Real copy, no placeholder text. Exposed on window for the other kit scripts. */

const LOGO_BLACK = '../../assets/logo-wordmark-black.png';

// Real photography of The Quarter (Cathedral Quarter, Canterbury).
const P = '../../assets/photos/';
const PHOTOS = {
  hero: P + 'photo-3939.jpg',
  // cathedral through the window, people collaborating
  mainSpace: P + 'main-space.jpg',
  // open desks, plants, people working
  mainSpaceWide: P + 'main-space-wide.jpg',
  flexi: P + 'flexi-booths.jpg',
  // the Bell Tower & Scriptorium booths
  flexiAvailable: P + 'flexi-available.jpg',
  cafe: P + 'cafe.jpg',
  // the Quarter Café breakfast bar
  catering: P + 'photo-3942.jpg',
  // the Quarter Café catering spread
  breakfast: P + 'photo-1949.jpg',
  // caprese / fresh food
  boardroom: P + 'photo-3937.jpg',
  // hybrid-ready meeting room with AV
  meetingWindow: P + 'photo-3939.jpg' // round table by the cathedral window
};
const NAV_LINKS = [{
  label: 'The Spaces',
  href: '#/spaces'
}, {
  label: 'Plans',
  href: '#/plans'
}, {
  label: 'Meeting rooms',
  href: '#/rooms'
}, {
  label: 'Perks',
  href: '#/perks'
}, {
  label: 'Events',
  href: '#/events'
}];
const FOOTER_COLUMNS = [{
  title: 'Visit',
  links: [{
    label: 'The Spaces'
  }, {
    label: 'Meeting rooms'
  }, {
    label: 'The Quarter Café'
  }, {
    label: 'Events'
  }]
}, {
  title: 'Members',
  links: [{
    label: 'Plans & pricing'
  }, {
    label: 'Perks'
  }, {
    label: 'Member login'
  }, {
    label: 'Day Pass'
  }]
}, {
  title: 'The Quarter',
  links: [{
    label: 'Our story'
  }, {
    label: 'Plantspiration'
  }, {
    label: 'Contact'
  }]
}];
const PLANS = [{
  name: 'Day Pass',
  price: '£21.60',
  period: 'one day',
  summary: 'Your way in. A single day to feel the place.',
  features: ['Fibre & ergonomic desks', 'Daily healthy breakfast', 'Lavazza coffee & premium drinks', 'Access to the Flexi Rooms']
}, {
  name: 'Visitor',
  price: '£84',
  period: 'five days',
  summary: 'Five days to use across the month.',
  features: ['Everything in Day Pass', 'Five days, flexible', 'A change of scene when you need it']
}, {
  name: 'Resident',
  price: '£138',
  period: 'ten days',
  summary: 'Ten days a month to call your own.',
  features: ['Everything in Visitor', 'Ten days a month', 'Your favourite corner, most weeks']
}, {
  name: 'Citizen',
  price: '£258',
  period: 'a month',
  featured: true,
  badge: 'Most loved',
  summary: 'Unrestricted. For those who are mostly here.',
  features: ['Everything in Resident', 'Unrestricted access', 'Priority room booking', 'A proper second home']
}, {
  name: 'Hybrid Office',
  price: '£42',
  period: 'a month',
  summary: 'A Canterbury address, plus days when you need them.',
  features: ['Canterbury mailing address', 'Twelve days a year', 'Use the space on your terms']
}];
const INCLUDED = [{
  icon: 'wifi',
  label: 'Fibre internet'
}, {
  icon: 'briefcase',
  label: 'Ergonomic desks'
}, {
  icon: 'monitor',
  label: 'Plug-and-play A/V'
}, {
  icon: 'utensils',
  label: 'Daily healthy breakfast'
}, {
  icon: 'coffee',
  label: 'Lavazza coffee & premium drinks'
}, {
  icon: 'door-open',
  label: 'Access to the Flexi Rooms'
}];
const SPACES = [{
  name: 'The Main Space',
  tag: 'Open desks',
  blurb: 'Open desks in the light, with the hum of people finding their focus. Your day, your seat.',
  img: PHOTOS.mainSpace,
  caption: 'Main Space — open desks, plants, natural light',
  meta: [{
    icon: 'users',
    label: 'Open seating'
  }, {
    icon: 'leaf',
    label: 'Plantspiration'
  }]
}, {
  name: 'The Flexi Rooms',
  tag: 'The Bell Tower & Scriptorium',
  blurb: 'Private slat-lined booths for a call, a catch-up or an hour of quiet. Included with every desk plan.',
  img: PHOTOS.flexi,
  caption: 'Flexi booths — the Bell Tower & the Scriptorium',
  meta: [{
    icon: 'door-open',
    label: 'Drop-in'
  }, {
    icon: 'users',
    label: '1–2 people'
  }]
}, {
  name: 'The Quarter Café',
  tag: 'Open social space',
  blurb: 'The cathedral view, the natural light and the breakfast. Not bookable — just ours to share.',
  img: PHOTOS.cafe,
  caption: 'The Quarter Café — breakfast bar, plants',
  meta: [{
    icon: 'coffee',
    label: 'Lavazza & breakfast'
  }, {
    icon: 'leaf',
    label: 'Cathedral view'
  }]
}];
const ROOMS = [{
  name: 'The Board Room',
  capacity: '8–10',
  status: 'available',
  blurb: 'Hybrid-ready boardroom for the meetings that matter, with plug-and-play A/V on the wall.',
  img: PHOTOS.boardroom,
  caption: 'Board Room — long table, hybrid AV, slat wall',
  features: [{
    icon: 'monitor',
    label: 'Hybrid-ready A/V'
  }, {
    icon: 'users',
    label: 'Seats 8–10'
  }],
  priceNote: 'Half & full-day packages'
}, {
  name: 'The Hop Yard',
  capacity: '6–8',
  status: 'soon',
  statusLabel: 'Free at 14:00',
  blurb: 'A high-spec meeting room with warmth and character. Made for focused, creative work.',
  img: PHOTOS.boardroom,
  caption: 'The Hop Yard — bright meeting room, AV screen',
  features: [{
    icon: 'monitor',
    label: 'Plug-and-play A/V'
  }, {
    icon: 'wifi',
    label: 'Fibre'
  }],
  priceNote: 'Half & full-day packages'
}, {
  name: 'The Chapter House',
  capacity: '4–6',
  status: 'busy',
  blurb: 'Our most intimate high-spec room, with the cathedral right there in the window.',
  img: PHOTOS.meetingWindow,
  caption: 'Chapter House — round table, cathedral view',
  features: [{
    icon: 'users',
    label: 'Seats 4–6'
  }, {
    icon: 'leaf',
    label: 'Cathedral view'
  }],
  priceNote: 'Half & full-day packages'
}];
const PERKS = [{
  partner: 'The Pound Bar',
  category: 'Food & drink',
  perk: '20% off brunch, Monday to Friday',
  expires: 'Ends 30 Jun'
}, {
  partner: 'Curzon Canterbury',
  category: 'Culture',
  perk: '2-for-1 cinema tickets midweek',
  expires: 'Always on'
}, {
  partner: 'Lavazza at home',
  category: 'Coffee',
  perk: 'Members-only bean subscription discount',
  expires: 'Always on'
}, {
  partner: 'The Goods Shed',
  category: 'Food & drink',
  perk: 'A free pastry with any coffee',
  expires: 'Ends 14 Jul'
}, {
  partner: 'Canterbury Cycles',
  category: 'Getting here',
  perk: '15% off servicing & rentals',
  expires: 'Always on'
}, {
  partner: 'Marlowe Theatre',
  category: 'Culture',
  perk: 'Priority booking on selected shows',
  expires: 'Always on'
}];
const WEEK_DAYS = [{
  label: 'Mon',
  date: '16'
}, {
  label: 'Tue',
  date: '17'
}, {
  label: 'Wed',
  date: '18'
}, {
  label: 'Thu',
  date: '19'
}, {
  label: 'Fri',
  date: '20'
}];
const WEEK_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'];
const WEEK_DATA = [['available', 'busy', 'available', 'soon', 'available'], ['busy', 'available', 'available', 'busy', 'available'], ['available', 'available', 'busy', 'available', 'soon'], ['busy', 'busy', 'available', 'available', 'available'], ['available', 'soon', 'available', 'busy', 'available'], ['available', 'available', 'busy', 'available', 'busy'], ['available', 'busy', 'available', 'available', 'available']];
Object.assign(window, {
  QData: {
    LOGO_BLACK,
    PHOTOS,
    NAV_LINKS,
    FOOTER_COLUMNS,
    PLANS,
    INCLUDED,
    SPACES,
    ROOMS,
    PERKS,
    WEEK_DAYS,
    WEEK_SLOTS,
    WEEK_DATA
  }
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/data.jsx", error: String((e && e.message) || e) }); }

// ui_kits/website/sections.jsx
try { (() => {
/* The Quarter — website layout helpers (shared section primitives). */
const {
  Icon,
  Button
} = window.TheQuarterDesignSystem_2f2064;
function Eyebrow({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: 'var(--gold-700)',
      ...style
    }
  }, children);
}
function Section({
  children,
  bg = 'var(--surface-page)',
  pad = '104px 32px',
  id,
  style
}) {
  return /*#__PURE__*/React.createElement("section", {
    id: id,
    style: {
      background: bg,
      padding: pad,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1200,
      margin: '0 auto'
    }
  }, children));
}
function SectionHead({
  eyebrow,
  title,
  intro,
  align = 'left',
  dark = false,
  max = 640
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: align,
      margin: align === 'center' ? '0 auto' : 0,
      maxWidth: max,
      marginBottom: 44
    }
  }, eyebrow ? /*#__PURE__*/React.createElement(Eyebrow, {
    style: {
      color: dark ? 'var(--gold-400)' : 'var(--gold-700)'
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(30px, 4vw, 44px)',
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.06,
      marginTop: 14,
      color: dark ? 'var(--sand-50)' : 'var(--ink-900)'
    }
  }, title), intro ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 18,
      lineHeight: 1.6,
      marginTop: 16,
      color: dark ? 'rgba(251,248,242,0.78)' : 'var(--text-body)'
    }
  }, intro) : null);
}

/* Art-directed photo block — real photography when `src` is given, else captioned placeholder. */
function Photo({
  caption,
  src,
  dark = false,
  ratio = '4 / 3',
  radius = 'var(--radius-xl)',
  position = 'center',
  style,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: src ? '' : 'q-photo',
    "data-caption": src ? undefined : caption,
    "data-dark": !src && dark ? '' : undefined,
    style: {
      aspectRatio: ratio,
      borderRadius: radius,
      width: '100%',
      backgroundImage: src ? `url(${src})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: position,
      ...style
    }
  }, children);
}
function IncludedStrip({
  items,
  dark = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 18
    }
  }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 42,
      height: 42,
      flex: 'none',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: dark ? 'rgba(251,248,242,0.08)' : 'var(--gold-100)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: it.icon,
    size: 20,
    color: dark ? 'var(--gold-400)' : 'var(--gold-700)'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 500,
      color: dark ? 'var(--sand-50)' : 'var(--text-strong)'
    }
  }, it.label))));
}
Object.assign(window, {
  QSections: {
    Eyebrow,
    Section,
    SectionHead,
    Photo,
    IncludedStrip
  }
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/website/sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.PerkCard = __ds_scope.PerkCard;

__ds_ns.PlanCard = __ds_scope.PlanCard;

__ds_ns.RoomCard = __ds_scope.RoomCard;

__ds_ns.SpaceCard = __ds_scope.SpaceCard;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.AvailabilityCalendar = __ds_scope.AvailabilityCalendar;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.QuarterCard = __ds_scope.QuarterCard;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Footer = __ds_scope.Footer;

__ds_ns.Navbar = __ds_scope.Navbar;

})();
