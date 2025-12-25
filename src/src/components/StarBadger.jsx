import React, { useState, useEffect } from 'react';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { MdStar } from 'react-icons/md';

const StarBadger = ({ isOpen, onClose, user, series, onComplete }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [username, setUsername] = useState('');

    useEffect(() => {
        const fetchUsername = async () => {
            if (user?.uid) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Prioritize 'username' field, then displayName, then email part
                        setUsername(userData.username || user.displayName || user.email?.split('@')[0] || 'USER');
                    } else {
                        setUsername(user.displayName || user.email?.split('@')[0] || 'USER');
                    }
                } catch (err) {
                    console.error("Error fetching username:", err);
                    setUsername('USER');
                }
            }
        };

        if (isOpen) {
            fetchUsername();
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleYes = async () => {
        setLoading(true);
        try {
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                // Badge Data
                const badge = {
                    id: series.id,
                    name: series.name,
                    poster_path: series.poster_path,
                    date: new Date().toISOString(),
                    earnedAt: Date.now()
                };

                // Update User's Star Series
                await updateDoc(userRef, {
                    starSeries: arrayUnion(badge)
                });
            }
            setStep(2);
        } catch (error) {
            console.error("Error awarding star:", error);
            // Optionally show error, but moving to step 2 or closing is safer UI wise
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Styles for animation */}
            <style>
                {`
                @keyframes scaleUp {
                    0% { transform: scale(0.8); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                `}
            </style>

            <div style={{
                background: '#000', // Pure Black
                border: '1px solid #333', // Square Border (no radius implied or small)
                padding: '40px',
                width: '90%', maxWidth: '600px',
                textAlign: 'center',
                boxShadow: '0 0 50px rgba(255, 204, 0, 0.1)',
                animation: 'scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
                {step === 1 && (
                    <>
                        <h2 style={{
                            color: '#fff',
                            fontSize: '2rem', // Large weight
                            fontWeight: '900', // Bold
                            marginBottom: '40px',
                            textTransform: 'uppercase',
                            lineHeight: '1.2'
                        }}>
                            <span style={{ color: '#FFCC00' }}>{username || 'USER'}</span> WATCHED THE WHOLE SERIES?
                        </h2>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                            <button
                                onClick={handleYes}
                                disabled={loading}
                                style={{
                                    background: '#FFCC00',
                                    color: '#000',
                                    border: 'none',
                                    padding: '15px 40px',
                                    fontSize: '1.2rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '2px',
                                    transition: 'transform 0.1s'
                                }}
                                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {loading ? '...' : 'YES'}
                            </button>

                            <button
                                onClick={onClose}
                                style={{
                                    background: 'transparent',
                                    color: '#555',
                                    border: '2px solid #333',
                                    padding: '15px 40px',
                                    fontSize: '1.2rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    letterSpacing: '2px'
                                }}
                            >
                                NO
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div style={{ marginBottom: '20px', animation: 'scaleUp 0.5s ease' }}>
                            <MdStar size={80} color="#FFCC00" />
                        </div>
                        <h2 style={{
                            color: '#fff',
                            fontSize: '1.8rem',
                            fontWeight: 'bold',
                            marginBottom: '30px',
                            textTransform: 'uppercase',
                            lineHeight: '1.4'
                        }}>
                            CONGRATULATION YOU HAVE EARNED THE STAR FOR THIS SERIES <br />
                            <span style={{ color: '#FFCC00' }}>{series.name}</span>
                        </h2>

                        <button
                            onClick={() => {
                                onClose();
                                if (onComplete) onComplete();
                            }}
                            style={{
                                background: '#FFCC00',
                                color: '#000',
                                border: 'none',
                                padding: '15px 50px',
                                fontSize: '1.2rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '2px'
                            }}
                        >
                            OK
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default StarBadger;
