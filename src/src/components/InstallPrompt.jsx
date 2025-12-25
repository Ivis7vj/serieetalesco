import React, { useState, useEffect } from 'react';
import { MdInstallMobile, MdClose } from 'react-icons/md';

const InstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Check if already dismissed
            if (!localStorage.getItem('installPromptDismissed')) {
                setIsVisible(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        // Optionally, send analytics event with outcome of user choice
        if (outcome === 'accepted') {
            setIsVisible(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem('installPromptDismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            maxWidth: '400px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            zIndex: 9998,
            animation: 'slideUp 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                    backgroundColor: '#FFCC00',
                    padding: '8px',
                    borderRadius: '8px',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <MdInstallMobile size={24} />
                </div>
                <div>
                    <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem' }}>Install SERIEE</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '0.8rem' }}>Add to home screen for better experience</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={handleInstall}
                    style={{
                        backgroundColor: 'transparent',
                        color: '#FFCC00',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        padding: '8px'
                    }}
                >
                    INSTALL
                </button>
                <button
                    onClick={handleDismiss}
                    style={{
                        backgroundColor: 'transparent',
                        color: '#666',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <MdClose size={20} />
                </button>
            </div>
            <style>
                {`
                    @keyframes slideUp {
                        from { transform: translate(-50%, 100%); opacity: 0; }
                        to { transform: translate(-50%, 0); opacity: 1; }
                    }
                `}
            </style>
        </div>
    );
};

export default InstallPrompt;
