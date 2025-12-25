// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID
};

if (!firebaseConfig.apiKey) {
    console.error("Firebase API Key is missing! Check your .env file.");
}

import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getRemoteConfig } from "firebase/remote-config"; // Import Remote Config

// Initialize Firebase
let app, auth, db, remoteConfig;
try {
    if (!firebaseConfig.apiKey) throw new Error("Missing API Key");
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    remoteConfig = getRemoteConfig(app); // Initialize Remote Config

    // Set persistence to local (survives app restart/close)
    setPersistence(auth, browserLocalPersistence).catch(err => {
        console.error("Firebase Persistence Error:", err);
    });

    // Default configs to prevent errors before fetch
    remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour default (dev: set lower)
    remoteConfig.defaultConfig = {
        "latest_version": "1.0.0",
        "changelog": JSON.stringify(["Welcome to SERIEE"])
    };

} catch (error) {
    console.error("Firebase Initialization Error:", error);
    // Continue with nulls to allow App to mount and show ErrorBoundary
    app = null;
    auth = null;
    db = null;
    remoteConfig = null;
}

export { auth, db, remoteConfig };
