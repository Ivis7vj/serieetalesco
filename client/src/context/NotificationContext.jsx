
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [state, setState] = useState({
        isOpen: false,
        type: 'alert', // 'alert' | 'confirm'
        message: '',
        title: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel'
    });

    const resolveRef = useRef(null);

    const close = useCallback(() => {
        setState(prev => ({ ...prev, isOpen: false }));
        // Clean up resolve ref after animation or immediately if no animation
    }, []);

    const alert = useCallback((message, title = 'Alert') => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                type: 'alert',
                message,
                title,
                confirmLabel: 'OK',
                cancelLabel: ''
            });
            resolveRef.current = resolve;
        });
    }, []);

    const confirm = useCallback((message, title = 'Confirm', confirmLabel = 'Yes', cancelLabel = 'No') => {
        return new Promise((resolve) => {
            setState({
                isOpen: true,
                type: 'confirm',
                message,
                title,
                confirmLabel,
                cancelLabel
            });
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        if (resolveRef.current) resolveRef.current(true);
        close();
    };

    const handleCancel = () => {
        if (resolveRef.current) resolveRef.current(false);
        close();
    };

    const handleAlertOk = () => {
        if (resolveRef.current) resolveRef.current();
        close();
    };

    return (
        <NotificationContext.Provider value={{ alert, confirm }}>
            {children}
            {state.isOpen && (
                <div style={styles.overlay} onClick={state.type === 'alert' ? handleAlertOk : handleCancel}>
                    <div style={styles.modal} onClick={e => e.stopPropagation()}>
                        <div style={styles.header}>
                            {state.title}
                        </div>
                        <div style={styles.body}>
                            {state.message}
                        </div>
                        <div style={styles.footer}>
                            {state.type === 'confirm' ? (
                                <>
                                    <button style={styles.cancelBtn} onClick={handleCancel}>
                                        {state.cancelLabel}
                                    </button>
                                    <button style={styles.confirmBtn} onClick={handleConfirm}>
                                        {state.confirmLabel}
                                    </button>
                                </>
                            ) : (
                                <button style={styles.confirmBtn} onClick={handleAlertOk}>
                                    {state.confirmLabel}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </NotificationContext.Provider>
    );
};

const styles = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'fadeIn 0.2s ease-out'
    },
    modal: {
        background: '#191919', // Prime Dark
        border: 'none',
        borderRadius: '8px',
        padding: '30px',
        minWidth: '350px',
        maxWidth: '90%',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        animation: 'scaleIn 0.2s ease-out',
        color: '#f2f2f2',
        fontFamily: '"Amazon Ember", Arial, sans-serif'
    },
    header: {
        fontSize: '1.1rem',
        fontWeight: '700',
        marginBottom: '1rem',
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
    },
    body: {
        fontSize: '0.95rem',
        color: '#bbbbbb', // Softer white
        marginBottom: '2rem',
        lineHeight: '1.5'
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '15px'
    },
    confirmBtn: {
        background: '#FFCC00', // Yellow
        color: '#000000', // Black Text
        border: 'none',
        padding: '10px 25px',
        borderRadius: '4px',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.95rem',
        textTransform: 'uppercase',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
        fontFamily: 'sans-serif'
    },
    cancelBtn: {
        background: 'transparent',
        color: '#FFCC00', // Yellow Text
        border: '1px solid #FFCC00', // Yellow Border
        padding: '10px 25px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.95rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        transition: 'all 0.2s'
    }
};

// Add global styles for animation if not present
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(styleSheet);
}
