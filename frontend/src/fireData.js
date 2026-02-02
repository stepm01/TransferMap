// fireData.js
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

const db = getFirestore();

/**
 * Updates intended major and/or community college for the logged-in user.
 * This is safe to call on every selection change.
 */
export const updateUserProfile = async (uid, { major, communityCollege }) => {
  if (!uid) {
    console.error('[fireData] Missing uid');
    return;
  }

  const updates = {};
  if (major !== undefined) updates.major = major;
  if (communityCollege !== undefined) updates.communityCollege = communityCollege;

  if (Object.keys(updates).length === 0) return;

  try {
    const ref = doc(db, 'userInformation', uid);
    await setDoc(ref, updates, { merge: true });
    console.log('[fireData] Profile updated:', updates);
  } catch (err) {
    console.error('[fireData] Update failed:', err);
  }
};

export const fetchUserProfile = async (uid) => {
  if (!uid) return null;

  try {
    const ref = doc(db, 'userInformation', uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.error('[fireData] Fetch failed:', err);
  }

  return null;
};

export const addCourseToTranscript = async (uid, course) => {
  if (!uid || !course) {
    console.error('[fireData] Missing uid or course');
    return;
  }

  try {
    const ref = doc(db, 'userInformation', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Create document with transcript array containing the course
      await setDoc(ref, { transcript: [course] }, { merge: true });
    } else {
      const data = snap.data();
      const transcript = Array.isArray(data.transcript) ? data.transcript : [];
      // Check if course with same id already exists, if not add
      if (!transcript.some(c => c.id === course.id)) {
        await updateDoc(ref, {
          transcript: arrayUnion(course)
        });
      }
    }
    console.log('[fireData] Course added to transcript:', course);
  } catch (err) {
    console.error('[fireData] Add course failed:', err);
  }
};

export const removeCourseFromTranscript = async (uid, courseId) => {
  if (!uid || !courseId) {
    console.error('[fireData] Missing uid or courseId');
    return;
  }

  try {
    const ref = doc(db, 'userInformation', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const transcript = Array.isArray(data.transcript) ? data.transcript : [];
    const courseToRemove = transcript.find(c => c.id === courseId);
    if (courseToRemove) {
      await updateDoc(ref, {
        transcript: arrayRemove(courseToRemove)
      });
      console.log('[fireData] Course removed from transcript:', courseId);
    }
  } catch (err) {
    console.error('[fireData] Remove course failed:', err);
  }
};