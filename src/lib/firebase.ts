import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  try {
    // Using signInWithPopup - ensure popups are allowed
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Auth Error:", error.code, error.message);
    throw error;
  }
};

export interface UserMemory {
  facts: string[];
  summary: string;
  updatedAt: any;
}

export const getUserMemory = async (userId: string): Promise<UserMemory | null> => {
  const docRef = doc(db, 'users', userId, 'memory', 'profile');
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserMemory;
  }
  return null;
};

export const saveFact = async (userId: string, fact: string) => {
  const docRef = doc(db, 'users', userId, 'memory', 'profile');
  await setDoc(docRef, {
    facts: arrayUnion(fact),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const updateSummary = async (userId: string, summary: string) => {
  const docRef = doc(db, 'users', userId, 'memory', 'profile');
  await setDoc(docRef, {
    summary,
    updatedAt: serverTimestamp()
  }, { merge: true });
};
