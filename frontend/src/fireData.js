import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const db = getFirestore();

// Add a course to user's transcript
export const addCourseToTranscript = async (uid, course) => {
  if (!uid || !course) return;
  
  try {
    const userRef = doc(db, "userInformation", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentTranscript = userSnap.data().transcript || [];
      await setDoc(userRef, {
        transcript: [...currentTranscript, course]
      }, { merge: true });
    } else {
      // Create new document if doesn't exist
      await setDoc(userRef, {
        transcript: [course]
      }, { merge: true });
    }
    
    console.log("✅ Course added to Firebase:", course.courseCode);
  } catch (error) {
    console.error("❌ Error adding course to Firebase:", error);
    throw error;
  }
};

// Remove a course from user's transcript
export const removeCourseFromTranscript = async (uid, courseId) => {
  if (!uid || !courseId) return;
  
  try {
    const userRef = doc(db, "userInformation", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentTranscript = userSnap.data().transcript || [];
      const updatedTranscript = currentTranscript.filter(c => c.id !== courseId);
      
      await setDoc(userRef, {
        transcript: updatedTranscript
      }, { merge: true });
      
      console.log("✅ Course removed from Firebase:", courseId);
    }
  } catch (error) {
    console.error("❌ Error removing course from Firebase:", error);
    throw error;
  }
};

// Save entire transcript (used for bulk operations)
export const saveTranscript = async (uid, courses) => {
  if (!uid) return;
  
  try {
    const userRef = doc(db, "userInformation", uid);
    await setDoc(userRef, {
      transcript: courses
    }, { merge: true });
    
    console.log("✅ Transcript saved to Firebase:", courses.length, "courses");
  } catch (error) {
    console.error("❌ Error saving transcript to Firebase:", error);
    throw error;
  }
};

// Get user's transcript
export const getTranscript = async (uid) => {
  if (!uid) return [];
  
  try {
    const userRef = doc(db, "userInformation", uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data().transcript || [];
    }
    return [];
  } catch (error) {
    console.error("❌ Error getting transcript from Firebase:", error);
    return [];
  }
};

// Save verification results (optional - for history)
export const saveVerificationResults = async (uid, results) => {
  if (!uid || !results) return;
  
  try {
    const userRef = doc(db, "userInformation", uid);
    await setDoc(userRef, {
      lastVerification: results,
      lastVerificationDate: new Date().toISOString()
    }, { merge: true });
    
    console.log("✅ Verification results saved to Firebase");
  } catch (error) {
    console.error("❌ Error saving verification results:", error);
    throw error;
  }
};

export default {
  addCourseToTranscript,
  removeCourseFromTranscript,
  saveTranscript,
  getTranscript,
  saveVerificationResults
};