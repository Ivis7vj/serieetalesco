import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase-config";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from "firebase/auth";
import { doc, setDoc, getDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userData, setUserData] = useState(null); // Firestore profile data
    const [loading, setLoading] = useState(true);

    async function checkUsernameAvailability(username) {
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    }

    async function signup(email, password, additionalData) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user document in Firestore with optimized storage
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            email: user.email,
            username: additionalData.username, // Save username
            createdAt: new Date(),
            dob: additionalData.dob || null, // Storing DOB as requested
            bio: "Movie enthusiast.",
            avatarUrl: "",
            // Optimized Arrays for storage efficiency
            watchlist: [], // Array of { tmdbId, type, addedAt }
            favorites: [], // Array of tmdbIds
            likes: [],     // Array of tmdbIds
            watched: []    // Array of tmdbIds
        });

        return user;
    }

    async function login(username, password) {
        // Assume input is username, try to find email
        let emailToUse = username;

        // If it doesn't look like an email, lookup the username
        if (!username.includes('@')) {
            const q = query(collection(db, "users"), where("username", "==", username));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                emailToUse = userData.email;
            } else {
                throw new Error("Username not found");
            }
        }

        return signInWithEmailAndPassword(auth, emailToUse, password);
    }

    function logout() {
        return signOut(auth);
    }

    async function verifyAndResetPassword(username, dob) {
        const q = query(collection(db, "users"), where("username", "==", username));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Username not found");
        }

        const userData = querySnapshot.docs[0].data();
        if (userData.dob !== dob) {
            throw new Error("Date of Birth does not match records");
        }

        // Send reset email
        await sendPasswordResetEmail(auth, userData.email);
        return true;
    }

    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        // 1. Auth State Listener
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (!user) {
                setUserData(null);
                setLoading(false);
            }
            // If user exists, loading calculation is deferred to data listener
        });

        return () => unsubscribeAuth();
    }, []);

    // 2. User Data Listener (Real-time)
    useEffect(() => {
        let unsubscribeData = () => { };

        if (currentUser) {
            const docRef = doc(db, "users", currentUser.uid);
            unsubscribeData = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                }
                setLoading(false); // Data ready
            }, (error) => {
                console.error("Error fetching user data:", error);
                setLoading(false);
            });
        }

        return () => unsubscribeData();
    }, [currentUser]);

    if (!auth) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#111',
                color: '#fff',
                padding: '2rem',
                textAlign: 'center'
            }}>
                <h1 style={{ color: '#ff4444', marginBottom: '1rem' }}>Configuration Error</h1>
                <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
                    The application cannot connect to Firebase.
                </p>
                <div style={{
                    backgroundColor: '#222',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    maxWidth: '600px',
                    textAlign: 'left'
                }}>
                    <strong style={{ display: 'block', marginBottom: '1rem', color: '#FFCC00' }}>Likely Cause: Missing Environment Variables</strong>
                    <p style={{ marginBottom: '0.5rem' }}>If you are viewing this on Vercel:</p>
                    <ol style={{ marginLeft: '1.5rem', lineHeight: '1.6' }}>
                        <li>Go to your Vercel Project Dashboard.</li>
                        <li>Navigate to <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
                        <li>Add the required keys (VITE_API_KEY, etc.) from your local <code>.env</code> file.</li>
                        <li>Go to <strong>Deployments</strong> and <strong>Redeploy</strong>.</li>
                    </ol>
                </div>
            </div>
        );
    }

    const value = {
        currentUser,
        userData,
        signup,
        login,
        logout,
        checkUsernameAvailability,
        verifyAndResetPassword
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
