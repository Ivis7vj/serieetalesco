import { useState, useEffect, useRef } from 'react';
import { MdSettings, MdEdit, MdPhotoCamera, MdGridOn, MdList, MdStar, MdAdd, MdMoreVert, MdCreate, MdClose, MdCheck, MdLocalFireDepartment } from 'react-icons/md';
import MobileIndicator from '../components/MobileIndicator';
import { useScrollLock } from '../hooks/useScrollLock';
import { FaInstagram, FaTwitter } from 'react-icons/fa';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, limit, orderBy, startAfter } from 'firebase/firestore';


import './Home.css';

// Simple Image Cropper Component
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { useLoading } from '../context/LoadingContext';
import ButtonLoader from '../components/ButtonLoader';
import BannerSearch from '../components/BannerSearch';
import BannerSelection from '../components/BannerSelection';
import BannerViewModal from '../components/BannerViewModal';
import BannerActionModal from '../components/BannerActionModal';
import ActivityFeed from '../components/ActivityFeed';
import * as watchlistService from '../utils/watchlistService';
import * as diaryService from '../utils/diaryService';
import { likesService } from '../utils/likesService';
import { getUserProfileData } from '../utils/profileService';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import { tmdbApi } from '../utils/tmdbApi'; // Fixed import path
import { AnimatePresence } from 'framer-motion';

// Helper for pinch distance
const getTouchDist = (touches) => {
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
};

