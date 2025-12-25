import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MdStar, MdStarBorder, MdStarHalf, MdAdd, MdRemove, MdCreate, MdFavorite, MdFavoriteBorder, MdVisibility, MdVisibilityOff, MdKeyboardArrowDown, MdKeyboardArrowUp, MdClose, MdShare, MdCheck, MdIosShare, MdRateReview, MdArrowBack, MdPlayArrow, MdEdit, MdSentimentSatisfiedAlt, MdSentimentNeutral, MdSentimentVeryDissatisfied, MdHeartBroken, MdCelebration, MdMovie, MdInfo } from 'react-icons/md';
import { FaArrowLeft } from 'react-icons/fa';
import ReviewModal from '../components/ReviewModal';
import PosterUnlockPopup from '../components/PosterUnlockPopup';
import { useScrollLock } from '../hooks/useScrollLock';

import MobileIndicator from '../components/MobileIndicator';
import { useLoading } from '../context/LoadingContext';
import ButtonLoader from '../components/ButtonLoader';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { getWatchedEpisodes, markEpisodeWatched, unmarkEpisodeWatched, markSeasonWatched } from '../utils/watchedService';
import * as watchlistService from '../utils/watchlistService';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, query, where, getDocs, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../firebase-config';

import { logActivity } from '../utils/activityLogger';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import { getResolvedPosterUrl, resolvePoster } from '../utils/globalPosterResolver';
import * as reviewService from '../utils/reviewService';
import * as ratingsService from '../utils/ratingsService';
import * as diaryService from '../utils/diaryService';
import { likesService } from '../utils/likesService';
import { tmdbApi } from '../utils/tmdbApi';
import gsap from 'gsap';
import './Home.css';

