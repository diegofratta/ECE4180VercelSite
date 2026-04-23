import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

// Reusable form wrapper component
const AuthCard: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
  <div className="w-full max-w-md mx-auto animate-scale-in">
    <div className="card-glass border border-gray-200/50 dark:border-gray-700/50 shadow-xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-gt flex items-center justify-center shadow-lg">
          <span className="font-display font-bold text-gt-gold text-2xl">GT</span>
        </div>
        <h2 className="font-display text-2xl font-bold text-secondary-700 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ECE 4180 Embedded Systems</p>
      </div>
      {children}
    </div>
  </div>
);

// Error alert component
const ErrorAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 animate-shake">
    <div className="flex items-start gap-3">
      <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
    </div>
  </div>
);

// Success alert component
const SuccessAlert: React.FC<{ message: string }> = ({ message }) => (
  <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
    <div className="flex items-start gap-3">
      <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
    </div>
  </div>
);

// Floating label input component
const FormInput: React.FC<{
  id: string;
  type: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  pattern?: string;
  title?: string;
  hint?: string;
  autoComplete?: string;
}> = ({ id, type, label, value, onChange, required, pattern, title, hint, autoComplete }) => (
  <div className="mb-5">
    <label htmlFor={id} className="label">
      {label}
    </label>
    <input
      id={id}
      type={type}
      className="input"
      value={value}
      onChange={onChange}
      required={required}
      pattern={pattern}
      title={title}
      autoComplete={autoComplete}
    />
    {hint && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{hint}</p>}
  </div>
);

// Primary button component
const SubmitButton: React.FC<{ isLoading: boolean; text: string; loadingText: string }> = ({ isLoading, text, loadingText }) => (
  <button
    type="submit"
    disabled={isLoading}
    className="btn-primary w-full text-base py-3 relative overflow-hidden group"
  >
    {isLoading ? (
      <span className="flex items-center justify-center gap-2">
        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        {loadingText}
      </span>
    ) : (
      <span className="relative z-10">{text}</span>
    )}
  </button>
);

export const SignInForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, authState } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (authState.isAuthenticated) {
      navigate('/');
    }
  }, [authState.isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signIn(email, password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Welcome Back">
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit}>
        <FormInput
          id="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FormInput
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <SubmitButton isLoading={isLoading} text="Sign In" loadingText="Signing in..." />
        
        <div className="mt-6 text-center space-y-3">
          <Link 
            to="/forgot-password" 
            className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors"
          >
            Forgot your password?
          </Link>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
};

export const SignUpForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [section, setSection] = useState<'' | 'A' | 'B'>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const { signUp, confirmSignUp, resendVerificationCode } = useAuth();
  const navigate = useNavigate();

  const validateEmail = (email: string): boolean => {
    return email.endsWith('@gatech.edu');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!validateEmail(email)) {
      setError('Only @gatech.edu email addresses are allowed');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!fullName.trim()) {
      setError('Full name is required');
      setIsLoading(false);
      return;
    }

    if (!section) {
      setError('Please pick your section');
      setIsLoading(false);
      return;
    }

    try {
      await signUp(email, password, fullName.trim(), section);
      setShowConfirmation(true);
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Exceeded daily email limit")) {
        setError("Sign-up limit reached for today due to AWS restrictions. Please try again tomorrow or email mneto6@gatech.edu");
      } else if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait 15-30 minutes before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await confirmSignUp(email, confirmationCode);
      navigate('/signin');
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Exceeded daily email limit")) {
        setError("Verification limit reached for today. Please try again tomorrow.");
      } else if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait 15-30 minutes before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <AuthCard title="Verify Your Email">
        {error && <ErrorAlert message={error} />}
        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            We've sent a verification code to <strong>{email}</strong>. Please check your inbox.
          </p>
        </div>
        <form onSubmit={handleConfirmation}>
          <FormInput
            id="confirmationCode"
            type="text"
            label="Verification Code"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            required
          />
          <SubmitButton isLoading={isLoading} text="Verify Email" loadingText="Verifying..." />
          
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors"
              onClick={() => {
                setError(null);
                setIsLoading(true);
                resendVerificationCode(email)
                  .then(() => alert('New verification code sent!'))
                  .catch((err: Error) => setError(err.message))
                  .finally(() => setIsLoading(false));
              }}
              disabled={isLoading}
            >
              Resend verification code
            </button>
          </div>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create Account">
      {error && <ErrorAlert message={error} />}
      <form onSubmit={handleSubmit}>
        <FormInput
          id="email"
          type="email"
          label="Georgia Tech Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          pattern=".*@gatech\.edu$"
          title="Must be a valid @gatech.edu email address"
          required
          hint="Only @gatech.edu addresses are allowed"
        />
        <FormInput
          id="fullName"
          type="text"
          label="Full Name (as on Canvas)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          hint='Use your name exactly as it appears in Canvas — e.g. "Jane Doe"'
        />
        <div className="mb-5">
          <label htmlFor="section" className="label">
            Section
          </label>
          <select
            id="section"
            className="input"
            value={section}
            onChange={(e) => setSection(e.target.value as '' | 'A' | 'B')}
            required
          >
            <option value="">Select your section…</option>
            <option value="A">Section A</option>
            <option value="B">Section B</option>
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            Check your Canvas enrollment if you're not sure.
          </p>
        </div>
        <FormInput
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          hint="At least 8 characters with uppercase, lowercase, and numbers"
        />
        <FormInput
          id="confirmPassword"
          type="password"
          label="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <SubmitButton isLoading={isLoading} text="Create Account" loadingText="Creating account..." />
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/signin" className="font-medium text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthCard>
  );
};

