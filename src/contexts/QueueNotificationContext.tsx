import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { API_ENDPOINT } from '../aws-config';
import { isStaffLevel } from '../utils/roles';

interface QueueNotificationContextType {
  showBanner: boolean;
  message: string;
}

const QueueNotificationContext = createContext<QueueNotificationContextType>({
  showBanner: false,
  message: ''
});

export const useQueueNotification = () => useContext(QueueNotificationContext);

interface QueueNotificationProviderProps {
  children: React.ReactNode;
}

export const QueueNotificationProvider: React.FC<QueueNotificationProviderProps> = ({ children }) => {
  const { authState, viewAsStudent } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showBanner, setShowBanner] = useState(false);
  const [message, setMessage] = useState('');
  
  const previousQueueCountRef = useRef<number>(0);
  const hasInitializedRef = useRef<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isStaff = isStaffLevel(authState.user) && !viewAsStudent;
  const isOnQueuePage = location.pathname === '/queue';

  const handleBannerClick = () => {
    if (!isOnQueuePage) {
      navigate('/queue');
      setShowBanner(false);
    }
  };

  const fetchQueue = useCallback(async () => {
    if (!isStaff || !authState.isAuthenticated) return;

    try {
      const token = localStorage.getItem('idToken');
      if (!token) return;

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/lab-queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) return;

      const data = await response.json();
      const currentTotal = (data.queue?.totalCheckoff || 0) + (data.queue?.totalHelp || 0);
      const previousTotal = previousQueueCountRef.current;

      // Only notify if we've already initialized (skip first load) AND count increased
      if (hasInitializedRef.current && currentTotal > previousTotal) {
        const newCount = currentTotal - previousTotal;
        const notificationMessage = newCount === 1 
          ? 'A new student has joined the queue!' 
          : `${newCount} new students have joined the queue!`;
        
        setMessage(notificationMessage);
        setShowBanner(true);
        
        // Play notification sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        
        // Auto-hide banner after 3 seconds
        setTimeout(() => {
          setShowBanner(false);
        }, 3000);
      }

      previousQueueCountRef.current = currentTotal;
      hasInitializedRef.current = true;
    } catch (err) {
      // Silently fail - this is a background notification feature
    }
  }, [isStaff, authState.isAuthenticated]);

  // Poll queue status every 2 seconds for staff
  useEffect(() => {
    if (!isStaff || !authState.isAuthenticated) {
      // Reset state when not staff
      hasInitializedRef.current = false;
      previousQueueCountRef.current = 0;
      return;
    }

    fetchQueue();
    const interval = setInterval(fetchQueue, 2000);
    return () => clearInterval(interval);
  }, [isStaff, authState.isAuthenticated, fetchQueue]);

  return (
    <QueueNotificationContext.Provider value={{ showBanner, message }}>
      {/* Audio element for notification sound */}
      <audio ref={audioRef} src="/ding.wav" preload="auto" />
      
      {/* Global notification banner */}
      <div 
        onClick={handleBannerClick}
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ease-out ${
          showBanner 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 -translate-y-4 pointer-events-none'
        } ${!isOnQueuePage ? 'cursor-pointer hover:scale-105' : ''}`}
      >
        <div className="flex items-center gap-3 px-6 py-4 rounded-xl bg-primary-500 text-white shadow-lg shadow-primary-500/25">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <span className="font-medium">{message}</span>
          {!isOnQueuePage && (
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
      
      {children}
    </QueueNotificationContext.Provider>
  );
};

export default QueueNotificationContext;