const MovieDetails = () => {
    const { id, seasonNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData, globalPosters } = useAuth(); // Get Access to Auth
    const { confirm } = useNotification();
    const { setIsLoading, stopLoading } = useLoading();
    const type = 'tv';

    const [details, setDetails] = useState(null);
    const [cast, setCast] = useState([]);
    const [crew, setCrew] = useState([]);
    const [reviewsData, setReviewsData] = useState([]);
    const [watchProviders, setWatchProviders] = useState(null);


    const [loading, setLoading] = useState(true);
    const [inWatchlist, setInWatchlist] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [limitPopupVisible, setLimitPopupVisible] = useState(false);
    const [error, setError] = useState(null); // Add Error State
    // Micro-loading states
    const [actionLoading, setActionLoading] = useState({
        watchlist: false,
        watched: false,
        share: false
    });

    // Animation Ref
    const heartRef = useRef(null);
    const brokenHeartRef = useRef(null);

    // Double Tap Logic
    const lastTapRef = useRef(0);
    const handlePosterClick = (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTapRef.current;
        if (tapLength < 300 && tapLength > 0) {
            handlePosterDoubleTap(e);
        }
        lastTapRef.current = currentTime;
    };

    const handlePosterDoubleTap = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!(await checkAuth())) return;

        const wasLiked = isLiked; // Capture state BEFORE toggle

        // Trigger Like Logic
        toggleLike();

        // GSAP Animation
        const targetRef = wasLiked ? brokenHeartRef : heartRef;
        const scaleVal = 2.5; // ROLLOBCK: Restored to original impactful size

        if (targetRef.current) {
            const tl = gsap.timeline();
            if (!wasLiked) {
                // LIKE ANIMATION (Pop)
                tl.fromTo(targetRef.current,
                    { scale: 0, opacity: 0, rotation: -45 },
                    { scale: scaleVal, opacity: 1, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" }
                )
                    .to(targetRef.current, { scale: 0, opacity: 0, duration: 0.3, delay: 0.2, ease: "power2.in" });
            } else {
                // UNLIKE ANIMATION (Break)
                tl.fromTo(targetRef.current,
                    { scale: 0, opacity: 0, rotation: 0 },
                    { scale: scaleVal, opacity: 1, rotation: 0, duration: 0.4, ease: "back.out(1.7)" }
                )
                    .to(targetRef.current, { rotation: -15, duration: 0.1, yoyo: true, repeat: 3 }) // Shake
                    .to(targetRef.current, { scale: 0, opacity: 0, y: 50, duration: 0.4, ease: "power2.in" }); // Drop
            }
        }
    };



    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';




    const [seasonDetails, setSeasonDetails] = useState(null);
    const [isWatched, setIsWatched] = useState(false);

    // Popup State
    const [showPosterUnlockPopup, setShowPosterUnlockPopup] = useState(false);
    const [posterUnlockData, setPosterUnlockData] = useState(null);
    const [posterUrl, setPosterUrl] = useState(null); // Added missing state

    // Poster Edit & Scroll State
    const posterContainerRef = useRef(null);
    const [showEditHint, setShowEditHint] = useState(false);
    const [isEditButtonGlowing, setIsEditButtonGlowing] = useState(false);

    // Custom Season Popup State
    const [isSeasonPopupOpen, setIsSeasonPopupOpen] = useState(false);

    // Selected Season (must be declared before useEffect that uses it)
    const [selectedSeason, setSelectedSeason] = useState(seasonNumber ? parseInt(seasonNumber) : 1);

    // Derived Season Progress
    const [seasonProgress, setSeasonProgress] = useState({
        completed: false,
        rated: false,
        selectedPoster: null
    });

    // Track previous completion state to trigger popup only on NEW completion
    const prevCompletedRef = useRef(false);



    const handlePopupClose = () => {
        setShowPosterUnlockPopup(false);
        // Trigger Auto-Scroll flow
        triggerAutoScroll();
    };

    const handleSeasonCompletionClose = () => {
        setShowSeasonCompletion(false);
        triggerAutoScroll(); // Reuse the same logic
    };

    const triggerAutoScroll = () => {
        if (posterContainerRef.current) {
            // 1. Scroll to poster (Always scroll when triggered)
            posterContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // 2. Highlight button (Only if completed)
            if (seasonProgress.completed) {
                setIsEditButtonGlowing(true);
                setShowEditHint(true);

                // 3. Timer to remove glow/hint
                setTimeout(() => {
                    setIsEditButtonGlowing(false);
                    setShowEditHint(false);
                }, 5000);
            }
        }
    };

    const canEditPoster = () => {
        if (!userData?.lastPosterEditAt) return true;

        const lastEdit = new Date(userData.lastPosterEditAt).getTime();
        const now = new Date().getTime();
        const twentyFourHours = 24 * 60 * 60 * 1000;

        return (now - lastEdit) >= twentyFourHours;
    };

    const handleEditClick = () => {
        if (!canEditPoster()) {
            setLimitPopupVisible(true);
            return;
        }
        navigate(`/tv/${details.id}/season/${selectedSeason}/poster`);
    };


    // Review Modal State
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewingItem, setReviewingItem] = useState(null);
    const [existingReviewData, setExistingReviewData] = useState(null);

    // Episode Tracking
    const [episodeWatchedIDs, setEpisodeWatchedIDs] = useState(new Set()); // Use Set for efficient lookup
    const [episodeWatchlistIDs, setEpisodeWatchlistIDs] = useState([]);
    const [showSeasonCompletion, setShowSeasonCompletion] = useState(false);
    const [completedSeasonInfo, setCompletedSeasonInfo] = useState(null);
    const [isSeasonOpen, setIsSeasonOpen] = useState(false);

    // Global Scroll Lock for inline popups
    useScrollLock(showSeasonCompletion || limitPopupVisible);

    // AUTO-CLOSE SEASON COMPLETION AFTER 3 SECONDS
    useEffect(() => {
        if (showSeasonCompletion) {
            const timer = setTimeout(() => {
                handleSeasonCompletionClose();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [showSeasonCompletion]);

    // Fetch Watched Status from Supabase (SSOT)
    useEffect(() => {
        const fetchWatched = async () => {
            // Clear state if no user or id
            if (!currentUser || !details?.id) {
                if (!currentUser) setEpisodeWatchedIDs(new Set());
                return;
            }

            const watchedList = await getWatchedEpisodes(currentUser.uid, details.id);
            const newSet = new Set(watchedList.map(w => `${w.season}-${w.episode}`));
            setEpisodeWatchedIDs(newSet);
        };
        fetchWatched();
    }, [currentUser, details?.id]);

    // Filter User Series Review (for Action Button State) - Keeping Series Level
    const userSeriesReview = reviewsData.find(r => r.tmdbId === parseInt(id || 0) && r.userId === currentUser?.uid && !r.isEpisode && !r.isSeason);
    // Find User Season Review
    const userSeasonReview = reviewsData.find(r => r.tmdbId === parseInt(id || 0) && r.userId === currentUser?.uid && r.isSeason && r.seasonNumber === selectedSeason);
    const [episodes, setEpisodes] = useState([]);
    const [seasonsValues, setSeasonsValues] = useState([]);

    // Review Likes State
    const [reviewLikes, setReviewLikes] = useState({});
    const [shareModal, setShareModal] = useState({ isOpen: false, imageUrl: '' });

    // EFFECT: Calculate Season Progress (Moved here to avoid TDZ for 'episodes')
    useEffect(() => {
        if (details && selectedSeason && episodes.length > 0) {
            // 1. Calculate Completion locally (Source of Truth: episodeWatchedIDs)
            const seasonEpisodes = episodes.filter(ep => ep.season_number === Number(selectedSeason));
            const totalEpisodes = seasonEpisodes.length;

            let completedCount = 0;
            seasonEpisodes.forEach(ep => {
                if (episodeWatchedIDs.has(`${ep.season_number}-${ep.episode_number}`)) {
                    completedCount++;
                }
            });

            const isCompleted = totalEpisodes > 0 && completedCount === totalEpisodes;

            // 2. Check Global Poster
            const resolvedPoster = globalPosters?.[details.id] || null;

            // 3. Trigger Popup if newly completed
            if (isCompleted && !prevCompletedRef.current) {
                // Logic to handle popup if needed, or rely on button glow
            }

            setSeasonProgress({
                completed: isCompleted,
                rated: false,
                selectedPoster: resolvedPoster
            });

            // Update Ref
            prevCompletedRef.current = isCompleted;
        }
    }, [details, selectedSeason, episodes, episodeWatchedIDs, globalPosters]);

    // Helper Functions (need to be defined before computed values)
    const fetchSeasonEpisodes = useCallback(async (seriesId, seasonNum, seriesNameOverride = null) => {
        try {
            // Phase 3: Backend Cache
            const data = await tmdbApi.getSeasonDetails(seriesId, seasonNum);
            const videosData = data.videos || {};
            // const data = await res.json(); // Replaced
            // const videosData = await videosRes.json(); // Replaced

            let episodes = data.episodes || [];

            // OMDb Integration for Season Ratings
            const nameToUse = seriesNameOverride || details?.name;
            if (nameToUse) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

                    const omdbRes = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(nameToUse)}&Season=${seasonNum}&apikey=15529774`, {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    const omdbData = await omdbRes.json();

                    if (omdbData.Response === "True" && omdbData.Episodes) {
                        // Merge ratings
                        episodes = episodes.map(ep => {
                            const omdbEp = omdbData.Episodes.find(o => o.Episode === String(ep.episode_number));
                            return omdbEp ? { ...ep, omdbRating: omdbEp.imdbRating } : ep;
                        });
                    }
                } catch (e) {
                    console.warn("OMDb Season fetch failed (Skipped):", e.name === 'AbortError' ? 'Timeout' : e.message);
                }
            }

            setEpisodes(episodes);
            setSeasonDetails({ ...data, videos: videosData });

            // Trailer implementation removed for stability

            setLoading(false);
            stopLoading();
        } catch (err) {
            console.error("Failed to fetch episodes", err);
            setLoading(false);
            stopLoading();
        }
    }, [details?.name]);


    // FETCH DETAILS EFFECT (Restored)

    const getSeasonName = (seasonNum) => {
        const season = seasonsValues.find(s => s.season_number === seasonNum);
        return season && season.name ? season.name : `Season ${seasonNum}`;
    };

    const getCurrentSeasonRating = () => {
        // Filter reviews for THIS specific series and season
        // Include BOTH Episode-level reviews AND the Season-level review itself
        const seasonReviews = reviewsData.filter(r =>
            Number(r.tmdbId) === Number(id) &&
            Number(r.seasonNumber) === Number(selectedSeason) &&
            (r.isEpisode || r.isSeason)
        );

        if (seasonReviews.length === 0) return { avg: "0.0", count: 0 };
        const sum = seasonReviews.reduce((acc, r) => acc + (parseFloat(r.rating) || 0), 0);
        return { avg: (sum / seasonReviews.length).toFixed(1), count: seasonReviews.length };
    };

    // Computed Values
    const getEnglishTitle = () => {
        if (!details) return 'Loading...';
        if (details.translations?.translations) {
            const enTranslation = details.translations.translations.find(t => t.iso_639_1 === 'en');
            if (enTranslation && enTranslation.data?.name) return enTranslation.data.name;
        }
        return details.name;
    };

    const getEnglishLogo = () => {
        if (!details?.images?.logos) return null;
        // Priority 1: English logos
        const enLogos = details.images.logos.filter(l => l.iso_639_1 === 'en');
        if (enLogos.length > 0) return enLogos[0].file_path;
        // Priority 2: Logos with no language (often stylized English)
        const noLangLogos = details.images.logos.filter(l => !l.iso_639_1);
        if (noLangLogos.length > 0) return noLangLogos[0].file_path;
        // Priority 3: Fallback to first available logo
        return details.images.logos[0]?.file_path;
    };

    const title = getEnglishTitle();
    const logoFilePath = getEnglishLogo();
    const seasonStats = getCurrentSeasonRating();

    // START INSERT FOR POSTER SYNC
    // INITIAL POSTER RESOLVE
    useEffect(() => {
        if (details?.poster_path) {
            const resolved = resolvePoster(details.id, details.poster_path, globalPosters);
            setPosterUrl(resolved);
        }
    }, [details, globalPosters]); // Re-run if globalPosters changes

    // LISTENER FOR IMMEDIATE POSTER UPDATE (From Popup)
    useEffect(() => {
        const handlePosterUpdate = (e) => {
            if (e.detail && e.detail.seriesId == id) { // Loose compare for string/num
                console.log("⚡ POSTER UPDATED EVENT RECEIVED!", e.detail.newPoster);
                setPosterUrl(e.detail.newPoster);
            }
        };
        window.addEventListener('poster-updated', handlePosterUpdate);
        return () => window.removeEventListener('poster-updated', handlePosterUpdate);
    }, [id]);
    // END INSERT



    // Check if all episodes in a season are completed

    // Check if all episodes in a season are completed
    const checkSeasonCompletion = (seasonNumber) => {
        if (!seasonNumber || !episodes || !userData) return false;

        // Get all episode IDs for this season
        const seasonEpisodeIds = episodes
            .filter(ep => ep.season_number === seasonNumber)
            .map(ep => ep.id);

        if (seasonEpisodeIds.length === 0) return false;

        // Check if all are in userData.watched
        const watchedEpisodeIds = (userData.watched || [])
            .filter(w => w.isEpisode && w.seasonNumber === seasonNumber)
            .map(w => w.episodeId || w.id);

        // Season is complete if all episode IDs are in watched
        return seasonEpisodeIds.every(id => watchedEpisodeIds.includes(id));
    };

    // Handle season completion flow - unlock posters
    const handleSeasonCompletedFlow = async (seasonNumber) => {
        if (!currentUser || !details) return;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) return;

            const data = userSnap.data();
            const completedKey = String(details.id);
            const completedSeasons = data.completedSeasons?.[completedKey] || [];
            const seasonNum = Number(seasonNumber); // Ensure it's a number

            console.log('✅ Marking season complete:', {
                seriesId: details.id,
                seasonNumber: seasonNum,
                completedKey,
                existingCompletedSeasons: completedSeasons,
                alreadyCompleted: completedSeasons.includes(seasonNum)
            });

            // Check if already marked as completed
            if (!completedSeasons.includes(seasonNum)) {
                // Mark as completed (ALWAYS store as number)
                await updateDoc(userRef, {
                    [`completedSeasons.${completedKey}`]: arrayUnion(seasonNum)
                });

                console.log('💾 Saved to Firestore:', { completedKey, seasonNum });

                // CRITICAL: Update local state immediately so Edit button appears
                setSeasonProgress(prev => ({
                    ...prev,
                    completed: true
                }));

                // Show unlock popup (New Design)
                setShowSeasonCompletion(true);
                // We can still set this for data if needed, but new popup is static text
                setPosterUnlockData({
                    seriesId: details.id,
                    seasonNumber: seasonNumber,
                    seriesName: details.name
                });
            }
        } catch (error) {
            console.error("Season completion error:", error);
        }
    };


    const handleShare = (reviewItem, isEpisodeArg = false, isSeasonArg = false) => {
        // Fallback to reviewItem properties if arguments are not provided (e.g. from ReviewsDrawer)
        const isEpisode = isEpisodeArg || reviewItem.isEpisode;
        const isSeason = isSeasonArg || reviewItem.isSeason;

        // Resolve Poster Path & Season Info
        let seasonEpisodeText = null;

        const targetSeasonNum = Number(reviewItem.seasonNumber || (isSeason ? seasonNumber : null));

        // Use Global Resolution Utility - resolvePoster now comes from globalPosterResolver
        let posterPathToUse = resolvePoster(details.id, details.poster_path, globalPosters);

        const foundSeason = targetSeasonNum ? seasonsValues.find(s => s.season_number === targetSeasonNum) : null;

        // Fallback Logic if resolvePoster returned default but we have a season-specific TMDB poster
        if (posterPathToUse === details.poster_path && foundSeason && foundSeason.poster_path) {
            posterPathToUse = foundSeason.poster_path;
        }

        // Try to use Season Poster if available (more specific)
        if (foundSeason && foundSeason.poster_path) {
            posterPathToUse = foundSeason.poster_path;
        } else if (isSeason && seasonDetails?.poster_path) {
            // Fallback to seasonDetails if it matches
            posterPathToUse = seasonDetails.poster_path;
        }

        // Set Label Text
        if (isEpisode) {
            seasonEpisodeText = `S${reviewItem.seasonNumber} E${reviewItem.episodeNumber}`;
        } else if (isSeason) {
            seasonEpisodeText = `S${reviewItem.seasonNumber}`;
        }

        const stickerDataToPass = {
            movie: {
                name: details.name,
                poster_path: posterPathToUse,
                seasonEpisode: seasonEpisodeText
            },
            rating: reviewItem?.rating ? (parseFloat(reviewItem.rating) <= 5 ? parseFloat(reviewItem.rating) * 2 : parseFloat(reviewItem.rating)) : 0,
            user: {
                username: userData?.username || currentUser?.displayName || reviewItem.userName || 'User',
                photoURL: reviewItem.photoURL || currentUser?.photoURL,
                uid: reviewItem.userId || currentUser?.uid
            },
            isEpisodes: isEpisode,
            seasonCompleted: isSeason ? checkSeasonCompletion(reviewItem.seasonNumber) : false
        };

        navigate('/share-sticker', { state: { stickerData: stickerDataToPass } });
    };

    useEffect(() => {
        try {
            const raw = localStorage.getItem('reviewLikes');
            if (raw && raw !== "[object Object]") {
                const savedReviewLikes = JSON.parse(raw);
                setReviewLikes(savedReviewLikes || {});
            } else {
                setReviewLikes({});
            }
        } catch (e) {
            console.error("Error parsing reviewLikes from localStorage:", e);
            setReviewLikes({});
            localStorage.setItem('reviewLikes', '{}');
        }
    }, []);

    // Reviews Fetch (Dual-Read: Supabase → Firebase Fallback)
    useEffect(() => {
        if (!id) return;

        const fetchReviews = async () => {
            const reviews = await reviewService.getSeriesReviews(parseInt(id));
            setReviewsData(reviews);
        };

        fetchReviews();

        // Poll for updates every 10 seconds (replace real-time listener)
        const interval = setInterval(fetchReviews, 10000);
        return () => clearInterval(interval);
    }, [id, seasonNumber]);

    const toggleReviewLike = async (reviewId) => {
        if (!currentUser) return;
        const reviewRef = doc(db, 'reviews', reviewId);

        // Optimistic update locally
        setReviewsData(prev => prev.map(r => {
            if (r.id === reviewId) {
                const hasLiked = r.likes?.includes(currentUser.uid);
                return {
                    ...r,
                    likes: hasLiked ? r.likes.filter(id => id !== currentUser.uid) : [...(r.likes || []), currentUser.uid]
                };
            }
            return r;
        }));

        // Fire and forget (or handle error logic, but for UI speed we optimistically update)
        const reviewDoc = await getDoc(reviewRef);
        if (reviewDoc.exists()) {
            const data = reviewDoc.data();
            const hasLiked = data.likes?.includes(currentUser.uid);
            if (hasLiked) {
                await updateDoc(reviewRef, { likes: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(reviewRef, { likes: arrayUnion(currentUser.uid) });
            }
        }
    };

    useEffect(() => {
        const fetchSeriesData = async () => {
            if (!id) return;
            setIsLoading(true);
            setLoading(true);
            try {
                // Phase 3: Use Backend Cache Service (Aggregated Data)
                const data = await tmdbApi.getSeriesDetails(id);

                const detailsData = data;
                const creditsData = data.credits || {};
                const providersData = data['watch/providers'] || {};
                const externalIdsData = data.external_ids || {};

                // Set Watch Providers (Prioritize IN, then US)
                setWatchProviders(providersData.results?.IN || providersData.results?.US || null);

                setDetails(detailsData);
                setCast(creditsData.cast?.slice(0, 20) || []); // Top 20 cast

                // Get creators or executive producers for "Director" equivalent in TV
                const creators = detailsData.created_by || [];
                setCrew(creators);

                if (detailsData.seasons) {
                    setSeasonsValues(detailsData.seasons.filter(s => s.season_number > 0)); // Skip Specials (S0) usually
                }

                checkUser(detailsData.id);
            } catch (error) {
                console.error("Series Data Fetch Error:", error);
                setLoading(false);
                stopLoading();
            }
        };

        fetchSeriesData();
    }, [id]);

    useEffect(() => {
        const fetchSeasonData = async () => {
            if (!id || !details) return;

            // If we have seasons, fetch the selected one
            if (details.seasons && details.seasons.length > 0) {
                const seasonToFetch = seasonNumber ? parseInt(seasonNumber) : 1;
                setSelectedSeason(seasonToFetch); // Ensure state sync
                fetchSeasonEpisodes(id, seasonToFetch, details.name);
            } else {
                setLoading(false);
                stopLoading();
            }
        };

        fetchSeasonData();
    }, [id, seasonNumber, details?.id, fetchSeasonEpisodes]);









    const checkAuth = async () => {
        if (!currentUser) {
            const isConfirmed = await confirm("You need to sign in to perform this action. Go to Sign In?", "Sign In Required", "Sign In", "Cancel");
            if (isConfirmed) {
                navigate('/login');
            }
            return false;
        }
        return true;
    };

    const handleSeasonChange = (newSeason) => {
        setIsSeasonPopupOpen(false);
        navigate(`/tv/${id}/season/${newSeason}`);
    };

    // Sync User State from Firestore & Supabase
    useEffect(() => {
        if (currentUser && details && userData) {
            const data = userData;

            // 1. Sync Watchlist State (Supabase SSOT with Firebase Fallback)
            const syncWatchlist = async () => {
                const currentWatchlist = await watchlistService.getWatchlist(currentUser.uid);

                // Set InWatchlist for current Season
                const isInWatch = currentWatchlist.some(i =>
                    i.seriesId === details.id &&
                    i.isSeason &&
                    i.seasonNumber === selectedSeason
                );
                setInWatchlist(isInWatch);

                // Sync Episode States
                const watchlistEps = currentWatchlist
                    .filter(i => i.seriesId === details.id && i.isEpisode)
                    .map(i => i.id || i.tmdb_id);
                setEpisodeWatchlistIDs(watchlistEps);
            };
            syncWatchlist();

            // 2. Like Status (Using SSOT Service)
            const checkLikeStatus = async () => {
                // Check if SERIES is liked (since current UI seems to be Series or Season like? 
                // The toggleLike logic I replaced was SERIES or SEASON?
                // Wait, previous toggleLike logic (lines 846-856) used `selectedSeason` and `isSeason: true`. 
                // So the button handles SEASON likes??
                // "id: `${details.id}-S${selectedSeason}`"
                // The prompt said "likeSeries / unlikeSeries".
                // I need to be careful. The User Request said "Series / Season / Episode".
                // Does the UI distinguish?
                // The Heart button in header usually means Series.
                // But the code I'm replacing was explicitly constructing a SEASON item.
                // "isSeason: true, seasonNumber: selectedSeason".

                // If I change this to Series only, I change behavior.
                // However, usually the main heart is Series. The code I saw looked like Season.
                // BUT `toggleLike` triggers `handlePosterDoubleTap` on the POSTER.
                // If I am on Season page, maybe it likes the Season?
                // The prompt says: "likesService.likeSeries(), likeSeason(), likeEpisode()".
                // I should probably check which one to use.
                // If `seasonNumber` is present, maybe it's Season Like?
                // But typically users 'Like' a Show.
                // Let's look at `toggleLike` context again. 
                // It used `userData.likes` ... `isSeason && seasonNumber === selectedSeason`.
                // So it was DEFINITELY liking the SEASON inside this component.

                // Okay, if the component logic was liking the SEASON, I should use `likesService.likeSeason`.
                // BUT, looking at `MovieDetails` ... it seems to handle Season selection.
                // If I like S1, do I like the Series?
                // The Prompt says: "User liked X -> Supabase likes table ... Item (series / season / episode)".

                // I will maintain existing behavior: If `selectedSeason` is set, we are liking the SEASON.
                // Wait, if I am on the main movie page (`/tv/:id`), `seasonNumber` might be undefined or 1.
                // The current code defaults `selectedSeason` to 1 if not param.

                // If the user treats this as "Liking the Show", then implementation was bugged or specific.
                // Most apps: Heart = Like Show.
                // Letterboard seems to have granular likes.
                // I will use `likeSeason` if that's what the old code did. 
                // Old code: `id: ...-S${selectedSeason}`, `item_type: season`.

                // SO: `likesService.likeSeason` is the correct replacement.

                const isSeasonLiked = await likesService.isLiked(
                    currentUser.uid,
                    details.id,
                    'SEASON',
                    selectedSeason
                );
                setIsLiked(isSeasonLiked);
            };
            checkLikeStatus();

            // 3. Ep States - Likes (Firebase)
            // (Wait, are there episode likes? Not explicitly tracked here, but logic is similar)
        }
    }, [currentUser, details, selectedSeason, userData]);

    // Legacy checkUser removed as it used localStorage
    const checkUser = (tmdbId) => {
        // Kept empty to prevent errors if called elsewhere in legacy code flow
    };

    const toggleWatchlist = async () => {
        if (!currentUser) return;

        // Define Season Item (Using numeric IDs for Supabase BIGINT tmdb_id)
        const seasonId = seasonDetails?.id || Number(`${details.id}${selectedSeason}`); // Best effort numeric ID
        const seasonItem = {
            id: seasonId,
            seriesId: details.id,
            name: `${details.name} (Season ${selectedSeason})`,
            poster_path: seasonDetails?.poster_path || details.poster_path,
            vote_average: details.vote_average,
            first_air_date: seasonDetails?.air_date || details.first_air_date,
            type: 'season',
            isSeason: true,
            seasonNumber: selectedSeason,
        };

        // Define Episode Items for Bulk Add/Remove
        const seasonPoster = seasonDetails?.poster_path || details.poster_path;
        const episodeItems = episodes.map(ep => ({
            id: ep.id,
            name: `${details.name} - S${ep.season_number}E${ep.episode_number}: ${ep.name}`,
            poster_path: details.poster_path, // Series Poster
            seasonPoster: seasonPoster,
            still_path: ep.still_path,
            vote_average: ep.vote_average,
            first_air_date: ep.air_date,
            type: 'episode',
            isEpisode: true,
            seriesId: details.id,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
        }));

        if (inWatchlist) {
            // REMOVE FROM SUPABASE
            const idsToRemove = [seasonItem.id, ...episodes.map(e => e.id)];
            const success = await watchlistService.removeFromWatchlistBulk(currentUser.uid, idsToRemove);

            if (success) {
                // Update Local State
                setEpisodeWatchlistIDs(prev => prev.filter(id => !episodes.some(e => e.id === id)));
                setInWatchlist(false);
            }
        } else {
            // ADD TO SUPABASE
            const itemsToAdd = [seasonItem, ...episodeItems];
            const success = await watchlistService.addToWatchlist(currentUser.uid, itemsToAdd);

            if (success) {
                // Update Local State
                setEpisodeWatchlistIDs(prev => [...new Set([...prev, ...episodes.map(e => e.id)])]);
                setInWatchlist(true);

                // LOG ACTIVITY (Using Firebase Auth Context for user object)
                logActivity(userData || currentUser, 'watchlist', {
                    seriesId: details.id, // FIX: id -> seriesId
                    seriesName: details.name, // EXTRACTED
                    posterPath: seasonDetails?.poster_path || details.poster_path, // FIX: Use Season Poster
                    seasonNumber: selectedSeason
                });
            }
        }
    };

    const toggleLike = async () => {
        if (!currentUser) {
            navigate('/login');
            return;
        }

        const newStatus = !isLiked;
        // Optimistic UI Update
        setIsLiked(newStatus);

        try {
            if (newStatus) {
                await likesService.likeSeason(currentUser.uid, details.id, selectedSeason);
            } else {
                await likesService.unlikeSeason(currentUser.uid, details.id, selectedSeason);
            }
        } catch (error) {
            console.error("Like toggle failed", error);
            setIsLiked(!newStatus); // Revert on error
        }
    };

    // Watched Logic






    // Removed addToWatched helper as it's merged or unnecessary with direct FS calls

    // Episode Watchlist Logic


    // Initialize Watchlist from LocalStorage (Legacy/Guest?) - Keeping Watchlist logic but removing Watched
    useEffect(() => {
        try {
            const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
            if (Array.isArray(watchlist)) {
                setEpisodeWatchlistIDs(watchlist.filter(i => i && i.isEpisode).map(i => i.id));
            }
        } catch (e) {
            console.warn("Failed to parse legacy watchlist", e);
        }
    }, []);

    const checkEpisodeWatched = (ep) => {
        // Updated to use S-E composite key from Set
        // Accepts either an episode object { season_number, episode_number } OR just the IDs if we refactor callers.
        // Existing callers pass `ep.id`. We need to handle that.
        // If passed an ID (number/string), we must find the episode object from `episodes` state (if available).

        let sNum, eNum;

        if (typeof ep === 'object' && ep !== null && ep.season_number !== undefined) {
            sNum = ep.season_number;
            eNum = ep.episode_number;
        } else {
            // It's an ID. Try to find in `episodes` list (for current season)
            const found = episodes.find(e => e.id === ep);
            if (found) {
                sNum = found.season_number;
                eNum = found.episode_number;
            } else {
                // If not found in current season list, we can't verify watched status easily with just ID 
                // unless we have a full map. But usually we only render current season.
                return false;
            }
        }
        return episodeWatchedIDs.has(`${sNum}-${eNum}`);
    };

    // Effect to update `isWatched` (Season Completion) based on `episodeWatchedIDs`
    useEffect(() => {
        if (seasonDetails?.episodes && seasonDetails.episodes.length > 0) {
            const allWatched = seasonDetails.episodes.every(ep =>
                checkEpisodeWatched(ep)
            );
            setIsWatched(allWatched);
        }
    }, [episodeWatchedIDs, seasonDetails]);

    // Centralized Season Completion Trigger
    // Centralized Season Completion Trigger
    // REMOVED PASSIVE TRIGGER as per User Request
    /*
    useEffect(() => {
        if (isWatched && details && userData) {
            const completedKey = String(details.id);
            const completedSeasons = userData.completedSeasons?.[completedKey] || [];
            const isCompleted = completedSeasons.includes(Number(selectedSeason));

            // Trigger flow only if not already recorded as completed in Firestore
            if (!isCompleted) {
                handleSeasonCompletedFlow(selectedSeason);
            }
        }
    }, [isWatched, details, userData, selectedSeason]);
    */

    const checkEpisodeInWatchlist = (epId) => {
        return episodeWatchlistIDs.includes(epId);
    };

    const toggleEpisodeWatched = async (episode) => {
        if (!currentUser) return;

        // Composite Key
        const key = `${episode.season_number}-${episode.episode_number}`;
        const isCurrentlyWatched = episodeWatchedIDs.has(key);

        // Optimistic Update
        setEpisodeWatchedIDs(prev => {
            const next = new Set(prev);
            if (isCurrentlyWatched) next.delete(key);
            else next.add(key);
            return next;
        });

        // Backend Call (Supabase Only)
        let success = false;
        if (isCurrentlyWatched) {
            success = await unmarkEpisodeWatched(currentUser.uid, details.id, episode.season_number, episode.episode_number);
        } else {
            success = await markEpisodeWatched(currentUser.uid, details.id, episode.season_number, episode.episode_number);

            if (success) {
                // NEW: Remove from Watchlist (Supabase)
                watchlistService.removeFromWatchlist(currentUser.uid, episode.id);

                // LOG ACTIVITY
                logActivity(userData || currentUser, 'watched_episode', {
                    seriesId: details.id,
                    seriesName: details.name,
                    seasonNumber: episode.season_number,
                    episodeNumber: episode.episode_number,
                    posterPath: seasonDetails?.poster_path || details.poster_path // Use Season Poster if available
                });

                // MANUAL COMPLETION CHECK (New)
                const currentWatchedSet = new Set(episodeWatchedIDs);
                currentWatchedSet.add(key); // Ensure current is added for check

                // Check if all episodes in THIS season are watched
                if (seasonDetails && seasonDetails.episodes) {
                    const allCheck = seasonDetails.episodes.every(ep => {
                        const epKey = `${ep.season_number}-${ep.episode_number}`;
                        return currentWatchedSet.has(epKey);
                    });

                    if (allCheck) {
                        console.log("Season Completed via Episode Toggle! Triggering flow...");
                        handleSeasonCompletedFlow(episode.season_number);
                    }
                }
            }
        }

        if (!success) {
            // Revert
            setEpisodeWatchedIDs(prev => {
                const next = new Set(prev);
                if (isCurrentlyWatched) next.add(key);
                else next.delete(key);
                return next;
            });
            triggerErrorAutomation(new Error("Failed to update status."));
        }
    };

    const toggleSeasonWatched = async () => {
        if (!currentUser || !seasonDetails || !seasonDetails.episodes) return;

        const episodesToToggle = seasonDetails.episodes;
        const shouldMarkWatched = !isWatched;

        try {
            if (shouldMarkWatched) {
                // MARK ALL - Use markSeasonWatched service (triggers migration if needed)
                const success = await markSeasonWatched(
                    currentUser.uid,
                    details.id,
                    selectedSeason,
                    episodesToToggle.length
                );

                if (success) {
                    const allKeys = episodesToToggle.map(ep => `${ep.season_number}-${ep.episode_number}`);
                    setEpisodeWatchedIDs(prev => new Set([...prev, ...allKeys]));
                    setIsWatched(true);

                    // NEW: Remove from Watchlist (Supabase)
                    const idsToRemove = [seasonDetails?.id || Number(`${details.id}${selectedSeason}`), ...episodesToToggle.map(e => e.id)];
                    watchlistService.removeFromWatchlistBulk(currentUser.uid, idsToRemove);

                    // Update Local Watchlist State
                    setInWatchlist(false);
                    setEpisodeWatchlistIDs(prev => prev.filter(id => !episodesToToggle.some(e => e.id === id)));

                    // DIARY MIGRATION: Log Season Completed - Removed Legacy Call
                    // diaryService.addSeasonCompletedEntry(...)

                    // LOG ACTIVITY (Feed)
                    logActivity(userData || currentUser, 'completed_season', {
                        seriesId: details.id,
                        seriesName: details.name,
                        seasonNumber: selectedSeason,
                        posterPath: seasonDetails?.poster_path || details.poster_path
                    });

                    // MANUAL TRIGGER FOR POPUP
                    handleSeasonCompletedFlow(selectedSeason);

                    // CHECK SERIES COMPLETION
                    if (details.seasons) {
                        const releasedSeasons = details.seasons.filter(s => s.season_number > 0 && s.air_date && new Date(s.air_date) <= new Date());
                        let allSeasonsWatched = true;

                        for (const s of releasedSeasons) {
                            if (s.season_number === Number(selectedSeason)) continue;

                            if (s.episode_count) {
                                for (let i = 1; i <= s.episode_count; i++) {
                                    if (!episodeWatchedIDs.has(`${s.season_number}-${i}`)) {
                                        allSeasonsWatched = false;
                                        break;
                                    }
                                }
                            }
                            if (!allSeasonsWatched) break;
                        }

                        if (allSeasonsWatched) {
                            // Legacy addSeriesCompletedEntry removed to enforce strict diary rules
                            // diaryService.addSeriesCompletedEntry(currentUser.uid, details.id, details.name, details.poster_path);
                        }
                    }
                } else {
                    throw new Error('Failed to mark season watched');
                }
            } else {
                // UNMARK ALL
                await Promise.all(episodesToToggle.map(ep =>
                    unmarkEpisodeWatched(currentUser.uid, details.id, ep.season_number, ep.episode_number)
                ));
                const allKeys = new Set(episodesToToggle.map(ep => `${ep.season_number}-${ep.episode_number}`));
                setEpisodeWatchedIDs(prev => {
                    const next = new Set(prev);
                    for (const k of allKeys) next.delete(k);
                    return next;
                });
                setIsWatched(false);
            }
        } catch (error) {
            triggerErrorAutomation(error);
            setIsWatched(!shouldMarkWatched);
        }
    };

    const toggleEpisodeWatchlist = async (episode) => {
        if (!currentUser) return;

        // Find correct season poster
        const seasonPoster = (seasonDetails && seasonDetails.season_number === episode.season_number)
            ? seasonDetails.poster_path
            : null;

        const itemToSave = {
            id: episode.id,
            name: `${details.name} - S${episode.season_number}E${episode.episode_number}: ${episode.name}`,
            poster_path: details.poster_path,
            seasonPoster: seasonPoster,
            still_path: episode.still_path,
            vote_average: episode.vote_average,
            first_air_date: episode.air_date,
            type: 'episode',
            isEpisode: true,
            seriesId: details.id,
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
        };

        if (checkEpisodeInWatchlist(episode.id)) {
            // REMOVE FROM WATCHLIST (Supabase)
            const success = await watchlistService.removeFromWatchlist(currentUser.uid, episode.id);
            if (success) {
                setEpisodeWatchlistIDs(prev => prev.filter(id => id !== episode.id));
            }
        } else {
            // ADD TO WATCHLIST (Supabase)
            const success = await watchlistService.addToWatchlist(currentUser.uid, itemToSave);

            if (success) {
                // STRICT RULE: Reset Watched State
                setEpisodeWatchedIDs(prev => {
                    const next = new Set(prev);
                    next.delete(`${episode.season_number}-${episode.episode_number}`);
                    return next;
                });
                setEpisodeWatchlistIDs(prev => [...new Set([...prev, episode.id])]);

                // Also unmark in Supabase
                unmarkEpisodeWatched(currentUser.uid, details.id, episode.season_number, episode.episode_number);
            }
        }
    };







    // Get existing review for an item
    // Get existing review for an item
    const getExistingReview = (itemId, isEpisode = false, isSeason = false, seasonNum = null, episodeNum = null) => {
        if (!currentUser) return null;
        if (isEpisode) {
            return reviewsData.find(r =>
                Number(r.tmdbId) === Number(details.id) &&
                Number(r.seasonNumber) === Number(seasonNum) &&
                Number(r.episodeNumber) === Number(episodeNum) &&
                r.isEpisode &&
                r.userId === currentUser.uid
            );
        } else if (isSeason) {
            return reviewsData.find(r => Number(r.tmdbId) === Number(itemId) && r.isSeason && Number(r.seasonNumber) === Number(seasonNum) && r.userId === currentUser.uid);
        } else {
            // Series (Default)
            return reviewsData.find(r => Number(r.tmdbId) === Number(itemId) && !r.isEpisode && !r.isSeason && r.userId === currentUser.uid);
        }
    };



    const handleEditReview = (review) => {
        const type = review.isEpisode ? 'episode' : (review.isSeason ? 'season' : 'series');
        const id = review.isEpisode ? review.episodeId : review.tmdbId;

        navigate(`/review/${type}/${id}`, {
            state: {
                tmdbId: review.tmdbId,
                seasonNumber: review.seasonNumber,
                episodeNumber: review.episodeNumber,
                name: review.topicName || details.name,
                poster_path: details.poster_path, // Fallback
                existingReview: review
            }
        });
    }

    // Review Submit Logic (Common for Series, Season, Episode)
    const handleReviewSubmit = async (data) => {
        if (!currentUser) return;
        console.log("🚀 handleReviewSubmit STARTED", data);
        const { rating, review } = data;

        // Determine Targets

        let isEpisode = reviewingItem.type === 'episode';
        let isSeason = reviewingItem.type === 'season';

        console.log("🔍 DEBUG: reviewingItem =", reviewingItem);
        console.log("🔍 DEBUG: isEpisode =", isEpisode, "| isSeason =", isSeason);
        console.log("🔍 DEBUG: existingReviewData =", existingReviewData);

        let newReview = null; // Fix: Declare here for function-wide scope

        // Define Doc Ref (Update if exists, Add if new)
        // We can't use setDoc with custom ID easily unless we enforce ID gen.
        // But we have 'existingReviewData' which contains the ID if editing.

        try {
            if (existingReviewData && existingReviewData.id) {
                console.log("✅ ENTERING UPDATE BLOCK");
                // UPDATE / EDIT FLOW
                console.log("📝 Editing Review...", existingReviewData);

                if (existingReviewData.source === 'supabase') {
                    // Update in Supabase
                    console.log("🔄 Updating Supabase Review...");
                    if (isSeason) {
                        await reviewService.updateSeasonReview(existingReviewData.id, review, rating ? parseFloat(rating) : null);
                        // Update Rating Table too? usually create handles it. Update logic for rating separate?
                        // ratingsService.setSeasonRating uses upsert, so we can call it.
                        if (rating) await ratingsService.setSeasonRating(currentUser.uid, parseInt(details.id), reviewingItem.seasonNumber, parseFloat(rating));
                    } else if (isEpisode) {
                        await reviewService.updateEpisodeReview(existingReviewData.id, review, rating ? parseFloat(rating) : null);
                        if (rating) await ratingsService.setEpisodeRating(currentUser.uid, parseInt(details.id), reviewingItem.seasonNumber, reviewingItem.episodeNumber, parseFloat(rating));
                    }

                    // Local state update
                    setReviewsData(prev => prev.map(r => r.id === existingReviewData.id ? { ...r, rating: rating.toString(), review, updatedAt: new Date().toISOString() } : r));

                } else {
                    // Source is Firebase (Legacy) -> MIGRATE TO SUPABASE
                    // effectively a CREATE in Supabase
                    console.log("🚀 Migrating Legacy Review to Supabase...");

                    // We treat it as a new creation in Supabase
                    if (isSeason) {
                        // Call Create Logic (copied from below or extracted)
                        const result = await reviewService.createSeasonReview(
                            currentUser.uid,
                            parseInt(details.id),
                            reviewingItem.seasonNumber,
                            review,
                            rating ? parseFloat(rating) : null,
                            userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                            currentUser.photoURL,
                            details.name,
                            details.poster_path
                        );
                        if (rating) await ratingsService.setSeasonRating(currentUser.uid, parseInt(details.id), reviewingItem.seasonNumber, parseFloat(rating));

                        // We should probably remove the Firebase one to avoid duplicates?
                        // deleteDoc(doc(db, 'reviews', existingReviewData.id)); // Optional: Delete legacy
                    } else if (isEpisode) {
                        const result = await reviewService.createEpisodeReview(
                            currentUser.uid,
                            parseInt(details.id),
                            reviewingItem.seasonNumber,
                            reviewingItem.episodeNumber,
                            review,
                            rating ? parseFloat(rating) : null,
                            userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                            currentUser.photoURL,
                            details.name,
                            details.poster_path
                        );
                        if (rating) await ratingsService.setEpisodeRating(currentUser.uid, parseInt(details.id), reviewingItem.seasonNumber, reviewingItem.episodeNumber, parseFloat(rating));
                    }

                    // Force refresh or local update?
                    // Ideally we replace the firebase item in local state with the new supabase one.
                    // But simpler is to allow local state to wait for refresh or just update the object values.
                    setReviewsData(prev => prev.map(r => r.id === existingReviewData.id ? { ...r, rating: rating.toString(), review, source: 'supabase', updatedAt: new Date().toISOString() } : r));
                }

            } else {

                console.log("✅ ENTERING CREATE BLOCK");
                // CREATE - Use Supabase via reviewService
                // newReview is already declared at top scope
                if (isEpisode) {
                    const result = await reviewService.createEpisodeReview(
                        currentUser.uid,
                        parseInt(details.id),
                        reviewingItem.seasonNumber,
                        reviewingItem.episodeNumber,
                        review,
                        rating ? parseFloat(rating) : null,
                        userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                        currentUser.photoURL,
                        details.name,
                        details.poster_path
                    );
                    if (!result.success) {
                        console.error('Failed to create episode review:', result.error);
                        return;
                    }
                    newReview = result.data;

                    // PHASE 2.2: ALSO write rating separately to episode_ratings table
                    if (rating) {
                        await ratingsService.setEpisodeRating(
                            currentUser.uid,
                            parseInt(details.id),
                            reviewingItem.seasonNumber,
                            reviewingItem.episodeNumber,
                            parseFloat(rating)
                        );
                    }

                    // LOG ACTIVITY (Episode Review)
                    logActivity(userData || currentUser, 'rated_episode', {
                        seriesId: details.id,
                        seriesName: details.name,
                        seasonNumber: reviewingItem.seasonNumber,
                        episodeNumber: reviewingItem.episodeNumber,
                        rating: parseFloat(rating),
                        posterPath: seasonDetails?.poster_path || details.poster_path // Use Season Poster
                    });
                } else if (isSeason) {
                    console.log("📝 Creating Season Review via Supabase...");
                    const result = await reviewService.createSeasonReview(
                        currentUser.uid,
                        parseInt(details.id),
                        reviewingItem.seasonNumber,
                        review,
                        rating ? parseFloat(rating) : null,
                        userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                        currentUser.photoURL,
                        details.name,
                        details.poster_path
                    );
                    console.log("📡 Supabase Response:", result);

                    if (!result.success) {
                        console.error('Failed to create season review:', result.error);
                        return;
                    }
                    newReview = result.data;

                    // PHASE 2.2: ALSO write rating separately to season_ratings table
                    if (rating) {
                        try {
                            await ratingsService.setSeasonRating(
                                currentUser.uid,
                                parseInt(details.id),
                                reviewingItem.seasonNumber,
                                parseFloat(rating)
                            );

                            // STRICT DIARY ENTRY CREATION (Review + Rating)
                            console.log("📝 Attempting strict Diary Entry creation...");
                            const diaryResult = await diaryService.createDiaryEntry(
                                currentUser.uid,
                                details,
                                reviewingItem.seasonNumber,
                                { rating: parseFloat(rating), review: review, posterPath: seasonDetails?.poster_path || details.poster_path }
                            );

                            if (diaryResult.success) {
                                console.log("✅ DIARY ENTRY SAVED SUCCESSFULLY:", diaryResult.data);
                                // Auto-Remove from Watchlist on Diary Entry
                                await watchlistService.removeFromWatchlist(currentUser.uid, details.id);
                            } else {
                                console.error("❌ DIARY SAVE FAILED:", diaryResult.error);
                            }

                        } catch (err) {
                            console.error('Error writing to season_ratings or diary:', err);
                        }
                    }

                    // LOG ACTIVITY (Season Review)
                    logActivity(userData || currentUser, 'rated_season', {
                        seriesId: details.id,
                        seriesName: details.name,
                        seasonNumber: reviewingItem.seasonNumber,
                        rating: parseFloat(rating),
                        posterPath: seasonDetails?.poster_path || details.poster_path
                    });
                } else {
                    // SERIES REVIEW (Previously Unhandled Fallthrough)
                    // We continue using Firestore for Series reviews as they don't have a dedicated Supabase table yet (or based on legacy).
                    const reviewDataPayload = {
                        userId: currentUser.uid,
                        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                        tmdbId: parseInt(details.id),
                        name: details.name,
                        poster_path: details.poster_path,
                        rating: parseFloat(rating),
                        review: review,
                        updatedAt: new Date().toISOString(),
                        type: 'series',
                        isEpisode: false,
                        isSeason: false,
                        seasonNumber: null,
                        episodeNumber: null,
                        createdAt: new Date().toISOString(),
                        likes: []
                    };

                    try {
                        const newDocRef = await addDoc(collection(db, 'reviews'), reviewDataPayload);
                        newReview = { ...reviewDataPayload, id: newDocRef.id, source: 'firebase' };

                        // Success badge logic for Series (Silent)
                        const userRef = doc(db, 'users', currentUser.uid);
                        await updateDoc(userRef, {
                            starSeries: arrayUnion({
                                id: details.id,
                                name: details.name,
                                poster_path: details.poster_path,
                                date: new Date().toISOString()
                            })
                        });
                    } catch (e) {
                        console.error("Error creating series review:", e);
                        return;
                    }
                }

                // Mark as Watched Logic (Firestore) - Only for Series/Season reviews, not individual episodes
                if (!isEpisode) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();

                        // Robust Duplication Check: Check by ID
                        const isAlreadyInWatched = data.watched?.some(w => String(w.id) === String(details.id));

                        if (!isAlreadyInWatched) {
                            const itemToSave = {
                                id: details.id,
                                name: details.name,
                                poster_path: details.poster_path,
                                vote_average: details.vote_average,
                                first_air_date: details.first_air_date,
                                type: type,
                                date: new Date().toISOString()
                            };
                            await updateDoc(userRef, {
                                watched: arrayUnion(itemToSave)
                            });
                            setIsWatched(true);
                        }
                    }
                }

                // Safety check: Only update local state if review was created successfully
                if (!newReview) {
                    // Review creation failed
                    // Show a visual warning to user via console or alert if preferred, but for now log is improved.
                    setIsReviewOpen(false);
                    return;
                }

                // Update Local - Format Supabase data to match expected structure
                setReviewsData(prev => [...prev, {
                    id: newReview.id,
                    userId: newReview.user_id,
                    userName: userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                    author: currentUser.email,
                    photoURL: currentUser.photoURL,
                    tmdbId: newReview.tmdb_id,
                    seriesId: details.id,
                    isEpisode: isEpisode,
                    isSeason: isSeason,
                    episodeId: isEpisode ? reviewingItem.id : null,
                    episodeNumber: newReview.episode_number,
                    seasonNumber: newReview.season_number,
                    rating: newReview.rating?.toString(),
                    review: newReview.review_text,
                    createdAt: newReview.created_at,
                    updatedAt: newReview.updated_at,
                    likes: [],
                    source: 'supabase',
                    topicName: reviewingItem.name,
                    poster_path: details.poster_path
                }]);

                if (!isEpisode) {
                    const userRef = doc(db, 'users', currentUser.uid);

                    // STRICT RULE: Remove Season Episodes from Watchlist (Supabase)
                    if (seasonDetails && seasonDetails.episodes) {
                        const seasonEpIds = seasonDetails.episodes.map(e => e.id);
                        const seasonId = seasonDetails.id || Number(`${details.id}${selectedSeason}`);
                        watchlistService.removeFromWatchlistBulk(currentUser.uid, [seasonId, ...seasonEpIds]);

                        // Local Update
                        setEpisodeWatchlistIDs(prev => prev.filter(id => !seasonEpIds.includes(id)));
                    }

                    // For Achievements and Star Series (STILL FIREBASE)
                    let updates = {};
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();

                        // Mark as Watched Logic (Sync with Supabase via Service)
                        if (seasonDetails && seasonDetails.episodes) {
                            const currentWatched = data.watched || [];
                            const seasonEpIds = new Set(seasonDetails.episodes.map(e => e.id));
                            const existingWatchedIds = new Set(currentWatched.map(i => i.id));
                            const episodeItems = seasonDetails.episodes.filter(ep => !existingWatchedIds.has(ep.id)).map(ep => ({
                                id: ep.id,
                                episodeId: ep.id,
                                seriesId: details.id,
                                name: details.name,
                                episodeName: ep.name,
                                poster_path: details.poster_path, // Series Poster
                                still_path: ep.still_path,
                                vote_average: ep.vote_average,
                                first_air_date: ep.air_date,
                                type: 'episode',
                                date: new Date().toISOString(),
                                isEpisode: true,
                                seasonNumber: ep.season_number,
                                episodeNumber: ep.episode_number
                            }));

                            if (episodeItems.length > 0) {
                                await Promise.all(episodeItems.map(ep =>
                                    markEpisodeWatched(currentUser.uid, details.id, ep.seasonNumber, ep.episodeNumber)
                                ));

                                setEpisodeWatchedIDs(prev => {
                                    const next = new Set(prev);
                                    episodeItems.forEach(ep => next.add(`${ep.seasonNumber}-${ep.episodeNumber}`));
                                    return next;
                                });
                            }
                        }

                        // NEW: Automatically mark as WATCHED on Review
                        if (isSeason) {
                            const success = await markSeasonWatched(currentUser.uid, details.id, reviewingItem.seasonNumber, episodes.length);
                            if (success) setIsWatched(true);
                        } else if (isEpisode) {
                            const epToMark = episodes.find(e => e.episode_number === reviewingItem.episodeNumber);
                            if (epToMark) {
                                const success = await markEpisodeWatched(currentUser.uid, details.id, reviewingItem.seasonNumber, reviewingItem.episodeNumber);
                                if (success) {
                                    setEpisodeWatchedIDs(prev => new Set(prev).add(`${reviewingItem.seasonNumber}-${reviewingItem.episodeNumber}`));
                                    watchlistService.removeFromWatchlist(currentUser.uid, epToMark.id);
                                }
                            }
                        }

                        // Star Series Logic
                        const isAlreadyStar = data.starSeries?.some(s => s.id === details.id);
                        if (!isAlreadyStar) {
                            updates.starSeries = arrayUnion({
                                id: details.id,
                                name: details.name,
                                poster_path: details.poster_path,
                                date: new Date().toISOString()
                            });
                        }
                    }

                    if (Object.keys(updates).length > 0) {
                        await updateDoc(userRef, updates);
                        if (updates.watched) setIsWatched(true);
                    }
                } else {
                    // IS EPISODE REVIEW
                    // STRICT RULE: Remove from Watchlist (Supabase)
                    const epId = reviewingItem.id;
                    watchlistService.removeFromWatchlist(currentUser.uid, epId);
                    setEpisodeWatchlistIDs(prev => prev.filter(id => id !== epId));
                }
            }
        } catch (e) {
            console.error("Error saving review", e);
        }

        // Automatically trigger share sticker for Season Reviews
        if (isSeason) {
            const reviewId = newReview ? newReview.id : existingReviewData?.id || 'temp-id-' + Date.now();
            const freshReviewItem = {
                id: reviewId,
                tmdbId: parseInt(details.id),
                isEpisode, isSeason,
                seasonNumber: reviewingItem.seasonNumber,
                episodeNumber: reviewingItem.episodeNumber,
                rating: parseFloat(rating),
                review: review,
                userId: currentUser.uid,
                userName: userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                photoURL: currentUser.photoURL,
                topicName: reviewingItem.name,
            };
            handleShare(freshReviewItem, isEpisode, isSeason);
        }

        setIsReviewOpen(false);
    };

    const openEpisodeReview = (ep) => {
        const existing = getExistingReview(details.id, true, false, ep.season_number, ep.episode_number);
        // Important: Navigate using details.id (Series ID) to ensure ReviewPage has it in params too
        navigate(`/review/episode/${details.id}`, {
            state: {
                tmdbId: details.id,
                seasonNumber: ep.season_number,
                episodeNumber: ep.episode_number,
                name: `${details.name} S${ep.season_number}E${ep.episode_number}`,
                poster_path: ep.still_path || details.poster_path,
                existingReview: existing
            }
        });
    };

    const handleReviewLike = async (reviewId) => {
        if (!currentUser) return;
        const reviewRef = doc(db, 'reviews', reviewId);

        // Optimistic Update
        setReviewsData(prev => prev.map(r => {
            if (r.id === reviewId) {
                const hasLiked = r.likes?.includes(currentUser.uid);
                return {
                    ...r,
                    likes: hasLiked ? r.likes.filter(id => id !== currentUser.uid) : [...(r.likes || []), currentUser.uid]
                };
            }
            return r;
        }));

        const review = reviewsData.find(r => r.id === reviewId);
        if (review) {
            const hasLiked = review.likes?.includes(currentUser.uid);
            try {
                if (hasLiked) {
                    await updateDoc(reviewRef, { likes: arrayRemove(currentUser.uid) });
                } else {
                    await updateDoc(reviewRef, { likes: arrayUnion(currentUser.uid) });
                }
            } catch (err) {
                // Revert optimistic update if needed, but usually fine
                console.error("Failed to toggle like", err);
            }
        }
    };





    const handleAction = async (actionType, actionFn) => {
        setActionLoading(prev => ({ ...prev, [actionType]: true }));
        try {
            await actionFn();
        } finally {
            setActionLoading(prev => ({ ...prev, [actionType]: false }));
        }
    };

    // The old handleReviewSubmit logic is replaced by the new one above.
    // This section is now removed as per the diff.
    /*
    const handleReviewSubmit = async ({ rating, review }) => {
        if (!currentUser) return;
     
        const isEpisode = reviewingItem !== 'series' && !!reviewingItem?.episode_number;
     
        // NEW FLOW: Removed Popup Interception as requested.
        // Direct Save.
     
        const episodeIdTarget = isEpisode ? reviewingItem.id : null;
     
        // Construct Review Data
        const reviewDataPayload = {
            userId: currentUser.uid,
            userName: currentUser.email?.split('@')[0] || 'User',
            tmdbId: parseInt(id),
            name: isEpisode ? `${details.name} (S${reviewingItem.season_number}E${reviewingItem.episode_number})` : details.name,
            poster_path: details.poster_path, // Series poster usually used
            rating: parseFloat(rating),
            review: review,
            updatedAt: new Date().toISOString(),
            type: type,
            isEpisode: isEpisode,
            seasonNumber: isEpisode ? reviewingItem.season_number : null,
            episodeNumber: isEpisode ? reviewingItem.episode_number : null,
            episodeId: episodeIdTarget
        };
     
        try {
            // Check for existing review explicitly
            let existingDocId = null;
            const existingReview = reviewsData.find(r =>
                r.userId === currentUser.uid &&
                r.tmdbId === parseInt(id) &&
                r.isEpisode === isEpisode &&
                (isEpisode ? r.episodeId === episodeIdTarget : true)
            );
     
            if (existingReview) {
                existingDocId = existingReview.id;
            } else {
                // Double check Firestore if not found in local state (paranoid check)
                const q = query(
                    collection(db, 'reviews'),
                    where('userId', '==', currentUser.uid),
                    where('tmdbId', '==', parseInt(id)),
                    where('isEpisode', '==', isEpisode)
                );
                const snap = await getDocs(q);
                const match = snap.docs.find(d => isEpisode ? d.data().episodeId === episodeIdTarget : true);
                if (match) existingDocId = match.id;
            }
     
            if (existingDocId) {
                // Update
                const reviewRef = doc(db, 'reviews', existingDocId);
                await updateDoc(reviewRef, {
                    ...reviewDataPayload,
                    // Preserve createdAt, likes
                });
     
                // Update Local
                setReviewsData(prev => prev.map(r => r.id === existingDocId ? { ...r, ...reviewDataPayload } : r));
     
                setIsReviewOpen(false);
     
                // SUCCESS FLOW (Silent Badge Add)
                if (!isEpisode) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await updateDoc(userRef, {
                        starSeries: arrayUnion({
                            id: details.id,
                            name: details.name,
                            poster_path: details.poster_path,
                            date: new Date().toISOString()
                        })
                    });
                    // setShowStarBadge(true); // Removed
                }
     
            } else {
                // Create New
                const newDocRef = await addDoc(collection(db, 'reviews'), {
                    ...reviewDataPayload,
                    createdAt: new Date().toISOString(),
                    likes: []
                });
     
                // Mark as Watched Logic (Firestore)
                if (!isEpisode) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
     
                        // Robust Duplication Check: Check by ID
                        const isAlreadyInWatched = data.watched?.some(w => String(w.id) === String(details.id));
     
                        if (!isAlreadyInWatched) {
                            const itemToSave = {
                                id: details.id,
                                name: details.name,
                                poster_path: details.poster_path,
                                vote_average: details.vote_average,
                                first_air_date: details.first_air_date,
                                type: type,
                                date: new Date().toISOString()
                            };
                            await updateDoc(userRef, {
                                watched: arrayUnion(itemToSave)
                            });
                            setIsWatched(true);
                        }
                    }
                }
     
                // Update Local
                setReviewsData(prev => [...prev, { ...reviewDataPayload, id: newDocRef.id, likes: [], createdAt: new Date().toISOString() }]);
     
                setIsReviewOpen(false);
     
                // SUCCESS FLOW (Silent Badge Add)
                if (!isEpisode) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    await updateDoc(userRef, {
                        starSeries: arrayUnion({
                            id: details.id,
                            name: details.name,
                            poster_path: details.poster_path,
                            date: new Date().toISOString()
                        })
                    });
                    // setShowStarBadge(true); // Removed
                }
            }
     
        } catch (error) {
            triggerErrorAutomation(error);
        }
    };
    */

    if (loading) return null; // STRICT: Wait for ALL data (Series + Season)
    if (!details) return <div className="loading" style={{ color: '#FFD600', textAlign: 'center', marginTop: '100px' }}>Series not found</div>;


    const date = details.first_air_date;

    const backdropUrl = `https://image.tmdb.org/t/p/original${details.backdrop_path}`;
    // Use Season Poster if seasonDetails exists (and matches selectedSeason, implicit via fetch)
    const rawPosterPath = seasonDetails?.poster_path || details.poster_path;
    // GLOBAL FIX: Resolve from globalPosters > Fallback to TMDB
    const resolvedPath = resolvePoster(details.id, rawPosterPath, globalPosters);
    // posterUrl derived variable removed in favor of state




    const getEmoji = (val) => {
        const iconStyle = { color: 'black', fontSize: '1.4rem' }; // Black drawing
        const bgStyle = {
            background: '#FFCC00', // Yellow face
            borderRadius: '4px', // SQUARE BORDER
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // border: '2px solid black' // Removed border as simple yellow circle with black face looks cleaner like emoji
        };

        // Custom Logic based on Image (Happy, Neutral, Sad)
        // 5 faces in image? user asked for "emojies like that photo".
        // I will stick to 3 for now, mapped to 0-10 scale.
        // >= 7: Happy
        // 4-6: Neutral
        // < 4: Sad

        let Icon = MdSentimentVeryDissatisfied;
        if (val >= 7) Icon = MdSentimentSatisfiedAlt;
        else if (val >= 4) Icon = MdSentimentNeutral;

        return (
            <div style={bgStyle}>
                <Icon style={iconStyle} />
            </div>
        );
    };



    return (
        <div className="movie-details-container" style={{ background: '#000', minHeight: '100vh' }}>

            <div className="details-content" style={{
                marginTop: '1vh', // SHRUNK (User Req: Reduce top space)
                width: '100%',
                maxWidth: '600px', // SHRUNK (Medium Large feel)
                margin: '1vh auto 0',
                padding: '0 1rem',
                display: 'flex',
                direction: 'column',
                flexDirection: 'column',
                alignItems: 'center',
                color: '#fff',
                position: 'relative',
                zIndex: 1
            }}>

                {/* VISUAL TITLE CARD BOX (Backdrop) with Logo & Fade */}
                <div style={{
                    width: '100%',
                    maxWidth: '1000px',
                    marginBottom: '1rem', // Reduced Gap below logo
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000',
                    borderRadius: '0px',
                    overflow: 'hidden',
                    minHeight: '100px' // Ensure minimum height for logo
                }}>

                    {/* LOGO OVERLAY (Only Logo, No Backdrop) */}
                    <div style={{ zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                        {logoFilePath ? (
                            <img
                                src={`https://image.tmdb.org/t/p/original${logoFilePath}`}
                                alt="Series Logo"
                                style={{
                                    width: 'auto',
                                    maxWidth: '80%', // Shrunk width
                                    height: 'auto',
                                    maxHeight: '120px', // Strict height limit
                                    objectFit: 'contain',
                                    filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.1))'
                                }}
                            />
                        ) : (
                            // Fallback if no logo
                            <h2 style={{
                                fontSize: '2rem', // SHRUNK (Medium Large)
                                fontFamily: 'Impact, sans-serif',
                                textTransform: 'uppercase',
                                color: '#ddd',
                                textAlign: 'center',
                                padding: '0 10px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                margin: 0
                            }}>
                                {title}
                            </h2>
                        )}
                    </div>
                </div>

                {/* POSTER (Refined: Card Style) */}
                <div className="poster-wrapper" style={{ flexShrink: 0, zIndex: 3, marginBottom: '2rem' }}>
                    <div
                        style={{ position: 'relative', filter: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}
                    >
                        {/* Watchlist Button Overlay */}


                        {/* Star Badge if Earned (Prioritize Star Badge over just Review, or show Star Badge if user has it) */}


                        {/* Animated Heart */}


                        {/* POSTER CONTAINER REF */}
                        <div ref={posterContainerRef} style={{ position: 'relative', display: 'inline-block' }}>
                            <img
                                src={posterUrl && !posterUrl.startsWith('http') ? `https://image.tmdb.org/t/p/w500${posterUrl}` : posterUrl}
                                alt={title}
                                className="movie-poster"
                                style={{
                                    width: 'auto',
                                    maxWidth: '90vw',
                                    height: '30vh', // SHRUNK MORE (30vh)
                                    maxHeight: '300px', // Strict limit
                                    objectFit: 'cover',
                                    borderRadius: '6px', // Tighter radius
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                                    border: 'none',
                                }}
                            />

                            {/* EDIT POSTER BUTTON - Only show if season is fully watched */}
                            {isWatched && (
                                <>
                                    {/* Edit Button & Hint Wrapper */}
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleEditClick();
                                            }}
                                            style={{
                                                background: isEditButtonGlowing ? '#FFD600' : 'rgba(0, 0, 0, 0.7)',
                                                color: isEditButtonGlowing ? '#000' : '#fff',
                                                border: isEditButtonGlowing ? '2px solid #FFD600' : '1px solid rgba(255, 255, 255, 0.3)',
                                                borderRadius: '50%',
                                                width: '40px',
                                                height: '40px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                backdropFilter: 'blur(4px)',
                                                transition: 'all 0.3s ease',
                                                boxShadow: isEditButtonGlowing ? '0 0 20px rgba(255, 214, 0, 0.6)' : 'none',
                                            }}
                                            title="Edit Season Poster"
                                        >
                                            <MdEdit size={20} />
                                        </div>

                                        {/* HINT TEXT: Triggered when showEditHint is true after popup close */}
                                        {showEditHint && (
                                            <MobileIndicator
                                                id={`edit-poster-v2-${details.id}`} // FRESH ID
                                                message="you are eligible to edit this series poster"
                                                position="bottom"
                                                duration={5000}
                                                style={{ zIndex: 10002, top: '45px', transform: 'translateX(-50%)', left: '50%' }} // Perfect Centering
                                            />
                                        )}
                                    </div>

                                    {/* Double Tap to Like Indicator (Attached to Poster) */}
                                    {/* Double Tap to Like Indicator REMOVED */}
                                </>
                            )}

                            {/* ROUNDED LIKE BUTTON (Bottom Right) */}
                            <div
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleLike();
                                }}
                                style={{
                                    position: 'absolute',
                                    bottom: '10px',
                                    right: '10px',
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.6)',
                                    backdropFilter: 'blur(4px)',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                                }}
                            >
                                {isLiked ? <MdFavorite size={20} color="#FF0000" /> : <MdFavoriteBorder size={20} color="#fff" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* INFO ROW: Title/Watch (Left) ---- Ratings (Right) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center', // Center Alignment
                    width: '100%',
                    maxWidth: '1000px', // Match top box width
                    marginBottom: '1rem', // Reduced margin
                    flexWrap: 'nowrap', // No Wrap if possible
                    gap: '20px'
                }}>

                    {/* LEFT: Title & Where to Watch */}
                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <h1 style={{ fontSize: '3rem', textTransform: 'uppercase', fontWeight: '700', margin: '0', fontFamily: 'Anton, Impact, sans-serif', letterSpacing: '0.5px', lineHeight: '1.1' }}>
                            {title}
                        </h1>

                        {/* Availability Info (Inline) */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Availability:</span>
                            {watchProviders?.flatrate || watchProviders?.rent || watchProviders?.buy ? (
                                (watchProviders.flatrate || watchProviders.rent || watchProviders.buy || []).slice(0, 3).map(provider => (
                                    <div key={provider.provider_id} title={provider.provider_name}>
                                        <img
                                            src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                            alt={provider.provider_name}
                                            style={{ width: '25px', height: '25px', borderRadius: '4px', border: '1px solid #333', objectFit: 'contain' }} // Shrunk to 25px
                                        />
                                    </div>
                                ))
                            ) : (
                                <span style={{ fontSize: '0.75rem', color: '#444', alignSelf: 'center' }}>Unavailable</span>
                            )}
                        </div>
                    </div>

                    <div
                        onClick={() => {
                            const isSeason = selectedSeason && Number(selectedSeason) > 0;
                            const path = isSeason
                                ? `/tv/${details.id}/season/${selectedSeason}/reviews`
                                : `/tv/${details.id}/reviews`;
                            navigate(path);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', // Tighter gap
                            background: 'rgba(255,255,255,0.1)', // Subtle bg
                            padding: '4px 12px', // Shrunk padding
                            borderRadius: '20px', border: '1px solid #333',
                            cursor: 'pointer'
                        }}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>
                            {seasonStats.count === 0 ? getEmoji(0) : getEmoji(parseFloat(seasonStats.avg))}
                        </span>
                        <span style={{ color: '#46d369', fontSize: '1rem', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}>
                            {seasonStats.avg}
                        </span>
                    </div>


                </div>

            </div>

            {/* Action Bar (Realigned & Compact) */}
            {/* Action Bar (Clean Icon Style) */}
            <div className="action-bar" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '40px', // Spacing between actions
                width: '100%',
                padding: '10px 0',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
            }}>

                {/* MY LIST (Watchlist) */}
                <div
                    onClick={() => handleAction('watchlist', async () => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (!(await checkAuth())) return;
                        await toggleWatchlist();
                    })}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        color: '#fff',
                        minWidth: '60px'
                    }}
                >
                    {actionLoading.watchlist ? (
                        <div style={{ height: '28px', display: 'flex', alignItems: 'center' }}><ButtonLoader size="24px" /></div>
                    ) : (
                        inWatchlist ? <MdCheck size={28} color="#fff" /> : <MdAdd size={28} color="#fff" />
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#ccc' }}>Tracking</span>
                </div>

                {/* RATE (Review) */}
                <div
                    onClick={() => {
                        // NEW: Navigate to ReviewPage
                        const isSeason = selectedSeason && Number(selectedSeason) > 0;
                        const reviewType = isSeason ? 'season' : 'series';
                        const existing = isSeason ? userSeasonReview : userSeriesReview;

                        navigate(`/review/${reviewType}/${details.id}`, {
                            state: {
                                tmdbId: details.id,
                                seasonNumber: isSeason ? Number(selectedSeason) : null,
                                episodeNumber: null,
                                name: isSeason ? `${details.name} Season ${selectedSeason}` : details.name,
                                poster_path: isSeason ? (seasonDetails?.poster_path || details.poster_path) : details.poster_path,
                                existingReview: existing,
                                totalEpisodes: isSeason ? episodes.length : 0 // Pass for auto-watched logic
                            }
                        });
                    }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        color: '#fff',
                        minWidth: '60px'
                    }}
                >
                    {/* Using MdStarBorder for "Rate" as generic, or filled if rated */}
                    {(selectedSeason > 0 ? userSeasonReview : userSeriesReview) ? <MdStar size={28} color="#FFD600" /> : <MdStarBorder size={28} color="#fff" />}
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: (selectedSeason > 0 ? userSeasonReview : userSeriesReview) ? '#FFD600' : '#ccc' }}>Rate</span>
                </div>


                {/* SHARE */}
                {/* SHARE (Always Visible) */}
                {(selectedSeason > 0 ? userSeasonReview : userSeriesReview) && (
                    <div
                        onClick={() => handleAction('share', async () => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            handleShare((selectedSeason > 0 ? userSeasonReview : userSeriesReview), false, selectedSeason > 0);
                        })}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            color: '#fff',
                            minWidth: '60px'
                        }}
                    >
                        {actionLoading.share ? (
                            <div style={{ height: '28px', display: 'flex', alignItems: 'center' }}><ButtonLoader size="24px" /></div>
                        ) : (
                            <MdIosShare size={28} color="#fff" />
                        )}
                        <span style={{ fontSize: '0.85rem', fontWeight: '500', color: '#ccc' }}>Share</span>
                    </div>
                )}


                {/* WATCHED (Track) */}
                <div
                    onClick={() => handleAction('watched', async () => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        if (!(await checkAuth())) return;
                        await toggleSeasonWatched();
                    })}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        color: '#fff',
                        minWidth: '60px'
                    }}
                >
                    {actionLoading.watched ? (
                        <div style={{ height: '28px', display: 'flex', alignItems: 'center' }}><ButtonLoader size="24px" /></div>
                    ) : (
                        isWatched ? <MdVisibility size={28} color="#46d369" /> : <MdVisibilityOff size={28} color="#fff" />
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: '500', color: isWatched ? '#46d369' : '#ccc' }}>Tracked</span>
                </div>

            </div>

            {/* Overview (truncated) */}
            <div className="overview" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 1.5rem', padding: '0 15px' }}>
                <p style={{
                    lineHeight: '1.4',
                    fontSize: '1rem',
                    color: '#ccc',
                    display: '-webkit-box',
                    WebkitLineClamp: 3, // TRUNCATE (Important points only)
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {seasonDetails?.overview || details.overview || "No information available."}
                </p>
            </div>

            {/* Episodes List - Full Width below? Or Sidebar? User image showed list. Let's put it full width below content OR in the main column. 
                    Actually, let's put it in a separate container below the top section.
                */}

            <div className="episodes-wrapper" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>



                {/* Episodes List - Integrated in Info Column */}
                <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                    <h3 style={{ color: '#FFCC00', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', borderBottom: '3px solid #E50914', paddingBottom: '14px', color: '#fff' }}>Episodes</span>
                        </div>
                        {seasonsValues.length > 0 && (
                            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginRight: '10px' }}>

                                {/* Season Rating - IMDb Style Badge REMOVED */}
                                {/*
                                        (seasonDetails?.vote_average > 0 || getCurrentSeasonRating() > 0) && (
                                            <div style={{ display: 'flex', alignItems: 'center', background: '#000', border: '1px solid #F5C518', borderRadius: '4px', padding: '4px 8px', marginRight: '15px' }}>
                                                <span style={{ background: '#F5C518', color: 'black', fontWeight: '900', padding: '2px 4px', borderRadius: '2px', marginRight: '6px', fontSize: '0.8rem' }}>IMDb</span>
                                                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1rem' }}>
                                                    {(seasonDetails?.vote_average || getCurrentSeasonRating()).toFixed(1)}/10
                                                </span>
                                            </div>
                                        )
                                    */}

                                {/* Season Selection Dropdown (Rolled back to Dropdown) */}
                                <div style={{
                                    position: 'relative',
                                    zIndex: 1000
                                }}>
                                    {/* TRIGGER BUTTON */}
                                    <div
                                        onClick={() => setIsSeasonPopupOpen(!isSeasonPopupOpen)}
                                        style={{
                                            backgroundColor: '#1a1a1a',
                                            color: '#fff',
                                            border: '1px solid #333',
                                            borderRadius: '4px',
                                            padding: '8px 12px',
                                            fontSize: '0.9rem',
                                            fontWeight: '700',
                                            minWidth: '130px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        <span style={{ marginRight: '10px' }}>Season {selectedSeason}</span>
                                        <MdKeyboardArrowDown size={18} />
                                    </div>

                                    {/* DROPDOWN MENU */}
                                    {isSeasonPopupOpen && (
                                        <div
                                            className="hide-scrollbar"
                                            style={{
                                                position: 'absolute',
                                                top: '110%',
                                                right: 0,
                                                width: '100%',
                                                minWidth: '150px',
                                                maxHeight: '200px',
                                                background: '#1a1a1a',
                                                border: '1px solid #333',
                                                borderRadius: '6px',
                                                overflowY: 'auto',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                                                zIndex: 1001
                                            }}
                                        >
                                            {seasonsValues.sort((a, b) => a.season_number - b.season_number).map((s) => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => handleSeasonChange(s.season_number)}
                                                    style={{
                                                        padding: '12px 15px',
                                                        fontSize: '0.9rem',
                                                        color: selectedSeason === s.season_number ? '#FFD600' : '#fff',
                                                        background: selectedSeason === s.season_number ? 'rgba(255, 214, 0, 0.1)' : 'transparent',
                                                        borderBottom: '1px solid #222',
                                                        fontWeight: '600',
                                                        textAlign: 'center',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {s.name || `Season ${s.season_number}`}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Season Action Buttons */}

                        {episodes.map((ep, index) => {
                            const epReviews = reviewsData.filter(r =>
                                Number(r.tmdbId) === Number(id) &&
                                Number(r.seasonNumber) === Number(selectedSeason) &&
                                Number(r.episodeNumber) === Number(ep.episode_number) &&
                                r.isEpisode
                            );

                            // User Rating (if any)
                            const userReview = getExistingReview(details.id, true, false, ep.season_number, ep.episode_number);

                            return (
                                <div
                                    key={ep.id}
                                    onClick={() => {
                                        navigate(`/tv/${details.id}/season/${selectedSeason}/episode/${ep.episode_number}`);
                                    }}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px',
                                        padding: '15px 0',
                                        borderBottom: '1px solid #222',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {/* Top Row: Thumbnail | Info | Review Icon */}
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>

                                        {/* Thumbnail (Overlays Added) */}
                                        <div style={{ position: 'relative', width: '130px', minWidth: '130px', height: '74px' }}>
                                            {ep.still_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                    alt={ep.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                                                />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', background: '#222', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <span style={{ color: '#555', fontSize: '0.8rem' }}>No Image</span>
                                                </div>
                                            )}

                                            {/* Action Buttons Overlay (Top Right) */}
                                            <div style={{ position: 'absolute', top: '5px', right: '5px', display: 'flex', gap: '6px' }}>
                                                {/* WATCHLIST TOGGLE */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleEpisodeWatchlist(ep);
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.6)',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        backdropFilter: 'blur(4px)',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                        zIndex: 10
                                                    }}
                                                >
                                                    {checkEpisodeInWatchlist(ep.id) ? (
                                                        <MdCheck size={18} color="#FFD600" />
                                                    ) : (
                                                        <MdAdd size={18} color="#fff" />
                                                    )}
                                                </button>

                                                {/* WATCHED TOGGLE */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleEpisodeWatched(ep);
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.6)',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        backdropFilter: 'blur(4px)',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                                                        zIndex: 10
                                                    }}
                                                >
                                                    {episodeWatchedIDs.has(`${ep.season_number}-${ep.episode_number}`) ? (
                                                        <MdVisibility size={18} color="#46d369" />
                                                    ) : (
                                                        <MdVisibilityOff size={18} color="#fff" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Info: Title & Duration */}
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {index + 1}. {ep.name}
                                            </h4>
                                            <span style={{ color: '#888', fontSize: '0.85rem' }}>
                                                {ep.runtime ? `${ep.runtime}m` : ''}
                                            </span>
                                        </div>

                                        {/* Review/Action Icon (Right Aligned) */}
                                        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEpisodeReview(ep);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                {userReview ? (
                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', color: '#FFD600' }}>
                                                            {parseFloat(userReview.rating) % 1 === 0 ? <MdStar size={24} /> : <MdStarHalf size={24} />}
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', marginLeft: '2px' }}>{userReview.rating}</span>
                                                        </div>
                                                        <MdIosShare
                                                            size={20}
                                                            color="#aaa"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleShare(userReview, true, false);
                                                            }}
                                                            style={{ transition: 'color 0.2s' }}
                                                            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                                                            onMouseLeave={(e) => e.currentTarget.style.color = '#aaa'}
                                                        />
                                                    </div>
                                                ) : (
                                                    <MdStarBorder size={24} color="#666" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Overview */}
                                    <p style={{
                                        margin: '0',
                                        fontSize: '0.9rem',
                                        color: '#aaa',
                                        lineHeight: '1.4',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {ep.overview || "No overview available."}
                                    </p>

                                </div>
                            );
                        })}
                    </div>
                </div>
            </div >



            {/* RELATED SERIES */}
            {
                details.recommendations?.results?.length > 0 && (() => {
                    // Logic: Prioritize Shared Genres & Popularity
                    const related = details.recommendations.results
                        .filter(() => false) // Disabled as requested
                        .slice(0, 0);

                    if (related.length === 0) return null;

                    return (
                        <div style={{ marginTop: '3rem', marginBottom: '2rem' }}>
                            <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#FFCC00' }}>Related Series</h3>
                            <div style={{ display: 'flex', overflowX: 'auto', gap: '15px', paddingBottom: '10px' }} className="hide-scrollbar">
                                {related.map(series => (
                                    <div
                                        key={series.id}
                                        onClick={() => {
                                            navigate(`/tv/${series.id}`);
                                            window.scrollTo(0, 0);
                                        }}
                                        style={{ flex: '0 0 auto', width: '140px', cursor: 'pointer' }}
                                    >
                                        <img
                                            src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w300')}
                                            alt={series.name}
                                            style={{ width: '100%', borderRadius: '6px', height: '210px', objectFit: 'cover', transition: 'transform 0.2s' }}
                                            onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                                            onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()
            }

            {/* PREMIUM CAST & CREW SECTION (ABSOLUTE BOTTOM) */}
            <div className="premium-cast-section" style={{ marginTop: '3rem', marginBottom: '4rem', padding: '0 8px' }}>
                <h3 className="section-title" style={{ fontSize: '1.3rem', color: '#fff', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Cast & Crew
                </h3>

                <div className="cast-carousel-container" style={{
                    display: 'flex',
                    overflowX: 'auto',
                    gap: '20px',
                    paddingBottom: '20px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                }}>
                    <style>{`
                        .cast-carousel-container::-webkit-scrollbar { display: none; }
                    `}</style>

                    {cast.map(actor => (
                        <div
                            key={actor.id}
                            className="cast-card"
                            onClick={() => navigate(`/person/${actor.id}`)}
                            style={{
                                flex: '0 0 auto',
                                width: '100px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                cursor: 'pointer',
                                textAlign: 'center'
                            }}
                        >
                            {/* Circular Profile Image */}
                            <div className="cast-profile-wrapper" style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: '2px solid #222',
                                marginBottom: '10px',
                                background: '#1a1a1a',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {actor.profile_path ? (
                                    <img
                                        src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`}
                                        alt={actor.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <div style={{ color: '#666', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                        {actor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                )}
                            </div>

                            {/* Actor Name */}
                            <div className="cast-name" style={{
                                fontSize: '0.85rem',
                                color: '#fff',
                                fontWeight: '700',
                                lineHeight: '1.2',
                                margin: '0 0 4px 0',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {actor.name.split(' ')[0]}
                            </div>

                            {/* Job / Character */}
                            <div className="cast-job" style={{
                                fontSize: '0.75rem',
                                color: '#888',
                                fontWeight: '500',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%'
                            }}>
                                {actor.character || 'Actor'}
                            </div>
                        </div>
                    ))}

                    {/* Creators / Crew in the same row if desired or separate? 
                        User: "Each cast card...". I'll stick to cast for now as primary UI. 
                        But I can add important crew too if available.
                    */}
                </div>

                {crew.length > 0 && (
                    <div className="creators-row" style={{ marginTop: '15px', padding: '10px 0', borderTop: '1px solid #111' }}>
                        <span style={{ fontSize: '0.8rem', color: '#555', textTransform: 'uppercase', fontWeight: 'bold', marginRight: '10px' }}>Created By</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
                            {crew.map(c => (
                                <span key={c.id} style={{ fontSize: '0.9rem', color: '#ccc', background: '#111', padding: '4px 12px', borderRadius: '20px' }}>
                                    {c.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>






            {/* SEASON COMPLETION OVERLAY */}
            {/* SEASON COMPLETION OVERLAY (Portal to Body for Viewport Positioning) */}
            {
                showSeasonCompletion && createPortal(
                    <div
                        className="season-complete-overlay"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw', // Explicit Viewport Width
                            height: '100vh', // Explicit Viewport Height
                            height: '100dvh', // Modern Mobile Height
                            background: 'rgba(0, 0, 0, 0.65)', // Slightly darker
                            backdropFilter: 'blur(12px)', // Stronger blur
                            zIndex: 10000, // Very high z-index
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'fadeIn 0.5s ease-out',
                            touchAction: 'none' // Disable touch interactions on backdrop
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                        }}
                    >
                        <div style={{
                            background: '#000000',
                            padding: '30px 20px',
                            borderRadius: '12px',
                            border: '1px solid #222',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            animation: 'popIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            width: '260px',
                            maxWidth: '85%',
                            textAlign: 'center'
                        }}>
                            <MdCelebration
                                style={{
                                    fontSize: '3rem',
                                    marginBottom: '15px',
                                    color: '#FFD600',
                                }}
                            />
                            <h1 style={{
                                fontSize: '1.2rem',
                                fontWeight: '900',
                                color: '#fff',
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                margin: '0 0 8px 0',
                                lineHeight: '1.2'
                            }}>
                                Season<br />Completed
                            </h1>
                            <p style={{
                                fontSize: '0.8rem',
                                color: '#888',
                                margin: 0,
                                fontWeight: '500'
                            }}>
                                Unlocking Poster Customization...
                            </p>
                        </div>
                        <style>{`
                            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                            @keyframes popIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                        `}</style>
                    </div>,
                    document.body
                )
            }

            {/* Daily Limit Popup */}
            {
                limitPopupVisible && (
                    <div
                        className="modal-overlay"
                        onClick={() => setLimitPopupVisible(false)}
                    >
                        <div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                background: '#000000',
                                border: '1px solid #333',
                                borderRadius: '16px',
                                padding: '30px',
                                maxWidth: '90%',
                                width: '320px',
                                textAlign: 'center',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                            }}
                        >
                            <MdMovie style={{ fontSize: '3rem', marginBottom: '15px', color: '#FFD600' }} />
                            <div style={{ fontSize: '1.2rem', lineHeight: '1.4', color: '#fff', marginBottom: '20px', fontWeight: 'bold' }}>
                                Take it slow
                            </div>
                            <p style={{ color: '#aaa', fontSize: '0.95rem', marginBottom: '25px' }}>
                                You can change one poster per day.
                            </p>
                            <button
                                onClick={() => setLimitPopupVisible(false)}
                                style={{
                                    background: '#FFD600',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '12px 30px',
                                    fontSize: '16px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    width: '100%'
                                }}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                )
            }


            {/* Poster Unlock Popup */}

            <PosterUnlockPopup
                isOpen={showPosterUnlockPopup}
                onClose={handlePopupClose}
                seriesId={posterUnlockData?.seriesId}
                seasonNumber={posterUnlockData?.seasonNumber}
                seriesName={posterUnlockData?.seriesName}
            />

        </div >
    );
};

export default MovieDetails;


