// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBHs5NvvXRwoY7wUAeZ3t6As7rBzQmp2aE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "connection-crm.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "connection-crm",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "connection-crm.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "561033372566",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:561033372566:web:6f09526269fa9eba4533b7",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-PD4VHETK9M",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

export { analytics };
