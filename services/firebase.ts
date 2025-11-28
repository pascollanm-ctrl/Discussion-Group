import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

// Config from the provided source code
const firebaseConfig = {
    apiKey: "AIzaSyChZG0b4IiGy4DMkBnuvivTW_Q48fJ8uEg",
    authDomain: "discussion-group-2e4e3.firebaseapp.com",
    projectId: "discussion-group-2e4e3",
    storageBucket: "discussion-group-2e4e3.firebasestorage.app",
    messagingSenderId: "992748744659",
    appId: "1:992748744659:web:3538b81190f5fb01f18926",
    measurementId: "G-2H8JVFSNCT"
};

// Initialize Firebase (Compat)
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

export const auth = app.auth();
export const db = app.firestore();

// Export User type for use in other components
export type User = firebase.User;

// Export helper for serverTimestamp to avoid importing firebase everywhere
export const serverTimestamp = firebase.firestore.FieldValue.serverTimestamp;

export const APP_ID = 'discussion-group-2e4e3'; // Used in collection paths
export const ADMIN_EMAIL = "pascollanm@gmail.com";

export const COLLECTIONS = {
    discussions: `/artifacts/${APP_ID}/public/data/discussions`,
    announcements: `/artifacts/${APP_ID}/public/data/announcements`,
    resources: `/artifacts/${APP_ID}/public/data/unit_resources`
};