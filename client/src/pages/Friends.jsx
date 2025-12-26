import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { activityService } from '../utils/activityService';
import ActivityRenderer from '../components/ActivityRenderer';
import { db } from '../firebase-config';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { MdPerson, MdSearch, MdClose, MdStar } from 'react-icons/md';
import Skeleton from '../components/Skeleton';
import './Friends.css';

const FriendsSkeleton = () => (
    <div className="activity-feed" style={{ padding: '0 20px' }}>
        {[1, 2, 3].map(i => (
            <div key={i} style={{ marginBottom: '20px', background: '#111', padding: '15px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <Skeleton width="40px" height="40px" borderRadius="50%" />
                    <div style={{ flex: 1 }}>
                        <Skeleton width="120px" height="15px" marginBottom="5px" />
                        <Skeleton width="80px" height="12px" />
                    </div>
                </div>
                <Skeleton height="150px" borderRadius="8px" />
            </div>
        ))}
    </div>
);

const Friends = () => {
    const { userData } = useAuth();

    // Feed State
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search State
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showHint, setShowHint] = useState(false);

    // Hint Logic
    useEffect(() => {
        const hasSeenHint = localStorage.getItem('friend_search_hint_seen');
        if (!hasSeenHint) {
            setShowHint(true);
            const timer = setTimeout(() => {
                setShowHint(false);
                localStorage.setItem('friend_search_hint_seen', 'true');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Fetch Feed (Force Refresh & Batched)
    useEffect(() => {
        const fetchActivities = async () => {
            if (!userData || !userData.following || userData.following.length === 0) {
                setActivities([]);
                setLoading(false);
                return;
            }

            // FORCE FETCH: Removed Cache Check

            setLoading(true);
            try {
                const following = userData.following;
                const chunks = [];
                // Chunk into arrays of 10 for Firestore 'in' limit
                for (let i = 0; i < following.length; i += 10) {
                    chunks.push(following.slice(i, i + 10));
                }

                // Execute Parallel Queries
                const promises = chunks.map(chunk => {
                    const q = query(
                        collection(db, 'user_activity'),
                        where('userId', 'in', chunk),
                        orderBy('createdAt', 'desc'),
                        limit(20) // Limit per chunk to avoid massive downloads
                    );
                    return getDocs(q);
                });

                const snapshots = await Promise.all(promises);
                let allItems = [];
                snapshots.forEach(snap => {
                    const chunkItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    allItems = [...allItems, ...chunkItems];
                });

                // Dedupe (just in case) using Map
                const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());

                // Filter Last 7 Days (Optional, keeping as per old logic but maybe user wants all?)
                // User said "PULL FORCELY", usually implies "Get me data".
                // I will relax the 7 day filter slightly? Or keep it?
                // The old logic was: 7 days. If older data exists, it wasn't shown.
                // If I have friend activity from 8 days ago, it will show empty. This might be why they say "NOT FETCHING".
                // I will REMOVE the date filter to populate the feed if there is data.
                // Users usually prefer seeing *something* rather than nothing.

                // Sort by Date Descending
                uniqueItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                // Take Top 50 global
                const finalFeed = uniqueItems.slice(0, 50);

                setActivities(finalFeed);
                // Removed setItem cache

                // MARK AS VIEWED
                activityService.markActivityViewed();

            } catch (error) {
                if (error.code === 'failed-precondition' && error.message.includes('index')) {
                    console.warn("⚠️ MISSING FIRESTORE INDEX (Friends Feed)");
                }
                console.error("Error fetching friends feed:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [userData]);

    // Search Handler (Unchanged logic mostly)
    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchText.trim()) return;

        setSearchLoading(true);
        setSearchResults([]);

        try {
            const q = query(
                collection(db, 'users'),
                where('username', '==', searchText.trim()), // Exact match
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

    const formatTimeAgo = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 60) return "Just now";
        let interval = Math.floor(seconds / 3600);
        if (interval >= 24) {
            interval = Math.floor(interval / 24);
            return interval === 1 ? "Yesterday" : `${interval}d ago`;
        }
        if (interval >= 1) return `${interval}h ago`;
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return `${interval}m ago`;
        return "Just now";
    };

    return (
        <div className="friends-container" style={{ background: '#000', minHeight: '100%', transform: 'translateZ(0)', paddingBottom: '100px' }}>
            {/* SEARCH SECTION */}
            <div className="friend-search-container" style={{ padding: '10px 20px', position: 'relative' }}>
                <form onSubmit={handleSearch} className="search-form" style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        className="friend-search-input"
                        placeholder="Search username... (exact)"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#111', color: '#fff', outline: 'none' }}
                    />
                    <button type="submit" className="friend-search-btn" style={{ background: '#333', border: 'none', borderRadius: '8px', width: '50px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {searchLoading ? '...' : <MdSearch size={24} />}
                    </button>
                    {showHint && <div style={{ position: 'absolute', top: '100%', left: '20px', background: '#FFD600', color: '#000', padding: '5px 10px', borderRadius: '4px', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>Find friends</div>}
                </form>

                {/* SEARCH RESULTS */}
                {searchResults.length > 0 && (
                    <div className="search-results-dropdown" style={{ position: 'absolute', top: '75px', left: '20px', right: '20px', background: '#222', borderRadius: '8px', padding: '10px', zIndex: 100, border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: '#888', fontSize: '12px', textTransform: 'uppercase' }}>
                            <span>Results</span>
                            <MdClose onClick={() => setSearchResults([])} style={{ cursor: 'pointer' }} />
                        </div>
                        {searchResults.map(user => (
                            <Link to={`/profile/${user.uid}`} key={user.uid} className="search-result-item" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', textDecoration: 'none', color: '#fff', background: '#111', borderRadius: '6px', marginBottom: '5px' }}>
                                <img src={user.photoURL || 'https://placehold.co/40'} alt={user.username} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                                <span style={{ fontWeight: 'bold' }}>{user.username}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* FEED SECTION */}
            <div className="activity-feed" style={{ padding: '0 20px' }}>
                {loading ? (
                    <FriendsSkeleton />
                ) : activities.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#FFD600', marginTop: '50px' }}>
                        <p style={{ marginBottom: '10px' }}>No recent activity.</p>
                        <p style={{ fontSize: '12px', color: '#FFD600' }}>Follow people to see what they're watching.</p>
                    </div>
                ) : (
                    <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {activities.filter(item => {
                            // 🧠 FILTER RULES: ONLY Reviews
                            // 'rated_season' matches specific review type
                            // Future 'category' field will be 'REVIEWED'
                            if (item.category === 'REVIEWED') return true;
                            if (item.type === 'rated_season') return true;
                            // What if they have a textual review but type is 'watched_season'? 
                            // Unlikely with current architecture.
                            return false;
                        }).map(item => (
                            <ActivityRenderer
                                key={item.id}
                                activity={item}
                                variant="friend"
                            />
                        ))}
                        {/* Fallback if list empty after filter? */}
                        {activities.filter(activity =>
                            activity.category === 'REVIEWED' || activity.type === 'rated_season'
                        ).length === 0 && (
                                <div style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
                                    No recent reviews from friends.
                                </div>
                            )}
                    </div>
                )}
            </div>
        </div >
    );
};

export default Friends;
