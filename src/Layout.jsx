import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import './pages/Home.css'; // Reusing Home layout styles for the main container

const Layout = () => {
    const [activeFooter, setActiveFooter] = useState('home');
    const isAuthenticated = localStorage.getItem('currentUser');
    const location = useLocation();
    const navigate = useNavigate();

    // Auth check removed for guest access

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        window.location.href = '/login'; // simple reload to clear state
    };

    // Show Back Button logic
    const showBackButton = location.pathname !== '/' && location.pathname !== '/login';

    return (
        <div className="home-container" style={{ position: 'relative' }}>
            {showBackButton && (
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        position: 'fixed',
                        top: 'calc(20px + env(safe-area-inset-top))',
                        left: '20px',
                        zIndex: 1000,
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        outline: 'none',
                        fontWeight: 'bold',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }}
                >
                    <FaArrowLeft size={24} /> Back
                </button>
            )}

            <Header onLogout={handleLogout} />
            <div className="content-wrapper">
                <Sidebar activeFooter={activeFooter} setActiveFooter={setActiveFooter} onLogout={handleLogout} />
                <main className="main-content scrollable-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
