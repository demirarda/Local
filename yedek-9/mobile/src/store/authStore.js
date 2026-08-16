import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  register as apiRegister,
  login as apiLogin,
  getCurrentUser,
  verifyEmail as apiVerifyEmail,
  verifyEmailCode as apiVerifyEmailCode,
  resendVerification as apiResendVerification,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  setAuthToken,
} from '../services/api';

const TOKEN_KEY = '@local_auth_token';
const USER_KEY = '@local_user_data';

const useAuthStore = create((set, get) => ({
  // State
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
  pendingVenueApply: null,

  setPendingVenueApply: (payload) => set({ pendingVenueApply: payload }),
  clearPendingVenueApply: () => set({ pendingVenueApply: null }),

  // Initialize - Check for stored token on app start
  initialize: async () => {
    try {
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);

      if (token && userData) {
        const user = JSON.parse(userData);
        // Verify token is still valid by fetching current user
        try {
          const currentUser = await getCurrentUser(token);

          // Set in-memory auth token for subsequent API calls
          setAuthToken(token);

          const pendingIdentityKyc =
            currentUser.identity_track === 'identity' &&
            !currentUser.identity_verified &&
            !currentUser.email_verified;

          set({
            token,
            user: currentUser,
            // Keep Track B pre-KYC on auth stack so OnboardingIdentityKyc can finish
            isAuthenticated: !pendingIdentityKyc,
            isLoading: false
          });
        } catch (error) {
          // Token invalid, clear storage
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      } else {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false
        });

        // Clear in-memory token as well
        setAuthToken(null);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: false
      });

      setAuthToken(null);
    }
  },

  // Register
  register: async (email, password, name, city, university) => {
    try {
      const result = await apiRegister(email, password, name, city, university);
      
      if (result.success) {
        // Registration successful, but user needs to verify email
        return {
          success: true,
          data: result.data,
          requiresVerification: true
        };
      }
      
      return result;
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  },

  // Login
  // rememberMe: if false, don't persist token to AsyncStorage (session-only)
  login: async (email, password, rememberMe = true) => {
    try {
      const result = await apiLogin(email, password);
      
      if (result.success) {
        const { token, user } = result.data;
        
        // Store token and user data (only persist if rememberMe)
        if (rememberMe) {
          await AsyncStorage.multiSet([
            [TOKEN_KEY, token],
            [USER_KEY, JSON.stringify(user)]
          ]);
        }
        
        // Set in-memory auth token for subsequent API calls
        setAuthToken(token);

        const pendingIdentityKyc =
          Boolean(result.data?.requires_identity_kyc) ||
          (user?.identity_track === 'identity' &&
            !user?.identity_verified &&
            !user?.email_verified);

        set({
          token,
          user,
          // Track B pre-KYC stays on auth stack — Main requires gate
          isAuthenticated: !pendingIdentityKyc,
        });
        
        return { success: true, data: result.data };
      }
      
      return result;
    } catch (error) {
      console.warn('Login error (non-fatal):', error?.message || error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  },

  // Logout
  logout: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setAuthToken(null);
    set({
      token: null,
      user: null,
      isAuthenticated: false
    });
  },

  // Update user data
  updateUser: async (updates) => {
    const currentUser = get().user;
    if (!currentUser) return;

    const updatedUser = { ...currentUser, ...updates };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
    
    set({ user: updatedUser });
  },

  /** Track B: store provisional JWT without flipping to Main stack */
  setProvisionalSession: async (token, user) => {
    setAuthToken(token);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]);
    set({
      token,
      user,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  /** After Track B KYC + onboarding: enter Main — server gate only, no client spoof */
  enterAuthenticatedSession: async (userOverrides = {}) => {
    const token = get().token;
    if (!token) {
      throw new Error('Oturum bulunamadi');
    }
    setAuthToken(token);
    const serverUser = await getCurrentUser(token);
    const gateOk = Boolean(serverUser?.email_verified || serverUser?.identity_verified);
    if (!gateOk) {
      throw new Error('Kimlik dogrulamasi tamamlanmadi');
    }
    const user = {
      ...serverUser,
      ...userOverrides,
      // Never allow client to invent verification flags over server truth
      email_verified: Boolean(serverUser.email_verified),
      identity_verified: Boolean(serverUser.identity_verified),
      age_ok: serverUser.age_ok !== false,
      verified: true,
      requires_identity_kyc: false,
    };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
    return user;
  },

  // Verify email with link token
  verifyEmail: async (token) => {
    try {
      const result = await apiVerifyEmail(token);
      
      if (result.success) {
        const currentUser = get().user;
        if (currentUser) {
          await get().updateUser({ email_verified: true });
        }
      }
      
      return result;
    } catch (error) {
      console.error('Verify email error:', error);
      return {
        success: false,
        error: error.message || 'Email verification failed'
      };
    }
  },

  // Verify email with 6-digit OTP code
  verifyEmailCode: async (email, code) => {
    try {
      const result = await apiVerifyEmailCode(email, code);
      if (result.success) {
        const currentUser = get().user;
        if (currentUser) {
          await get().updateUser({ email_verified: true });
        }
      }
      return result;
    } catch (error) {
      console.error('Verify email code error:', error);
      return {
        success: false,
        error: error.message || 'Email verification failed',
      };
    }
  },

  // Resend verification
  resendVerification: async (email) => {
    try {
      return await apiResendVerification(email);
    } catch (error) {
      console.error('Resend verification error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend verification email'
      };
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    try {
      return await apiForgotPassword(email);
    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to send password reset email'
      };
    }
  },

  // Reset password
  resetPassword: async (token, password) => {
    try {
      return await apiResetPassword(token, password);
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: error.message || 'Password reset failed'
      };
    }
  },

  // Refresh current user data
  refreshUser: async () => {
    const token = get().token;
    if (!token) return;

    try {
      const user = await getCurrentUser(token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      const pendingIdentityKyc =
        user.identity_track === 'identity' &&
        !user.identity_verified &&
        !user.email_verified;
      // Never auto-promote to Main here — enterAuthenticatedSession / login does that.
      // Only demote when Track B KYC is still pending.
      set({
        user,
        ...(pendingIdentityKyc ? { isAuthenticated: false } : {}),
      });
    } catch (error) {
      console.error('Refresh user error:', error);
      // If token invalid, logout
      if (error.message.includes('401') || error.message.includes('403')) {
        await get().logout();
      }
    }
  }
}));

export default useAuthStore;
