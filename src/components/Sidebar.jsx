import { MdHome, MdStarBorder, MdAdd, MdPublic } from 'react-icons/md';
import { CgProfile } from 'react-icons/cg';

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
                >
                    <CgProfile size={28} />
                    <span className="sidebar-text">Profile</span>
                </NavLink>


            </nav>
        </aside>
    );
};

export default Sidebar;
