
import React, { useState, useEffect } from 'react';
import ReportProblemSheet from './ReportProblemSheet';
import { MdErrorOutline } from 'react-icons/md';

/**
 * GlobalErrorAutomation
 * Listens for 'seriee-global-error' events, shows a minimalist popup for 3s,
 * and then automatically opens the ReportProblemSheet.
 */
const GlobalErrorAutomation = () => {
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        const handleGlobalError = () => {
            // Already showing an error? Don't stack them.
            if (showPopup || isReportOpen) return;

            // 1. Show the "Something error happened" popup
            setShowPopup(true);

            // 2. Hide popup after 3 seconds and open the report sheet
            setTimeout(() => {
                setShowPopup(false);
                setIsReportOpen(true);
            }, 3000);
        };

        window.addEventListener('seriee-global-error', handleGlobalError);
        return () => window.removeEventListener('seriee-global-error', handleGlobalError);
    }, [showPopup, isReportOpen]);

    return (
        <>
            {/* Minimalist Error Popup */}
            {showPopup && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '20px',
                    right: '20px',
                    backgroundColor: '#000000',
                    borderLeft: '4px solid #FFD400',
                    padding: '20px',
                    zIndex: 20000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                    borderRadius: '8px',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <style>
                        {`
                            @keyframes slideIn {
                                from { transform: translateY(-100%); opacity: 0; }
                                to { transform: translateY(0); opacity: 1; }
                            }
                        `}
                    </style>
                    <MdErrorOutline size={30} color="#FFD400" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#FFFFFF', fontWeight: '800', fontSize: '1rem' }}>Something error happened in this application</span>
                        <span style={{ color: '#9A9A9A', fontSize: '0.85rem' }}>Opening report section in 3 seconds...</span>
                    </div>
                </div>
            )}

            {/* The Report Sheet */}
            <ReportProblemSheet
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
            />
        </>
    );
};

export default GlobalErrorAutomation;
