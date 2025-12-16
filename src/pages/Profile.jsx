import { useState, useEffect, useRef } from 'react';
import { MdSettings, MdEdit, MdPhotoCamera, MdGridOn, MdList, MdStar, MdAdd, MdMoreVert, MdCreate, MdClose, MdCheck } from 'react-icons/md';
import { FaInstagram, FaTwitter } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit, orderBy, startAfter } from 'firebase/firestore';


import './Home.css';

// Simple Image Cropper Component
import { resolvePoster } from '../utils/posterResolution';

const ImageCropper = ({ imageSrc, onCancel, onSave }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [rel, setRel] = useState(null);
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        setDragging(true);
        setRel({ x: e.pageX - position.x, y: e.pageY - position.y });
        e.stopPropagation();
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!dragging) return;
        setPosition({ x: e.pageX - rel.x, y: e.pageY - rel.y });
        e.stopPropagation();
        e.preventDefault();
    };

    const onMouseUp = () => setDragging(false);

    const onTouchStart = (e) => {
        setDragging(true);
        setRel({ x: e.touches[0].pageX - position.x, y: e.touches[0].pageY - position.y });
    };

    const onTouchMove = (e) => {
        if (!dragging) return;
        setPosition({ x: e.touches[0].pageX - rel.x, y: e.touches[0].pageY - rel.y });
    };

    const handleSave = () => {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const img = imgRef.current;
        if (!img) return;
        const scale = img.naturalWidth / img.width;
        ctx.drawImage(img, -position.x * scale, -position.y * scale, size * scale, size * scale, 0, 0, size, size);
        onSave(canvas.toDataURL('image/jpeg', 0.9));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <h3 style={{ color: 'white', marginBottom: '20px' }}>Adjust Profile Photo</h3>
            <div
                ref={containerRef}
                style={{ width: '300px', height: '300px', border: '2px solid var(--accent-color)', position: 'relative', overflow: 'hidden', cursor: 'move', background: '#000' }}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
            >
                <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.3)', pointerEvents: 'none', zIndex: 10 }}></div>
                <img ref={imgRef} src={imageSrc} alt="Edit" draggable={false} style={{ position: 'absolute', top: position.y, left: position.x, maxWidth: 'none', minWidth: '300px', userSelect: 'none' }} />
            </div>
            <div style={{ marginTop: '20px', display: 'flex', gap: '20px' }}>
                <button onClick={onCancel} style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>CANCEL</button>
                <button onClick={handleSave} style={{ padding: '10px 20px', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>SAVE</button>
            </div>
            <p style={{ color: '#888', marginTop: '10px', fontSize: '0.8rem' }}>Drag to reposition</p>
        </div>
    );
};

