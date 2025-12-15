import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { MdPerson, MdSearch, MdClose, MdStar } from 'react-icons/md';
import './Friends.css';

const Friends = () => {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();

    // Feed State
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Hint Logic (First Visit Only)
    useEffect(() => {
        const hasSeenHint = localStorage.getItem('friend_search_hint_seen');
        if (!hasSeenHint) {
            setShowHint(true);
            const timer = setTimeout(() => {
                setShowHint(false);
                localStorage.setItem('friend_search_hint_seen', 'true');
            }, 3000); // Fade out after 3s
            return () => clearTimeout(timer);
        }
    }, []);

    // Fetch Feed (Single Read)
    useEffect(() => {
        const fetchActivities = async () => {
            // Check In-Memory Cache (Session)
            const cached = sessionStorage.getItem('friends_feed_cache_v2'); // New version key
            if (cached) {
                setActivities(JSON.parse(cached));
                setLoading(false);
                return;
            }

            try {
                // Determine Query: Strictly ONE read path
                // We default to global purely recents (limit 10) for safety/aliveness
                // Filter by friends logic is complex without composite index on generic fields
                // Prompt: "Fetch MAX 10 activities... Order by timestamp DESC"

                const q = query(
                    collection(db, 'activities'),
                    orderBy('timestamp', 'desc'),
                    limit(10)
                );

                const snapshot = await getDocs(q);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Client-side 5-hour filter (Strict Rule)
                const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
                const validItems = items.filter(i => {
                    const time = i.timestamp?.toMillis ? i.timestamp.toMillis() : i.createdAt;
                    return time > fiveHoursAgo;
                });

                setActivities(validItems);
                sessionStorage.setItem('friends_feed_cache_v2', JSON.stringify(validItems));

            } catch (error) {
                console.error("Error fetching activity feed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, []);

    // Search Handler
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchText.trim()) return;

        setSearchLoading(true);
        setSearchResults([]);

        try {
            // "Exact match only"
            const q = query(
                collection(db, 'users'),
                where('username', '==', searchText.trim()),
                limit(3)
            );
            const snapshot = await getDocs(q);
            const results = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
            setSearchResults(results);
        } catch (err) {
            console.error("Search failed:", err);
        } finally {
            setSearchLoading(false);
        }
    };

    const getTimeAgo = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 60) return "Just now";
        let interval = Math.floor(seconds / 3600);
        if (interval >= 1) return `${interval}h ago`;
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return `${interval}m ago`;
        return "Just now";
    };

    const getActionText = (type) => {
        switch (type) {
            case 'liked': return 'liked';
            case 'watched': return 'watched';
            case 'watchlist': return 'added to watchlist';
            case 'review': return 'reviewed';
            default: return 'interacted with';
        }
    };

    return (
        <div className="friends-container">
            {/* SEARCH SECTION */}
            <div className="friend-search-container">
                <form onSubmit={handleSearch} className="search-form">
                    <input
                        type="text"
                        className="friend-search-input"
                        placeholder="Search username..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                    />
                    <button type="submit" className="friend-search-btn">
                        {searchLoading ? '...' : <MdSearch size={22} />}
                    </button>

                    {/* HINT TOOLTIP */}
                    <div className={`search-hint ${showHint ? 'visible' : ''}`}>
                        Search your friends here
                    </div>
                </form>

                {/* SEARCH RESULTS */}
                {searchResults.length > 0 && (
                    <div className="search-results-dropdown">
                        <div className="search-results-header">
                            <span>Results</span>
                            <MdClose onClick={() => setSearchResults([])} style={{ cursor: 'pointer' }} />
                        </div>
                        {searchResults.map(user => (
                            <Link to={`/profile/${user.uid}`} key={user.uid} className="search-result-item">
                                <img src={user.photoURL || 'https://via.placeholder.com/40'} alt={user.username} className="result-pfp" />
                                <span className="result-username">{user.username}</span>
                            </Link>
                        ))}
                    </div>
                )}
                {searchResults.length === 0 && !searchLoading && searchText && searchResults !== null && (
                    // Optional: Show "No results" if we tracked "searched" state, but keeping UI clean
                    null
                )}
            </div>

            {/* FEED SECTION */}
            <div className="activity-feed">
                {loading ? (
                    <div className="friends-loading">Loading activity...</div>
                ) : (
                    <div className="activity-list">
                        {activities.length === 0 ? (
                            <div className="no-activity">No recent activity.</div>
                        ) : (
                            activities.map(item => (
                                <div key={item.id} className="activity-item">
                                    {/* Layout: [Pfp] ... */}
                                    <div className="activity-left">
                                        <Link to={`/profile/${item.userId}`}>
                                            {item.userProfilePicURL ?
                                                <img src={item.userProfilePicURL} alt={item.username} className="activity-pfp" /> :
                                                <div className="activity-pfp-placeholder"><MdPerson /></div>
                                            }
                                        </Link>
                                    </div>

                                    <div className="activity-right">
                                        {/* Row 1: Username Action Time */}
                                        <div className="activity-meta-row">
                                            <div className="meta-left">
                                                <Link to={`/profile/${item.userId}`} className="meta-username">{item.username}</Link>
                                                <span className="meta-action">{getActionText(item.actionType)}</span>
                                            </div>
                                            <span className="meta-time">{getTimeAgo(item.timestamp)}</span>
                                        </div>

                                        {/* Row 2: Series Title */}
                                        <Link to={`/tv/${item.seriesId}`} className="activity-series-title">
                                            {item.seriesName}
                                        </Link>

                                        {/* Row 3: Rating/Review (if exists) */}
                                        {(item.rating || item.reviewSnippet) && (
                                            <div className="activity-review-block">
                                                {item.rating && (
                                                    <div className="activity-stars">
                                                        {[...Array(5)].map((_, i) => (
                                                            <MdStar key={i} size={14} color={i < item.rating ? "#FFD600" : "#444"} />
                                                        ))}
                                                    </div>
                                                )}
                                                {item.reviewSnippet && (
                                                    <p className="activity-review-text">{item.reviewSnippet}</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Row 4: Poster */}
                                        <Link to={`/tv/${item.seriesId}`} className="activity-poster-wrapper">
                                            <img src={`https://image.tmdb.org/t/p/w200${item.seriesPosterURL}`} alt={item.seriesName} loading="lazy" />
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Friends;
