import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { API_ENDPOINT } from '../aws-config';
import { isStaffLevel } from '../utils/roles';

const HomePage: React.FC = () => {
  const { authState } = useAuth();
  const { isAuthenticated, user } = authState;
  const [hasPartner, setHasPartner] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPartner = async () => {
      if (isAuthenticated && user?.role === 'student' && user.username) {
        // Use studentId if available, otherwise fallback to username (handling email format)
        const identifier = user.studentId || (user.username.includes('@') ? user.username.split('@')[0] : user.username);
        
        try {
          const token = localStorage.getItem('idToken');
          if (!token) return;

          const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/progress/${identifier}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            // Using /progress endpoint to bypass /students restriction for students
            // Response has { student: {...}, labs: [...] }
            setHasPartner(!!data.student?.partnerId);
          } else {
            // If student record not found or error, assume no partner (and maybe prompt to complete setup?)
            setHasPartner(false);
          }
        } catch (err) {
          setHasPartner(false);
        }
      } else {
        // Skip check
      }
    };

    checkPartner();
  }, [isAuthenticated, user]);

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12 animate-fade-in">
        
        <h1 className="font-display text-5xl md:text-6xl font-bold mb-4">
          <span className="text-secondary-700 dark:text-white">ECE 4180 –</span>{' '}
          <span className="text-gradient block mt-2">Embedded System Design</span>
          <span className="text-secondary-700 dark:text-white block mt-2 text-4xl">Spring 2026</span>
        </h1>
        


        <div className="flex flex-col md:flex-row justify-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-900/30 border border-secondary-200 dark:border-secondary-800">
            <svg className="w-5 h-5 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-secondary-700 dark:text-secondary-300">Section A: 3:30 - 4:45PM M/W</span>
            <span className="text-gray-500 dark:text-gray-400">in Klaus 1447</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary-50 dark:bg-secondary-900/30 border border-secondary-200 dark:border-secondary-800">
            <svg className="w-5 h-5 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium text-secondary-700 dark:text-secondary-300">Section B: 3:30 - 4:45PM T/R</span>
            <span className="text-gray-500 dark:text-gray-400">in Klaus 2456</span>
          </div>
        </div>

        {!isAuthenticated && (
          <div className="flex justify-center gap-4">
            <Link to="/signin" className="btn-ghost px-6 py-3 text-base">
              Sign In
            </Link>
            <Link to="/signup" className="btn-secondary px-6 py-3 text-base">
              Get Started
            </Link>
          </div>
        )}
      </section>

      {/* Welcome Card for Authenticated Users */}
      {isAuthenticated && (
        <section className="animate-slide-up animation-delay-100">
          <div className={`card-hover p-8 border-l-4 ${
            isStaffLevel(user)
              ? 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' 
              : 'border-l-gt-gold bg-primary-50/50 dark:bg-primary-900/10'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-display font-bold text-secondary-700 dark:text-white mb-2">
                  Welcome back, {user?.fullName || user?.username}!
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  You're logged in as <span className="font-semibold capitalize">{user?.role}</span>.
                </p>
                {user?.role === 'student' && (
                  <Link to="/labs" className="btn-primary inline-flex">
                    Continue to Labs →
                  </Link>
                )}

                {isStaffLevel(user) && (
                  <div className="flex gap-3">
                    <Link to="/checkoffs" className="btn-primary inline-flex">
                      Review Checkoffs
                    </Link>
                    <Link to="/people" className="btn-ghost inline-flex">
                      View Roster
                    </Link>
                  </div>
                )}
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                isStaffLevel(user)
                  ? 'bg-emerald-500'
                  : 'bg-gt-gold'
              }`}>
                <span className="text-2xl font-bold text-white">
                  {user?.fullName?.[0] || user?.username?.[0] || 'U'}
                </span>
              </div>
            </div>
            
            {user?.role === 'student' && !hasPartner && hasPartner !== null && (
              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg animate-fade-in block w-full">
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-1 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      No Partner Detected
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Labs are better with a partner! Add one now to enable shared checkoffs.
                    </p>
                  </div>
                  <Link to="/my-grades" className="btn-secondary whitespace-nowrap text-sm px-6 py-2.5 shadow-sm">
                    Add Partner
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* TA Office Hours Calendar - Only visible to authenticated users */}
      {isAuthenticated && (
        <section className="animate-slide-up animation-delay-150">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gt-gold/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-gt-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-display font-bold text-secondary-700 dark:text-white">TA Office Hours</h2>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <iframe 
                src="https://calendar.google.com/calendar/u/0/embed?height=600&wkst=2&ctz=America/New_York&showWeekends=0&mode=WEEK&title=ECE4180+TA+Office+Hours&showTabs=0&showCalendars=0&src=MTJjZjU5MDA4NGIzNzk5YmZkZTBlOTk4Mjk0NzU5ZDc5OGNiOWU3NDI1MjQ4NTYzYmY4OTRhNGYxZmRmZjdjZEBncm91cC5jYWxlbmRhci5nb29nbGUuY29t&color=%23967e67"
                title="ECE 4180 TA Office Hours Calendar"
                className="w-full"
                style={{ height: '500px', border: 0 }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Features Grid */}

      {/* Lab Structure */}
      <section className="animate-slide-up animation-delay-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-secondary-100 dark:bg-secondary-900/50 flex items-center justify-center">
            <svg className="w-5 h-5 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-secondary-700 dark:text-white">Lab Structure</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { num: 0, title: 'Intro & Setup', desc: 'ESP32 introduction and development environment' },
            { num: 1, title: 'Bare-Metal I/O', desc: 'I/O and signal processing' },
            { num: 2, title: 'Wired Comm', desc: 'Communication protocols and actuators' },
            { num: 3, title: 'Interrupts', desc: 'Interrupts and wireless communication' },
            { num: 4, title: 'RTOS & ML', desc: 'Timers and on-device machine learning' },
          ].map((lab, idx) => (
            <div 
              key={lab.num}
              className="group p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-gt-gold dark:hover:border-gt-gold hover:shadow-lg transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="w-8 h-8 rounded-lg bg-secondary-100 dark:bg-secondary-900/50 flex items-center justify-center text-sm font-bold text-secondary-600 dark:text-secondary-400 group-hover:bg-gt-gold group-hover:text-gt-navy transition-colors">
                  {lab.num}
                </span>
                <h4 className="font-semibold text-secondary-700 dark:text-white">{lab.title}</h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 pl-11">{lab.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Objectives */}
      <section className="animate-slide-up animation-delay-400">
        <div className="card">
          <h3 className="text-xl font-display font-bold text-secondary-700 dark:text-white mb-4">Learning Objectives</h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Identify Embedded Systems in the real world along with the problems they solve',
              'Design systems using a microcontroller with peripherals and I/O devices',
              'Understand how microcontrollers and peripherals communicate via different protocols',
              'Write software with and without APIs in both high-level and low-level languages',
              'Understand hardware timers with respect to the processor\'s clock',
              'Analyze and create real-time systems for deployment on Embedded Systems',
            ].map((obj, idx) => (
              <li key={idx} className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">{obj}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Course Staff & Grading */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up animation-delay-500">
        {/* Staff */}
        <div className="card">
          <h3 className="text-xl font-display font-bold text-secondary-700 dark:text-white mb-4">Course Staff</h3>
          
          {/* Instructor & GTA - same level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Instructor */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Instructor</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-gt flex items-center justify-center">
                  <span className="font-bold text-gt-gold">DF</span>
                </div>
                <div>
                  <p className="font-medium text-secondary-700 dark:text-white">Diego Fratta</p>
                  <a href="mailto:fratta@gatech.edu" className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold">
                    fratta@gatech.edu
                  </a>
                </div>
              </div>
            </div>
            
            {/* GTA */}
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <h4 className="text-xs font-semibold text-gt-gold uppercase tracking-wide mb-3">Graduate TA</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gt-gold flex items-center justify-center">
                  <span className="font-bold text-gt-navy">MN</span>
                </div>
                <div>
                  <p className="font-medium text-secondary-700 dark:text-white">Matt Neto</p>
                  <a href="mailto:mneto6@gatech.edu" className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold">
                    mneto6@gatech.edu
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* UTAs */}
          <div>
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Undergraduate TAs</h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Pedro Chen', email: 'pchen396' },
                { name: 'Jason Hsiao', email: 'jhsiao9' },
                { name: 'Advaith Menon', email: 'advaith' },
                { name: 'Keshav Parthasarathy', email: 'kparthas6' },
                { name: 'Dev Patel', email: 'dpatel742' },
                { name: 'Maddie White', email: 'mwhite359' },
              ].map((ta) => (
                <a 
                  key={ta.email}
                  href={`mailto:${ta.email}@gatech.edu`}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                    {ta.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{ta.name}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Grading */}
        <div className="card">
          <h3 className="text-xl font-display font-bold text-secondary-700 dark:text-white mb-4">Grading</h3>
          
          <div className="space-y-4">
            {[
              { label: 'Lab Assignments', value: 25, color: 'bg-emerald-500' },
              { label: 'Midterm 1', value: 20, color: 'bg-secondary-500' },
              { label: 'Midterm 2', value: 20, color: 'bg-secondary-400' },
              { label: 'Final Project', value: 35, color: 'bg-gt-gold' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="font-medium text-secondary-700 dark:text-white">{item.value}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>CIOS Bonus:</strong> Up to 1% extra credit for course evaluation.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
