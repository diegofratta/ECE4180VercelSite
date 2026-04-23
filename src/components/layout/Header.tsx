import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isStaffLevel, isAdmin } from '../../utils/roles';
import { fetchCurrentTerm } from '../../utils/terms';

const Header: React.FC = () => {
  const { authState, signOut, viewAsStudent, toggleViewAsStudent } = useAuth();
  const { isAuthenticated, user } = authState;
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTermLabel, setActiveTermLabel] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Pull the active term label so staff/admins can see at a glance which
  // term new writes will be stamped with. Swallow errors — a missing term
  // badge is way better UX than a broken header.
  useEffect(() => {
    if (!isAuthenticated || !isStaffLevel(user)) {
      setActiveTermLabel(null);
      return;
    }
    let cancelled = false;
    fetchCurrentTerm()
      .then((res) => {
        if (cancelled) return;
        setActiveTermLabel(res.term?.displayName || res.activeTermId || null);
      })
      .catch(() => {
        if (!cancelled) setActiveTermLabel(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user]);

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme === 'dark' || !storedTheme || (storedTheme === 'system' && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Close the user dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!isUserMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isUserMenuOpen]);

  // Close dropdowns on route change so they don't linger after navigation.
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  };

  const isActive = (path: string) => location.pathname === path;

  // Compact desktop nav link: slightly smaller padding than before so 8-9
  // items fit comfortably at ~1280px wide without wrapping.
  const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <Link
      to={to}
      className={`relative px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 rounded-lg
        ${isActive(to)
          ? 'text-gt-gold dark:text-gt-gold'
          : 'text-white/80 hover:text-white dark:text-gray-300 dark:hover:text-white'
        }
        hover:bg-white/10
      `}
    >
      {children}
      {isActive(to) && (
        <span className="absolute bottom-0 left-2.5 right-2.5 h-0.5 bg-gt-gold rounded-full" />
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-gradient-gt shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img
              src="/Georgia_Tech_Yellow_Jackets_logo.svg"
              alt="Georgia Tech"
              className="w-10 h-10 object-contain"
            />
            <div className="hidden sm:flex flex-col whitespace-nowrap">
              <span className="font-display font-bold text-white text-lg leading-tight">ECE 4180</span>
              <span className="text-xs text-gt-gold font-medium">Embedded Systems</span>
            </div>
          </Link>

          {/* Desktop Navigation — hides into the hamburger at anything below lg (1024px) */}
          <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {isAuthenticated ? (
              <>
                <NavLink to="/">Home</NavLink>
                <NavLink to="/labs">Labs</NavLink>
                <NavLink to="/guides">Guides</NavLink>
                <NavLink to="/queue">Queue</NavLink>
                {(!isStaffLevel(user) || viewAsStudent) && (
                  <NavLink to="/my-grades">My Grades</NavLink>
                )}
                {isStaffLevel(user) && !viewAsStudent && (
                  <>
                    <NavLink to="/people">People</NavLink>
                    <NavLink to="/grades">Grades</NavLink>
                    <NavLink to="/checkoffs">Checkoffs</NavLink>
                    <NavLink to="/admin/audit">Audit</NavLink>
                  </>
                )}
                {isStaffLevel(user) && !viewAsStudent && (
                  <NavLink to="/admin/data">Data</NavLink>
                )}
                {isAdmin(user) && !viewAsStudent && (
                  <>
                    <NavLink to="/admin/staff">Staff</NavLink>
                    <NavLink to="/admin/terms">Terms</NavLink>
                    <NavLink to="/admin/purge">Purge</NavLink>
                  </>
                )}
              </>
            ) : (
              <NavLink to="/">Home</NavLink>
            )}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Active term badge — staff-level only; admins click through to /admin/terms */}
            {isAuthenticated && isStaffLevel(user) && activeTermLabel && (
              isAdmin(user) ? (
                <Link
                  to="/admin/terms"
                  className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-gt-gold/20 text-gt-gold hover:bg-gt-gold/30 transition-colors"
                  title="Manage terms"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gt-gold" />
                  {activeTermLabel}
                </Link>
              ) : (
                <span
                  className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap bg-gt-gold/10 text-gt-gold/80"
                  title="Active term"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-gt-gold" />
                  {activeTermLabel}
                </span>
              )
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {isAuthenticated ? (
              /* User menu — one button, one dropdown. Replaces the old standalone
                 Staff View / Change Password / Sign Out buttons that were wrapping
                 and clashing with the nav. */
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors duration-200 whitespace-nowrap"
                >
                  <div className="w-7 h-7 rounded-full bg-gt-gold flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-gt-navy">
                      {user?.fullName?.[0] || user?.username?.[0] || 'U'}
                    </span>
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-medium text-white leading-tight max-w-[10rem] truncate">
                      {user?.fullName || user?.username}
                    </span>
                    <span className="text-[10px] text-white/60 capitalize">
                      {user?.role}
                      {viewAsStudent && isStaffLevel(user) ? ' · viewing as student' : ''}
                    </span>
                  </div>
                  <svg
                    className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 animate-slide-down"
                  >
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {user?.fullName || user?.username}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {user?.role}
                      </div>
                    </div>

                    {/* Staff-only: switch between staff view and student-simulated view */}
                    {isStaffLevel(user) && (
                      <button
                        onClick={() => {
                          toggleViewAsStudent();
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                        role="menuitem"
                      >
                        {viewAsStudent ? 'Switch to staff view' : 'Preview as student'}
                      </button>
                    )}

                    <Link
                      to="/change-password"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/60"
                      role="menuitem"
                    >
                      Change password
                    </Link>

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        signOut();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-200 dark:border-gray-700"
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/signin"
                  className="px-3 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 whitespace-nowrap transition-all duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="px-3 py-2 rounded-xl text-sm font-bold bg-gt-gold text-gt-navy hover:bg-gt-gold-light whitespace-nowrap transition-all duration-200 shadow-md hover:shadow-glow-gold"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Hamburger (hides at lg+) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-white/10 animate-slide-down">
            <div className="flex flex-col gap-1">
              {isAuthenticated ? (
                <>
                  {/* Term badge shown at top of mobile menu so it's not invisible on small widths */}
                  {isStaffLevel(user) && activeTermLabel && (
                    <div className="px-4 py-1.5 text-xs text-gt-gold/80 font-semibold">
                      Active term: {activeTermLabel}
                    </div>
                  )}
                  <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Home</Link>
                  <Link to="/labs" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Labs</Link>
                  <Link to="/guides" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Guides</Link>
                  <Link to="/queue" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Queue</Link>
                  {(!isStaffLevel(user) || viewAsStudent) && (
                    <Link to="/my-grades" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">My Grades</Link>
                  )}
                  {isStaffLevel(user) && !viewAsStudent && (
                    <>
                      <Link to="/people" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">People</Link>
                      <Link to="/grades" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Grades</Link>
                      <Link to="/checkoffs" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Checkoffs</Link>
                      <Link to="/admin/audit" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Audit</Link>
                    </>
                  )}
                  {isStaffLevel(user) && !viewAsStudent && (
                    <Link to="/admin/data" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Data</Link>
                  )}
                  {isAdmin(user) && !viewAsStudent && (
                    <>
                      <Link to="/admin/staff" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Staff</Link>
                      <Link to="/admin/terms" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Terms</Link>
                      <Link to="/admin/purge" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Purge</Link>
                    </>
                  )}
                  {isStaffLevel(user) && (
                    <button
                      onClick={() => { toggleViewAsStudent(); setIsMobileMenuOpen(false); }}
                      className="px-4 py-2 text-left text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                      {viewAsStudent ? 'Switch to staff view' : 'Preview as student'}
                    </button>
                  )}
                  <Link to="/change-password" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Change password</Link>
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); signOut(); }}
                    className="px-4 py-2 text-left text-red-200 hover:text-red-100 hover:bg-red-500/20 rounded-lg"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Home</Link>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
