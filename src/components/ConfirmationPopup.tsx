import React, { useState, useEffect } from 'react';

interface ConfirmationPopupProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonColor?: string;
  isSuccess?: boolean;
}

const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmButtonColor = 'bg-secondary-500 hover:bg-secondary-600',
  isSuccess = false,
}) => {
  const [isChecked, setIsChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false);
      setIsRendered(true);
      setTimeout(() => setIsVisible(true), 10);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  const handleConfirm = () => {
    if (isSuccess || isChecked) {
      onConfirm();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div
        className={`relative bg-white dark:bg-surface-dark-alt rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${
          isSuccess 
            ? 'bg-emerald-100 dark:bg-emerald-900/30' 
            : confirmButtonColor.includes('red') 
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-secondary-100 dark:bg-secondary-900/30'
        }`}>
          {isSuccess ? (
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : confirmButtonColor.includes('red') ? (
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-secondary-600 dark:text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        
        {/* Title */}
        <h2 className="text-xl font-display font-bold text-secondary-700 dark:text-white text-center mb-2">
          {title}
        </h2>
        
        {/* Message */}
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          {message}
        </p>
        
        {/* Checkbox for non-success modals */}
        {!isSuccess && (
          <div className="mb-6 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <label className="flex items-center cursor-pointer gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                />
                <div className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                  isChecked 
                    ? 'bg-secondary-500 border-secondary-500' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}>
                  {isChecked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                I understand this action will affect all students
              </span>
            </label>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3">
          {!isSuccess && (
            <button
              className="btn flex-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onCancel}
            >
              {cancelText}
            </button>
          )}
          <button
            className={`btn flex-1 text-white ${confirmButtonColor} ${
              !isSuccess && !isChecked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            onClick={handleConfirm}
            disabled={!isSuccess && !isChecked}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPopup;