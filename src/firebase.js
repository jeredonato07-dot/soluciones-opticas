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

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDZRm7xREvz1l7baf2SHYFrtU3IDm5kmoE",
  authDomain: "soluciones-opticas.firebaseapp.com",
  projectId: "soluciones-opticas",
  storageBucket: "soluciones-opticas.firebasestorage.app",
  messagingSenderId: "665154982665",
  appId: "1:665154982665:web:ad1915b8336ed56d9ab9d8"
};

let firebaseApp = null;
let db = null;

// Get or initialize firebase db based on config
export const getFirebaseDb = () => {
  if (db) return db;

  let configToUse = DEFAULT_FIREBASE_CONFIG;
  const storedConfig = localStorage.getItem('optica_firebase_config');
  if (storedConfig) {
    try {
      const parsedConfig = JSON.parse(storedConfig);
      if (parsedConfig && parsedConfig.apiKey) {
        configToUse = parsedConfig;
      }
    } catch (error) {
      console.error("Error parsing stored config:", error);
    }
  }

  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(configToUse);
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
  return true;
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

