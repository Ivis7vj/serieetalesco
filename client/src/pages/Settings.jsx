import { MdSettings, MdLogout, MdDeleteForever, MdLightMode, MdDarkMode, MdReportProblem } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext'; // Improved Import
import * as accountService from '../utils/accountService'; // New Service
import ReportProblemSheet from '../components/ReportProblemSheet';
import './Home.css';
import { useState } from 'react';
import ButtonLoader from '../components/ButtonLoader'; // Assuming this exists or using simple text

const Settings = () => {
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { confirm, alert } = useNotification();
    const { logout, currentUser } = useAuth(); // Use Context Logout
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const handleDeleteAccount = async () => {
        const isConfirmed = await confirm(
            "Are you sure you want to delete your account? ALL your data (Watchlist, Reviews, Diary) will be permanently erased. This username will become available for others. This action CANNOT be undone.",
            "Permanently Delete Account",
            "DELETE FOREVER",
            "Cancel"
        );

        if (isConfirmed) {
            setIsDeleting(true);
            try {
                await accountService.deleteUserAccount(currentUser);
                navigate('/login');
            } catch (error) {
                console.error("Deletion error:", error);
                setIsDeleting(false);
                alert(error.message || "Failed to delete account. Try logging in again.", "Error");
            }
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', color: 'var(--text-primary)' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '40px', color: 'var(--text-primary)' }}>Settings</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Account Actions Section */}
                <div style={{ padding: '0 0 20px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <h3 style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px', fontWeight: '800' }}>
                        Account
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                color: '#FFFFFF',
                                fontWeight: '600',
                                fontSize: '1.1rem'
                            }}
                        >
                            <MdLogout size={22} color="#666" /> Log Out
                        </button>

                        <button
                            onClick={() => setIsReportOpen(true)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <MdReportProblem size={22} color="#666" />
                                <span style={{ color: '#FFFFFF', fontSize: '1.1rem', fontWeight: '600' }}>Report a problem</span>
                            </div>
                            <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '37px' }}>Something not working? Tell us.</span>
                        </button>

                        <button
                            onClick={handleDeleteAccount}
                            disabled={isDeleting}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                padding: '0',
                                textAlign: 'left',
                                cursor: isDeleting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                color: '#ff4444',
                                fontWeight: '600',
                                fontSize: '1.1rem',
                                opacity: isDeleting ? 0.5 : 1
                            }}
                        >
                            <MdDeleteForever size={22} color="#ff4444" />
                            {isDeleting ? "Deleting..." : "Delete Account"}
                        </button>
                    </div>
                </div>

                {/* ABOUT / COMPLIANCE */}
                <div style={{ padding: '20px 0', borderBottom: '1px solid #1a1a1a' }}>
                    <h3 style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px', fontWeight: '800' }}>
                        About
                    </h3>
                    <p style={{ color: '#aaa', fontSize: '0.85rem', lineHeight: '1.6' }}>
                        SERIEE does not host, stream, or distribute any movies, TV shows, or games.
                        All information and images are provided by third-party metadata services.
                        SERIEE is intended for tracking, rating, and discovery purposes only.
                    </p>
                </div>
            </div>

            <ReportProblemSheet isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
        </div>
    );
};

export default Settings;
