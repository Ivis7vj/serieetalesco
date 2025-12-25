import { useState, useEffect, useRef } from 'react';
import { FaSearch } from 'react-icons/fa';
import { CgProfile } from 'react-icons/cg';
import { IoSettingsOutline } from 'react-icons/io5';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { MdCheck } from 'react-icons/md';
import Notify from './Notify';
import '../pages/Home.css';

import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

const Header = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [duplicateAlert, setDuplicateAlert] = useState(false); // Alert state

    const navigate = useNavigate();
    const location = useLocation();
    const inputRef = useRef(null);
    const searchContainerRef = useRef(null);

    const { currentUser } = useAuth(); // Get User

    // Selection Mode State (Merged from Location or Event)
    const [selectionMode, setSelectionMode] = useState({
        active: false,
        slotIndex: null
    });

    // Sync with Location if present (Priority mostly to initial load if navigated)
    useEffect(() => {
        if (location.state?.selectForFavorite) {
            setSelectionMode({ active: true, slotIndex: location.state.slotIndex });
        } else {
            // Only reset if we are NOT in a persistent search flow? 
            // Actually, if we navigate to Profile, this effect runs. Profile doesn't have state.
            // So we reset. This is correct except if we want to persist across generic nav?
            // User flow: Profile -> Header Search -> Stay on Profile.
            // Profile -> Search Page -> Profile.
            // So default reset is fine.
            setSelectionMode({ active: false, slotIndex: null });
        }
    }, [location.state]);

    // Custom Event Listener
    useEffect(() => {
        const handleTrigger = (e) => {
            const { slotIndex } = e.detail;
            setSelectionMode({ active: true, slotIndex });
            setIsSearchActive(true);
            setTimeout(() => inputRef.current?.focus(), 100);
        };
        window.addEventListener('trigger-search-bar', handleTrigger);
        return () => window.removeEventListener('trigger-search-bar', handleTrigger);
    }, []);

    // Click Outside Handling
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearchActive(false);
                setShowSuggestions(false);
            }
        };

        if (isSearchActive) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchActive]);

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

    useEffect(() => {
        const fetchSuggestions = async () => {
            if (searchTerm.trim().length > 1) { // Trigger earlier
                try {
                    const response = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTerm)}`);
                    const data = await response.json();
                    if (data.results) {
                        setSuggestions(data.results.slice(0, 5));
                        setShowSuggestions(true);
                    }
                } catch (e) {
                    console.error("Suggestion fetch error:", e);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        };

        const timeoutId = setTimeout(fetchSuggestions, 200); // Faster debounce
        return () => clearTimeout(timeoutId);
    }, [searchTerm, TMDB_API_KEY]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchTerm)}`, {
                state: selectionMode.active ? { selectForFavorite: true, slotIndex: selectionMode.slotIndex } : {}
            });
            setShowSuggestions(false);
            addToRecent({ name: searchTerm, id: Date.now() }); // Use name as object
            setIsSearchActive(false); // Close Black Overlay & Search Bar
            setSearchTerm(''); // Clear Input
        }
    };

    const [recentSearches, setRecentSearches] = useState([]); // Store objects {id, name, poster_path}

    // Load Recents
    useEffect(() => {
        let saved = [];
        try {
            const raw = localStorage.getItem('recentSearches');
            if (raw && raw !== "[object Object]") {
                try {
                    saved = JSON.parse(raw);
                    if (!Array.isArray(saved)) saved = [];
                } catch (parseErr) {
                    console.error("JSON Parse Error in Header.jsx:", parseErr);
                    saved = [];
                }
            }
        } catch (e) {
            console.error("Error accessing localStorage in Header.jsx", e);
            saved = [];
        }
        const normalized = saved.map(item => (item && typeof item === 'object') ? item : { name: String(item), id: 'legacy-' + item });
        setRecentSearches(normalized);
    }, [isSearchActive]);

    const addToRecent = (item) => {
        let current = [];
        try {
            const raw = localStorage.getItem('recentSearches');
            if (raw && raw !== "[object Object]") {
                try {
                    current = JSON.parse(raw);
                    if (!Array.isArray(current)) current = [];
                } catch (parseErr) {
                    current = [];
                }
            }
        } catch (e) { current = []; }

        current = current.filter(i => (i && typeof i === 'object' ? i.id !== item.id : i !== item.name));
        const newItem = { id: item.id, name: item.name, poster_path: item.poster_path, date: new Date().toISOString() };
        current = [newItem, ...current].slice(0, 5);

        localStorage.setItem('recentSearches', JSON.stringify(current));
        setRecentSearches(current);
    };

    const handleSuggestionClick = async (item) => {
        // IMMEDIATE UI CLEAR - critical for removing black overlay
        setIsSearchActive(false);
        setShowSuggestions(false);
        setSearchTerm('');
        addToRecent(item); // Save to Recents

        if (selectionMode.active) {
            if (!currentUser) return;
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    let currentFavs = userSnap.data().favorites || [null, null, null, null, null];

                    // Duplicate Check
                    const isDuplicate = currentFavs.some((fav, idx) => fav && fav.id === item.id && idx !== selectionMode.slotIndex);
                    if (isDuplicate) {
                        setDuplicateAlert(true);
                        setTimeout(() => setDuplicateAlert(false), 2000);
                        return; // Stop
                    }

                    // Ensure padding
                    if (currentFavs.length < 5) currentFavs = [...currentFavs, ...Array(5 - currentFavs.length).fill(null)];

                    // Update
                    currentFavs[selectionMode.slotIndex] = item;
                    await updateDoc(userRef, { favorites: currentFavs });

                    // Success UI
                    setShowSuccess(true);

                    // Reset mode
                    setSelectionMode({ active: false, slotIndex: null });

                    // Navigate (Refresh Profile logic handled by onSnapshot in Profile.jsx)
                    setTimeout(() => {
                        setShowSuccess(false);
                        navigate('/profile');
                    }, 2000);
                }
            } catch (err) {
                console.error("Fav Save Error", err);
            }

        } else {
            // Standard Navigation
            setTimeout(() => {
                navigate(`/tv/${item.id}`);
            }, 50); // Small specific delay to ensure state clears first if needed, though state update is typically enough
        }
    };

    const handleSClick = (e) => {
        e.preventDefault();
        setIsSearchActive(true);
    };



    return (
        <header className="header" style={{
            justifyContent: 'space-between',
            padding: '0 15px', // Match CSS compressed padding
            paddingTop: 'env(safe-area-inset-top)',
            height: 'calc(56px + env(safe-area-inset-top))' // Explicit sync
        }}>
            {/* Success Popup */}
            {showSuccess && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    background: 'rgba(0,0,0,0.8)', zIndex: 2000,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.3s ease-out'
                }}>
                    <div style={{
                        width: '100px', height: '100px', borderRadius: '50%', background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
                        animation: 'popIn 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}>
                        <MdCheck size={60} color="#000" />
                    </div>
                    <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold', animation: 'fadeIn 1s ease-out' }}>Added to Favorites</h2>
                </div>
            )}
            <style>
                {`
                @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}
            </style>

            {/* Duplicate Alert */}
            {duplicateAlert && (
                <div style={{
                    position: 'fixed', top: '100px', left: '50%', transform: 'translateX(-50%)',
                    background: '#ff4444', color: 'white', padding: '15px 30px', borderRadius: '8px',
                    zIndex: 2100, fontWeight: 'bold', boxShadow: '0 5px 20px rgba(0,0,0,0.3)',
                    animation: 'fadeIn 0.2s ease-out', display: 'flex', alignItems: 'center', gap: '10px'
                }}>
                    <span>⚠️ This series is already in your favorites!</span>
                </div>
            )}

            {/* LEFT SPACER */}
            <div className="header-left" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                {/* Search Focus Overlay - Blank Black Page */}
                {isSearchActive && (searchTerm || suggestions.length > 0 || recentSearches.length > 0) && (
                    <div style={{
                        position: 'fixed',
                        top: 'calc(56px + env(safe-area-inset-top))', // Start below header
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: '#000', // Pure Black
                        zIndex: 999, // Below Header (1000ish) but above content
                        touchAction: 'none', // Prevent scrolling
                        animation: 'fadeIn 0.2s ease-out'
                    }} />
                )}
                <Notify />
            </div>

            {/* CENTER: DYNAMIC LOGO / SEARCH */}
            <div ref={searchContainerRef} style={{ flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
                <style>
                    {`
                    .search-input::placeholder {
                        color: var(--text-primary);
                        opacity: 1; /* Firefox */
                    }
                    `}
                </style>
                <div style={{
                    display: 'flex', alignItems: 'center',
                    position: 'relative'
                }}>
                    {/* The "S" Trigger - Fades Out (Replaced by Search Bar S) */}
                    <div
                        onClick={handleSClick}
                        style={{
                            cursor: 'pointer',
                            zIndex: 10,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.5s ease',
                            opacity: isSearchActive ? 0 : 1,
                            width: isSearchActive ? 0 : 'auto',
                            overflow: 'hidden',
                            marginRight: isSearchActive ? 0 : '0px'
                        }}
                        className="app-logo-text logo-s-part"
                    >
                        S
                    </div>

                    {/* Search Input Container - Expands */}
                    <div className={isSearchActive ? "search-bar-container-responsive" : ""} style={{
                        transition: 'all 0.5s ease',
                        width: isSearchActive ? '350px' : 0, // Increased width for Icon + S + EARCH
                        opacity: isSearchActive ? 1 : 0,
                        overflow: 'hidden',
                        display: 'flex', alignItems: 'center'
                    }}>
                        {/* Search Icon */}
                        <FaSearch style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginRight: '15px', minWidth: '20px' }} />

                        <form onSubmit={handleSearch} style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                            <input
                                ref={inputRef}
                                autoFocus={isSearchActive}
                                type="text"
                                placeholder=""
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onBlur={() => { }}
                                onFocus={() => searchTerm.length > 2 && setShowSuggestions(true)}
                                className="search-input search-input-responsive"
                                style={{
                                    width: '100%',
                                    background: 'transparent', // Handled by container class on mobile
                                    border: 'none',
                                    borderBottom: '2px solid var(--accent-color)', // Default
                                    color: 'var(--text-primary)',
                                    fontSize: '1.5rem',
                                    fontFamily: 'sans-serif',
                                    fontWeight: 'bold',
                                    outline: 'none',
                                    padding: '5px'
                                }}
                            />
                        </form>
                    </div>

                    {/* "ERIEE" Text - Conditional Visibility to avoid overlap */}
                    <div
                        onClick={() => setIsSearchActive(false)}
                        style={{
                            transition: 'all 0.5s ease',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            opacity: isSearchActive ? 0 : 1,
                            width: isSearchActive ? 0 : 'auto',
                            overflow: 'hidden'
                        }}
                        className="app-logo-text logo-eriee-part"
                    >
                        ERIEE
                    </div>
                </div>

                {/* Suggestions / Recents Dropdown */}
                {isSearchActive && ((showSuggestions && suggestions.length > 0) || (!searchTerm && recentSearches.length > 0)) && (
                    <div className="suggestions-dropdown-responsive" style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%', // Centered relative to container
                        transform: 'translateX(-50%)',
                        width: '90vw', // Mobile Width
                        maxWidth: '400px', // Desktop Limit
                        // background/border handled by class (Black/Square)
                        zIndex: 1000,
                        marginTop: '10px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}>
                        {searchTerm ? (
                            suggestions.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => handleSuggestionClick(s)}
                                    style={{
                                        padding: '10px',
                                        borderBottom: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        color: 'var(--text-primary)',
                                        textAlign: 'left'
                                    }}
                                >
                                    <img
                                        src={`https://image.tmdb.org/t/p/w92${s.poster_path}`}
                                        alt={s.name}
                                        style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '2px' }} // Smaller 30px
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                    <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '1rem' }}>{s.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.first_air_date ? s.first_air_date.split('-')[0] : ''}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            // Recents
                            <>
                                <div style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold', letterSpacing: '1px', background: 'rgba(255,255,255,0.05)' }}>RECENT SEARCHES</div>
                                {recentSearches.map((s, i) => (
                                    <div
                                        key={s.id || i}
                                        onClick={() => handleSuggestionClick(s)} // Treat recent click same as suggestion click
                                        style={{
                                            padding: '10px',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            color: 'var(--text-primary)',
                                            textAlign: 'left',
                                            opacity: 0.8
                                        }}
                                    >
                                        {s.poster_path ? (
                                            <img
                                                src={`https://image.tmdb.org/t/p/w92${s.poster_path}`}
                                                alt={s.name}
                                                style={{ width: '30px', height: '45px', objectFit: 'cover', borderRadius: '2px' }}
                                            />
                                        ) : (
                                            <div style={{ width: '30px', height: '45px', background: '#333', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <FaSearch color="#666" />
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '0.95rem' }}>{s.name}</div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* RIGHT SPACER */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}></div>
        </header>
    );
};

export default Header;
