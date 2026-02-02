// useGoogleAuth.js
import { useState, useEffect } from 'react';
import { auth } from './firebase';
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';

const db = getFirestore();

export const useGoogleAuth = () => {
  const [user, setUser] = useState({
    uid: '',
    email: '',
    name: '',
    major: '',
    communityCollege: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const loggedInUser = result.user;

      // Set local state
      setUser({
        uid: loggedInUser.uid,
        email: loggedInUser.email || '',
        name: loggedInUser.displayName || '',
        major: '',
        communityCollege: ''
      });

      // Firestore user document
      const userDocRef = doc(db, 'userInformation', loggedInUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        // Update name if doc exists
        await setDoc(
          userDocRef,
          { name: loggedInUser.displayName || '' },
          { merge: true }
        );
      } else {
        // Create new user document
        await setDoc(userDocRef, {
          uid: loggedInUser.uid,
          email: loggedInUser.email || '',
          name: loggedInUser.displayName || '',
          major: '',
          communityCollege: ''
        });
      }

      setIsAuthenticated(true);
      setShowSignUp(true);
      console.log('User signed in:', loggedInUser);

    } catch (error) {
      console.error('Google Sign-In Error:', error.message);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || '',
          major: '',
          communityCollege: ''
        });
        setIsAuthenticated(true);
        setShowSignUp(true);
      } else {
        setUser({
          uid: '',
          email: '',
          name: '',
          major: '',
          communityCollege: ''
        });
        setIsAuthenticated(false);
        setShowSignUp(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    isAuthenticated,
    showSignUp,
    handleGoogleSignIn,
    setUser,
    setShowSignUp
  };
};