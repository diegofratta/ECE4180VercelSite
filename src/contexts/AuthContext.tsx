import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GlobalSignOutCommand,
  GetUserCommand,
  AttributeType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
  ChangePasswordCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { User, AuthState } from '../types';
import { cognitoClient, USER_POOL_CLIENT_ID, API_ENDPOINT } from '../aws-config';

// Token expiration times in milliseconds
const TOKEN_EXPIRATION = 60 * 60 * 1000; // 1 hour in milliseconds
const REFRESH_THRESHOLD = 10 * 60 * 1000; // Refresh 10 minutes before expiration
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds (7 days)

interface AuthContextType {
  authState: AuthState;
  viewAsStudent: boolean;
  toggleViewAsStudent: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserAttributes: (fullName: string, section?: 'A' | 'B' | 'Staff') => Promise<void>;
  hideNameCollectionModal: () => void;
}

const initialAuthState: AuthState = {
  isAuthenticated: false,
  user: null,
  isLoading: true,
  error: null,
  showNameCollectionModal: false
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const [viewAsStudent, setViewAsStudent] = useState<boolean>(false);
  
  const toggleViewAsStudent = () => {
    setViewAsStudent(prev => !prev);
  };

  useEffect(() => {
    checkAuthState();
    
    // Set up token refresh interval
    const refreshInterval = setInterval(() => {
      refreshTokenIfNeeded();
    }, REFRESH_THRESHOLD);
    
    return () => clearInterval(refreshInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkAuthState = async () => {
    try {
      // Get the stored tokens
      const idToken = localStorage.getItem('idToken');
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const lastRefreshTime = localStorage.getItem('lastRefreshTime');
      const initialSignInTime = localStorage.getItem('initialSignInTime');
      
      // Check if session has exceeded the 1-week limit
      if (initialSignInTime) {
        const sessionDuration = Date.now() - parseInt(initialSignInTime);
        if (sessionDuration > WEEK_IN_MS) {
          console.log('Session exceeded 1-week limit, signing out');
          await signOut();
          return;
        }
      }
      
      // If we have a refresh token but no valid access token, try to refresh
      if (refreshToken && (!accessToken || !idToken)) {
        try {
          const success = await refreshTokens(refreshToken);
          if (success) {
            return; // checkAuthState will be called again after token refresh
          }
        } catch (refreshError) {
          console.error('Failed to refresh tokens on startup:', refreshError);
          // Continue to sign out
          await signOut();
          return;
        }
      }
      
      if (!idToken || !accessToken) {
        throw new Error('No tokens found');
      }
      
      // Check if tokens need to be refreshed
      if (refreshToken && lastRefreshTime) {
        const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshTime);
        
        // If it's been more than TOKEN_EXPIRATION - REFRESH_THRESHOLD since last refresh
        if (timeSinceLastRefresh > TOKEN_EXPIRATION - REFRESH_THRESHOLD) {
          // Try to refresh tokens
          try {
            await refreshTokens(refreshToken);
            return; // checkAuthState will be called again after token refresh
          } catch (refreshError) {
            console.error('Failed to refresh tokens:', refreshError);
            // Continue with existing tokens if they're still valid
          }
        }
      }
      
      // Verify the token by calling the GetUser API
      try {
        const command = new GetUserCommand({
          AccessToken: accessToken
        });
        
        const response = await cognitoClient.send(command);
        
        if (response.Username) {
          const userAttributes = parseUserAttributes(response.UserAttributes || []);
  
          setAuthState({
            isAuthenticated: true,
            user: userAttributes,
            isLoading: false,
            error: null,
            showNameCollectionModal: !userAttributes.fullName || !userAttributes.section
          });
          
          // If no lastRefreshTime is set, set it now
          if (!lastRefreshTime) {
            localStorage.setItem('lastRefreshTime', Date.now().toString());
          }
          
          // If no initialSignInTime is set, set it now
          if (!initialSignInTime) {
            localStorage.setItem('initialSignInTime', Date.now().toString());
          }
        } else {
          throw new Error('Invalid user data');
        }
      } catch (error) {
        // If the access token is invalid but we have a refresh token, try to refresh
        if (refreshToken) {
          try {
            const success = await refreshTokens(refreshToken);
            if (success) return;
          } catch (refreshError) {
            console.error('Failed to refresh tokens after GetUser error:', refreshError);
          }
        }
        
        // If we get here, we couldn't refresh the tokens, so sign out
        await signOut();
      }
    } catch (error) {
      // Clear tokens if they're invalid
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('lastRefreshTime');
      localStorage.removeItem('initialSignInTime');
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        showNameCollectionModal: false
      });
    }
  };
  
  const refreshTokenIfNeeded = async () => {
    if (!authState.isAuthenticated) return;
    
    const lastRefreshTime = localStorage.getItem('lastRefreshTime');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!lastRefreshTime || !refreshToken) return;
    
    const timeSinceLastRefresh = Date.now() - parseInt(lastRefreshTime);
    
    // If it's been more than TOKEN_EXPIRATION - REFRESH_THRESHOLD since last refresh
    if (timeSinceLastRefresh > TOKEN_EXPIRATION - REFRESH_THRESHOLD) {
      try {
        await refreshTokens(refreshToken);
      } catch (error) {
        console.error('Failed to refresh tokens:', error);
        
        // If refresh fails and tokens are likely expired, sign out
        if (timeSinceLastRefresh > TOKEN_EXPIRATION) {
          signOut();
        }
      }
    }
  };
  
  const refreshTokens = async (refreshToken: string) => {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken
        }
      });
      
      const response = await cognitoClient.send(command);
      
      if (response.AuthenticationResult) {
        // Store new tokens
        localStorage.setItem('idToken', response.AuthenticationResult.IdToken || '');
        localStorage.setItem('accessToken', response.AuthenticationResult.AccessToken || '');
        localStorage.setItem('lastRefreshTime', Date.now().toString());
        
        // Get user attributes with new access token
        const getUserCommand = new GetUserCommand({
          AccessToken: response.AuthenticationResult.AccessToken
        });
        
        const userResponse = await cognitoClient.send(getUserCommand);
        const userAttributes = parseUserAttributes(userResponse.UserAttributes || []);
        
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          user: userAttributes,
          isLoading: false,
          error: null
        }));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      throw error;
    }
  };

  const parseUserAttributes = (attributes: AttributeType[]): User => {
    const role = attributes.find(attr => attr.Name === 'custom:role')?.Value || 'student';
    const studentId = attributes.find(attr => attr.Name === 'custom:studentId')?.Value;
    const fullName = attributes.find(attr => attr.Name === 'custom:fullName')?.Value;
    const section = attributes.find(attr => attr.Name === 'custom:section')?.Value as 'A' | 'B' | 'Staff' | undefined;
    const username = attributes.find(attr => attr.Name === 'preferred_username')?.Value ||
                    attributes.find(attr => attr.Name === 'email')?.Value || '';

    return {
      username,
      role: role as 'student' | 'staff',
      studentId,
      fullName,
      section
    };
  };

  const signIn = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: USER_POOL_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });
      
      const response = await cognitoClient.send(command);
      
      if (response.AuthenticationResult) {
        // Store tokens
        localStorage.setItem('idToken', response.AuthenticationResult.IdToken || '');
        localStorage.setItem('accessToken', response.AuthenticationResult.AccessToken || '');
        localStorage.setItem('refreshToken', response.AuthenticationResult.RefreshToken || '');
        localStorage.setItem('lastRefreshTime', Date.now().toString());
        localStorage.setItem('initialSignInTime', Date.now().toString());
        
        // Get user attributes
        const getUserCommand = new GetUserCommand({
          AccessToken: response.AuthenticationResult.AccessToken
        });
        
        const userResponse = await cognitoClient.send(getUserCommand);
        const userAttributes = parseUserAttributes(userResponse.UserAttributes || []);

        setAuthState({
          isAuthenticated: true,
          user: userAttributes,
          isLoading: false,
          error: null,
          showNameCollectionModal: !userAttributes.fullName || !userAttributes.section
        });
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const accessToken = localStorage.getItem('accessToken');
      
      if (accessToken) {
        // Call global sign out
        const command = new GlobalSignOutCommand({
          AccessToken: accessToken
        });
        
        await cognitoClient.send(command);
      }
      
      // Clear tokens
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('lastRefreshTime');
      localStorage.removeItem('initialSignInTime');
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: null,
        showNameCollectionModal: false
      });
    } catch (error) {
      // Even if the API call fails, clear tokens and state
      localStorage.removeItem('idToken');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('lastRefreshTime');
      localStorage.removeItem('initialSignInTime');
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: (error as Error).message,
        showNameCollectionModal: false
      });
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Validate email domain
      if (!email.endsWith('@gatech.edu')) {
        throw new Error('Only @gatech.edu email addresses are allowed');
      }
      
      // Note: custom:role is NOT set here - it's securely assigned by the
      // Post-Confirmation Lambda trigger based on server-side email whitelist
      const userAttributes: AttributeType[] = [
        { Name: 'email', Value: email },
      ];
      
      const command = new SignUpCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: userAttributes
      });
      
      await cognitoClient.send(command);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const confirmSignUp = async (email: string, code: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const command = new ConfirmSignUpCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email,
        ConfirmationCode: code
      });
      
      await cognitoClient.send(command);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const command = new ForgotPasswordCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email
      });
      
      await cognitoClient.send(command);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const confirmForgotPassword = async (email: string, code: string, newPassword: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const command = new ConfirmForgotPasswordCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword
      });
      
      await cognitoClient.send(command);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const resendVerificationCode = async (email: string) => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const command = new ResendConfirmationCodeCommand({
        ClientId: USER_POOL_CLIENT_ID,
        Username: email
      });
      
      await cognitoClient.send(command);
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        throw new Error('No access token found. Please sign in again.');
      }
      
      const command = new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: currentPassword,
        ProposedPassword: newPassword
      });
      
      await cognitoClient.send(command);
    } catch (error) {
      throw error;
    }
  };

  const updateUserAttributes = async (fullName: string, section?: 'A' | 'B' | 'Staff') => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const idToken = localStorage.getItem('idToken');
      const accessToken = localStorage.getItem('accessToken');
      if (!idToken || !accessToken) {
        throw new Error('No authentication tokens found');
      }

      const response = await fetch(`${API_ENDPOINT.replace(/\/$/, '')}/auth/update-attributes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
          'X-Access-Token': accessToken
        },
        body: JSON.stringify({ fullName, section })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user attributes');
      }

      // Update the user in the auth state and hide the modal
      setAuthState(prev => ({
        ...prev,
        user: prev.user ? { ...prev.user, fullName, section } : null,
        isLoading: false,
        showNameCollectionModal: false
      }));
    } catch (error) {
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: (error as Error).message
      }));
      throw error;
    }
  };

  const hideNameCollectionModal = () => {
    setAuthState(prev => ({
      ...prev,
      showNameCollectionModal: false
    }));
  };

  const value = {
    authState,
    viewAsStudent,
    toggleViewAsStudent,
    signIn,
    signOut,
    signUp,
    confirmSignUp,
    forgotPassword,
    confirmForgotPassword,
    resendVerificationCode,
    changePassword,
    updateUserAttributes,
    hideNameCollectionModal
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
