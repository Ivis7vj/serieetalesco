import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdCheckCircle, MdAutoAwesome, MdLocalFireDepartment, MdPerson, MdSecurity, MdClose, MdLayers, MdGroups, MdMessage } from 'react-icons/md';

const ChangelogModal = ({ isOpen, onClose }) => {
    // Lock body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    const changes = [
        {
            icon: <MdPerson color="#FFD600" size={24} />,
            title: "Real Profile Pictures",
            description: "Reviews now show actual user avatars instead of placeholders, fetched on-demand."
        },
        {
            icon: <MdLocalFireDepartment color="#FFD600" size={24} />,
            title: "Smooth Pull-to-Refresh",
            description: "Added a high-performance 120FPS refresh gesture to the homepage for instant data reload."
        },
        {
            icon: <MdAutoAwesome color="#FFD600" size={24} />,
            title: "Friend Activity Fix",
            description: "Resolved issues with friends' activity not fetching. Now shows all recent interactions."
        },
        {
            icon: <MdLayers color="#FFD600" size={24} />,
            title: "Episode Details UI",
            description: "Completely redesigned episode view with better hierarchies and immersive layout."
        },
        {
            icon: <MdGroups color="#FFD600" size={24} />,
            title: "Cast & Crew Redesign",
            description: "Polished the talent section with circular avatars and smooth horizontal scrolling."
        },
        {
            icon: <MdMessage color="#FFD600" size={24} />,
            title: "Activity UI Upgrade",
            description: "Refined the look and feel of activity cards for clearer tracking of your journey."
        },
        {
            icon: <MdSecurity color="#FFD600" size={24} />,
            title: "Optimized Startup",
            description: "Improved authentication checks to prevent login flashes. App opens directly to your content."
        },
        {
            icon: <MdCheckCircle color="#FFD600" size={24} />,
            title: "Native Look & Feel",
            description: "Further polished UI transitions and safe-area handling for a premium mobile experience."
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)'
                    }}
                >
                    <motion.div
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: 0.95, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        style={{
                            background: '#000',
                            width: '92%',
                            maxWidth: '440px',
                            maxHeight: '85vh',
                            borderRadius: '32px',
                            border: '1px solid #1a1a1a',
                            overflow: 'hidden',
                            boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '32px 24px 20px',
                            background: 'linear-gradient(to bottom, #111, #000)',
                            borderBottom: '1px solid #111',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            zIndex: 2
                        }}>
                            <div>
                                <h2 style={{ color: '#fff', fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '-0.5px' }}>
                                    What's New in <span style={{ color: '#FFD600' }}>v3.0.0</span>
                                </h2>
                                <p style={{ color: '#888', fontSize: '0.9rem', margin: '6px 0 0' }}>The Evolution of SERIEE</p>
                            </div>
                            <button
                                onClick={onClose}
                                style={{
                                    background: '#111',
                                    border: '1px solid #222',
                                    borderRadius: '14px',
                                    width: '40px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#fff'
                                }}
                            >
                                <MdClose size={22} />
                            </button>
                        </div>

                        {/* Content Scroll Area */}
                        <div className="hide-scrollbar" style={{
                            padding: '10px 24px',
                            overflowY: 'auto',
                            overflowX: 'hidden', // Force only vertical
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '24px'
                        }}>
                            {/* Inner Padding for scrolling visibility at edges */}
                            <div style={{ paddingTop: '10px', paddingBottom: '20px' }}>
                                {changes.map((change, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 + (index * 0.04) }}
                                        style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '28px' }}
                                    >
                                        <div style={{
                                            minWidth: '48px',
                                            height: '48px',
                                            background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                                            borderRadius: '18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '1px solid #222',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                        }}>
                                            {change.icon}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: '800', margin: 0 }}>{change.title}</h3>
                                            <p style={{ color: '#aaa', fontSize: '0.88rem', lineHeight: '1.5', margin: 0 }}>{change.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '24px', borderTop: '1px solid #111', background: '#000' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    width: '100%',
                                    padding: '18px',
                                    background: '#FFD600',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '18px',
                                    fontSize: '1.1rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 25px rgba(255, 214, 0, 0.3)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}
                            >
                                START EXPLORING
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ChangelogModal;