const Profile = () => {
    const { uid } = useParams(); // Get uid from URL if present
    const navigate = useNavigate();
    const { currentUser, logout } = useAuth();

    // Determine Target User (URL param > Current User)
    const targetUid = uid || currentUser?.uid;
    const isOwnProfile = !uid || (currentUser && targetUid === currentUser.uid);

    const [user, setUser] = useState({});
    const [stats, setStats] = useState({ thisYear: 0, following: 0, followers: 0 });
    const [activeTab, setActiveTab] = useState('Profile');
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [editImageSrc, setEditImageSrc] = useState(null);
    const [showFullPFP, setShowFullPFP] = useState(false);
    const menuRef = useRef(null);

    const isCollapsed = activeTab !== 'Profile';
    const [favorites, setFavorites] = useState([null, null, null, null, null]);
    const [watchlist, setWatchlist] = useState([]);
    const [likes, setLikes] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [watched, setWatched] = useState([]);
    const [activityItems, setActivityItems] = useState([]);
    const [starSeriesIds, setStarSeriesIds] = useState(new Set());

    // Fetch User Data (Optimized)
    useEffect(() => {
        if (!targetUid) return;

        let unsubUser = () => { };

        const loadProfile = async () => {
            // 1. Current User Profile (From AuthContext)
            if (isOwnProfile && currentUser && window.location.pathname.includes('/profile') && !uid) {
                // Note: The check !uid ensures we are on /profile (self) usually, but logic depends on routing. 
                // isOwnProfile is reliable: (currentUser && targetUid === currentUser.uid).
                // If we are looking at our own profile via /profile/MY_ID, we can still use context.

                // However, AuthContext's userData might be null initially.
                // We rely on AuthContext for updates.
                if (currentUser) {
                    // We don't need to do anything if we use prop/context derived state, 
                    // BUT this component uses local state 'user', 'watchlist', etc.
                    // We should sync local state with Context whenever Context updates.
                    // See separate useEffect below.
                    return;
                }
            }

            // 2. Other User Profile (One-time fetch to save reads, or onSnapshot if preferred. Plan said getDoc)
            if (!isOwnProfile) {
                try {
                    const docRef = doc(db, 'users', targetUid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setUser({ ...data, username: data.username || data.email?.split('@')[0] || 'User' });
                        setProfilePhoto(data.photoURL || null);
                        setWatchlist(data.watchlist || []);
                        setLikes(data.likes || []);
                        setWatched(data.watched || []);

                        const achievements = data.achievements || [];
                        const starSeries = data.starSeries || [];
                        setStarSeriesIds(new Set(starSeries.map(s => s.id)));

                        const loadedFavs = data.favorites || [];

                        // Favorites Logic
                        const limitedFavs = loadedFavs.slice(0, 5);
                        const paddedFavs = [...limitedFavs, ...Array(Math.max(0, 5 - limitedFavs.length)).fill(null)].map(f => {
                            if (!f) return null;
                            return { ...f, isStar: starSeries.some(s => s.id === f.id) };
                        });
                        setFavorites(paddedFavs);

                        // Stats
                        const currentYear = new Date().getFullYear();
                        setStats({
                            thisYear: achievements.filter(a => a.type === 'season_finish' && new Date(a.date).getFullYear() === currentYear).length,
                            totalSeasons: achievements.filter(a => a.type === 'season_finish').length,
                            following: data.following?.length || 0,
                            followers: data.followers?.length || 0
                        });

                        // Check Follow Status
                        if (currentUser && data.followers?.includes(currentUser.uid)) {
                            setIsFollowing(true);
                        } else {
                            setIsFollowing(false);
                        }
                    }
                } catch (e) {
                    console.error("Error fetching user profile:", e);
                }
            }
        };

        if (!isOwnProfile) {
            loadProfile();
        }

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [targetUid, isOwnProfile, currentUser]); // Removed unsub logic from here for self

    // Sync Self Data from Context
    const { userData: authUserData } = useAuth(); // Global State

    useEffect(() => {
        if (isOwnProfile && authUserData) {
            const data = authUserData;
            setUser({ ...data, username: data.username || data.email?.split('@')[0] || 'User' });
            setProfilePhoto(data.photoURL || null);
            setWatchlist(data.watchlist || []);
            setLikes(data.likes || []);
            setWatched(data.watched || []);

            const achievements = data.achievements || [];
            const starSeries = data.starSeries || [];
            setStarSeriesIds(new Set(starSeries.map(s => s.id)));

            const loadedFavs = data.favorites || [];
            // Favorites Logic
            const limitedFavs = loadedFavs.slice(0, 5);
            const paddedFavs = [...limitedFavs, ...Array(Math.max(0, 5 - limitedFavs.length)).fill(null)].map(f => {
                if (!f) return null;
                return { ...f, isStar: starSeries.some(s => s.id === f.id) };
            });
            setFavorites(paddedFavs);

            // Stats
            const currentYear = new Date().getFullYear();
            setStats({
                thisYear: achievements.filter(a => a.type === 'season_finish' && new Date(a.date).getFullYear() === currentYear).length,
                totalSeasons: achievements.filter(a => a.type === 'season_finish').length,
                following: data.following?.length || 0,
                followers: data.followers?.length || 0
            });
        }
    }, [isOwnProfile, authUserData]);

    // Reviews Pagination Logic
    const [lastReview, setLastReview] = useState(null);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [hasMoreReviews, setHasMoreReviews] = useState(true);

    const fetchReviews = async (isInitial = false) => {
        if (loadingReviews) return;
        setLoadingReviews(true);
        try {
            let q = query(
                collection(db, 'reviews'),
                where('userId', '==', targetUid),
                orderBy('createdAt', 'desc'), // Assuming 'createdAt' exists. Old code used 'date'? No, verify sort logic.
                // Old code: sorted by new Date(b.createdAt) - new Date(a.createdAt). So field is createdAt.
                limit(10)
            );

            if (!isInitial && lastReview) {
                q = query(q, startAfter(lastReview));
            }

            const snap = await getDocs(q);
            const fetched = snap.docs.map(d => ({ ...d.data(), id: d.id })); // .sort by desc usually handled by query

            if (fetched.length < 10) setHasMoreReviews(false);

            setLastReview(snap.docs[snap.docs.length - 1]);

            if (isInitial) {
                setReviews(fetched);
            } else {
                setReviews(prev => [...prev, ...fetched]);
            }
        } catch (e) {
            console.error("Error fetching reviews:", e);
        }
        setLoadingReviews(false);
    };

    // Trigger Fetch on Tab Change
    useEffect(() => {
        if ((activeTab === 'Reviews' || activeTab === 'Activity') && reviews.length === 0 && hasMoreReviews) {
            fetchReviews(true);
        }
    }, [activeTab, targetUid]);


    const { alert } = useNotification();

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5000000) return alert("File too large!", "Upload Error");
            const reader = new FileReader();
            reader.onloadend = () => { setEditImageSrc(reader.result); setShowMenu(false); };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveCropped = async (base64) => {
        setProfilePhoto(base64);
        setEditImageSrc(null);
        try { await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: base64 }); } catch (err) { console.error(err); }
    };

    // DEBUG: Reset Database function
    const handleResetStars = async () => {
        const isConfirmed = await confirm("This will remove ALL Star Badges properly. Are you sure? You can't undo this.", "Reset Star Badges", "YES, DUMP STARS", "CANCEL");
        if (isConfirmed) {
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), { starSeries: [] });
                alert("All Star Badges have been removed.", "Cleanup Successful");
            } catch (e) {
                console.error(e);
                alert("Failed to reset.", "Error");
            }
        }
    };

    const [isFollowing, setIsFollowing] = useState(false);

    // Pull to Refresh State
    const [refreshing, setRefreshing] = useState(false);
    const [pullStartY, setPullStartY] = useState(0);

    const handleBoxClick = (index) => window.dispatchEvent(new CustomEvent('trigger-search-bar', { detail: { slotIndex: index } }));

    const handleFollowToggle = async () => {
        if (!currentUser || !targetUid) return;

        const myRef = doc(db, 'users', currentUser.uid);
        const targetRef = doc(db, 'users', targetUid);

        try {
            if (isFollowing) {
                // Unfollow
                await updateDoc(myRef, { following: arrayRemove(targetUid) });
                await updateDoc(targetRef, { followers: arrayRemove(currentUser.uid) });
                setIsFollowing(false);
            } else {
                // Follow
                await updateDoc(myRef, { following: arrayUnion(targetUid) });

                // Notification Logic (Aggregated)
                const targetDoc = await getDoc(targetRef);
                if (targetDoc.exists()) {
                    const data = targetDoc.data();
                    const currentNotifs = data.notifications || [];

                    // Check for existing "new follower" notification
                    const existingFollowIndex = currentNotifs.findIndex(n => n.type === 'follow');

                    if (existingFollowIndex !== -1) {
                        // Aggregate
                        const existing = currentNotifs[existingFollowIndex];
                        let count = 1; // Default if plain message
                        // Match "follower(N)" pattern
                        const match = existing.message && existing.message.match(/follower\((\d+)\)/);
                        if (match) {
                            count = parseInt(match[1]);
                        }

                        const newCount = count + 1;
                        const newMessage = `HEY SERIEER, new follower(${newCount}) for you !`;

                        // Update the existing item
                        const updatedNotif = {
                            ...existing,
                            message: newMessage,
                            timestamp: new Date().toISOString(),
                            from: 'multiple' // or keep last sender
                        };

                        // Replace in array
                        const newNotifs = [...currentNotifs];
                        newNotifs[existingFollowIndex] = updatedNotif;

                        await updateDoc(targetRef, {
                            followers: arrayUnion(currentUser.uid),
                            notifications: newNotifs
                        });

                    } else {
                        // Create New
                        const notifMsg = `HEY SERIEER , new follower for you!`;
                        const notifObj = { message: notifMsg, type: 'follow', from: currentUser.uid, timestamp: new Date().toISOString() };

                        await updateDoc(targetRef, {
                            followers: arrayUnion(currentUser.uid),
                            notifications: arrayUnion(notifObj)
                        });
                    }
                } else {
                    // Just add follower if issue reading
                    await updateDoc(targetRef, { followers: arrayUnion(currentUser.uid) });
                }
                setIsFollowing(true);
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
            if (error.code === 'permission-denied') {
                alert("Permission Denied: Unable to update follower stats. Please check Firestore Security Rules to allow updating 'followers' array for other users.", "Backend Error");
            } else {
                alert("Failed to update follow status.", "Error");
            }
        }
    };

    // Refresh Logic (Simple Reload)
    const handleTouchStart = (e) => {
        if (window.scrollY === 0) setPullStartY(e.touches[0].clientY);
    };

    const handleTouchMove = (e) => {
        const y = e.touches[0].clientY;
        if (pullStartY && y > pullStartY + 50 && window.scrollY === 0) {
            // Visual cue could go here
        }
    };

    const handleTouchEnd = (e) => {
        const y = e.changedTouches[0].clientY;
        if (pullStartY && y > pullStartY + 100 && window.scrollY === 0) {
            setRefreshing(true);
            // Simulate refresh or reload
            setTimeout(() => {
                window.location.reload();
            }, 800);
        }
        setPullStartY(0);
    };

    const getDiaryGroups = () => {
        const groups = {};
        const sorted = [...watched].sort((a, b) => new Date(b.date) - new Date(a.date));
        const groupedItems = [];
        let currentGroup = null;

        sorted.forEach(item => {
            const itemDateStr = new Date(item.date).toDateString();
            if (item.isEpisode) {
                if (currentGroup && currentGroup.seriesId === item.seriesId && currentGroup.seasonNumber === item.seasonNumber && new Date(currentGroup.date).toDateString() === itemDateStr) {
                    currentGroup.episodes.push(item);
                    currentGroup.episodeCount++;
                } else {
                    if (currentGroup) groupedItems.push(currentGroup);
                    currentGroup = { ...item, isGroup: true, episodes: [item], episodeCount: 1 };
                }
            } else {
                if (currentGroup) { groupedItems.push(currentGroup); currentGroup = null; }
                groupedItems.push(item);
            }
        });
        if (currentGroup) groupedItems.push(currentGroup);

        groupedItems.forEach(item => {
            const date = new Date(item.date);
            const key = `${date.toLocaleString('default', { month: 'long' }).toUpperCase()} ${date.getFullYear()}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    };

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const diffInSeconds = Math.floor((new Date() - date) / 1000);
        if (diffInSeconds < 60) return `${diffInSeconds}s`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        return `${Math.floor(diffInSeconds / 86400)}d`;
    }

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const formatDateShort = (dateStr) => {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    const [basketModalData, setBasketModalData] = useState(null);

    // Grouping Logic for Watchlist (Deduplicated)
    const processWatchlist = (list) => {
        const groups = {}; // Key: "seriesId_SseasonNumber"

        // 1. Identify Episode Baskets
        // Filter and process episodes first to build groups
        list.forEach(item => {
            if (item.seasonNumber !== undefined && item.seasonNumber !== null && item.episodeNumber !== undefined) {
                const key = `${item.seriesId || item.id}_S${item.seasonNumber}`;
                if (!groups[key]) {
                    groups[key] = {
                        type: 'basket',
                        seriesId: item.seriesId || item.id,
                        seasonNumber: item.seasonNumber,
                        name: item.name,
                        poster_path: item.poster_path,
                        seasonPoster: item.seasonPoster,
                        episodes: []
                    };
                }
                groups[key].episodes.push(item);
                if (!groups[key].seasonPoster && item.seasonPoster) groups[key].seasonPoster = item.seasonPoster;
            }
        });

        const processed = [];

        // 2. Add Whole Series/Seasons (Dedupe check)
        list.forEach(item => {
            // Skip episodes (already handled)
            if (item.seasonNumber !== undefined && item.episodeNumber !== undefined) return;

            // Check for duplicates
            if (item.seasonNumber !== undefined) {
                const basketKey = `${item.seriesId || item.id}_S${item.seasonNumber}`;
                // If a basket already exists for this season, SKIP this Season Item
                if (groups[basketKey]) return;
            }

            processed.push({ ...item, type: 'series', isSeason: item.seasonNumber !== undefined });
        });

        // 3. Add Baskets to Processed
        Object.values(groups).forEach(basket => {
            basket.episodeCount = basket.episodes.length;
            basket.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
            if (basket.seasonPoster) basket.poster_path = basket.seasonPoster;

            // Name cleanup
            if (basket.episodes[0]) {
                const parts = basket.episodes[0].name.split(' - ');
                basket.name = parts[0] + (basket.seasonNumber ? ` (Season ${basket.seasonNumber})` : '');
            }

            processed.push(basket);
        });

        return processed;
    };

    const handleRemoveFromWatchlist = async (itemToRemove) => {
        if (!currentUser) return;
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const currentList = userSnap.data().watchlist || [];
                // Filter out the item based on ID/Season/Ep match
                // Assuming objects might differ slightly in memory, better to compare unique IDs
                // But watchlist items don't strictly have unique instance IDs, so check props
                const updatedList = currentList.filter(i => {
                    const isSameSeries = (i.seriesId || i.id) === (itemToRemove.seriesId || itemToRemove.id);
                    const isSameSeason = i.seasonNumber === itemToRemove.seasonNumber;
                    const isSameEp = i.episodeNumber === itemToRemove.episodeNumber;

                    // If removing an episode: match all 3
                    if (itemToRemove.episodeNumber) return !(isSameSeries && isSameSeason && isSameEp);
                    // If removing series: match seriesId (and ensure it was a whole series entry?)
                    return !(isSameSeries && !i.episodeNumber);
                });

                await updateDoc(userRef, { watchlist: updatedList });

                // Update local basket state if open
                if (basketModalData) {
                    const newBasketEps = basketModalData.episodes.filter(i => i !== itemToRemove);
                    if (newBasketEps.length === 0) setBasketModalData(null);
                    else setBasketModalData({ ...basketModalData, episodes: newBasketEps });
                }
            }
        } catch (error) {
            console.error("Error removing from watchlist:", error);
        }
    };

    const renderTabContent = () => {
        const content = (() => {
            switch (activeTab) {
                case 'Profile':
                    return (
                        <div className="profile-content-col">
                            <div style={{ marginBottom: '3rem' }}>

                                <h3 className="favorite-series-label" style={{ marginTop: '30px', marginBottom: '20px' }}>FAVORITE SERIES</h3>
                                <div className="favorites-grid">
                                    {favorites.map((fav, index) => (
                                        <div key={index} className="favorite-box" style={{ border: 'none', overflow: 'visible', margin: (fav && starSeriesIds.has(fav.id)) ? '20px 0 0 20px' : '0', transition: 'margin 0.3s' }}>
                                            {fav ? (
                                                <>
                                                    <Link to={fav.seasonNumber ? `/tv/${fav.id}/season/${fav.seasonNumber}` : `/tv/${fav.id}`} style={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'visible' }}>
                                                        <img src={`https://image.tmdb.org/t/p/w342${resolvePoster(user, fav.id, fav.seasonNumber, fav.seasonPoster || fav.poster_path)}`} alt={fav.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                                                    </Link>
                                                    {isOwnProfile && <button onClick={(e) => { e.preventDefault(); handleBoxClick(index); }} using className="edit-fav-btn"><MdCreate /></button>}
                                                </>
                                            ) : (
                                                isOwnProfile ? (
                                                    <div onClick={() => handleBoxClick(index)} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                                        <MdAdd size={40} color="var(--accent-color)" />
                                                    </div>
                                                ) : <div style={{ width: '100%', height: '100%', background: '#111' }} />
                                            )}
                                        </div>
                                    ))
                                    }
                                </div>
                            </div>
                        </div>
                    );
                case 'Diary':
                    const groups = getDiaryGroups();
                    return (
                        <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
                            {Object.keys(groups).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No entries yet.</p> : Object.keys(groups).map((group, i) => (
                                <div key={i} style={{ marginBottom: '2.5rem' }}>
                                    <h3 style={{ fontSize: '1.2rem', fontWeight: '900', color: 'var(--text-primary)', marginBottom: '15px' }}>{group}</h3>
                                    <div className="diary-scroll-container">
                                        {groups[group].map((item, idx) => (
                                            <div key={idx} className="diary-item" style={{ paddingTop: starSeriesIds.has(item.seriesId || item.id) ? '20px' : '0', paddingLeft: starSeriesIds.has(item.seriesId || item.id) ? '20px' : '0', width: starSeriesIds.has(item.seriesId || item.id) ? '180px' : '160px', transition: 'all 0.3s' }}>
                                                <Link to={item.seasonNumber ? `/tv/${item.seriesId || item.id}/season/${item.seasonNumber}` : `/tv/${item.seriesId || item.id}`} style={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'visible', borderRadius: '4px' }}>

                                                    <img src={`https://image.tmdb.org/t/p/w342${item.seasonPoster || item.poster_path}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />

                                                    {/* Internal Badges (Reverted) */}
                                                    <div className="diary-date-badge">
                                                        <div style={{ fontSize: '1rem', fontWeight: '900', lineHeight: 1 }}>{new Date(item.date).getDate()}</div>
                                                        <div style={{ fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{new Date(item.date).toLocaleString('default', { month: 'short' })}</div>
                                                    </div>

                                                    {item.isGroup && <div className="diary-eps-badge">{item.episodeCount} eps</div>}
                                                    {(item.seasonNumber || item.isSeason) && <div className="diary-season-badge">S{item.seasonNumber}</div>}
                                                    {item.rating && <div className="diary-rating-badge"><MdStar /> {item.rating}</div>}
                                                </Link>


                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                case 'Activity':
                    const rawActivityItems = [
                        ...reviews.map(r => ({ ...r, type: 'review', date: r.date })),
                        ...watched.map(w => ({ ...w, type: 'watched', date: w.date })),
                        ...watchlist.map(w => ({ ...w, type: 'watchlist', date: w.date || w.dateAdded })),
                        ...likes.map(l => ({ ...l, type: 'liked', date: l.date }))
                    ].sort((a, b) => {
                        const getDate = (d) => {
                            if (!d) return 0;
                            // Handle Firestore Timestamp (has toDate method)
                            if (typeof d === 'object' && typeof d.toDate === 'function') return d.toDate().getTime();
                            const parsed = new Date(d).getTime();
                            return isNaN(parsed) ? 0 : parsed;
                        };
                        return getDate(b.date) - getDate(a.date);
                    });

                    // Group Activity (Consecutive Watchlist Items for same Season)
                    const groupedActivity = [];
                    let currentGroup = null;

                    rawActivityItems.forEach(item => {
                        // Only Group Watchlist Items for now (as requested)
                        if (item.type === 'watchlist' && item.seasonNumber !== undefined) {
                            const itemSeriesId = item.seriesId || item.id;
                            const groupSeriesId = currentGroup ? (currentGroup.seriesId || currentGroup.id) : null;

                            const isMatch = currentGroup &&
                                currentGroup.type === 'watchlist' &&
                                groupSeriesId === itemSeriesId &&
                                currentGroup.seasonNumber === item.seasonNumber;

                            if (isMatch) {
                                currentGroup.episodes.push(item);
                                currentGroup.episodeCount = currentGroup.episodes.length;
                                // If current item is the Season Item, capture metadata
                                if (item.isSeason) {
                                    currentGroup.name = item.name;
                                    currentGroup.poster_path = item.poster_path; // Season poster
                                    currentGroup.isSeasonItemFound = true;
                                }
                                // If seasonPoster available on item, update group
                                if (!currentGroup.seasonPoster && item.seasonPoster) {
                                    currentGroup.seasonPoster = item.seasonPoster;
                                }
                                return;
                            } else {
                                // Flush previous
                                if (currentGroup) groupedActivity.push(currentGroup);

                                // Start new group
                                currentGroup = {
                                    ...item,
                                    isGroup: true,
                                    episodes: [item],
                                    episodeCount: 1,
                                    // Use proper name from start if possible
                                    name: item.name,
                                    poster_path: item.seasonPoster || item.poster_path
                                };
                                return;
                            }
                        }

                        // Flush previous if exists
                        if (currentGroup) {
                            groupedActivity.push(currentGroup);
                            currentGroup = null;
                        }

                        groupedActivity.push(item);
                    });
                    if (currentGroup) groupedActivity.push(currentGroup);

                    return (
                        <div className="activity-feed">
                            {groupedActivity.length === 0 ? <p style={{ color: '#888' }}>No activity yet.</p> : groupedActivity.map((item, idx) => {
                                let actionText = "";
                                if (item.type === 'like_review') {
                                    const isTargetMe = currentUser?.uid && item.targetUserId === currentUser.uid;
                                    const targetName = isTargetMe ? "your" : `${item.targetUsername || 'user'}'s`;
                                    actionText = ` liked ${targetName} review`;
                                    // Ensure we don't treat this as an 'episode' action in the text, explicit about review.
                                } else if (item.type === 'review') {
                                    actionText = ' reviewed';
                                } else if (item.type === 'watched') {
                                    actionText = ' watched';
                                } else if (item.type === 'liked') {
                                    actionText = ' liked';
                                } else if (item.isGroup && item.episodeCount > 1) {
                                    actionText = ` added Season ${item.seasonNumber} to watchlist`;
                                } else {
                                    actionText = ' added to watchlist';
                                }

                                return (
                                    <div key={idx} className="activity-item">
                                        <div className="activity-header">
                                            <span className="user-text">{isOwnProfile ? 'You' : (user.username || 'User')}</span>
                                            <span className="action-text">{actionText}</span>
                                        </div>

                                        <div className="activity-body">
                                            {/* Large Clean Poster */}
                                            <Link to={item.seasonNumber ? `/tv/${item.seriesId || item.id}/season/${item.seasonNumber}` : `/tv/${item.seriesId || item.id}`} className="activity-poster-wrapper">
                                                <img src={`https://image.tmdb.org/t/p/w342${item.seasonPoster || item.poster_path}`} alt={item.name} />
                                            </Link>

                                            {/* External Metadata Area */}
                                            <div className="activity-meta-col">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                                                    <Link to={item.seasonNumber ? `/tv/${item.seriesId || item.id}/season/${item.seasonNumber}` : `/tv/${item.seriesId || item.id}`} style={{ fontWeight: '900', fontSize: '1.1rem', color: '#fff', textDecoration: 'none', lineHeight: 1.2 }}>
                                                        {item.isGroup && item.episodeCount > 1
                                                            ? (item.name.includes("Season") ? item.name : `${item.name} (Season ${item.seasonNumber})`)
                                                            : item.name}
                                                    </Link>
                                                    <div style={{ textAlign: 'right', minWidth: '60px' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 'bold' }}>{formatDateShort(item.date)}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatTime(item.date)}</div>
                                                    </div>
                                                </div>

                                                <div style={{ marginTop: '5px', fontSize: '0.9rem', color: '#ccc', fontWeight: 'bold' }}>
                                                    {item.isGroup && item.episodeCount > 1 ? (
                                                        <span style={{ color: '#FFCC00' }}>{item.episodeCount} episodes</span>
                                                    ) : (
                                                        <>
                                                            {(item.seasonNumber || item.isSeason) && <span>Season {item.seasonNumber}</span>}
                                                            {(item.seasonNumber && item.episodeNumber) && <span> • </span>}
                                                            {item.episodeNumber && <span>Ep {item.episodeNumber}</span>}
                                                        </>
                                                    )}
                                                </div>

                                                {item.rating && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '5px', color: '#F5C518', fontWeight: '900' }}>
                                                        <MdStar size={16} /> <span>{item.rating}</span>
                                                    </div>
                                                )}

                                                {item.type === 'review' && item.review && (
                                                    <div className="activity-review-content">"{item.review}"</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );

                case 'Watchlist':
                case 'Liked':
                    if (activeTab === 'Liked') {
                        return (
                            <div className="watchlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px' }}>
                                {likes.filter(i => i.type !== 'like_review').map(item => (
                                    <div key={item.id} style={{ position: 'relative', paddingTop: starSeriesIds.has(item.seriesId || item.id) ? '0' : '0', paddingLeft: '0' }}>
                                        <Link to={item.seasonNumber ? `/tv/${item.seriesId || item.id}/season/${item.seasonNumber}` : `/tv/${item.seriesId || item.id}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative', overflow: 'visible' }}>

                                            <img src={`https://image.tmdb.org/t/p/w500${resolvePoster(user, item.seriesId || item.id, item.seasonNumber, item.seasonPoster || item.poster_path)}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    // Watchlist Case
                    const watchlistItems = processWatchlist(watchlist);
                    return (
                        <div className="watchlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px' }}>
                            {watchlistItems.map((item, idx) => {
                                if (item.type === 'basket') {
                                    return (
                                        <div key={idx} onClick={() => setBasketModalData(item)} style={{ cursor: 'pointer', display: 'block', width: '100%', border: '1px solid var(--border-color)', aspectRatio: '2/3', position: 'relative', overflow: 'hidden' }}>
                                            <img src={`https://image.tmdb.org/t/p/w500${resolvePoster(user, item.seriesId || item.id, item.seasonNumber, item.poster_path)}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                            {/* Basket Badges */}
                                            <div className="diary-season-badge" style={{ top: '6px', right: '6px', fontSize: '0.8rem', padding: '4px 6px' }}>S{item.seasonNumber}</div>
                                            <div className="diary-eps-badge" style={{ bottom: '6px', right: '6px', fontSize: '0.75rem' }}>{item.episodeCount} EPS</div>
                                        </div>
                                    );
                                } else {
                                    // Whole Series
                                    return (
                                        <div key={idx} style={{ position: 'relative', overflow: 'visible', paddingTop: starSeriesIds.has(item.seriesId || item.id) ? '20px' : '0', paddingLeft: starSeriesIds.has(item.seriesId || item.id) ? '20px' : '0' }}>
                                            <Link to={`/tv/${item.seriesId || item.id}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative', overflow: 'visible' }}>

                                                <img src={`https://image.tmdb.org/t/p/w500${resolvePoster(user, item.seriesId || item.id, item.seasonNumber, item.poster_path)}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                            </Link>
                                        </div>
                                    );
                                }
                            })}
                        </div>
                    );
                default: return null;
            }
        })();

        return <div key={activeTab} className="slide-content-anim">{content}</div>;
    };

    return (
        <div
            className="profile-wrapper"
            style={{ width: '70%', margin: '0 auto', maxWidth: '1400px', padding: '2rem 0', color: 'var(--text-primary)', position: 'relative' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {refreshing && (
                <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
                    <div className="loading-circle" style={{ width: '40px', height: '40px', border: '4px solid #333', borderTop: '4px solid #FFCC00', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            <style>
                {`
                .profile-header-grid { display: grid; grid-template-columns: auto 1fr; column-gap: 2rem; row-gap: 1.5rem; margin-bottom: 2rem; position: relative; }
                .collapsible-header-content { grid-column: 1 / 3; display: flex; gap: 2rem; transition: max-height 0.5s ease, opacity 0.4s ease; max-height: 500px; opacity: 1; overflow: hidden; }
                .collapsible-header-content.collapsed { max-height: 0; opacity: 0; margin-bottom: 0; }
                .profile-avatar-area { width: 120px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
                .profile-details-area { display: flex; flex-direction: column; gap: 15px; padding-top: 10px; flex: 1; }
                .profile-actions-animated { position: absolute; top: 0; right: 0; transition: all 0.5s ease; z-index: 10; display: flex; gap: 10px; align-items: center; }
                .profile-actions-animated.collapsed-menu { top: 10px; opacity: 0; pointer-events: none; visibility: hidden; }
                .follow-btn {
                    padding: 8px 24px;
                    font-size: 1rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    cursor: pointer;
                    border: 2px solid; /* Square border styling handled by border-radius 0 default or explicit */
                    border-radius: 0px; 
                    transition: all 0.2s ease;
                }
                .follow-btn.not-following {
                    background: #FFCC00;
                    color: #000;
                    border-color: #FFCC00;
                }
                .follow-btn.following {
                    background: #fff;
                    color: #000;
                    border-color: #fff;
                }

                .stats-container { display: flex; gap: 40px; align-items: center; }
                .social-icons { display: flex; gap: 15px; justify-content: center; }
                .social-icon-link { color: #888; font-size: 1.2rem; display: flex; align-items: center; justify-content: center; }
                .profile-username { font-size: 2rem; font-weight: 900; line-height: 1; color: var(--text-primary); }
                .stats-number { font-size: 1.2rem; font-weight: 900; color: #FFFFFF; }
                .stats-label { font-size: 0.75rem; font-weight: bold; color: #FFFFFF; letter-spacing: 1px; white-space: nowrap; margin-top: 2px; }
                .profile-bio { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.4; max-width: 500px; white-space: pre-wrap; }
                
                .nav-scroll-container { display: flex; overflow-x: auto; white-space: nowrap; scrollbar-width: none; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; margin-top: 1rem; }
                .nav-tab-btn { padding: 15px 25px; font-size: 1rem; background: transparent; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }

                /* Favorites */
                .favorites-grid { display: flex; gap: 15px; }
                .favorite-box { width: 140px; aspect-ratio: 2/3; background: var(--bg-secondary); border: none; position: relative; flex-shrink: 0; }
                .edit-fav-btn { position: absolute; top: 5px; right: 5px; background: transparent; color: #fff; border: none; width: 24px; height: 24px; display: flex; alignItems: center; justifyContent: center; cursor: pointer; }
                .badge-star-s { position: absolute; bottom: -5px; right: -5px; width: 30px; height: 30px; background: #FFCC00; clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); display: flex; alignItems: center; justifyContent: center; fontWeight: 900; color: black; font-size: 0.8rem; z-index: 10; filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5)); }

                /* Menu */
                .menu-dropdown { position: absolute; top: 100%; right: 0; background: #000; box-shadow: 0 4px 15px rgba(0,0,0,0.5); width: 180px; z-index: 100; display: flex; flex-direction: column; animation: menuPop 0.2s forwards; }
                @keyframes menuPop { from {opacity: 0; transform: scale(0.8);} to {opacity: 1; transform: scale(1);} }
                .menu-item { background: transparent; border: none; color: #fff; padding: 12px 16px; text-align: left; font-size: 0.9rem; font-weight: bold; cursor: pointer; display: block; width: 100%; }
                .menu-item:hover { background: #222; }

                /* Slide Anim */
                .slide-content-anim { animation: slideInRight 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
                @keyframes slideInRight { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }

                /* Diary Badges */
                .diary-scroll-container { display: flex; gap: 15px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; padding-bottom: 20px; width: 100%; flex-wrap: nowrap; }
                .diary-item { width: 160px; flex-shrink: 0; position: relative; }
                .diary-date-badge { position: absolute; top: 6px; left: 6px; background: #000; border: 1px solid #333; borderRadius: 4px; textAlign: center; minWidth: 32px; padding: 4px 2px; boxShadow: 0 2px 5px rgba(0,0,0,0.5); zIndex: 20; color: #fff; }
                .diary-eps-badge { position: absolute; bottom: 6px; right: 6px; background: rgba(0,0,0,0.8); color: #fff; padding: 2px 6px; borderRadius: 4px; fontSize: 0.65rem; fontWeight: bold; border: 1px solid rgba(255,255,255,0.2); }
                .diary-season-badge { position: absolute; top: 6px; right: 6px; background: black; color: white; padding: 2px 4px; fontSize: 0.65rem; fontWeight: bold; zIndex: 6; borderRadius: 2px; }
                .diary-rating-badge { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.8); color: #FFCC00; padding: 2px 4px; borderRadius: 4px; fontSize: 0.7rem; display: flex; alignItems: center; gap: 2px; fontWeight: bold; zIndex: 5; }

                /* ACTIVITY FEED STYLES */
                .activity-feed { display: flex; flex-direction: column; gap: 30px; }
                .activity-item { display: flex; flex-direction: column; gap: 10px; }
                .activity-header { font-size: 1rem; line-height: 1.4; }
                .user-text { fontWeight: bold; color: #fff; }
                .action-text { color: #888; }
                .activity-title { fontWeight: 900; color: #fff; text-decoration: none; font-size: 1.1rem; }
                
                .activity-body { display: flex; gap: 20px; align-items: flex-start; }
                .activity-poster-wrapper { width: 110px; aspect-ratio: 2/3; position: relative; flex-shrink: 0; border-radius: 4px; overflow: hidden; display: block; }
                .activity-poster-wrapper img { width: 100%; height: 100%; object-fit: cover; }
                
                .activity-meta-col { flex: 1; display: flex; flex-direction: column; justify-content: flex-start; }
                .activity-review-content { background: #111; padding: 15px; border-radius: 6px; color: #ccc; font-size: 0.95rem; line-height: 1.5; margin-top: 10px; position: relative; }
                .activity-review-content::before { content: ''; position: absolute; left: -6px; top: 15px; width: 0; height: 0; border-top: 6px solid transparent; border-bottom: 6px solid transparent; border-right: 6px solid #111; }

                .pfp-full-modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); z-index: 5000; display: flex; align-items: center; justify-content: center; }
                .pfp-full-img-container { width: 280px; height: 280px; border-radius: 50%; overflow: hidden; border: 5px solid var(--accent-color); }

                /* Watchlist Grid Default (Desktop) */
                .watchlist-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
                    gap: 10px;
                }

                @media (max-width: 768px) {
                    .profile-wrapper { width: 95% !important; padding: 1rem !important; }
                    
                    /* Mobile Header Grid - 3 Rows */
                    .collapsible-header-content { 
                        display: grid; 
                        grid-template-columns: auto 1fr; 
                        column-gap: 15px; 
                        row-gap: 10px; /* Gap between rows */
                        max-height: 1000px; /* Allow expansion */
                    }

                    /* 1. Avatar (Top Left) */
                    .profile-avatar-area { 
                        grid-column: 1; 
                        grid-row: 1; 
                        width: 90px; 
                        margin-bottom: 0;
                    }

                    /* Flatten details area to allow children to be grid items */
                    .profile-details-area { display: contents; }

                    /* 2. Name & Follow Button (Top Right) */
                    .user-info-row {
                        grid-column: 2;
                        grid-row: 1;
                        align-self: center;
                        gap: 10px !important;
                    }

                    /* 3. Stats (Row 2 - Full Width - Space Below) */
                    .stats-container {
                        grid-column: 1 / -1;
                        grid-row: 2;
                        width: 100%;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr); /* Force 4 equal columns */
                        justify-items: center;
                        align-items: center;
                        margin-top: 10px;
                        margin-bottom: 10px; /* Space before Bio/Tabs */
                        padding: 5px 0;
                        background: rgba(255,255,255,0.05); /* Subtle separation */
                        border-radius: 8px;
                    }

                    /* 4. Bio (Row 3 - Full Width) */
                    .profile-bio {
                        grid-column: 1 / -1;
                        grid-row: 3;
                        margin-top: 5px;
                        text-align: center; /* Center bio on mobile */
                    }

                    .profile-username { font-size: 1.5rem; }
                    
                    .diary-item { width: 140px; } 
                    .activity-poster-wrapper { width: 80px; }
                    .activity-title { font-size: 1rem; }
                    
                    .favorites-grid { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 20px; scroll-interval: 150px; }
                    .favorite-box { width: 110px; }
                    .pfp-full-img-container { width: 70vw !important; height: 70vw !important; max-width: 300px !important; max-height: 300px !important; }

                    /* Watchlist Grid - 3 Columns on Mobile for better view */
                    .watchlist-grid {
                        grid-template-columns: repeat(3, 1fr);
                        gap: 8px;
                    }

                    .profile-actions-animated { top: 10px; right: 0; }
                }

                /* BASKET MODAL STYLES */
                .basket-modal-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); z-index: 6000; display: flex; alignItems: center; justifyContent: center; }
                .basket-modal-content { background: #111; border: 1px solid #333; width: 90%; max-width: 400px; max-height: 80vh; overflow-y: auto; border-radius: 8px; padding: 20px; position: relative; }
                .basket-header { font-size: 1.5rem; fontWeight: 900; color: #fff; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
                .basket-list { display: flex; flex-direction: column; gap: 10px; }
                .basket-item { display: flex; gap: 15px; align-items: center; background: #000; padding: 10px; border: 1px solid #333; border-radius: 0px; } /* Pure Black & Square */
                .basket-img-wrapper { width: 60px; height: 60px; border: 1px solid #333; position: relative; display: flex; alignItems: center; justifyContent: center; flex-shrink: 0; background: #222; overflow: hidden; }
                .basket-img-wrapper img { width: 100%; height: 100%; object-fit: cover; opacity: 0.6; } 
                .remove-watchlist-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: transparent; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10; }
                .basket-info-col { display: flex; flex-direction: column; justify-content: center; }
                .ep-title { font-weight: 900; color: #fff; font-size: 1rem; line-height: 1.2; }
                `}
            </style>

            {editImageSrc && <ImageCropper imageSrc={editImageSrc} onCancel={() => setEditImageSrc(null)} onSave={handleSaveCropped} />}
            {showFullPFP && profilePhoto && (
                <div className="pfp-full-modal" onClick={() => setShowFullPFP(false)}>
                    <div className="pfp-full-img-container" onClick={e => e.stopPropagation()}>
                        <img src={profilePhoto} alt="Full Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <button style={{ position: 'absolute', top: 20, right: 20, background: 'transparent', color: '#fff', border: 'none', fontSize: '2rem' }}><MdClose /></button>
                </div>
            )}

            {/* BASKET MODAL */}
            {basketModalData && (
                <div className="basket-modal-overlay" onClick={() => setBasketModalData(null)}>
                    <div className="basket-modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div className="basket-header" style={{ marginBottom: 0 }}>SEASON {basketModalData.seasonNumber}</div>
                            <button onClick={() => setBasketModalData(null)} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer' }}><MdClose /></button>
                        </div>

                        <div className="basket-list">
                            {basketModalData.episodes.map(ep => {
                                let cleanTitle = ep.name;
                                if (cleanTitle.includes(': ')) cleanTitle = cleanTitle.split(': ').pop();
                                return (
                                    <div key={ep.id} className="basket-item">
                                        <div className="basket-img-wrapper">
                                            <img src={`https://image.tmdb.org/t/p/w200${ep.still_path || ep.poster_path}`} alt="Ep" />
                                            <button className="remove-watchlist-btn" onClick={() => handleRemoveFromWatchlist(ep)}>
                                                <MdCheck color="var(--accent-color)" />
                                            </button>
                                        </div>
                                        <div className="basket-info-col">
                                            <div className="ep-title">{cleanTitle}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="profile-header-grid" style={{ minHeight: isCollapsed ? '0px' : 'auto' }}>
                <div className={`collapsible-header-content ${isCollapsed ? 'collapsed' : ''}`}>
                    <div className="profile-avatar-area">
                        <div onClick={() => setShowFullPFP(true)} style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-color)', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                            {profilePhoto ? <img src={profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#555' }}>{user.username ? user.username[0].toUpperCase() : 'U'}</div>}
                        </div>
                        <div className="social-icons">
                            {user.instaLink && <a href={user.instaLink} target="_blank" rel="noopener noreferrer" className="social-icon-link"><FaInstagram /></a>}
                            {user.twitterLink && <a href={user.twitterLink} target="_blank" rel="noopener noreferrer" className="social-icon-link"><FaTwitter /></a>}
                            {!user.instaLink && !user.twitterLink && <div style={{ display: 'flex', gap: 10 }}><FaInstagram className="social-icon-link" /><FaTwitter className="social-icon-link" /></div>}
                        </div>
                    </div>
                    <div className="profile-details-area">
                        <div className="user-info-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                            <h1 className="profile-username">{user.username || 'User'}</h1>
                            {!isOwnProfile && (
                                <button
                                    onClick={handleFollowToggle}
                                    className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`}
                                    style={{ fontSize: '0.8rem', padding: '6px 16px' }}
                                >
                                    {isFollowing ? 'UNFOLLOW' : 'FOLLOW'}
                                </button>
                            )}
                        </div>

                        <div className="stats-container">
                            <div className="stats-div" style={{ textAlign: 'center' }}><div className="stats-number">{stats.totalSeasons || 0}</div><div className="stats-label">SEASONS</div></div>
                            <div className="stats-div" style={{ textAlign: 'center' }}><div className="stats-number">{stats.thisYear}</div><div className="stats-label">THIS YEAR</div></div>
                            <Link to={`/profile/${targetUid}/followers`} className="stats-div" style={{ textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                <div className="stats-number">{stats.followers}</div>
                                <div className="stats-label">FOLLOWERS</div>
                            </Link>
                            <Link to={`/profile/${targetUid}/following`} className="stats-div" style={{ textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                                <div className="stats-number">{stats.following}</div>
                                <div className="stats-label">FOLLOWING</div>
                            </Link>
                        </div>
                        <style>{`
                            @media (max-width: 768px) {
                                .stats-label { font-size: 0.55rem !important; letter-spacing: 0px !important; }
                                .stats-number { font-size: 1rem !important; } 
                            }
                        `}</style>
                        {user.bio && <div className="profile-bio">{user.bio}</div>}
                    </div>
                </div>
                {isOwnProfile && (
                    <div className={`profile-actions-animated ${isCollapsed ? 'collapsed-menu' : ''}`} ref={menuRef}>
                        <button onClick={() => setShowMenu(!showMenu)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '1.5rem', padding: '5px' }}><MdMoreVert /></button>
                        {showMenu && (
                            <div className="menu-dropdown">
                                <label className="menu-item" style={{ cursor: 'pointer' }}>Edit Profile PFP<input type="file" hidden onChange={handleFileSelect} accept="image/*" /></label>
                                <button className="menu-item" onClick={() => navigate('/edit-profile')}>Edit Profile Details</button>
                                <button className="menu-item" onClick={() => navigate('/settings')}>Settings</button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <nav className="nav-scroll-container">
                {['Profile', 'Diary', 'Activity', 'Watchlist', 'Liked'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} className="nav-tab-btn" style={{ color: activeTab === tab ? '#FFFFFF' : 'var(--text-muted)', fontWeight: activeTab === tab ? 'bold' : 'normal', borderBottom: activeTab === tab ? '3px solid var(--accent-color)' : '3px solid transparent' }}>
                        {tab}
                    </button>
                ))}
            </nav>

            <main style={{ minHeight: '400px' }}>{renderTabContent()}</main>
        </div >
    );
};

export default Profile;