const ImageCropper = ({ imageSrc, onCancel, onSave }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [pinchDist, setPinchDist] = useState(null);

    const containerRef = useRef(null);
    const imgRef = useRef(null);

    // Ref to access latest state in non-passive event listeners without re-binding
    const stateRef = useRef({
        position: { x: 0, y: 0 },
        zoom: 1,
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        pinchDist: null
    });

    // Sync state to ref
    useEffect(() => {
        stateRef.current = { position, zoom, isDragging, dragStart, pinchDist };
    }, [position, zoom, isDragging, dragStart, pinchDist]);

    // Attach non-passive listeners
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const delta = -e.deltaY * 0.001;
            const currentZoom = stateRef.current.zoom;
            setZoom(Math.min(Math.max(0.2, currentZoom + delta), 5));
        };

        const handleTouchMove = (e) => {
            e.preventDefault(); // Prevent page scroll
            const { isDragging, dragStart, pinchDist, zoom } = stateRef.current;

            if (e.touches.length === 1 && isDragging) {
                setPosition({ x: e.touches[0].pageX - dragStart.x, y: e.touches[0].pageY - dragStart.y });
            } else if (e.touches.length === 2 && pinchDist) {
                const newDist = getTouchDist(e.touches);
                const scaleFactor = newDist / pinchDist;
                setZoom(Math.min(Math.max(0.2, zoom * scaleFactor), 5));
                setPinchDist(newDist);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchmove', handleTouchMove);
        };
    }, []);

    // --- MOUSE EVENTS ---
    const onMouseDown = (e) => {
        if (e.button !== 0) return;
        setIsDragging(true);
        setDragStart({ x: e.pageX - position.x, y: e.pageY - position.y });
        e.stopPropagation();
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!isDragging) return;
        setPosition({ x: e.pageX - dragStart.x, y: e.pageY - dragStart.y });
        e.stopPropagation();
        e.preventDefault();
    };

    const onMouseUp = () => setIsDragging(false);

    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({ x: e.touches[0].pageX - position.x, y: e.touches[0].pageY - position.y });
        } else if (e.touches.length === 2) {
            setIsDragging(false);
            setPinchDist(getTouchDist(e.touches));
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        setPinchDist(null);
    };

    const handleSave = () => {
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const img = imgRef.current;
        if (!img) return;

        // Fill black background first (for zoomed out fit)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);

        // Calculate rendered size to draw 1:1 with view
        const renderWidth = img.offsetWidth;
        const renderHeight = img.offsetHeight;

        // Draw Image at current position with current size
        ctx.drawImage(img, position.x, position.y, renderWidth, renderHeight);

        onSave(canvas.toDataURL('image/jpeg', 0.9));
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.95)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', touchAction: 'none' }}>
            <h3 style={{ color: 'white', marginBottom: '20px' }}>Adjust Profile Photo</h3>
            <div
                ref={containerRef}
                style={{ width: '300px', height: '300px', border: '2px solid var(--accent-color)', position: 'relative', overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab', background: '#000' }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                {/* Guidelines */}
                <div style={{ position: 'absolute', top: '33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', top: '66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', left: '33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 10 }}></div>
                <div style={{ position: 'absolute', left: '66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.2)', pointerEvents: 'none', zIndex: 10 }}></div>

                <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Edit"
                    draggable={false}
                    style={{
                        position: 'absolute',
                        top: position.y,
                        left: position.x,
                        // Flexible width based on zoom, allowing it to be smaller than container
                        width: `${300 * zoom}px`,
                        maxWidth: 'none',
                        userSelect: 'none',
                        transformOrigin: 'top left',
                        willChange: 'width, top, left'
                    }}
                />
            </div>

            {/* Zoom Slider */}
            <div style={{ width: '300px', margin: '20px 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#888', fontSize: '1.2rem' }}>-</span>
                <input
                    type="range"
                    min="0.2"
                    max="5"
                    step="0.01"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                />
                <span style={{ color: '#888', fontSize: '1.2rem' }}>+</span>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', gap: '20px' }}>
                <button onClick={onCancel} style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>CANCEL</button>
                <button onClick={handleSave} style={{ padding: '10px 20px', background: 'var(--accent-color)', color: '#000', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>SAVE</button>
            </div>
            <p style={{ color: '#666', marginTop: '10px', fontSize: '0.8rem', textAlign: 'center' }}>
                Pinch/Scroll to Zoom • Drag to Move
            </p>
        </div>
    );
};

// Helper: Robustly parses a TMDB ID, ensuring it's a number.
const parseTmdbId = (id) => {
    if (!id) return null;
    if (typeof id === 'number') return id;
    if (typeof id === 'string' && id.includes('-S')) {
        const numeric = parseInt(id.split('-S')[0]);
        return isNaN(numeric) ? null : numeric;
    }
    const numeric = parseInt(id);
    if (isNaN(numeric) || (typeof id === 'string' && id.match(/[a-z]/i) && !id.includes('-S'))) return null;
    return numeric;
};

// Helper: Hydrate Likes with TMDB Data (BSOT Rule: No metadata in DB)
const hydrateLikes = async (likesList) => {
    if (!likesList || likesList.length === 0) return [];

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
    const uniqueIds = [...new Set(likesList.map(l => l.tmdbId))];
    const seriesMap = {};

    // Batch Processing to prevent TMDB 429 Errors / Heavy Load
    // Process 5 items at a time with a delay
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);

        // Execute batch in parallel
        const results = await Promise.all(batch.map(async (id) => {
            try {
                // tmdbApi handles backend cache -> TMDB fallback
                return await tmdbApi.getSeriesDetails(id);
            } catch (e) {
                console.warn(`Failed to hydrate series ${id}`, e);
                return null;
            }
        }));

        // Collect results
        results.forEach(series => {
            if (series) seriesMap[series.id] = series;
        });

        // Small delay between batches to respect rate limits (if hit TMDB)
        if (i + BATCH_SIZE < uniqueIds.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return likesList.map(item => {
        const series = seriesMap[item.tmdbId];
        let poster = null;
        let name = 'Unknown Series';

        if (series) {
            poster = series.poster_path;
            name = series.name;
            // Use Season Poster if applicable
            if (item.type === 'SEASON' && item.seasonNumber && series.seasons) {
                const s = series.seasons.find(sea => sea.season_number === item.seasonNumber);
                if (s && s.poster_path) poster = s.poster_path;
            }
        }

        return {
            ...item,
            poster_path: poster,
            seasonPoster: (item.type === 'SEASON') ? poster : null,
            seriesName: name
        };
    });
};

const Profile = () => {
    const { uid } = useParams(); // Get uid from URL if present
    const navigate = useNavigate();
    const { currentUser, logout, globalPosters } = useAuth();
    const { setIsLoading, setLoadingMessage } = useLoading();

    // Determine Target User (URL param > Current User)
    const targetUid = uid || currentUser?.uid;
    const isOwnProfile = !uid || (currentUser && targetUid === currentUser.uid);

    const [user, setUser] = useState(null); // Null means not loaded
    const [stats, setStats] = useState({ thisYear: 0, following: 0, followers: 0 });
    const [activeTab, setActiveTab] = useState('Profile');
    const [profilePhoto, setProfilePhoto] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [editImageSrc, setEditImageSrc] = useState(null);
    const [showFullPFP, setShowFullPFP] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [hasNewActivity, setHasNewActivity] = useState(false);
    const menuRef = useRef(null);

    const isCollapsed = activeTab !== 'Profile';
    const [favorites, setFavorites] = useState([null, null, null, null, null]);
    const [watchlist, setWatchlist] = useState([]);
    const [likes, setLikes] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [watched, setWatched] = useState([]);
    const [activityItems, setActivityItems] = useState([]);
    const [starSeriesIds, setStarSeriesIds] = useState(new Set());
    const [followLoading, setFollowLoading] = useState(false);

    // Profile-specific Posters (Handles \"My View\" vs \"Friend View\")
    const [profilePosters, setProfilePosters] = useState({});

    // Banner & Diary State
    const [showBannerSearch, setShowBannerSearch] = useState(false);
    const [showBannerSelection, setShowBannerSelection] = useState(false);
    const [selectedBannerSeries, setSelectedBannerSeries] = useState(null);
    const [showBannerView, setShowBannerView] = useState(false);
    const [showBannerAction, setShowBannerAction] = useState(false);
    const [detailedEntry, setDetailedEntry] = useState(null); // Selected Diary Entry for Overlay


    // Activity Feed State
    const [userActivityFeed, setUserActivityFeed] = useState([]);
    const { stopLoading } = useLoading();

    // Fetch User Data (Optimized with ProfileService)
    const loadProfileData = async () => {
        if (!targetUid) return;

        // 1. Fetch Aggregated Data
        const { userInfo, diary, watchlist: wl, likes: rawLikes, ratings: dbRatings, activityPreview, userPosters } = await getUserProfileData(targetUid);

        // Set Posters (Own vs Other)
        if (targetUid === currentUser?.uid) {
            setProfilePosters(globalPosters || {});
        } else if (userPosters) {
            setProfilePosters(userPosters);
        }

        if (userInfo) {
            setUser(userInfo);
            setProfilePhoto(userInfo.photoURL);

            // Update Derived State
            const starSeries = userInfo.starSeries || [];
            setStarSeriesIds(new Set(starSeries.map(s => s.id)));

            // Favorites
            const loadedFavs = userInfo.favorites || [];
            const limitedFavs = loadedFavs.slice(0, 5);
            const paddedFavs = [...limitedFavs, ...Array(Math.max(0, 5 - limitedFavs.length)).fill(null)].map(f => {
                if (!f) return null;
                return { ...f, isStar: starSeries.some(s => s.id === f.id) };
            });
            setFavorites(paddedFavs);

            // Stats
            const currentYear = new Date().getFullYear();
            const achievements = userInfo.achievements || [];
            const followedByMe = userInfo.followers?.includes(currentUser?.uid);

            setStats({
                thisYear: achievements.filter(a => a.type === 'season_finish' && new Date(a.date).getFullYear() === currentYear).length,
                following: userInfo.following?.length || 0,
                followers: userInfo.followers?.length || 0,
                streak: userInfo.streak?.current || 0
            });
            setIsFollowing(followedByMe);
        }

        // 2. Set SSOT Data
        setWatchlist(wl);
        setWatched(diary); // Diary
        setUserActivityFeed(activityPreview);

        // 3. Hydrate Likes
        const hydratedLikes = await hydrateLikes(rawLikes);
        setLikes(hydratedLikes);

        // Signal page ready
        stopLoading();
        setPageLoading(false);
    };

    useEffect(() => {
        loadProfileData();

        // Menu Close Handler
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setShowMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };

    }, [targetUid, currentUser]);
    // Removing 'globalPosters' dependency as hydration uses helper or internal logic? 
    // Wait, profilePosters state logic?
    // The previous code had specific logic for profilePosters fetching.
    // I should probably Keep the profilePosters logic separate if services don't handle it.
    // The instructions said "Replace them with ONE call ... profileService.getUserProfileData".
    // Does profileService return user posters? No.
    // So I should keep the existing `profilePosters` useEffect logic found in lines 253-276?
    // The prompt: "No direct DB queries in Profile.jsx".
    // line 259: `supabase.from('user_posters')...`
    // I should move this to profileService or a separate service call? 
    // Prompt says "REMOVE ALL direct queries to: Supabase".
    // So I should have included 'user_posters' in profileService.
    // BUT the prompt didn't list `user_posters` in "Expected return shape". 
    // "Expected return shape: { userInfo, diary, watchlist, likes, ratings, activityPreview }".
    // AND "NO new features".

    // I will KEEP the `profilePosters` fetch separate for now (or move to profileService if permissible, but risk breaking expected shape).
    // Actually, `user_posters` table query IS a Supabase query.
    // User Instructions: "Replace them with ONE call ... profileService.getUserProfileData(uid)".
    // If I leave `user_posters` query, I fail "No direct DB queries".
    // I should Add `userPosters` to `profileService` return? 
    // Or ignore? If I ignore, Profile Posters break.
    // I will Add it to `profileService` implementation in a minute? 
    // Or just leave it as an exception?
    // "Phase 2.7 goal ... Reduce DB reads".
    // If I add it to `profileService`, I reduce network calls.
    // I Will UPDATE `profileService.js` to include `user_posters` fetch.
    // But first, let's look at the replacement block.
    // I need to be careful not to delete the `profilePosters` logic if I don't have replacement.
    // I will leave `profilePosters` logic for a separate tool call to move it to `profileService`? 
    // Step 2 is: "Replace loadProfile and syncSelfData logic". 
    // I will replace `loadProfile` and `syncSelfData`.
    // I will leave `profilePosters` block (lines 253-276) alone for now, because it was separate.
    // Wait, the block I am replacing spans 252-463. This INCLUDES `profilePosters`.
    // If I overwrite valid logic with nothing, I break "Profile loads correctly".
    // I MUST move `user_posters` fetching to `profileService` OR keep the logic.
    // I will KEEP the logic by including it in the new `useEffect` but wrapped inline? 
    // No, "Removes duplicated queries".
    // I WILL UPDATE `profileService.js` to fetch posters too.

    // BUT I cannot update `profileService.js` in this `multi_replace`.
    // Implementation Plan: "Import and reuse existing services: diary, watchlist, likes, ratings".
    // Does not mention `userPosters`.
    // I will assume `userPosters` is minor enough to fetch separately or inline via `supabase-config` import?
    // But explicit rule: "Remove ALL direct queries to Supabase".
    // Okay, I will add `user_posters` to `profileService` in a subsequent step (or previous step, but I already wrote it).
    // I will perform the Profile update assuming I will FIX `profileService` to return posters.
    // I will update `Profile.jsx` to USE `profilePosters` from service.

    // Wait, line 253-276:
    /*
        if (targetUid === currentUser?.uid) {
            setProfilePosters(globalPosters || {});
        } else if (targetUid) {
             // Fetch from Supabase
        }
    */
    // This logic handles "My View" (Context) vs "Friend View" (DB).
    // Service handles DB. 
    // So `getUserProfileData` should return `userPosters` (from DB).
    // In `Profile.jsx`:
    // if (targetUid === currentUser) setProfilePosters(globalPosters)
    // else setProfilePosters(data.userPosters)

    // Okay. Ready.

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
        if (activeTab === 'Reviews' && reviews.length === 0 && hasMoreReviews) {
            fetchReviews(true);
        }
    }, [activeTab, targetUid]);

    // Activity Feed Fetch - REMOVED (Moved to ActivityFeed component)


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
                triggerErrorAutomation(e);
            }
        }
    };

    const [isFollowing, setIsFollowing] = useState(false);

    // Pull to Refresh State
    const [refreshing, setRefreshing] = useState(false);
    const [pullStartY, setPullStartY] = useState(0);
    const [pullProgress, setPullProgress] = useState(0);

    const handleBoxClick = (index) => window.dispatchEvent(new CustomEvent('trigger-search-bar', { detail: { slotIndex: index } }));

    const handleFollowToggle = async () => {
        if (!currentUser || !targetUid || followLoading) return;
        setFollowLoading(true);

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
            triggerErrorAutomation(error);
        } finally {
            setFollowLoading(false);
        }
    };

    // Refresh Logic (Simple Reload)
    const handleTouchStart = (e) => {
        if (window.scrollY === 0) setPullStartY(e.touches[0].clientY);
    };
    const handleTouchMove = (e) => {
        if (!pullStartY) return;
        const y = e.touches[0].clientY;
        const diff = y - pullStartY;
        if (diff > 0 && window.scrollY === 0) {
            setPullProgress(Math.min(diff / 150, 1));
        }
    };
    const handleTouchEnd = (e) => {
        if (pullProgress === 1) {
            setRefreshing(true);
            setPullProgress(0);
            loadProfileData().finally(() => {
                setTimeout(() => setRefreshing(false), 500);
            });
        } else {
            setPullProgress(0);
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
                if (currentGroup && currentGroup.tmdbId === item.tmdbId && currentGroup.seasonNumber === item.seasonNumber && new Date(currentGroup.date).toDateString() === itemDateStr) {
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

    // Banner Handlers
    const handleBannerClick = () => {
        if (isOwnProfile) {
            setShowBannerAction(true);
        } else if (user?.bannerBackdropPath) {
            setShowBannerView(true);
        }
    };

    const handleSeriesForBanner = (series) => {
        setSelectedBannerSeries(series);
        setShowBannerSearch(false);
        setShowBannerSelection(true);
    };

    // Diary Actions
    const handleDiaryClick = (e, item) => {
        e.preventDefault();
        navigate(`/diary/${item.id}`);
    };

    const handleUpdateDiary = async (entryId, updates) => {
        setLoadingMessage('Updating...');
        setIsLoading(true);
        try {
            const result = await updateDiaryEntry(entryId, updates);
            if (result.success) {
                // Optimistic Update
                setWatched(prev => prev.map(item => item.id === entryId ? { ...item, ...updates } : item));
                setReviews(prev => prev.map(item => item.id === entryId ? { ...item, ...updates } : item));
                setDetailedEntry(prev => ({ ...prev, ...updates }));

                // Parallel Background Fetch
                fetchReviews(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteDiary = async (entryId) => {
        setLoadingMessage('Deleting...');
        setIsLoading(true);
        try {
            const result = await deleteDiaryEntry(entryId);
            if (result.success) {
                // Optimistic Update
                setWatched(prev => prev.filter(item => item.id !== entryId));
                setReviews(prev => prev.filter(item => item.id !== entryId));
                setDetailedEntry(null);

                // Parallel Background Fetch
                fetchReviews(true);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useScrollLock(editImageSrc || showFullPFP || showBannerSearch || showBannerSelection || detailedEntry);

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
            // OPTIMISTIC UPDATE: Update local state immediately
            setWatchlist(prev => prev.filter(i => {
                const isSameItem = (i.id || i.tmdb_id) === (itemToRemove.id || itemToRemove.tmdb_id);
                return !isSameItem;
            }));

            // SUPABASE DELETE: Remove from SSOT
            await watchlistService.removeFromWatchlist(currentUser.uid, itemToRemove.id || itemToRemove.tmdb_id);


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
                                                    {(() => {
                                                        const validTmdbId = parseTmdbId(fav.tmdbId || fav.id);
                                                        if (!validTmdbId) return null; // Don't link if ID is malformed

                                                        return (
                                                            <Link to={fav.seasonNumber ? `/tv/${validTmdbId}/season/${fav.seasonNumber}` : `/tv/${validTmdbId}`} style={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'visible' }}>
                                                                <img src={getResolvedPosterUrl(validTmdbId, fav.seasonPoster || fav.poster_path, profilePosters, 'w342') || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'} alt={fav.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            </Link>
                                                        );
                                                    })()}
                                                    {isOwnProfile && <button onClick={(e) => { e.preventDefault(); handleBoxClick(index); }} className="edit-fav-btn"><MdCreate /></button>}
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
                        <div style={{ maxWidth: '100%', paddingBottom: '20px' }}>
                            {Object.keys(groups).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No entries yet.</p> : Object.keys(groups).map((group, i) => (
                                <div key={i} style={{ marginBottom: '2rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '900', color: '#888', marginBottom: '15px', textTransform: 'uppercase', letterSpacing: '1px' }}>{group}</h3>
                                    <div className="diary-grid">
                                        {groups[group].map((item, idx) => {
                                            const dateObj = new Date(item.date);
                                            const dateBadge = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' }).toUpperCase()}`;
                                            const cleanTitle = item.name.replace(/\s*\(Season \d+\)$/, ''); // Strip season text if present

                                            return (
                                                <div key={idx} className="diary-card">
                                                    <div
                                                        onClick={(e) => handleDiaryClick(e, item)}
                                                        className="diary-poster-container"
                                                        style={{ cursor: 'pointer' }}
                                                    >
                                                        <img
                                                            src={getResolvedPosterUrl(item.tmdbId, item.posterPath || item.poster_path, profilePosters, 'w342') || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'}
                                                            alt={item.name}
                                                        />
                                                        {/* DATE BADGE ONLY */}
                                                        <div className="diary-poster-date">
                                                            {dateBadge}
                                                        </div>
                                                        {item.seasonNumber && (
                                                            <div className="diary-season-badge">S{item.seasonNumber}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div >
                    );
                case 'Activity':
                    // Uses Single Aggregated Feed
                    return (
                        <div className="activity-feed">
                            <ActivityFeed userId={targetUid} feed={userActivityFeed} />
                        </div>
                    );
                case 'Watchlist':
                case 'Liked':
                    if (activeTab === 'Liked') {
                        return (
                            <div className="watchlist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '10px' }}>
                                {likes.filter(i => i.type !== 'like_review').map(item => (
                                    <div key={item.id} style={{ position: 'relative', paddingTop: starSeriesIds.has(item.tmdbId || item.id) ? '0' : '0', paddingLeft: '0' }}>
                                        <Link to={item.seasonNumber ? `/tv/${item.tmdbId}/season/${item.seasonNumber}` : `/tv/${item.tmdbId}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative', overflow: 'visible' }}>
                                            <img src={getResolvedPosterUrl(item.tmdbId, item.seasonPoster || item.poster_path, profilePosters, 'w500') || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
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
                                        <div
                                            key={idx}
                                            onClick={() => navigate(`/watchlist/season/${item.seriesId}/${item.seasonNumber}`)}
                                            style={{ cursor: 'pointer', display: 'block', width: '100%', border: '1px solid var(--border-color)', aspectRatio: '2/3', position: 'relative', overflow: 'hidden' }}
                                        >
                                            <img src={getResolvedPosterUrl(item.tmdbId, item.poster_path, profilePosters, 'w500') || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                            {/* Basket Badges */}
                                            <div className="diary-season-badge" style={{ bottom: '6px', right: '6px', top: 'auto', fontSize: '0.8rem', padding: '4px 6px', position: 'absolute', zIndex: 5, background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>S{item.seasonNumber}</div>
                                            <div className="diary-eps-badge" style={{ bottom: '6px', right: '6px', fontSize: '0.75rem' }}>{item.episodeCount} EPS</div>
                                        </div>
                                    );
                                } else {
                                    // Whole Series
                                    return (
                                        <div key={idx} style={{ position: 'relative', overflow: 'visible', paddingTop: starSeriesIds.has(item.tmdbId) ? '20px' : '0', paddingLeft: starSeriesIds.has(item.tmdbId) ? '20px' : '0' }}>
                                            <Link to={`/tv/${item.tmdbId}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative', overflow: 'visible' }}>
                                                <img src={getResolvedPosterUrl(item.tmdbId, item.poster_path, profilePosters, 'w500') || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', position: 'relative', zIndex: 1 }} />
                                                {item.seasonNumber && (
                                                    <div className="diary-season-badge" style={{ bottom: '6px', right: '6px', top: 'auto', fontSize: '0.8rem', padding: '4px 6px', position: 'absolute', zIndex: 5, background: 'rgba(0,0,0,0.8)', color: '#fff', borderRadius: '4px', fontWeight: 'bold' }}>S{item.seasonNumber}</div>
                                                )}
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

    if (pageLoading && !user) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
                <ButtonLoader size="40px" color="var(--accent-color)" />
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '80px', minHeight: '100vh', background: '#000' }}>
            {/* Banner Section */}
            <div
                className="profile-banner-container"
                onClick={handleBannerClick}
                style={{
                    width: '100%',
                    aspectRatio: '3.5/1', // Twitter-like ultra wide
                    maxHeight: '400px',
                    minHeight: '180px',
                    background: user?.bannerBackdropPath
                        ? `url(https://image.tmdb.org/t/p/w1280${user?.bannerBackdropPath}) center center/cover no-repeat`
                        : '#1a1a1a', // Dark clean grey if empty
                    position: 'relative',
                    cursor: 'pointer',
                    marginBottom: '-80px', // Avatar overlap
                    maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
                    WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)'
                }}
            >
                {/* Mobile Responsive Style Injection */}
                <style>{`
                    @media (max-width: 768px) {
                        .profile-banner-container {
                            aspect-ratio: 2.2/1 !important; /* Taller on mobile to show more height/faces */
                            min-height: 180px !important;
                            margin-bottom: -60px !important;
                        }
                    }
                `}</style>

                {!user?.bannerBackdropPath && isOwnProfile && (
                    <div style={{
                        position: 'absolute',
                        top: '40%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        color: '#666',
                        zIndex: 2,
                        pointerEvents: 'none' // Click passes to container
                    }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px' }}>Add profile banner</div>
                        <div style={{ fontSize: '0.9rem' }}>Choose from your favorite series</div>
                    </div>
                )}

                {/* Gradient Overlay for Readability - ALWAYS */}
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
                    pointerEvents: 'none'
                }} />

                {/* REMOVED: Edit Button/Badge */}
            </div>

            <div
                className="profile-wrapper"
                style={{ width: '90%', margin: '0 auto', maxWidth: '1200px', padding: '2rem 0', color: 'var(--text-primary)', position: 'relative', zIndex: 10 }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {(refreshing || pullProgress > 0) && (
                    <div style={{
                        position: 'fixed',
                        top: `calc(var(--safe-top) + ${70 + (pullProgress * 40)}px)`,
                        left: '50%',
                        transform: `translateX(-50%)`,
                        zIndex: 9999,
                        background: 'rgba(26,26,26,0.95)',
                        padding: '12px',
                        borderRadius: '50%',
                        backdropFilter: 'blur(8px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        border: '1px solid #333',
                        opacity: refreshing ? 1 : pullProgress,
                        transition: pullProgress > 0 ? 'none' : 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <div
                            className={refreshing ? "loading-circle" : ""}
                            style={{
                                width: '24px',
                                height: '24px',
                                border: '3px solid #333',
                                borderTop: '3px solid #FFCC00',
                                borderRadius: '50%',
                                animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
                                transform: refreshing ? 'none' : `rotate(${pullProgress * 360}deg)`
                            }}
                        />
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

                .nav-scroll-container { display: flex; overflow-x: auto; white-space: nowrap; scrollbar-width: none; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); margin-bottom: 2rem; margin-top: 1rem; width: 100%; -webkit-overflow-scrolling: touch; }
                .nav-scroll-container::-webkit-scrollbar { display: none; }
                .nav-tab-btn { padding: 15px 25px; font-size: 1rem; background: transparent; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; flex-shrink: 0; }

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
                /* NEW DIARY GRID STYLES */
                .diary-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr; /* 2 Column Mobile First */
                    gap: 15px;
                }

                .diary-card {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .diary-poster-container {
                    display: block;
                    width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: 14px;
                    overflow: hidden;
                    position: relative;
                    background: #222; /* Loading placeholder */
                }

                .diary-poster-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                /* DATE BADGE ON POSTER */
                .diary-poster-date {
                    position: absolute;
                    top: 8px;
                    left: 8px;
                    background: rgba(0, 0, 0, 0.85); /* Solid dark background */
                    color: #fff;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.75rem;
                    font-family: inherit;
                    font-weight: 800;
                    letter-spacing: 0.5px;
                    z-index: 10;
                    pointer-events: none;
                }

                .diary-season-badge {
                    position: absolute !important;
                    bottom: 8px !important;
                    right: 8px !important;
                    background: rgba(0, 0, 0, 0.85) !important;
                    color: #FFD600 !important;
                    padding: 4px 8px !important;
                    border-radius: 6px !important;
                    font-size: 0.75rem !important;
                    font-weight: 800 !important;
                    z-index: 10 !important;
                }

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
                        grid-template-columns: repeat(3, 1fr); /* Adjusted to 3 cols */
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
                .remove-watchlist-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: transparent; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justifyContent: center; z-index: 10; }
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



                <div className="profile-header-grid" style={{ minHeight: isCollapsed ? '0px' : 'auto' }}>
                    <div className={`collapsible-header-content ${isCollapsed ? 'collapsed' : ''}`}>
                        <div className="profile-avatar-area">
                            <div onClick={() => setShowFullPFP(true)} style={{ width: '100%', aspectRatio: '1/1', borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--accent-color)', background: 'var(--bg-tertiary)', cursor: 'pointer' }}>
                                {profilePhoto ? <img src={profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#555' }}>{(user?.username || 'U')[0].toUpperCase()}</div>}
                            </div>
                            <div className="social-icons">
                                {user?.instaLink && <a href={user?.instaLink} target="_blank" rel="noopener noreferrer" className="social-icon-link"><FaInstagram /></a>}
                                {user?.twitterLink && <a href={user?.twitterLink} target="_blank" rel="noopener noreferrer" className="social-icon-link"><FaTwitter /></a>}
                                {!user?.instaLink && !user?.twitterLink && <div style={{ display: 'flex', gap: 10 }}><FaInstagram className="social-icon-link" /><FaTwitter className="social-icon-link" /></div>}
                            </div>
                        </div>
                        <div className="profile-details-area">
                            <div className="user-info-row" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                                <h1 className="profile-username">{user?.username || 'User'}</h1>
                                {!isOwnProfile && (
                                    <button
                                        onClick={handleFollowToggle}
                                        className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`}
                                        style={{ fontSize: '0.8rem', padding: '6px 16px', minWidth: '85px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                        disabled={followLoading}
                                    >
                                        {followLoading ? <ButtonLoader size="14px" color={isFollowing ? "#fff" : "#000"} /> : (isFollowing ? 'UNFOLLOW' : 'FOLLOW')}
                                    </button>
                                )}
                            </div>

                            <div className="stats-container">
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
                            {user?.bio && <div className="profile-bio">{user?.bio}</div>}
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



                <div className="nav-scroll-container hide-scrollbar">
                    {['Profile', 'Diary', 'Activity', 'Watchlist', 'Liked'].map(tab => (
                        <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'Activity') { setHasNewActivity(false); if (userActivityFeed[0]) localStorage.setItem(`lastSeenActivity_${currentUser.uid}`, userActivityFeed[0]?.createdAt); } }} className="nav-tab-btn" style={{ position: 'relative', color: activeTab === tab ? '#FFFFFF' : 'var(--text-muted)', fontWeight: activeTab === tab ? 'bold' : 'normal', borderBottom: activeTab === tab ? '3px solid var(--accent-color)' : '3px solid transparent' }}>
                            {tab}
                            {tab === 'Diary' && <MobileIndicator id="diary-tab-tip" message="Your itemized tracking history" position="bottom" />}
                            {tab === 'Activity' && hasNewActivity && <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', background: '#FF4136', borderRadius: '50%' }}></div>}
                        </button>
                    ))}
                </div>

                <main style={{ minHeight: '400px' }}>{renderTabContent()}</main>
            </div>

            {/* Modals */}
            {editImageSrc && <ImageCropper imageSrc={editImageSrc} onCancel={() => setEditImageSrc(null)} onSave={handleSaveCropped} />}
            {showFullPFP && <div className="full-pfp-modal" onClick={() => setShowFullPFP(false)}><img src={profilePhoto} alt="Full PFP" /></div>}

            {/* Banner Modals */}
            {showBannerSearch && (
                <BannerSearch
                    onClose={() => setShowBannerSearch(false)}
                    onSelectSeries={handleSeriesForBanner}
                />
            )}
            {showBannerSelection && selectedBannerSeries && (
                <BannerSelection
                    series={selectedBannerSeries}
                    onClose={() => setShowBannerSelection(false)}
                    onBack={() => { setShowBannerSelection(false); setShowBannerSearch(true); }}
                    onSelectSeries={(s) => setSelectedBannerSeries(s)}
                />
            )}
            {showBannerView && user?.bannerBackdropPath && (
                <BannerViewModal
                    src={`https://image.tmdb.org/t/p/original${user?.bannerBackdropPath}`}
                    onClose={() => setShowBannerView(false)}
                />
            )}
            {showBannerAction && (
                <BannerActionModal
                    onClose={() => setShowBannerAction(false)}
                    onSearch={() => { setShowBannerAction(false); setShowBannerSearch(true); }}
                    lastUpdated={user?.bannerUpdatedAt}
                />
            )}


        </div >
    );
};

export default Profile;
