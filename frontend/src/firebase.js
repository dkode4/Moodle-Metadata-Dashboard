// initialises the firebase app instance used throughout the frontend
// auth, firestore, storage and functions services are each imported from this app instance
// in the files that need them rather than being initialised here
import { initializeApp } from "firebase/app";

// firebase project configuration - these values identify the firebase project
// and are safe to include in client-side code as access is controlled by firebase security rules
const firebaseConfig = {
  apiKey: "AIzaSyAv7nqJUyw6Wy2kbpkfjKegEMukSEWUeik",
  authDomain: "moodle-metadata.firebaseapp.com",
  projectId: "moodle-metadata",
  storageBucket: "moodle-metadata.firebasestorage.app",
  messagingSenderId: "214681505354",
  appId: "1:214681505354:web:6365ff26a27551833460b3",
  measurementId: "G-1776W4378T"
};

const app = initializeApp(firebaseConfig);

export { app };