import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MdStar, MdAdd, MdRemove, MdCreate, MdFavorite, MdFavoriteBorder, MdVisibility, MdVisibilityOff, MdKeyboardArrowDown, MdClose, MdShare, MdCheck, MdIosShare, MdRateReview, MdArrowBack, MdPlayArrow, MdEdit, MdSentimentSatisfiedAlt, MdSentimentNeutral, MdSentimentVeryDissatisfied, MdHeartBroken } from 'react-icons/md';
import { FaArrowLeft } from 'react-icons/fa';
import ReviewsDrawer from '../components/ReviewsDrawer';
import ReviewModal from '../components/ReviewModal';
import StarBadger from '../components/StarBadger';
import PosterBadge from '../components/PosterBadge';
import StorySticker from '../components/StorySticker';
import ShareModal from '../components/ShareModal';
import LoadingPopup from '../components/LoadingPopup';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import html2canvas from 'html2canvas';
import { doc, deleteDoc, updateDoc, arrayUnion, arrayRemove, getDoc, collection, addDoc, query, where, getDocs, orderBy, onSnapshot, limit } from 'firebase/firestore';

import { logActivity } from '../utils/activityLogger';
import gsap from 'gsap';
import './Home.css';

const MovieDetails = () => {
    const { id, seasonNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth(); // Get Access to Auth
    const { confirm } = useNotification();
    const isTv = true;
    const type = 'tv';

    const [details, setDetails] = useState(null);
    const [cast, setCast] = useState([]);
    const [crew, setCrew] = useState([]);
    const [reviewsData, setReviewsData] = useState([]);
    const [ratings, setRatings] = useState([]);
    const [trailer, setTrailer] = useState(null);

    const [loading, setLoading] = useState(true);
    const [inWatchlist, setInWatchlist] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    // Animation Ref
    const heartRef = useRef(null);
    const brokenHeartRef = useRef(null);

    // Double Tap Logic
    let lastTap = 0;
    const handlePosterClick = (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 300 && tapLength > 0) {
            handlePosterDoubleTap(e);
        }
        lastTap = currentTime;
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
        const scaleVal = 1.0; // "Medium Small" (Reduced from 2.5)

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

    const [showStarBadge, setShowStarBadge] = useState(false);
    const [hasStarBadge, setHasStarBadge] = useState(false);


    const [seasonDetails, setSeasonDetails] = useState(null);
    const [isWatched, setIsWatched] = useState(false);

    // Review Modal State
    const [isReviewOpen, setIsReviewOpen] = useState(false);
    const [reviewingItem, setReviewingItem] = useState(null);
    const [existingReviewData, setExistingReviewData] = useState(null);

    // Episode Tracking
    const [episodeWatchedIDs, setEpisodeWatchedIDs] = useState([]);
    const [episodeWatchlistIDs, setEpisodeWatchlistIDs] = useState([]);
    const [showSeasonCompletion, setShowSeasonCompletion] = useState(false);
    const [completedSeasonInfo, setCompletedSeasonInfo] = useState(null);

    const [selectedSeason, setSelectedSeason] = useState(seasonNumber ? parseInt(seasonNumber) : 1);

    // Filter User Series Review (for Action Button State) - Keeping Series Level
    const userSeriesReview = reviewsData.find(r => r.tmdbId === parseInt(id || 0) && r.userId === currentUser?.uid && !r.isEpisode && !r.isSeason);
    // Find User Season Review
    const userSeasonReview = reviewsData.find(r => r.tmdbId === parseInt(id || 0) && r.userId === currentUser?.uid && r.isSeason && r.seasonNumber === selectedSeason);

    const [isSeasonOpen, setIsSeasonOpen] = useState(false);
    const [episodes, setEpisodes] = useState([]);
    const [seasonsValues, setSeasonsValues] = useState([]);

    const [watchProviders, setWatchProviders] = useState(null);

    // Review Likes State
    const [reviewLikes, setReviewLikes] = useState({});
    const [isReviewsOpen, setIsReviewsOpen] = useState(false);
    const [shareModal, setShareModal] = useState({ isOpen: false, imageUrl: '' });

    // Helper Functions (need to be defined before computed values)
    const getSeasonName = (seasonNum) => {
        const season = seasonsValues.find(s => s.season_number === seasonNum);
        return season && season.name ? season.name : `Season ${seasonNum}`;
    };

    const getCurrentSeasonRating = () => {
        const seasonReviews = reviewsData.filter(r => r.tmdbId === parseInt(id) && r.seasonNumber === selectedSeason && r.isEpisode);
        if (seasonReviews.length === 0) return { avg: "0.0", count: 0 };
        const sum = seasonReviews.reduce((acc, r) => acc + (parseFloat(r.rating) || 0), 0);
        return { avg: (sum / seasonReviews.length).toFixed(1), count: seasonReviews.length };
    };

    // Computed Values
    const title = details?.name || 'Loading...';
    const seasonStats = getCurrentSeasonRating();



    // Sticker Logic
    const [stickerModalOpen, setStickerModalOpen] = useState(false);
    const [stickerStatus, setStickerStatus] = useState('idle'); // idle, preparing, ready
    const [stickerData, setStickerData] = useState(null);
    const [generatedStickerImage, setGeneratedStickerImage] = useState(null);
    const stickerRef = useRef(null);

    const generateSticker = async () => {
        if (!stickerRef.current) return;
        setStickerStatus('preparing');

        // CRITICAL FIX: Wait for images to load before capture
        // This prevents black/empty stickers on mobile

        // Step 1: Small delay for DOM to settle
        await new Promise(r => setTimeout(r, 100));

        // Step 2: Wait for BOTH images to finish loading
        const waitForImages = async () => {
            const maxWait = 4000; // 4 second timeout
            const startTime = Date.now();

            while (Date.now() - startTime < maxWait) {
                const posterLoaded = stickerRef.current?.getAttribute('data-poster-loaded') === 'true';
                const pfpLoaded = stickerRef.current?.getAttribute('data-pfp-loaded') === 'true';

                if (posterLoaded && pfpLoaded) {
                    return true; // Both images loaded
                }

                // Check every 50ms
                await new Promise(r => setTimeout(r, 50));
            }

            console.warn('Image load timeout - proceeding anyway');
            return false;
        };

        await waitForImages();

        // Step 3: Additional delay for fonts/layout (mobile-critical)
        await new Promise(r => setTimeout(r, 400));

        try {
            const canvas = await html2canvas(stickerRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
                width: 1080,
                height: 1920,
                logging: false,
                allowTaint: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('story-sticker-element');
                    if (el) {
                        el.style.display = 'flex';
                        el.style.position = 'relative';
                        el.style.top = '0';
                        el.style.left = '0';
                        el.style.transform = 'none';
                    }
                }
            });

            canvas.toBlob((blob) => {
                if (!blob) {
                    console.error("Blob generation failed");
                    setStickerStatus('idle');
                    return;
                }
                const url = URL.createObjectURL(blob);
                setGeneratedStickerImage(url);
                setStickerStatus('ready');
            }, 'image/png');

        } catch (e) {
            console.error("Sticker Gen Error:", e);
            setStickerStatus('idle');
        }
    };

    // Auto-trigger generation whenever data is set for the modal
    useEffect(() => {
        if (stickerModalOpen && stickerData && stickerStatus === 'idle') {
            generateSticker();
        }
    }, [stickerModalOpen, stickerData, stickerStatus]);

    const handleShareSticker = async () => {
        if (!generatedStickerImage) return;
        try {
            const blob = await fetch(generatedStickerImage).then(r => r.blob());
            const file = new File([blob], `SERIEE_Share_${Date.now()}.png`, { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file]
                });
            } else {
                // Fallback: Download logic if share not supported (Desktop) calls the same blob logic or shows prompt
                const a = document.createElement('a');
                a.href = generatedStickerImage;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        } catch (e) {
            console.error("Native Share Error", e);
        }
    };

    const closeStickerModal = () => {
        setStickerModalOpen(false);
        setStickerStatus('idle');
        setGeneratedStickerImage(null);
        setStickerData(null);
    };

    const handleShare = (reviewItem, isEpisode = false, isSeason = false) => {
        // CRITICAL: Reset cached image to force fresh generation
        setGeneratedStickerImage(null);
        setStickerStatus('idle');

        // Resolve Poster Path & Season Info
        let posterPathToUse = details.poster_path; // Default: Series Poster
        let seasonEpisodeText = null;

        const targetSeasonNum = reviewItem.seasonNumber;
        const foundSeason = targetSeasonNum ? seasonsValues.find(s => s.season_number === targetSeasonNum) : null;

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

        setStickerData({
            movie: {
                name: details.name,
                poster_path: posterPathToUse,
                seasonEpisode: seasonEpisodeText
            },
            rating: reviewItem?.rating ? parseFloat(reviewItem.rating) : 0,
            user: currentUser,
            isEpisodes: isEpisode
        });
        setStickerModalOpen(true);
    };

    useEffect(() => {
        const savedReviewLikes = JSON.parse(localStorage.getItem('reviewLikes') || '{}');
        setReviewLikes(savedReviewLikes);
    }, []);

    // Star Badge Prompt Logic (Moved to Top Level to avoid Hook Error)
    useEffect(() => {
        // Only trigger on Main Series Page (no seasonNumber param)
        if (currentUser && details && !seasonNumber) {
            const checkPrompt = async () => {
                try {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const snap = await getDoc(userRef);
                    if (snap.exists()) {
                        const d = snap.data();
                        const hasStar = d.starSeries?.some(s => s.id === details.id);
                        const hasPrompted = d.promptedSeries?.includes(String(details.id));
                        if (!hasStar && !hasPrompted) setTimeout(() => setShowStarBadge(true), 1000);
                    }
                } catch (e) {
                    console.error("Error checking prompt state", e);
                }
            };
            checkPrompt();
        }
    }, [currentUser, details, seasonNumber]);

    // Check Star Badge Status (Initial)
    useEffect(() => {
        if (currentUser && details && currentUser.starSeries) {
            const hasStar = currentUser.starSeries.some(s => s.id === details.id);
            setHasStarBadge(hasStar);
        }
    }, [currentUser, details]);

    const handlePromptClose = () => {
        setShowStarBadge(false);
        // Assuming if prompt closed after YES, we earned a star.
        // We can verify this or just optimistically set it to true if we know it was success.
        // Or re-check sync? 
        // For now, let's force a sync or just set true
        // Actually, the Prompt tracks whether user clicked YES. 
        // If we want to be precise, StarBadger should pass "earned: true" to onClose.
        // But for now, if the star badge prompt WAS REVEALED and closed, it likely means interaction happened.
        // Let's rely on syncUserState re-running or better yet, just manually set it if we suspect success.
        // BUT, `StarBadger` updates FireStore. We should probably update local state too.

        // Since StarBadger handles the update, we can just set this to true if we want immediate feedback
        // But we don't know if they clicked Yes or No here.
        // Let's assume we can fetch or listen.
        // However, user specifically asked "WHEN THE USER CLICKED THE YES BUTTON... POSTER GETTING... STARBADGE".
        // I'll update it optimistically here if needed, but better to update StarBadger to pass a success flag.
        // For this step I'll just adding the state variable, I'll modify Star Badger call separately.
        checkUser(); // Re-fetch to be sure
    };

    // Override handlePromptClose to receive success flag
    const handleStarBadgeComplete = (success) => {
        setShowStarBadge(false);
        if (success) setHasStarBadge(true); // Immediate update
        checkUser();
    };

    // Real-time Reviews Listener (Firestore) for this Series
    // Real-time Reviews Listener (Firestore) for this Series - Optimized
    useEffect(() => {
        if (!id) return;
        // Limit to 20 recent reviews to save bandwidth/reads
        const q = query(
            collection(db, 'reviews'),
            where('tmdbId', '==', parseInt(id)),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        const unsub = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
            // We replace local state with Firestore data to ensure ratings are accurate
            setReviewsData(fetched);
        });
        return () => unsub();
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
        const fetchData = async () => {
            setLoading(true);
            try {
                // Parallel fetch for Details, Credits (Cast/Crew), Reviews, Providers, and External IDs
                const [detailsRes, creditsRes, reviewsRes, providersRes, externalIdsRes, videosRes] = await Promise.all([
                    fetch(`${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=images,recommendations&include_image_language=en,null`),
                    fetch(`${TMDB_BASE_URL}/${type}/${id}/credits?api_key=${TMDB_API_KEY}`),
                    fetch(`${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${TMDB_API_KEY}`),
                    fetch(`${TMDB_BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`),
                    fetch(`${TMDB_BASE_URL}/${type}/${id}/external_ids?api_key=${TMDB_API_KEY}`),
                    fetch(`${TMDB_BASE_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`)
                ]);

                const detailsData = await detailsRes.json();
                const creditsData = await creditsRes.json();
                const reviewsData = await reviewsRes.json();
                const providersData = await providersRes.json();
                const externalIdsData = await externalIdsRes.json();
                const videosData = await videosRes.json();

                // Fetch OMDb Ratings if IMDb ID exists
                if (externalIdsData.imdb_id) {
                    try {
                        const omdbRes = await fetch(`https://www.omdbapi.com/?i=${externalIdsData.imdb_id}&apikey=15529774`);
                        const omdbData = await omdbRes.json();
                        setRatings(omdbData.Ratings || []);
                        if (omdbData.imdbRating) {
                            setRatings(prev => {
                                // dedup if imdb already in Ratings array (sometimes it is, sometimes not)
                                const exists = prev.some(r => r.Source === "Internet Movie Database");
                                if (!exists) return [...prev, { Source: "Internet Movie Database", Value: `${omdbData.imdbRating}/10` }];
                                return prev;
                            });
                        }
                    } catch (e) {
                        console.error("OMDb Fetch Error", e);
                    }
                }

                // Set Watch Providers (Prioritize IN, then US)
                setWatchProviders(providersData.results?.IN || providersData.results?.US || null);

                setDetails(detailsData);
                setCast(creditsData.cast?.slice(0, 10) || []); // Top 10 cast

                // Get creators or executive producers for "Director" equivalent in TV
                const creators = detailsData.created_by || [];
                setCrew(creators);

                if (videosData?.results) {
                    const trailerVideo = videosData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
                    setTrailer(trailerVideo || null);
                }

                setCrew(creators);

                // Fetch Reviews from Firestore - Handled by Real-time Listener now
                // setReviewsData(firestoreReviews);


                if (detailsData.seasons) {
                    setSeasonsValues(detailsData.seasons.filter(s => s.season_number > 0)); // Skip Specials (S0) usually
                }

                checkUser(detailsData.id);
                // Don't set loading false yet if we want to wait for episodes, but for perceived perf, maybe separate?
                // Let's just fetch season 1 default immediately if exists
                if (detailsData.seasons && detailsData.seasons.length > 0) {
                    const seasonToFetch = seasonNumber ? parseInt(seasonNumber) : 1;
                    setSelectedSeason(seasonToFetch); // Ensure state sync
                    fetchSeasonEpisodes(detailsData.id, seasonToFetch, detailsData.name);
                } else {
                    setLoading(false);
                }
            } catch (error) {
                console.error("Failed to fetch details", error);
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);



    const fetchSeasonEpisodes = async (seriesId, seasonNum, seriesNameOverride = null) => {
        try {
            const [res, videosRes] = await Promise.all([
                fetch(`${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNum}?api_key=${TMDB_API_KEY}`),
                fetch(`${TMDB_BASE_URL}/tv/${seriesId}/season/${seasonNum}/videos?api_key=${TMDB_API_KEY}`)
            ]);

            const data = await res.json();
            const videosData = await videosRes.json();

            let episodes = data.episodes || [];

            // OMDb Integration for Season Ratings
            const nameToUse = seriesNameOverride || details?.name;
            if (nameToUse) {
                try {
                    const omdbRes = await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(nameToUse)}&Season=${seasonNum}&apikey=15529774`);
                    const omdbData = await omdbRes.json();

                    if (omdbData.Response === "True" && omdbData.Episodes) {
                        // Merge ratings
                        episodes = episodes.map(ep => {
                            const omdbEp = omdbData.Episodes.find(o => o.Episode === String(ep.episode_number));
                            return omdbEp ? { ...ep, omdbRating: omdbEp.imdbRating } : ep;
                        });
                    }
                } catch (e) {
                    console.warn("OMDb Season fetch failed", e);
                }
            }

            setEpisodes(episodes);
            setSeasonDetails({ ...data, videos: videosData });

            // Set Season Trailer if available
            if (videosData?.results) {
                const trailerVideo = videosData.results.find(vid => vid.type === 'Trailer' && vid.site === 'YouTube');
                setTrailer(trailerVideo || null);
            } else {
                setTrailer(null);
            }

            setLoading(false);
        } catch (err) {
            console.error("Failed to fetch episodes", err);
            setLoading(false);
        }
    };



    const [showStoryPrompt, setShowStoryPrompt] = useState(false);
    const [storyPromptData, setStoryPromptData] = useState(null);

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

    const handleSeasonChange = (e) => {
        const newSeason = parseInt(e.target.value);
        setSelectedSeason(newSeason);
        fetchSeasonEpisodes(id, newSeason);
    };

    // Sync User State from Firestore (Season Aware)
    // Sync User State from Firestore (Season Aware) - Optimized using AuthContext
    useEffect(() => {
        if (currentUser && details && userData) {
            const data = userData;

            // Check Season specific state if season > 0
            // We use selectedSeason to check.
            const isSeasonItem = (i) => i.id === details.id && i.isSeason && i.seasonNumber === selectedSeason;
            const isSeriesItem = (i) => i.id === details.id && !i.isEpisode && !i.isSeason;

            // Watchlist: Check if THIS season (or series if fallback) is in watchlist
            setInWatchlist(data.watchlist?.some(i => i.seriesId === details.id && i.isSeason && i.seasonNumber === selectedSeason) || false);

            // Like
            setIsLiked(data.likes?.some(i => i.seriesId === details.id && i.isSeason && i.seasonNumber === selectedSeason) || false);

            // Watched
            setIsWatched(data.watched?.some(i => i.seriesId === details.id && i.isSeason && i.seasonNumber === selectedSeason) || false);

            // Sync Episode States
            const watchedEps = data.watched?.filter(i => i.seriesId === details.id && i.isEpisode).map(i => i.id) || [];
            setEpisodeWatchedIDs(watchedEps);

            const watchlistEps = data.watchlist?.filter(i => i.seriesId === details.id && i.isEpisode).map(i => i.id) || [];
            setEpisodeWatchlistIDs(watchlistEps);
        }
    }, [currentUser, details, selectedSeason, userData]);

    // Legacy checkUser removed as it used localStorage
    const checkUser = (tmdbId) => {
        // Kept empty to prevent errors if called elsewhere in legacy code flow
    };

    const toggleWatchlist = async () => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);

        // Define Season Item
        const seasonItem = {
            id: `${details.id}-S${selectedSeason}`, // Unique ID for finding in array (optional, or just rely on properties)
            seriesId: details.id,
            name: `${details.name} (Season ${selectedSeason})`,
            poster_path: seasonDetails?.poster_path || details.poster_path, // Use season poster
            vote_average: details.vote_average, // Or season rating if we had it
            first_air_date: seasonDetails?.air_date || details.first_air_date,
            type: 'season',
            isSeason: true,
            seasonNumber: selectedSeason,
            date: new Date().toISOString()
        };

        // Define Episode Items for Bulk Add/Remove
        const seasonPoster = seasonDetails?.poster_path || details.poster_path;
        const episodeItems = episodes.map(ep => ({
            id: ep.id,
            name: `${details.name} - S${ep.season_number}E${ep.episode_number}: ${ep.name}`,
            poster_path: details.poster_path, // Keep Series Poster as main lookup
            seasonPoster: seasonPoster,
            still_path: ep.still_path,
            backdrop_path: ep.still_path,
            vote_average: ep.vote_average,
            first_air_date: ep.air_date,
            type: 'episode',
            isEpisode: true,
            seriesId: details.id,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            date: new Date().toISOString()
        }));

        if (inWatchlist) {
            if (userData) { // Use userData from context
                const data = userData;
                // Filter out Season Item AND All Episodes of this season
                const newWatchlist = (data.watchlist || []).filter(i => {
                    const isTargetSeason = i.seriesId === details.id && i.seasonNumber === selectedSeason && i.isSeason;
                    const isTargetEpisode = i.seriesId === details.id && i.seasonNumber === selectedSeason && i.isEpisode;
                    return !isTargetSeason && !isTargetEpisode;
                });
                await updateDoc(userRef, { watchlist: newWatchlist });
            }
            // Update Local State: Remove IDs of current season episodes
            setEpisodeWatchlistIDs(prev => prev.filter(id => !episodes.some(e => e.id === id)));
        } else {
            // Add Season Item AND All Episodes
            const itemsToAdd = [seasonItem, ...episodeItems];
            await updateDoc(userRef, {
                watchlist: arrayUnion(...itemsToAdd)
            });
            // Update Local State: Add IDs
            setEpisodeWatchlistIDs(prev => [...new Set([...prev, ...episodes.map(e => e.id)])]);

            // LOG ACTIVITY
            logActivity(userData || currentUser, 'watchlist', {
                id: details.id,
                name: details.name,
                poster_path: details.poster_path,
                seasonNumber: selectedSeason
            });
        }
        setInWatchlist(!inWatchlist);
    };

    const toggleLike = async () => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const itemToSave = {
            id: `${details.id}-S${selectedSeason}`,
            seriesId: details.id,
            name: `${details.name} (Season ${selectedSeason})`,
            poster_path: seasonDetails?.poster_path || details.poster_path,
            vote_average: details.vote_average,
            first_air_date: seasonDetails?.air_date || details.first_air_date,
            type: 'season',
            isSeason: true,
            seasonNumber: selectedSeason,
            date: new Date().toISOString()
        };

        if (isLiked) {
            if (userData) {
                const newLikes = (userData.likes || []).filter(i => !(i.seriesId === details.id && i.seasonNumber === selectedSeason && i.isSeason));
                await updateDoc(userRef, { likes: newLikes });
            }
        } else {
            await updateDoc(userRef, {
                likes: arrayUnion(itemToSave)
            });
            // LOG ACTIVITY
            logActivity(userData || currentUser, 'liked', {
                id: details.id,
                name: details.name,
                poster_path: details.poster_path,
                seasonNumber: selectedSeason
            });
        }
        setIsLiked(!isLiked);
    };

    // Watched Logic


    useEffect(() => {
        if (details) {
            checkWatched(details.id);
        }
    }, [details]);

    const checkWatched = (tmdbId) => {
        // Handled by syncUserState effect
    };

    const toggleWatched = async () => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const itemToSave = {
            id: `${details.id}-S${selectedSeason}`,
            seriesId: details.id,
            name: `${details.name} (Season ${selectedSeason})`,
            poster_path: seasonDetails?.poster_path || details.poster_path,
            vote_average: details.vote_average,
            first_air_date: seasonDetails?.air_date || details.first_air_date,
            type: 'season',
            isSeason: true,
            seasonNumber: selectedSeason,
            date: new Date().toISOString()
        };

        if (isWatched) {
            if (userData) {
                const newWatched = (userData.watched || []).filter(i => !(i.seriesId === details.id && i.seasonNumber === selectedSeason && i.isSeason));
                await updateDoc(userRef, { watched: newWatched });
            }
        } else {
            await updateDoc(userRef, {
                watched: arrayUnion(itemToSave)
            });
            // LOG ACTIVITY
            logActivity(userData || currentUser, 'watched', {
                id: details.id,
                name: details.name,
                poster_path: details.poster_path,
                seasonNumber: selectedSeason
            });
        }
        setIsWatched(!isWatched);
    };

    // Removed addToWatched helper as it's merged or unnecessary with direct FS calls

    // Episode Watchlist Logic


    useEffect(() => {
        const watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
        setEpisodeWatchlistIDs(watchlist.filter(i => i.isEpisode).map(i => i.id));

        const watched = JSON.parse(localStorage.getItem('watched') || '[]');
        setEpisodeWatchedIDs(watched.filter(i => i.isEpisode).map(i => i.id));
    }, []);

    const checkEpisodeInWatchlist = (epId) => {
        return episodeWatchlistIDs.includes(epId);
    };

    const checkEpisodeWatched = (epId) => {
        return episodeWatchedIDs.includes(epId);
    };

    const toggleEpisodeWatched = async (episode) => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);
        const itemToSave = {
            id: episode.id,
            episodeId: episode.id,
            seriesId: details.id,
            name: details.name, // Main name is Series name
            episodeName: episode.name,
            poster_path: details.poster_path,
            still_path: episode.still_path,
            vote_average: episode.vote_average,
            first_air_date: episode.air_date,
            type: 'episode',
            date: new Date().toISOString(),
            isEpisode: true,
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number
        };

        try {
            if (checkEpisodeWatched(episode.id)) {
                // Remove
                if (userData) {
                    const data = userData;
                    const newWatched = (data.watched || []).filter(i => i.id !== episode.id);
                    // Also potentially remove milestones? (Too complex to revert completion logic for now, let's keep it simple: milestones stay)
                    await updateDoc(userRef, { watched: newWatched });
                }
                setEpisodeWatchedIDs(prev => prev.filter(id => id !== episode.id));
            } else {
                // Add
                // 1. Update Watched List
                // We need to fetch current list to calculate completion accurately
                if (userData) {
                    const data = userData;
                    let currentWatched = data.watched || [];
                    let currentAchievements = data.achievements || [];
                    let currentStarSeries = data.starSeries || [];

                    // Add new item locally for calculation
                    const updatedWatched = [...currentWatched, itemToSave];

                    // --- SEASON COMPLETION CHECK (Client Side Only) ---
                    // 1. Is this the last episode of the CURRENT season?
                    // We rely on 'seasonDetails' which contains all episodes for the selected season.
                    if (seasonDetails && seasonDetails.episodes) {
                        const totalEpisodes = seasonDetails.episodes.length;
                        const isLastEpisode = episode.episode_number === totalEpisodes; // Assuming ordered numbers

                        if (isLastEpisode) {
                            // 2. Are all PREVIOUS episodes watched?
                            // We check if every episode (except the current one we are adding) is in 'episodeWatchedIDs'.
                            const allOthersWatched = seasonDetails.episodes.every(ep => {
                                if (ep.id === episode.id) return true; // Current one is being added now
                                return episodeWatchedIDs.includes(ep.id);
                            });

                            if (allOthersWatched) {
                                // TRIGGER CELEBRATION
                                setCompletedSeasonInfo({
                                    seasonNumber: episode.season_number,
                                    poster: seasonDetails?.poster_path || details.poster_path
                                });
                                setShowSeasonCompletion(true);

                                // Auto Dismiss
                                setTimeout(() => {
                                    setShowSeasonCompletion(false);
                                    // Optional: Show "Write Review" hint here via another state if desired, but keeping minimal as requested.
                                }, 3000);
                            }
                        }
                    }
                    // --------------------------------------------------

                    // 2. Check Season Completion
                    const season = seasonsValues.find(s => s.season_number === episode.season_number);
                    let newAchievements = [];
                    let newStarSeries = [];

                    if (season) {
                        const watchedInSeason = updatedWatched.filter(w => w.seriesId === details.id && w.seasonNumber === episode.season_number);
                        if (watchedInSeason.length >= season.episode_count) {
                            // Season Completed!
                            const achievementId = `${details.id}-S${episode.season_number}-COMPLETED`;
                            if (!currentAchievements.some(a => a.id === achievementId)) {
                                newAchievements.push({
                                    id: achievementId,
                                    seriesId: details.id,
                                    name: details.name,
                                    seasonNumber: episode.season_number,
                                    type: 'season_finish',
                                    date: new Date().toISOString(),
                                    poster_path: details.poster_path
                                });
                            }
                        }
                    }

                    // 3. Check Series Completion
                    // Deduplicate by episode ID to be sure
                    const uniqueWatchedIDs = new Set(updatedWatched.filter(w => w.seriesId === details.id).map(w => w.id));
                    // Note: details.number_of_episodes is total.
                    if (uniqueWatchedIDs.size >= details.number_of_episodes) {
                        // Series Completed!
                        const seriesAchievementId = `${details.id}-SERIES-COMPLETED`;
                        if (!currentAchievements.some(a => a.id === seriesAchievementId)) {
                            newAchievements.push({
                                id: seriesAchievementId,
                                seriesId: details.id,
                                name: details.name,
                                type: 'series_finish',
                                date: new Date().toISOString(),
                                poster_path: details.poster_path
                            });

                            // Add to Star Series Table (Array)
                            if (!currentStarSeries.some(s => s.id === details.id)) {
                                newStarSeries.push({
                                    id: details.id,
                                    name: details.name,
                                    poster_path: details.poster_path,
                                    date: new Date().toISOString()
                                });
                            }
                        }
                    }

                    // Commit Updates
                    const updatePayload = {
                        watched: arrayUnion(itemToSave)
                    };
                    if (newAchievements.length > 0) updatePayload.achievements = arrayUnion(...newAchievements);
                    if (newStarSeries.length > 0) updatePayload.starSeries = arrayUnion(...newStarSeries);

                    await updateDoc(userRef, updatePayload);
                    setEpisodeWatchedIDs(prev => [...prev, episode.id]);

                    // FEATURE: Continue Watching Intelligence
                    // Find Next Episode
                    let nextEpisode = null;
                    if (seasonDetails && seasonDetails.episodes) {
                        const currentIdx = seasonDetails.episodes.findIndex(e => e.id === episode.id);
                        if (currentIdx !== -1 && currentIdx < seasonDetails.episodes.length - 1) {
                            nextEpisode = seasonDetails.episodes[currentIdx + 1];
                        } else if (seasonsValues) {
                            // Check Next Season
                            const currentSeasonIdx = seasonsValues.findIndex(s => s.season_number === episode.season_number);
                            if (currentSeasonIdx !== -1 && currentSeasonIdx < seasonsValues.length - 1) {
                                const nextSeason = seasonsValues[currentSeasonIdx + 1];
                                nextEpisode = {
                                    season_number: nextSeason.season_number,
                                    episode_number: 1,
                                    name: "Episode 1", // Fallback name
                                    seasonPoster: nextSeason.poster_path // Ensure we pass this if available
                                };
                            }
                        }
                    }

                }
            }
        } catch (error) {
            console.error("Error toggling watch:", error);
        }
    };

    const toggleEpisodeWatchlist = async (episode) => {
        if (!currentUser) return;
        const userRef = doc(db, 'users', currentUser.uid);

        // Find correct season poster
        // We know 'seasonDetails' matches 'selectedSeason'. 
        // If episode.season_number === selectedSeason, use seasonDetails.poster_path
        const seasonPoster = (seasonDetails && seasonDetails.season_number === episode.season_number)
            ? seasonDetails.poster_path
            : null;

        const itemToSave = {
            id: episode.id,
            name: `${details.name} - S${episode.season_number}E${episode.episode_number}: ${episode.name}`,
            poster_path: details.poster_path, // Keep Series Poster as main lookup
            seasonPoster: seasonPoster, // NEW: Specific Season Poster
            still_path: episode.still_path,
            backdrop_path: episode.still_path,
            vote_average: episode.vote_average,
            first_air_date: episode.air_date,
            type: 'episode',
            isEpisode: true,
            seriesId: details.id,
            seasonNumber: episode.season_number,
            episodeNumber: episode.episode_number,
            date: new Date().toISOString()
        };

        if (checkEpisodeInWatchlist(episode.id)) {
            if (userData) {
                const data = userData;
                const newWatchlist = (data.watchlist || []).filter(i => i.id !== episode.id);
                await updateDoc(userRef, { watchlist: newWatchlist });
            }
            setEpisodeWatchlistIDs(prev => prev.filter(id => id !== episode.id));
        } else {
            await updateDoc(userRef, {
                watchlist: arrayUnion(itemToSave)
            });
            setEpisodeWatchlistIDs(prev => [...prev, episode.id]);
        }
    };



    const handleReviewLike = async (reviewId) => {
        if (!currentUser) return;

        const review = reviewsData.find(r => r.id === reviewId);
        if (!review) return;

        const hasUserLikedReview = review.likes && review.likes.includes(currentUser.uid);
        const userRef = doc(db, 'users', currentUser.uid);
        const reviewRef = doc(db, 'reviews', reviewId);

        try {
            if (hasUserLikedReview) {
                // Unlike: Remove UID from review.likes
                await updateDoc(reviewRef, { likes: arrayRemove(currentUser.uid) });

                // Remove from User Activity (Read-Modify-Write for safe object removal)
                if (userData) {
                    const newLikes = (userData.likes || []).filter(l => !(l.type === 'like_review' && l.reviewId === reviewId));
                    await updateDoc(userRef, { likes: newLikes });
                }

                // Update Local State
                setReviewsData(prev => prev.map(r => {
                    if (r.id === reviewId) {
                        return { ...r, likes: (r.likes || []).filter(uid => uid !== currentUser.uid) };
                    }
                    return r;
                }));

            } else {
                // Like: Add UID to review.likes
                await updateDoc(reviewRef, { likes: arrayUnion(currentUser.uid) });

                // Add to User Activity
                const activityItem = {
                    type: 'like_review',
                    reviewId: review.id,
                    targetUserId: review.userId,
                    targetUsername: review.userName || review.author || 'User',
                    seriesId: details.id,
                    name: details.name, // Series Name
                    seasonNumber: review.seasonNumber,
                    episodeNumber: review.episodeNumber,
                    poster_path: details.poster_path,
                    seasonPoster: seasonDetails?.poster_path,
                    date: new Date().toISOString()
                };
                await updateDoc(userRef, { likes: arrayUnion(activityItem) });

                // Update Local State
                setReviewsData(prev => prev.map(r => {
                    if (r.id === reviewId) {
                        return { ...r, likes: [...(r.likes || []), currentUser.uid] };
                    }
                    return r;
                }));
            }
        } catch (error) {
            console.error("Error toggling review like:", error);
        }
    };



    // Get existing review for an item
    // Get existing review for an item
    const getExistingReview = (itemId, isEpisode = false, isSeason = false, seasonNum = null) => {
        if (!currentUser) return null;
        if (isEpisode) {
            return reviewsData.find(r => r.episodeId === itemId && r.isEpisode && r.userId === currentUser.uid);
        } else if (isSeason) {
            return reviewsData.find(r => r.tmdbId === itemId && r.isSeason && r.seasonNumber === seasonNum && r.userId === currentUser.uid);
        } else {
            // Series (Default)
            // Ensure we exclude seasons/episodes
            return reviewsData.find(r => r.tmdbId === itemId && !r.isEpisode && !r.isSeason && r.userId === currentUser.uid);
        }
    };

    const handleSeasonReview = (seasonNum) => {
        const existing = getExistingReview(details.id, false, true, seasonNum); // itemId, isEpisode, isSeason, seasonNum
        setExistingReviewData(existing || null);
        setReviewingItem({
            type: 'season',
            id: details.id,
            name: `${details.name} (Season ${seasonNum})`,
            seasonNumber: seasonNum
        });
        setIsReviewOpen(true);
    };

    const handleEditReview = (review) => {
        setExistingReviewData(review);
        setReviewingItem({
            type: review.isEpisode ? 'episode' : (review.isSeason ? 'season' : 'series'),
            id: review.isEpisode ? review.episodeId : review.tmdbId,
            name: review.topicName || details.name, // generic fallback
            seasonNumber: review.seasonNumber,
            episodeNumber: review.episodeNumber
        });
        setIsReviewOpen(true);
    }

    // Review Submit Logic (Common for Series, Season, Episode)
    const handleReviewSubmit = async (data) => {
        if (!currentUser) return;
        const { rating, review } = data;

        // Determine Targets
        let targetId = reviewingItem.id;
        let isEpisode = reviewingItem.type === 'episode';
        let isSeason = reviewingItem.type === 'season';

        // Define Doc Ref (Update if exists, Add if new)
        // We can't use setDoc with custom ID easily unless we enforce ID gen.
        // But we have 'existingReviewData' which contains the ID if editing.

        try {
            if (existingReviewData && existingReviewData.id) {
                // UPDATE
                const reviewRef = doc(db, 'reviews', existingReviewData.id);
                await updateDoc(reviewRef, {
                    rating: rating,
                    review: review,
                    updatedAt: new Date().toISOString() // Update timestamp? User usually wants 'edited' timestamp or just update.
                });
                // Local Update (Optimistic)
                setReviewsData(prev => prev.map(r => r.id === existingReviewData.id ? { ...r, rating, review, updatedAt: new Date().toISOString() } : r));
            } else {
                // CREATE
                const reviewDataPayload = {
                    userId: currentUser.uid,
                    userName: currentUser.displayName || currentUser.email, // Fallback
                    author: currentUser.email, // Legacy field support
                    photoURL: currentUser.photoURL,
                    tmdbId: parseInt(details.id), // Series ID is common pivot
                    seriesId: details.id, // Semantic

                    // Discriminators
                    isEpisode: isEpisode,
                    isSeason: isSeason,

                    // Specifics
                    episodeId: isEpisode ? reviewingItem.id : null,
                    episodeNumber: isEpisode ? reviewingItem.episodeNumber : null,
                    seasonNumber: isSeason ? reviewingItem.seasonNumber : (isEpisode ? reviewingItem.seasonNumber : null),

                    rating: rating,
                    review: review,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    likes: [],
                    source: 'app',
                    topicName: reviewingItem.name, // Store the name of the item being reviewed (series, season, episode)
                    poster_path: details.poster_path // Add poster path for UserReview page
                };

                const newDocRef = await addDoc(collection(db, 'reviews'), reviewDataPayload);

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

                // Update Local
                setReviewsData(prev => [...prev, {
                    ...reviewDataPayload,
                    id: newDocRef.id,
                    likes: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }]);

                // SUCCESS FLOW (Silent Badge Add) - Only for Series/Season reviews
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
                }
            }


            // Trigger Sticker Flow (for new reviews only)
            // Use reviewingItem which is always available, not reviewDataPayload (only in CREATE block)
            if (!existingReviewData) {
                const isEp = isEpisode;
                const isSe = isSeason;

                let seasonEpisodeText = null;
                if (isEp) {
                    seasonEpisodeText = `S${reviewingItem.seasonNumber} E${reviewingItem.episodeNumber}`;
                } else if (isSe) {
                    seasonEpisodeText = `S${reviewingItem.seasonNumber}`;
                }

                setStickerData({
                    movie: {
                        name: details.name,
                        poster_path: details.poster_path,
                        seasonEpisode: seasonEpisodeText
                    },
                    rating: parseFloat(rating),
                    user: currentUser,
                    isEpisodes: isEp
                });
                setStickerModalOpen(true);
                setStickerStatus('idle');
            }

        } catch (e) {
            console.error("Error saving review", e);
        }
        setIsReviewOpen(false);
    };

    const openEpisodeReview = (ep) => {
        const existing = getExistingReview(ep.id, true);
        setExistingReviewData(existing || null);
        setReviewingItem({
            type: 'episode',
            id: ep.id,
            name: `${details.name} S${ep.season_number}E${ep.episode_number}`,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number
        });
        setIsReviewOpen(true);
    };



    const handleAction = async (actionFn) => {
        await actionFn();
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
            console.error("Error saving review: ", error);
        }
    };
    */

    if (loading) return <div className="loading">Loading...</div>;
    if (!details) return <div className="loading">Not found</div>;


    const date = details.first_air_date;
    const year = date ? date.split('-')[0] : 'N/A';
    const backdropUrl = `https://image.tmdb.org/t/p/original${details.backdrop_path}`;
    // Use Season Poster if seasonDetails exists (and matches selectedSeason, implicit via fetch)
    const displayPosterPath = seasonDetails?.poster_path || details.poster_path;
    const posterUrl = `https://image.tmdb.org/t/p/w500${displayPosterPath}`;




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
        <div className="movie-details-container">
            {/* Star Badge Prompt */}
            {details && (
                <StarBadger
                    isOpen={showStarBadge}
                    onClose={() => handleStarBadgeComplete(false)}
                    user={currentUser}
                    series={details}
                    onComplete={() => handleStarBadgeComplete(true)} // Pass true on success
                />
            )}

            <div
                className="backdrop-overlay"
                style={{
                    backgroundImage: `linear-gradient(to top, #000000 10%, transparent 90%), url(${backdropUrl})`,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '60vh',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    zIndex: -1,
                    opacity: 0.3
                }}
            />

            <div className="details-content" style={{ marginTop: '5vh', width: '100%', maxWidth: '1000px', margin: '5vh auto 0', padding: '0 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', position: 'relative', zIndex: 1 }}>

                {/* VISUAL TITLE CARD BOX (Backdrop) with Logo & Fade */}
                <div style={{
                    width: '100%',
                    maxWidth: '1000px', // Increased width (though 100% might be too wide, sticking to large container width)
                    aspectRatio: '16/9',
                    marginBottom: '-4rem', // Overlap effect
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#000', // Pure Black
                    borderRadius: '0px',
                    overflow: 'hidden'
                }}>

                    {/* LOGO OVERLAY (Only Logo, No Backdrop) */}
                    <div style={{ zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%' }}>
                        {details.images?.logos?.[0]?.file_path ? (
                            <img
                                src={`https://image.tmdb.org/t/p/original${details.images?.logos?.[0]?.file_path}`}
                                alt="Series Logo"
                                style={{ width: '70%', maxHeight: '70%', objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.1))' }}
                            />
                        ) : (
                            // Fallback if no logo
                            <h2 style={{ fontSize: '4rem', fontFamily: 'Impact, sans-serif', textTransform: 'uppercase', color: '#333' }}>
                                {title}
                            </h2>
                        )}
                    </div>
                </div>

                {/* POSTER (Refined: Card Style) */}
                <div className="poster-wrapper" style={{ flexShrink: 0, zIndex: 3, marginBottom: '2rem' }}>
                    <div
                        onClick={handlePosterClick}
                        style={{ position: 'relative', filter: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                    >
                        {/* Watchlist Button Overlay */}


                        {/* Star Badge if Earned (Prioritize Star Badge over just Review, or show Star Badge if user has it) */}
                        {hasStarBadge && <PosterBadge />}

                        {/* Animated Heart */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10,
                            pointerEvents: 'none' // Click through
                        }}>
                            <MdFavorite
                                ref={heartRef}
                                size={120}
                                color="#FF0000"
                                style={{ opacity: 0, position: 'absolute', transform: 'translate(-50%, -50%)' }}
                            />
                            <MdHeartBroken
                                ref={brokenHeartRef}
                                size={120}
                                color="#FFFFFF"
                                style={{ opacity: 0, position: 'absolute', transform: 'translate(-50%, -50%)' }}
                            />
                        </div>

                        <img
                            src={posterUrl}
                            alt={title}
                            className="movie-poster"
                            style={{
                                width: 'auto',
                                maxWidth: '90vw',
                                height: '55vh', // REDUCED HEIGHT (User Req: ~55-60%)
                                maxHeight: '600px',
                                objectFit: 'cover',
                                borderRadius: '12px', // ROUNDED
                                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', // Subtle shadow, no drop-shadow
                                border: 'none', // NO BORDER
                                position: 'relative',
                                zIndex: 1
                            }}
                        />
                    </div>
                </div>

                {/* INFO ROW: Title/Watch (Left) ---- Ratings (Right) */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    width: '100%',
                    maxWidth: '1000px', // Match top box width
                    marginBottom: '2rem',
                    flexWrap: 'wrap',
                    gap: '30px'
                }}>

                    {/* LEFT: Title & Where to Watch */}
                    <div style={{ flex: 1, minWidth: '350px', textAlign: 'left' }}>
                        <h1 style={{ fontSize: '4.5rem', textTransform: 'uppercase', fontWeight: '400', margin: '0 0 1rem 0', fontFamily: 'Anton, Impact, sans-serif', letterSpacing: '1px', lineHeight: '0.9' }}>
                            {title}
                        </h1>

                        {/* Where to Watch */}
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '15px', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginRight: '10px' }}>Where to Watch:</span>
                            {watchProviders?.flatrate || watchProviders?.rent || watchProviders?.buy ? (
                                (watchProviders.flatrate || watchProviders.rent || watchProviders.buy || []).slice(0, 3).map(provider => (
                                    <div key={provider.provider_id} title={provider.provider_name}>
                                        <img
                                            src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                                            alt={provider.provider_name}
                                            style={{ width: '45px', height: '45px', borderRadius: '8px', border: '1px solid #444' }}
                                        />
                                    </div>
                                ))
                            ) : (
                                <span style={{ fontSize: '1rem', color: '#555', alignSelf: 'center' }}>Unavailable</span>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Ratings Pill -> Emoji Badge */}
                    <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                        <div
                            onClick={() => setIsReviewsOpen(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                background: 'rgba(0,0,0,0.6)', padding: '8px 20px',
                                borderRadius: '50px', border: '1px solid #333',
                                cursor: 'pointer'
                            }}>
                            <span style={{ fontSize: '2rem', lineHeight: 1 }}>
                                {seasonStats.count === 0 ? getEmoji(0) : getEmoji(parseFloat(seasonStats.avg))}
                            </span>
                            <span style={{ color: '#46d369', fontSize: '1.5rem', fontWeight: '900', fontFamily: 'Inter, sans-serif' }}>
                                {seasonStats.avg}
                            </span>
                        </div>
                    </div>

                </div>

                {/* Action Bar (Redesigned) */}
                <div className="action-bar" style={{
                    display: 'flex',
                    gap: '0',
                    borderTop: '2px solid #555',
                    borderBottom: '2px solid #555',
                    padding: '20px 0', // Increased padding
                    width: '100%',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    background: '#000',
                    marginBottom: '3rem'
                }}>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
                        {/* REVIEW */}
                        <button
                            className="action-btn-responsive"
                            onClick={() => {
                                setExistingReviewData(userSeriesReview || null);
                                setReviewingItem({ type: 'series', id: details.id, name: details.name });
                                setIsReviewOpen(true);
                            }}
                            style={{
                                background: userSeriesReview ? '#fff' : '#FFCC00',
                                color: '#000',
                                border: `2px solid ${userSeriesReview ? '#fff' : '#FFCC00'}`,
                                padding: '12px 30px',
                                fontSize: '1.1rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                borderRadius: '0px',
                                outline: 'none',
                                position: 'relative',
                                overflow: 'hidden',
                                zIndex: 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            <MdRateReview size={20} /> {userSeriesReview ? `Rated (${userSeriesReview.rating})` : 'Review'}
                        </button>


                        {/* Star Badge Popup */}


                        {/* SHARE (Only if Reviewed) */}
                        {userSeriesReview && (
                            <button
                                className="action-btn-responsive"
                                onClick={() => handleAction(async () => {
                                    handleShare(userSeriesReview);
                                })}
                                style={{
                                    background: '#FFCC00',
                                    color: '#000',
                                    border: '2px solid #FFCC00',
                                    padding: '12px 30px',
                                    fontSize: '1.1rem',
                                    fontWeight: '900',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    borderRadius: '0px',
                                    outline: 'none',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    zIndex: 1,
                                    transition: 'all 0.3s ease'
                                }}
                            >
                                <MdIosShare size={20} /> SHARE
                            </button>
                        )}



                        {/* SEASON REVIEW REMOVED */}

                        {/* WATCHED */}
                        <button
                            className="action-btn-responsive"
                            onClick={() => handleAction(async () => {
                                if (!(await checkAuth())) return;
                                toggleWatched();
                            })}
                            style={{
                                background: isWatched ? '#fff' : '#FFCC00',
                                color: '#000',
                                border: `2px solid ${isWatched ? '#fff' : '#FFCC00'}`,
                                padding: '12px 30px',
                                fontSize: '1.1rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                borderRadius: '0px',
                                outline: 'none',
                                position: 'relative',
                                overflow: 'hidden',
                                zIndex: 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {isWatched ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />} WATCHED
                        </button>

                        <button
                            className="action-btn-responsive"
                            onClick={() => handleAction(async () => {
                                if (!(await checkAuth())) return;
                                toggleWatchlist();
                            })}
                            style={{
                                background: inWatchlist ? '#fff' : '#FFCC00',
                                color: '#000',
                                border: `2px solid ${inWatchlist ? '#fff' : '#FFCC00'}`,
                                padding: '12px 30px',
                                fontSize: '1.1rem',
                                fontWeight: '900',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                borderRadius: '0px',
                                outline: 'none',
                                position: 'relative',
                                overflow: 'hidden',
                                zIndex: 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {inWatchlist ? <MdCheck size={20} /> : <MdAdd size={20} />} WATCHLIST
                        </button>
                    </div>
                </div>

                {/* Overview (Redesigned) */}
                <div className="overview" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 2rem' }}>
                    <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#FFCC00' }}>
                        {seasonDetails && seasonDetails.name ? seasonDetails.name : 'Overview'}
                    </h3>
                    <p style={{ lineHeight: '1.6', fontSize: '1.1rem', color: '#ddd' }}>
                        {seasonDetails?.overview || details.overview || "No overview available."}
                    </p>
                </div>


            </div >

            {/* Episodes List - Full Width below? Or Sidebar? User image showed list. Let's put it full width below content OR in the main column. 
                    Actually, let's put it in a separate container below the top section.
                */}

            < div className="episodes-wrapper" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>



                {/* Episodes List - Integrated in Info Column */}
                < div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
                    <h3 style={{ color: '#FFCC00', borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        Episodes
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

                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setIsSeasonOpen(!isSeasonOpen)}
                                        style={{
                                            background: '#333', // Grey button bg
                                            color: 'white', // White text
                                            border: 'none',
                                            padding: '8px 20px',
                                            borderRadius: '4px',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontWeight: 'bold', // "Amazon Prime Bold"
                                            textTransform: 'uppercase',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            width: 'auto', // Auto width
                                            minWidth: '150px', // Increased width
                                            height: '40px',
                                            justifyContent: 'space-between',
                                            whiteSpace: 'nowrap' // No Newline
                                        }}
                                    >
                                        {getSeasonName(selectedSeason)}
                                        <MdKeyboardArrowDown
                                            size={24}
                                            style={{
                                                transform: isSeasonOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.3s ease'
                                            }}
                                        />
                                    </button>



                                    {/* Dropdown / Overlay */}
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 'calc(100% + 5px)', // Tighter spacing
                                            left: 0,
                                            width: '100%', // Match button width
                                            minWidth: '150px',
                                            background: '#000', // Pure Black
                                            border: '1px solid #333',
                                            borderRadius: '4px', // Slight rounding
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                                            zIndex: 100,
                                            opacity: isSeasonOpen ? 1 : 0,
                                            transform: isSeasonOpen ? 'translateY(0)' : 'translateY(-10px)',
                                            pointerEvents: isSeasonOpen ? 'auto' : 'none',
                                            transition: 'all 0.2s ease-out',
                                            overflow: 'hidden',
                                            maxHeight: '300px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {seasonsValues.map(s => (
                                            <div
                                                key={s.id}
                                                onClick={() => {
                                                    handleSeasonChange({ target: { value: s.season_number } });
                                                    setIsSeasonOpen(false);
                                                }}
                                                className="season-item"
                                                style={{
                                                    padding: '10px 20px',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid #222',
                                                    background: selectedSeason === s.season_number ? '#333' : 'transparent', // Grey for selected
                                                    fontWeight: 'bold', // Bold Text
                                                    textTransform: 'uppercase', // Full Capital
                                                    transition: 'background 0.2s',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: '0.9rem'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (selectedSeason !== s.season_number) e.currentTarget.style.background = '#1a1a1a';
                                                }}
                                                onMouseLeave={(e) => {
                                                    if (selectedSeason !== s.season_number) e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                {s.name || `SEASON ${s.season_number}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Season Action Buttons */}

                        {episodes.map(ep => {
                            const epReviews = reviewsData.filter(r => r.tmdbId === parseInt(id) && r.seasonNumber === selectedSeason && r.episodeNumber === ep.episode_number && r.isEpisode);
                            const epCount = epReviews.length;
                            const epAvg = epCount > 0
                                ? (epReviews.reduce((acc, r) => acc + (parseFloat(r.rating) || 0), 0) / epCount).toFixed(1)
                                : "0.0";

                            // User Rating (if any)
                            const userReview = getExistingReview(ep.id, true);

                            return (
                                <div
                                    key={ep.id}
                                    onClick={() => navigate(`/tv/${id}/season/${selectedSeason}/episode/${ep.episode_number}`)}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        padding: '20px 0',
                                        borderBottom: '1px solid #333',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                        {/* Poster Section with Centered Buttons */}
                                        <div className="responsive-episode-img" style={{ width: '178px', minWidth: '178px', position: 'relative', flexShrink: 0 }}>
                                            {ep.still_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                                                    alt={ep.name}
                                                    style={{ width: '100%', borderRadius: '4px', height: '100px', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{ width: '100%', height: '100px', borderRadius: '4px', border: '1px solid #333', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                </div>
                                            )}
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: '8px', zIndex: 5 }}>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!(await checkAuth())) return;
                                                        toggleEpisodeWatchlist(ep);
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.7)',
                                                        color: checkEpisodeInWatchlist(ep.id) ? '#FFCC00' : 'white',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        padding: '0',
                                                        cursor: 'pointer',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '36px',
                                                        height: '36px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title={checkEpisodeInWatchlist(ep.id) ? "Remove from Watchlist" : "Add to Watchlist"}
                                                >
                                                    {checkEpisodeInWatchlist(ep.id) ? <MdRemove size={18} /> : <MdAdd size={18} />}
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (!(await checkAuth())) return;
                                                        toggleEpisodeWatched(ep);
                                                    }}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.7)',
                                                        color: checkEpisodeWatched(ep.id) ? '#00e054' : 'white',
                                                        border: '1px solid rgba(255,255,255,0.2)',
                                                        padding: '0',
                                                        cursor: 'pointer',
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '36px',
                                                        height: '36px',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    title={checkEpisodeWatched(ep.id) ? "Mark as Unwatched" : "Mark as Watched"}
                                                >
                                                    {checkEpisodeWatched(ep.id) ? <MdVisibility size={18} /> : <MdVisibilityOff size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content Column: Info, Overview, Actions */}
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                                            {/* Header Info */}
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 'bold' }}>
                                                    {ep.episode_number}. {ep.name}
                                                </h4>
                                                <div style={{ color: '#999', fontSize: '0.95rem', marginTop: '4px', fontWeight: '500' }}>
                                                    {ep.runtime ? `${Math.floor(ep.runtime / 60)}h ${ep.runtime % 60}m` : ''}
                                                </div>
                                            </div>

                                            {/* Overview */}
                                            <p style={{ color: '#ccc', fontSize: '1.1rem', lineHeight: '1.5', margin: '0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {ep.overview || "No overview available."}
                                            </p>

                                            {/* Bottom Actions Row */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px', flexWrap: 'wrap' }}>

                                                {/* Episode Rating Badge */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#000', padding: '4px 10px', borderRadius: '4px', border: '1px solid #333' }}>
                                                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{getEmoji(parseFloat(epAvg))}</span>
                                                    <span style={{ color: '#46d369', fontWeight: 'bold', fontSize: '1rem' }}>{epAvg}</span>
                                                </div>

                                                {/* Review Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openEpisodeReview(ep);
                                                    }}
                                                    className="btn-secondary episode-review-btn-mobile"
                                                    style={{
                                                        background: 'transparent',
                                                        color: '#46d369',
                                                        border: 'none',
                                                        padding: '0',
                                                        cursor: 'pointer',
                                                        fontSize: '0.9rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        fontWeight: 'bold',
                                                        textTransform: 'uppercase'
                                                    }}
                                                >
                                                    <MdRateReview size={16} /> {userReview ? `Rated (${userReview.rating})` : 'Review'}
                                                </button>

                                                {userReview && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleShare(userReview, true);
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '0',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            fontSize: '0.85rem',
                                                            gap: '6px',
                                                            fontWeight: 'bold',
                                                            textTransform: 'uppercase'
                                                        }}
                                                    >
                                                        <MdIosShare size={16} /> Share
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div >
            </div >

            {/* CAST & CREW */}
            < div style={{ marginTop: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#FFCC00' }}>Cast & Crew</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '1rem' }}>
                    {cast.map(actor => (
                        <div key={actor.id} onClick={() => navigate(`/person/${actor.id}`)} style={{ textAlign: 'center', width: '80px', cursor: 'pointer' }}>
                            <img
                                src={actor.profile_path ? `https://image.tmdb.org/t/p/w200${actor.profile_path}` : 'https://via.placeholder.com/200x300/141414/FFFF00?text=?'}
                                alt={actor.name}
                                style={{ width: '100%', borderRadius: '0', border: '1px solid #333', height: '100px', objectFit: 'cover' }}
                            />
                            <div style={{ fontSize: '0.8rem', marginTop: '5px', color: '#ccc' }}>{actor.name}</div>
                        </div>
                    ))}
                </div>
                {
                    crew.length > 0 && (
                        <div style={{ fontSize: '0.9rem', color: '#bbb' }}>
                            <strong>Created by:</strong> {crew.map(c => c.name).join(', ')}
                        </div>
                    )
                }
            </div >

            {/* RELATED SERIES */}
            {details.recommendations?.results?.length > 0 && (() => {
                // Logic: Prioritize Shared Genres & Popularity
                const related = details.recommendations.results
                    .filter(rec => {
                        if (!rec.poster_path) return false;
                        if (!details.genres) return true; // Keep if we have no genre info to compare
                        const myGenres = details.genres.map(g => g.id);
                        return rec.genre_ids?.some(id => myGenres.includes(id));
                    })
                    .slice(0, 10); // Limit to top 10 relevant

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
                                        src={`https://image.tmdb.org/t/p/w300${series.poster_path}`}
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
            })()}




            {/* --- NEW STORY STICKER MODAL --- */}
            {stickerModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.95)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column'
                }}>


                    {stickerStatus === 'preparing' && <LoadingPopup />}


                    {stickerStatus === 'ready' && generatedStickerImage && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
                            {/* Preview Image (Scaled Down for Viewport) */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '20px',
                                width: '100%',
                                maxWidth: '400px' // Limit width to simulate phone screen
                            }}>
                                <img
                                    src={generatedStickerImage}
                                    alt="Sticker Preview"
                                    style={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: '16px',
                                        boxShadow: '0 0 40px rgba(0,0,0,0.5)',
                                        border: '1px solid #333'
                                    }}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{
                                padding: '30px',
                                display: 'flex',
                                gap: '20px',
                                width: '100%',
                                justifyContent: 'center',
                                background: '#000',
                                borderTop: '1px solid #222'
                            }}>
                                <button
                                    onClick={closeStickerModal}
                                    style={{
                                        background: '#333', color: 'white',
                                        padding: '16px 32px', borderRadius: '50px',
                                        fontSize: '16px', fontWeight: 'bold', border: 'none'
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleShareSticker}
                                    style={{
                                        background: '#FFD600', color: 'black',
                                        padding: '16px 32px', borderRadius: '50px',
                                        fontSize: '16px', fontWeight: 'bold', border: 'none',
                                        display: 'flex', alignItems: 'center', gap: '10px'
                                    }}
                                >
                                    <MdIosShare size={20} />
                                    Share
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Hidden Render Target (Using opacity 0 to ensure images load, visibility:hidden can block loading) */}
                    <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1000, width: '1080px', height: '1920px', overflow: 'hidden' }}>
                        {stickerData && (
                            <StorySticker
                                ref={stickerRef}
                                movie={stickerData.movie}
                                rating={stickerData.rating}
                                user={stickerData.user}
                                isEpisodes={stickerData.isEpisodes}
                            />
                        )}
                    </div>
                </div>
            )}

            <ReviewModal
                isOpen={isReviewOpen}
                onClose={() => setIsReviewOpen(false)}
                onSubmit={handleReviewSubmit}
                initialRating={existingReviewData ? existingReviewData.rating : 5}
                initialReview={existingReviewData ? existingReviewData.review : ''}
                movieName={reviewingItem === 'series' ? title : (reviewingItem ? `${title}: Season ${selectedSeason} Episode ${reviewingItem.episode_number}` : title)}
                modalTitle={reviewingItem !== 'series' && reviewingItem ? 'EPISODE REVIEW' : 'SERIES REVIEW'}
            />

            <ReviewsDrawer
                isOpen={isReviewsOpen}
                onClose={() => setIsReviewsOpen(false)}
                reviews={[...reviewsData]
                    .filter(r => {
                        const isSeriesLevel = !r.isSeason && !r.isEpisode;
                        const isCurrentSeason = r.isSeason && r.seasonNumber === selectedSeason;
                        const isEpisodeInSeason = r.isEpisode && r.seasonNumber === selectedSeason;
                        return isSeriesLevel || isCurrentSeason || isEpisodeInSeason;
                    })
                    .sort((a, b) => {
                        const amIAuthor = a.userId === currentUser?.uid;
                        const bmIAuthor = b.userId === currentUser?.uid;
                        if (amIAuthor && !bmIAuthor) return -1;
                        if (!amIAuthor && bmIAuthor) return 1;
                        const aLikes = a.likes?.length || 0;
                        const bLikes = b.likes?.length || 0;
                        return bLikes - aLikes;
                    })
                    .map(r => ({
                        id: r.id,
                        source: 'app',
                        author: r.userName || 'User',
                        rating: r.rating,
                        review: r.review,
                        date: r.createdAt,
                        likes: r.likes || [],
                        isLiked: r.likes?.includes(currentUser?.uid),
                        userId: r.userId,
                        photoURL: r.photoURL || null,
                        episodeNumber: r.episodeNumber,
                        isEpisode: r.isEpisode,
                        isSeason: r.isSeason,
                        seasonNumber: r.seasonNumber,
                        tmdbId: r.tmdbId,
                        episodeId: r.episodeId,
                        topicName: r.topicName || details.name
                    }))}
                onDelete={async (id) => {
                    if (!currentUser) return;
                    try {
                        const reviewToDelete = reviewsData.find(r => r.id === id);
                        if (!reviewToDelete) return;
                        await deleteDoc(doc(db, 'reviews', id));
                        if (!reviewToDelete.isEpisode) {
                            const userRef = doc(db, 'users', currentUser.uid);
                            const userSnap = await getDoc(userRef);
                            if (userSnap.exists()) {
                                const data = userSnap.data();
                                const updatedStars = (data.starSeries || []).filter(s => String(s.id) !== String(details.id));
                                await updateDoc(userRef, { starSeries: updatedStars });
                            }
                        }
                        setReviewsData(prev => prev.filter(r => r.id !== id));
                    } catch (error) {
                        console.error("Error deleting review:", error);
                    }
                }}
                onShare={handleShare}
                onLike={handleReviewLike}
                onEdit={handleEditReview}
                theme={{}}
            />

            {/* Hidden Share Modal for Fallback (if kept) - but we use Sticker Modal now. Keeping for safety if other logic calls it, but likely redundant. */}
            <ShareModal
                isOpen={shareModal.isOpen}
                onClose={() => setShareModal({ ...shareModal, isOpen: false })}
                imageUrl={shareModal.imageUrl}
            />

            {/* SEASON COMPLETION OVERLAY */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0,0,0,0.85)',
                display: showSeasonCompletion ? 'flex' : 'none',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                opacity: showSeasonCompletion ? 1 : 0,
                transition: 'opacity 0.4s ease',
                backdropFilter: 'blur(5px)'
            }} onClick={() => setShowSeasonCompletion(false)}>
                <div style={{
                    background: '#0a0a0a',
                    padding: '40px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    transform: showSeasonCompletion ? 'scale(1)' : 'scale(0.95)',
                    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    maxWidth: '90vw',
                    width: '320px'
                }} onClick={e => e.stopPropagation()}>
                    <h2 style={{
                        color: '#fff',
                        fontFamily: 'Anton, sans-serif',
                        fontSize: '2rem',
                        marginBottom: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}>
                        Season {completedSeasonInfo?.seasonNumber} Completed
                    </h2>

                    <div style={{
                        width: '140px',
                        height: '140px',
                        margin: '0 auto 20px',
                        position: 'relative',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                        <img
                            src={`https://image.tmdb.org/t/p/w200${completedSeasonInfo?.poster}`}
                            alt="Season Poster"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: '100%',
                            height: '4px',
                            background: '#FFD600'
                        }} />
                    </div>

                    <p style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        margin: 0
                    }}>
                        Great job catching up!
                    </p>
                </div>
            </div>

        </div>
    );
};

export default MovieDetails;

