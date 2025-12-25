import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import PremiumLoader from './components/PremiumLoader';
import { useAuth } from './context/AuthContext';
import { useLoading } from './context/LoadingContext';
import { useScrollLock } from './hooks/useScrollLock';
import './pages/Home.css'; // Reusing Home layout styles for the main container

const Layout = () => {
    const [activeFooter, setActiveFooter] = useState('home');
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { isLoading, setIsLoading, loadingMessage } = useLoading();

    // Lock scroll during global loading
    useScrollLock(isLoading);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/login');
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    // Show Back Button logic
    const showBackButton = location.pathname !== '/' && location.pathname !== '/login';

    return (
        <div className="home-container" style={{
            position: 'relative',
            height: '100dvh',
            width: '100vw',
            overflow: 'hidden',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
            backgroundColor: 'var(--bg-primary)'
        }}>
            {isLoading && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: '#000' }}>
                    <PremiumLoader message={loadingMessage} />
                </div>
            )}

            {showBackButton && (
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        position: 'fixed',
                        top: 'calc(15px + env(safe-area-inset-top))',
                        left: '20px',
                        zIndex: 1000,
                        background: 'rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(5px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '50px',
                        width: '40px',
                        height: '40px',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        outline: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }}
                >
                    <FaArrowLeft size={18} />
                </button>
            )}

            <Header onLogout={handleLogout} />
            <div className="content-wrapper" style={{ height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Sidebar activeFooter={activeFooter} setActiveFooter={setActiveFooter} onLogout={handleLogout} />
                <main className="main-content" style={{ minHeight: '100%' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
