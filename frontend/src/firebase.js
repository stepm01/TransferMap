// ============================================================
// 🔥 FIREBASE CONFIGURATION
// ============================================================
// To change to a different Firebase account:
// 1. Go to https://console.firebase.google.com
// 2. Select your project (or create a new one)
// 3. Click ⚙️ Project Settings > General
// 4. Scroll down to "Your apps" section
// 5. If no web app exists, click "Add app" > Web icon (</>)
// 6. Copy the firebaseConfig object and paste it below
// ============================================================

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ⬇️ REPLACE THIS WITH YOUR FIREBASE CONFIG ⬇️
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD3eO5vTEE9i_VkWEoX2wudi3_I4n0p_co",
  authDomain: "transfermap-db343.firebaseapp.com",
  projectId: "transfermap-db343",
  storageBucket: "transfermap-db343.firebasestorage.app",
  messagingSenderId: "592672080502",
  appId: "1:592672080502:web:8791ff999d00c6dba35557",
  measurementId: "G-RXVQQY4FC8"
};
// Example (replace with your own):
// const firebaseConfig = {
//   apiKey: "AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
//   authDomain: "transfermap-12345.firebaseapp.com",
//   projectId: "transfermap-12345",
//   storageBucket: "transfermap-12345.appspot.com",
//   messagingSenderId: "123456789012",
//   appId: "1:123456789012:web:abcdef1234567890abcdef"
// };

// ============================================================
// 🔐 FIREBASE SETUP CHECKLIST
// ============================================================
// After changing the config, make sure you:
//
// 1. ENABLE AUTHENTICATION:
//    - Firebase Console > Authentication > Sign-in method
//    - Enable "Google" provider
//    - Add your domain to "Authorized domains"
//
// 2. CREATE FIRESTORE DATABASE:
//    - Firebase Console > Firestore Database
//    - Click "Create database"
//    - Start in "test mode" for development
//
// 3. SET FIRESTORE RULES (for production):
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /userInformation/{userId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }
// ============================================================

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Configure Google Auth
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;