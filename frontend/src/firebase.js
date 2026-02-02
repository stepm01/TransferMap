// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


const firebaseConfig = {
  apiKey: "AIzaSyCNk-Hghr6fk9Kmr550eD8eLjzJE1-ONjw",
  authDomain: "cruzhacks-223f4.firebaseapp.com",
  projectId: "cruzhacks-223f4",
  storageBucket: "cruzhacks-223f4.firebasestorage.app",
  messagingSenderId: "823546989521",
  appId: "1:823546989521:web:6f29f1abfc49ac52cd2ef0",
  measurementId: "G-5VNQZW1JQC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const signInWithGoogle = () => {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log('User signed in: ', user);
    })
    .catch((error) => {
      console.error('Error during sign in: ', error);
    });
}
