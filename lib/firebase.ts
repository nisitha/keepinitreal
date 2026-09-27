import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAmm0JLX7uATj-Xtw6tHK0Gs8LLljk21XM",
  authDomain: "keepinitreal-ee191.firebaseapp.com",
  projectId: "keepinitreal-ee191",
  storageBucket: "keepinitreal-ee191.firebasestorage.app",
  messagingSenderId: "322946442988",
  appId: "1:322946442988:web:e4534233e401a6b941e7c9"
};

// Initialize Firebase only if it hasn't been initialized already (important for Next.js hot reloading)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
