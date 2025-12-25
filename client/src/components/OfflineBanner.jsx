import React, { useState, useEffect } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { MdCloudOff } from 'react-icons/md';

const OfflineBanner = () => {
    const isOnline = useOnlineStatus();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!isOnline) {
            setVisible(true);
        } else {
            // Hide after a brief moment when connection restores
            const timer = setTimeout(() => setVisible(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: isOnline ? '-50px' : '0',
            left: 0,
            width: '100%',
            backgroundColor: isOnline ? '#2e7d32' : '#222',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
            zIndex: 9999,
            transition: 'all 0.3s ease-in-out',
            borderTop: '1px solid #333',
            fontSize: '0.9rem',
            fontWeight: '500'
        }}>
            {isOnline ? (
                <>
                    <span>Back online</span>
                </>
            ) : (
                <>
                    <MdCloudOff size={18} color="#FF4444" />
                    <span>You're offline. Some content may be unavailable.</span>
                </>
            )}
        </div>
    );
};

export default OfflineBanner;
