/* The Quarter — website app shell + hash router. */
const { Navbar, Footer } = window.TheQuarterDesignSystem_2f2064;

function useHashRoute() {
  const [route, setRoute] = React.useState(window.location.hash || '#/');
  React.useEffect(() => {
    const on = () => { setRoute(window.location.hash || '#/'); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (href) => { window.location.hash = href; };
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
    '/login': window.QLogin,
  };
  const Screen = SCREENS[path] || window.QHome;
  const activeHref = '#' + (path === '/' ? '' : path.split('/').slice(0, 2).join('/'));

  return (
    <div>
      <div style={{ position: darkNav ? 'absolute' : 'sticky', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <Navbar logoSrc={D.LOGO_BLACK} links={D.NAV_LINKS} variant={navVariant}
          activeHref={D.NAV_LINKS.find(l => l.href === '#' + path)?.href}
          onNavigate={go} ctaLabel="Book a Day Pass" onCta={() => go('#/daypass')}
          signInLabel="Member login" onSignIn={() => go('#/login')} />
      </div>
      <main style={{ minHeight: '60vh' }}>
        <Screen go={go} />
      </main>
      {path !== '/login' ? (
        <Footer logoSrc={D.LOGO_BLACK} address="First floor, Cathedral Quarter, Canterbury" columns={D.FOOTER_COLUMNS} />
      ) : null}
    </div>
  );
}

Object.assign(window, { QWebsiteApp: App });
