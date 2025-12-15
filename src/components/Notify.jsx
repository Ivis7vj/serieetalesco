import { useState, useEffect, useRef } from 'react';
import { IoNotificationsOutline } from 'react-icons/io5';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
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
            </div>

            {showDropdown && (
                <div className="notify-dropdown" style={{
                    position: 'absolute',
                    top: '140%', // pushed down a bit more
                    left: '0', // Align left edge
                    transform: 'none',
                    width: '280px', // slightly clearer width
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    zIndex: 1000,
                    maxHeight: '400px',
                    overflowY: 'auto',
                    padding: '10px'
                }}>
                    <h3 style={{
                        margin: '0 0 10px 0',
                        fontSize: '1rem',
                        borderBottom: '1px solid #333',
                        paddingBottom: '5px',
                        color: 'var(--text-primary)'
                    }}>
                        Notifications
                    </h3>

                    {notifications.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                            No new notifications
                        </div>
                    ) : (
                        notifications.map((notif, index) => (
                            <div key={index} style={{
                                padding: '10px',
                                borderBottom: '1px solid #333',
                                display: 'flex',
                                alignItems: 'start',
                                gap: '10px',
                                color: '#eee',
                                fontSize: '0.9rem'
                            }}>
                                <div style={{ flex: 1 }}>
                                    {typeof notif === 'string' ? notif : notif.message}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDismiss(notif); }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#666',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem',
                                        padding: '0 5px'
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
