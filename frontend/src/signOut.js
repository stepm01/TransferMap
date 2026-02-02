import React from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useGoogleAuth } from './useGoogleAuth';

export default function SignOutButton() {
  const { setUser, setIsAuthenticated, setShowSignUp } = useGoogleAuth();
  const auth = getAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Reset local auth state
      setUser({});
      setIsAuthenticated(false);
      setShowSignUp(false);
      // Optional: redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <button onClick={handleSignOut} className="btn-secondary">
      Sign Out
    </button>
  );
}
