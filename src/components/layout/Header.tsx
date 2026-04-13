import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Header: React.FC = () => {
  const { authState, signOut, viewAsStudent, toggleViewAsStudent } = useAuth();
  const { isAuthenticated, user } = authState;
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    // Check local storage or system preference
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Default to dark mode if no preference or if stored is dark or if system is dark
    // This effectively makes 'dark' the default if nothing is stored
    if (storedTheme === 'dark' || (!storedTheme) || (storedTheme === 'system' && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

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

  const NavLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
    <Link
      to={to}
      className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 rounded-lg
        ${isActive(to)
          ? 'text-gt-gold dark:text-gt-gold'
          : 'text-white/80 hover:text-white dark:text-gray-300 dark:hover:text-white'
        }
        hover:bg-white/10
      `}
    >
      {children}
      {isActive(to) && (
        <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gt-gold rounded-full" />
      )}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-gradient-gt shadow-lg backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img 
              src="/Georgia_Tech_Yellow_Jackets_logo.svg" 
              alt="Georgia Tech" 
              className="w-10 h-10 object-contain"
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-display font-bold text-white text-lg leading-tight">ECE 4180</span>
              <span className="text-xs text-gt-gold font-medium">Embedded Systems</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <NavLink to="/">Home</NavLink>
                <NavLink to="/labs">Labs</NavLink>
                <NavLink to="/guides">Guides</NavLink>
                <NavLink to="/queue">Queue</NavLink>
                {(user?.role !== 'staff' || viewAsStudent) && (
                  <NavLink to="/my-grades">My Grades</NavLink>
                )}
                {user?.role === 'staff' && !viewAsStudent && (
                  <>
                    <NavLink to="/people">People</NavLink>
                    <NavLink to="/grades">Grades</NavLink>
                    <NavLink to="/checkoffs">Checkoffs</NavLink>
                  </>
                )}
              </>
            ) : (
              <NavLink to="/">Home</NavLink>
            )}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
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
              <div className="flex items-center gap-3">
                {/* Staff View Toggle */}
                {user?.role === 'staff' && (
                  <button
                    onClick={toggleViewAsStudent}
                    className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewAsStudent
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {viewAsStudent ? 'Student View' : 'Staff View'}
                  </button>
                )}

                {/* User Info */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                  <div className="w-7 h-7 rounded-full bg-gt-gold flex items-center justify-center">
                    <span className="text-xs font-bold text-gt-navy">
                      {user?.fullName?.[0] || user?.username?.[0] || 'U'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-white leading-tight">
                      {user?.fullName || user?.username}
                    </span>
                    <span className="text-[10px] text-white/60 capitalize">{user?.role}</span>
                  </div>
                </div>

                {/* Change Password */}
                <Link
                  to="/change-password"
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Change Password
                </Link>

                {/* Sign Out */}
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/signin"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-gt-gold text-gt-navy hover:bg-gt-gold-light transition-all duration-200 shadow-md hover:shadow-glow-gold"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
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
          <nav className="md:hidden py-4 border-t border-white/10 animate-slide-down">
            <div className="flex flex-col gap-1">
              {isAuthenticated ? (
                <>
                  <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Home</Link>
                  <Link to="/labs" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Labs</Link>
                  <Link to="/guides" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Guides</Link>
                  <Link to="/queue" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Queue</Link>
                  {(user?.role !== 'staff' || viewAsStudent) && (
                    <Link to="/my-grades" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">My Grades</Link>
                  )}
                  {user?.role === 'staff' && !viewAsStudent && (
                    <>
                      <Link to="/people" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">People</Link>
                      <Link to="/grades" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Grades</Link>
                      <Link to="/checkoffs" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Checkoffs</Link>
                    </>
                  )}
                  {user?.role === 'staff' && (
                    <button
                      onClick={() => { toggleViewAsStudent(); setIsMobileMenuOpen(false); }}
                      className="px-4 py-2 text-left text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                    >
                      {viewAsStudent ? 'Switch to Staff View' : 'Switch to Student View'}
                    </button>
                  )}
                  <Link to="/change-password" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg">Change Password</Link>
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
