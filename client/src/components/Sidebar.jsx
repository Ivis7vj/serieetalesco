import { useState, useEffect } from 'react';
import { MdHome, MdStarBorder, MdAdd, MdPublic, MdPeople, MdInsertChart } from 'react-icons/md';
import { CgProfile } from 'react-icons/cg';
import { IoSettingsOutline } from 'react-icons/io5';

import { NavLink } from 'react-router-dom';
import MobileIndicator from './MobileIndicator';
import { useAuth } from '../context/AuthContext';
import { activityService } from '../utils/activityService';
import '../pages/Home.css';

const Sidebar = () => {
    const { userData } = useAuth();
    const [hasActivity, setHasActivity] = useState(false);

    useEffect(() => {
        const checkActivity = async () => {
            if (userData) {
                const hasNew = await activityService.hasNewActivity(userData);
                setHasActivity(hasNew);
            }
        };

        checkActivity();

        const handleViewed = () => setHasActivity(false);
        window.addEventListener('friends-activity-viewed', handleViewed);

        return () => {
            window.removeEventListener('friends-activity-viewed', handleViewed);
        };
    }, [userData]);

    return (
        <aside className="left-sidebar">
            <nav className="sidebar-nav">
                <NavLink
                    to="/"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdHome size={28} />
                    <span className="sidebar-text">Home</span>
                    <MobileIndicator id="nav-home-tip" message="Your series feed 🏠" position="top" />
                </NavLink>
                <NavLink
                    to="/series-graph"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdInsertChart size={28} />
                    <span className="sidebar-text">Series Graph</span>
                    <MobileIndicator id="nav-stats-tip" message="Your tracking insights 📊" position="top" />
                </NavLink>

                <NavLink
                    to="/reviews"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdStarBorder size={28} />
                    <span className="sidebar-text">Reviews</span>
                    <MobileIndicator id="nav-reviews-tip" message="Your reviews live here ✍️" position="top" />
                </NavLink>

                <NavLink
                    to="/profile"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <CgProfile size={28} />
                    <span className="sidebar-text">Profile</span>
                    <MobileIndicator id="nav-profile-tip" message="Your space 👤" position="top" />
                </NavLink>

                <NavLink
                    to="/friends"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdPeople size={28} />
                    <span className="sidebar-text">Friends</span>
                    {hasActivity && (
                        <div className="friend-activity-dot" style={{
                            position: 'absolute',
                            top: '15px',
                            right: '15px',
                            width: '8px',
                            height: '8px',
                            background: '#E50914',
                            borderRadius: '50%',
                            boxShadow: '0 0 5px #E50914'
                        }}></div>
                    )}
                </NavLink>
            </nav>
        </aside>
    );
};

export default Sidebar;