export const SignOutButton: React.FC = () => {
  const { signOut } = useAuth();
  return (
    <button onClick={signOut} className="btn-primary">
      Sign Out
    </button>
  );
};

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { forgotPassword, confirmForgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await forgotPassword(email);
      setShowConfirmation(true);
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Exceeded daily email limit")) {
        setError("Password reset limit reached for today. Please try again tomorrow.");
      } else if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait 15-30 minutes before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await confirmForgotPassword(email, confirmationCode, newPassword);
      alert('Password reset successfully!');
      navigate('/signin');
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait 15-30 minutes before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showConfirmation) {
    return (
      <AuthCard title="Reset Password">
        {error && <ErrorAlert message={error} />}
        <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            We've sent a reset code to <strong>{email}</strong>.
          </p>
        </div>
        <form onSubmit={handleConfirmation}>
          <FormInput
            id="confirmationCode"
            type="text"
            label="Reset Code"
            value={confirmationCode}
            onChange={(e) => setConfirmationCode(e.target.value)}
            required
          />
          <FormInput
            id="newPassword"
            type="password"
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            hint="At least 8 characters with uppercase, lowercase, and numbers"
          />
          <SubmitButton isLoading={isLoading} text="Reset Password" loadingText="Resetting..." />
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot Password">
      {error && <ErrorAlert message={error} />}
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Enter your email and we'll send you a code to reset your password.
      </p>
      <form onSubmit={handleSubmit}>
        <FormInput
          id="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <SubmitButton isLoading={isLoading} text="Send Reset Code" loadingText="Sending..." />
        
        <div className="mt-6 text-center">
          <Link 
            to="/signin" 
            className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors"
          >
            ← Back to Sign In
          </Link>
        </div>
      </form>
    </AuthCard>
  );
};

export const ResendVerificationForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { resendVerificationCode } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await resendVerificationCode(email);
      setSuccess('Verification code sent! Check your email.');
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Exceeded daily email limit")) {
        setError("Verification limit reached for today. Please try again tomorrow.");
      } else if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait 15-30 minutes before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthCard title="Resend Verification">
      {error && <ErrorAlert message={error} />}
      {success && <SuccessAlert message={success} />}
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Enter your email to receive a new verification code.
      </p>
      <form onSubmit={handleSubmit}>
        <FormInput
          id="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <SubmitButton isLoading={isLoading} text="Send Code" loadingText="Sending..." />
        
        <div className="mt-6 text-center">
          <Link 
            to="/signin" 
            className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors"
          >
            ← Back to Sign In
          </Link>
        </div>
      </form>
    </AuthCard>
  );
};

export const ChangePasswordForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { changePassword, authState } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authState.isAuthenticated && !authState.isLoading) {
      navigate('/signin');
    }
  }, [authState.isAuthenticated, authState.isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      const errorMessage = (err as Error).message;
      if (errorMessage.includes("Incorrect username or password") || errorMessage.includes("NotAuthorizedException")) {
        setError("Current password is incorrect");
      } else if (errorMessage.includes("Attempt limit exceeded")) {
        setError("Too many attempts. Please wait before trying again.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (authState.isLoading) {
    return <AuthCard title="Change Password"><p className="text-center text-gray-500">Loading...</p></AuthCard>;
  }

  return (
    <AuthCard title="Change Password">
      {error && <ErrorAlert message={error} />}
      {success && <SuccessAlert message={success} />}
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 text-center">
        Enter your current password and choose a new password.
      </p>
      <form onSubmit={handleSubmit}>
        <FormInput
          id="currentPassword"
          type="password"
          label="Current Password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <FormInput
          id="newPassword"
          type="password"
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          hint="At least 8 characters with uppercase, lowercase, and numbers"
          autoComplete="new-password"
        />
        <FormInput
          id="confirmNewPassword"
          type="password"
          label="Confirm New Password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <SubmitButton isLoading={isLoading} text="Change Password" loadingText="Changing..." />
        
        <div className="mt-6 text-center">
          <Link 
            to="/" 
            className="text-sm text-secondary-600 hover:text-secondary-700 dark:text-gt-gold dark:hover:text-gt-gold-light transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </form>
    </AuthCard>
  );
};
