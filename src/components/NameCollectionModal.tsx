import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isStaffLevel } from '../utils/roles';

interface NameCollectionModalProps {
  isOpen: boolean;
  onClose?: () => void; // Optional since modal should only close on successful submission
}

const NameCollectionModal: React.FC<NameCollectionModalProps> = ({
  isOpen,
  onClose
}) => {
  const [fullName, setFullName] = useState('');
  const [section, setSection] = useState<'A' | 'B' | 'Staff' | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  
  const { updateUserAttributes, authState } = useAuth();
  
  // Check if user has any staff-level role
  const isStaff = isStaffLevel(authState.user);

  // Handle modal visibility animations
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Small delay to ensure the component is rendered before adding the visible class
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      // Wait for the animation to complete before removing from DOM
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset form when modal opens, pre-fill if values exist
  useEffect(() => {
    if (isOpen) {
      // If user already has a name, pre-fill it
      setFullName(authState.user?.fullName || '');
      
      // For staff, always set section to 'Staff'
      if (isStaff) {
        setSection('Staff');
      } else {
        setSection(authState.user?.section || '');
      }
      
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, authState.user?.fullName, authState.user?.section, isStaff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (fullName.trim().length < 2) {
      setError('Please enter a valid full name');
      return;
    }

    // For students, check that section is selected
    if (!isStaff && !section) {
      setError('Please select your section');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Staff always get 'Staff' as section
      const finalSection = isStaff ? 'Staff' : section as 'A' | 'B';
      await updateUserAttributes(fullName.trim(), finalSection);
      // Modal will close automatically when the auth state updates
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFullName(e.target.value);
    if (error) {
      setError(null);
    }
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSection(e.target.value as 'A' | 'B' | '');
    if (error) {
      setError(null);
    }
  };

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Dark overlay */}
      <div 
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isVisible ? 'opacity-60' : 'opacity-0'
        }`}
      />
      
      {/* Modal content */}
      <div
        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md mx-4 transition-all duration-300 ease-in-out ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        <div className="text-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isStaff 
              ? 'bg-gradient-gold' 
              : 'bg-gradient-to-br from-blue-500 to-indigo-600'
          }`}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome{isStaff ? ', Staff Member' : ' to ECE 4180'}!
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {isStaff 
              ? 'Please enter your name to complete your profile.' 
              : "Let's get you set up. Please enter your details below."}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Full Name Input */}
          <div className="mb-5">
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all dark:bg-gray-700 dark:text-white ${
                error && !fullName.trim() ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
              }`}
              value={fullName}
              onChange={handleInputChange}
              placeholder={isStaff ? "Enter your full name" : "Enter your full name as it appears on Canvas"}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          {/* Section Dropdown - Only show for students, disabled for staff */}
          <div className="mb-5">
            <label htmlFor="section" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
              Section
            </label>
            {isStaff ? (
              // Staff see a disabled input showing "Staff"
              <input
                id="section"
                type="text"
                className="w-full px-4 py-3 border-2 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 cursor-not-allowed"
                value="Staff"
                disabled
              />
            ) : (
              // Students see the dropdown
              <select
                id="section"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white dark:bg-gray-700 dark:text-white appearance-none cursor-pointer ${
                  error && !section ? 'border-red-500' : 'border-gray-200 dark:border-gray-600'
                }`}
                value={section}
                onChange={handleSectionChange}
                disabled={isSubmitting}
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="">Select your section</option>
                <option value="A">Section A</option>
                <option value="B">Section B</option>
              </select>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center">
                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          {/* Info Box - Different message for staff vs students */}
          <div className={`rounded-lg p-4 mb-6 border ${
            isStaff 
              ? 'bg-gt-gold/10 border-gt-gold/30 dark:bg-gt-gold/10 dark:border-gt-gold/30' 
              : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className={`h-5 w-5 ${isStaff ? 'text-gt-gold' : 'text-blue-500'}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className={`text-sm ${isStaff ? 'text-gt-gold dark:text-gt-gold-light' : 'text-blue-700 dark:text-blue-300'}`}>
                  {isStaff 
                    ? 'Your name will be shown to students when you grade their submissions.'
                    : 'This helps staff identify you for lab checkoffs and ensures proper grade recording!'}
                </p>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !fullName.trim() || (!isStaff && !section)}
            className={`w-full py-3 rounded-lg text-white font-semibold text-base transition-all duration-200 ${
              isSubmitting || !fullName.trim() || (!isStaff && !section)
                ? 'bg-gray-400 cursor-not-allowed'
                : isStaff
                  ? 'bg-gt-gold hover:bg-gt-gold-light text-gt-navy shadow-lg hover:shadow-glow-gold transform hover:-translate-y-0.5'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </div>
            ) : (
              'Get Started'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NameCollectionModal;
