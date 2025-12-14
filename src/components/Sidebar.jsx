import { MdHome, MdStarBorder, MdAdd, MdPublic } from 'react-icons/md';
import { CgProfile } from 'react-icons/cg';
import { IoSettingsOutline } from 'react-icons/io5';

import { NavLink } from 'react-router-dom';
import '../pages/Home.css';

const Sidebar = ({ onLogout }) => {
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
                </NavLink>
                <NavLink
                    to="/reviews"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdStarBorder size={28} />
                    <span className="sidebar-text">Reviews</span>
                </NavLink>
                <NavLink
                    to="/watchlist"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                >
                    <MdAdd size={28} />
                    <span className="sidebar-text">Watchlist</span>
                </NavLink>
                <NavLink
                    to="/profile"
                    className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                    style={({ isActive }) => ({ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)', textDecoration: 'none' })}
                    <span className="sidebar-text">Profile</span>
            </NavLink>

            <NavLink
                to="/settings"
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                style={({ isActive }) => ({
                    color: isActive ? '#fff' : '#888', // Highlight white when active, muted gray otherwise
                    textDecoration: 'none',
                    background: isActive ? '#000' : 'transparent', // Pure black bg when active
                    fontWeight: '700', // Rich Bold
                    fontFamily: 'Arial, sans-serif',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px'
                })}
            >
                <IoSettingsOutline size={28} />
                <span className="sidebar-text" style={{ fontSize: '1rem' }}>Settings</span>
            </NavLink>


        </nav>
        </aside >
    );
};

export default Sidebar;
