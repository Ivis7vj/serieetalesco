import { useState, useEffect, useRef } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import MobileIndicator from './MobileIndicator';
import '../pages/Home.css'; // Leveraging existing styles or add new ones

const Notify = () => {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // Fetch Notifications
    useEffect(() => {
        if (!currentUser) return;

        const userRef = doc(db, 'users', currentUser.uid);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Assuming notifications are stored in a 'notifications' array field
                // Structure: { id: string, message: string, read: boolean, timestamp: string, type: string }
                // or just strings. Let's assume objects for future proofing, but handle simple strings if needed.
                const notifs = data.notifications || [];
                // Sort by timestamp if available, else reverse order (newest first assuming push)
                setNotifications(notifs.reverse());
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    // Auto-Clear Notifications on Close (Optimized)
    const prevShowDropdown = useRef(false);
    useEffect(() => {
        if (currentUser && prevShowDropdown.current && !showDropdown && notifications.length > 0) {
            // Close Transition: User saw notifications, now clearing.
            const userRef = doc(db, 'users', currentUser.uid);
            updateDoc(userRef, { notifications: [] }).catch(e => console.error("Error clearing notifications", e));
        }
        prevShowDropdown.current = showDropdown;
    }, [showDropdown, notifications, currentUser]);

    const handleDismiss = async (notification) => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                notifications: arrayRemove(notification)
            });
        } catch (error) {
            console.error("Error removing notification:", error);
        }
    };

    const unreadCount = notifications.length; // Or filter by !read if we implement read status

    return (
        <div className="notify-container" ref={dropdownRef} style={{ position: 'relative', marginRight: '20px' }}>
            <div
                className="notify-icon"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                    cursor: 'pointer',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <IoNotificationsOutline size={28} color="var(--text-primary)" />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: 'red',
                        color: 'white',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 'bold'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                <MobileIndicator
                    id="notif-bell-tip"
                    message="Series updates here 🔔"
                    position="bottom"
                    style={{
                        right: 0,
                        left: 'auto',
                        transform: 'none',
                        whiteSpace: 'nowrap'
                    }}
                />
            </div>

            {showDropdown && (
                <div className="notify-dropdown" style={{
                    position: 'fixed', // Fixed for full width capability
                    top: '70px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '95vw', // Full Mobile Width
                    maxWidth: '400px',
                    background: 'rgba(0,0,0,0.95)', // Semi-transparent Black
                    border: '1px solid #333',
                    borderRadius: '8px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
                    zIndex: 2000,
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    padding: '0'
                }}>
                    <h3 style={{
                        margin: '0',
                        fontSize: '1rem',
                        borderBottom: '1px solid #333',
                        padding: '15px',
                        color: '#fff',
                        fontWeight: '900',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Notifications
                    </h3>

                    {notifications.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#666', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            NO NEW NOTIFICATIONS
                        </div>
                    ) : (
                        notifications.map((notif, index) => (
                            <div key={index} style={{
                                padding: '15px',
                                borderBottom: '1px solid #222',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                color: '#fff', // White text
                                fontSize: '0.95rem',
                                fontWeight: 'bold', // Bold text
                                background: '#000'
                            }}>
                                <div style={{ flex: 1, lineHeight: '1.4' }}>
                                    {typeof notif === 'string' ? notif : notif.message}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDismiss(notif); }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#444',
                                        cursor: 'pointer',
                                        fontSize: '1.5rem',
                                        padding: '0 5px',
                                        display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    &times;
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default Notify;
