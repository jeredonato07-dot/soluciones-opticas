import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch,
  runTransaction
} from 'firebase/firestore';

let firebaseApp = null;
let db = null;

// Get or initialize firebase db based on config
export const getFirebaseDb = () => {
  if (db) return db;

  const storedConfig = localStorage.getItem('optica_firebase_config');
  if (!storedConfig) return null;

  try {
    const parsedConfig = JSON.parse(storedConfig);
    if (!parsedConfig || !parsedConfig.apiKey) return null;

    if (getApps().length === 0) {
      firebaseApp = initializeApp(parsedConfig);
    } else {
      firebaseApp = getApp();
    }
    db = getFirestore(firebaseApp);
    return db;
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    return null;
  }
};

// Check if firebase config is present and valid
export const isFirebaseConfigured = () => {
  const config = localStorage.getItem('optica_firebase_config');
  if (!config) return false;
  try {
    const parsed = JSON.parse(config);
    return !!(parsed && parsed.apiKey);
  } catch (e) {
    return false;
  }
};

// Clear firebase instance (useful when changing credentials)
export const resetFirebase = () => {
  firebaseApp = null;
  db = null;
};

export { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch,
  runTransaction
};

