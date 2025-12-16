import { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { MdHistory, MdCheck } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, updateDoc } from 'firebase/firestore';

import './Home.css';
import './Search.css';

const Search = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search).get('q');

    // Selection Mode Params
    const selectForFavorite = location.state?.selectForFavorite;
    const slotIndex = location.state?.slotIndex;

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    // Recent Searches
    const [recentSearches, setRecentSearches] = useState([]);

    // Success Animation State
    const [showSuccess, setShowSuccess] = useState(false);
    const [duplicateAlert, setDuplicateAlert] = useState(false);
    const [starSeriesIds, setStarSeriesIds] = useState(new Set());

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f'; // Fallback if env not loaded
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

    // Auth for unique storage
    const { currentUser, userData } = useAuth();
    const storageKey = currentUser ? `recentSearches_${currentUser.uid}` : 'recentSearches_guest';

    useEffect(() => {
        try {
            const savedRecents = JSON.parse(localStorage.getItem(storageKey) || '[]');
            setRecentSearches(Array.isArray(savedRecents) ? savedRecents : []);
        } catch (e) {
            setRecentSearches([]);
        }
    }, [currentUser, storageKey]);

    useEffect(() => {
        if (userData?.starSeries) {
            setStarSeriesIds(new Set(userData.starSeries.map(s => s.id)));
        } else {
            setStarSeriesIds(new Set());
        }
    }, [userData]);

    useEffect(() => {
        if (query) {
            fetchSearch();
            addToRecent(query);
        } else {
            setResults([]);
        }
    }, [query, storageKey]);

    const addToRecent = (term) => {
        let recents = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (!recents.includes(term)) {
            recents = [term, ...recents].slice(0, 5); // Keep last 5
            localStorage.setItem(storageKey, JSON.stringify(recents));
            setRecentSearches(recents);
        }
    };

    const [genreSearchData, setGenreSearchData] = useState(null); // { trending: [], underrated: [], genreName: '' }
    // Related Series State
    const [relatedSeries, setRelatedSeries] = useState([]);

    const GENRES_MAP = {
        'action': 10759, 'adventure': 10759,
        'animation': 16, 'comedy': 35, 'crime': 80,
        'documentary': 99, 'drama': 18, 'family': 10751,
        'kids': 10762, 'mystery': 9648, 'news': 10763,
        'reality': 10764,
        'scifi': 10765, 'sci-fi': 10765, 'fantasy': 10765,
        'soap': 10766, 'talk': 10767, 'war': 10768, 'western': 37,
        'horror': 27, 'thriller': 9648
    };

    const fetchSearch = async () => {
        setLoading(true);
        setGenreSearchData(null);
        setResults([]);
        setRelatedSeries([]); // Reset

        const lowerQ = query.toLowerCase().trim();
        const genreId = GENRES_MAP[lowerQ];

        try {
            let currentResults = [];
            if (genreId) {
                // Genre Search
                const [trending, underrated] = await Promise.all([
                    fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc`).then(r => r.json()),
                    fetch(`${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=200`).then(r => r.json())
                ]);
                setGenreSearchData({
                    genreName: lowerQ.toUpperCase(),
                    trending: trending.results || [],
                    underrated: underrated.results || []
                });
                // For genre search, we don't have a single "Top Result" in the same way, but let's assume standard behavior for now across search types if needed.
                // But Prompt specifically implies "Top Result" from search results. 
                // If genre search, `results` stays empty in current logic? 
                // The current logic sets `results` only in "Normal Search".
                // Let's stick to modifying the Normal Search flow mostly, or unify if needed.
                // The Prompt says "When screen width is mobile... Top Result card...".
                // Logic below handles "Normal Search" results.
            } else {
                // Normal Search
                const response = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
                const data = await response.json();
                currentResults = data.results || [];
                setResults(currentResults);

                // Fetch Related Series if we have a top result
                if (currentResults.length > 0) {
                    await fetchRelatedSeries(currentResults[0]);
                }
            }
            setLoading(false);
        } catch (error) {
            console.error("Search failed", error);
            setLoading(false);
        }
    };

    const fetchRelatedSeries = async (topItem) => {
        if (!topItem || !topItem.genre_ids) return;

        try {
            // Logic: 
            // 1. Genre IDs
            let genreIds = topItem.genre_ids;
            let sortBy = 'popularity.desc';

            // Mood Filtering Logic
            // Animation -> Animation Only
            if (genreIds.includes(16)) {
                genreIds = [16];
            }

            // High Rating (> 8) -> Serious Tone (? Use Rating Sort)
            // Serious/Drama logic could be implied by rating sort.
            if (topItem.vote_average >= 8) {
                sortBy = 'vote_average.desc';
            }

            // Comedy -> Light Tone (Usually just Comedy genre is enough)

            const genreQuery = genreIds.join(',');

            const url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=${genreQuery}&sort_by=${sortBy}&vote_count.gte=100`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.results) {
                // Filter out the top result
                const filtered = data.results
                    .filter(item => item.id !== topItem.id)
                    .slice(0, 12); // Limit to 12
                setRelatedSeries(filtered);
            }
        } catch (e) {
            console.error("Failed to fetch related", e);
        }
    };

    // const { currentUser } = useAuth(); // Moved up

    const handleSeriesClick = async (e, item) => {
        if (selectForFavorite) {
            e.preventDefault();

            if (!currentUser || !userData) return;

            try {
                // Use userData directly to save a read
                const userRef = doc(db, 'users', currentUser.uid);
                let currentFavs = userData.favorites || [null, null, null, null, null];

                // Duplicate Check
                const isDuplicate = currentFavs.some((fav, idx) => fav && fav.id === item.id && idx !== slotIndex);
                if (isDuplicate) {
                    setDuplicateAlert(true);
                    setTimeout(() => setDuplicateAlert(false), 2000);
                    return; // Stop processing
                }

                // Animation Trigger (Only if not duplicate)
                setShowSuccess(true);

                // Ensure standard length
                if (currentFavs.length < 5) {
                    currentFavs = [...currentFavs, ...Array(5 - currentFavs.length).fill(null)];
                }

                // Update specific slot
                const newFavs = [...currentFavs];
                newFavs[slotIndex] = item;

                // Save back
                await updateDoc(userRef, { favorites: newFavs });
            } catch (err) {
                console.error("Failed to save favorite", err);
            }

            // Delay for Animation then Redirect
            setTimeout(() => {
                navigate('/profile');
            }, 2000); // 2s delay
        }
    };

    // Logic for Tiers
    const topResult = results.length > 0 ? results[0] : null;

    // Filter "Exact Matches" - loosely matches title or heavily related.
    // Logic: Same words, excluding Top Result.
    // Actually TMDB returns sorted by relevance. Let's just take next 5 as "Close Matches"
    const exactMatches = results.length > 1
        ? results.slice(1, 7) // Take 2nd to 7th items
        : [];

    // "Related Discovery" REPLACED by relatedSeries state

    return (
        <div className="section" style={{ position: 'relative', minHeight: '100vh', background: '#000' }}>
            {/* Background pure black enforced inline just in case */}
            {showSuccess && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
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
                    <h2 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>Added to Favorites</h2>
                </div>
            )}
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

            {!query ? (
                // RECENT SEARCHES UI (Unchanged Layout, just ensured wrapper)
                <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
                    <h3 style={{ color: '#666', marginBottom: '1rem', fontSize: '0.9rem', letterSpacing: '1px' }}>RECENT SEARCHES</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {recentSearches.length > 0 ? recentSearches.map((term, i) => (
                            <Link key={i} to={`/search?q=${encodeURIComponent(term)}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ccc', textDecoration: 'none', padding: '15px', background: '#111', border: '1px solid #222', borderRadius: '4px' }}>
                                <MdHistory color="#666" />
                                {term}
                            </Link>
                        )) : (
                            <div style={{ color: '#444', fontStyle: 'italic' }}>No recent searches</div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="search-results-container">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '100px', color: '#666' }}>Searching...</div>
                    ) : results.length === 0 && !genreSearchData ? (
                        <div style={{ textAlign: 'center', marginTop: '100px', color: '#999' }}>
                            <h2>No results for "{query}"</h2>
                            <p>Try searching for specific series like "Breaking Bad" or "The Office"</p>
                        </div>
                    ) : (
                        <>
                            {/* TIER 1: TOP RESULT */}
                            {topResult && (
                                <div className="search-tier-top">
                                    <div className="top-result-card" onClick={(e) => handleSeriesClick(e, topResult)}>
                                        <Link to={selectForFavorite ? '#' : `/tv/${topResult.id}`} style={{ display: 'flex', width: '100%', textDecoration: 'none', color: 'inherit' }}>
                                            <div className="top-poster-wrapper">

                                                <img
                                                    className="top-poster"
                                                    src={topResult.poster_path ? `https://image.tmdb.org/t/p/w780${topResult.poster_path}` : 'https://via.placeholder.com/300x450'}
                                                    alt={topResult.name}
                                                />
                                            </div>
                                            <div className="top-info">
                                                <div className="top-label">Top Result</div>
                                                <h1 className="top-title">{topResult.name}</h1>
                                                <div className="top-meta">
                                                    <span>{topResult.first_air_date ? topResult.first_air_date.substring(0, 4) : 'Unknown'}</span>
                                                    <span>•</span>
                                                    <span>{topResult.vote_average ? `${topResult.vote_average.toFixed(1)} Rating` : 'Mixed'}</span>
                                                </div>
                                                <div className="view-btn">View Details</div>
                                            </div>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* TIER 2: EXACT MATCHES */}
                            {exactMatches.length > 0 && (
                                <div className="search-tier-section">
                                    <h3 className="tier-title">More Matches</h3>
                                    <div className="tier-row">
                                        {exactMatches.map(item => (
                                            <div key={item.id} className="search-card" onClick={(e) => handleSeriesClick(e, item)}>
                                                <Link to={selectForFavorite ? '#' : `/tv/${item.id}`} style={{ display: 'block' }}>

                                                    <img
                                                        className="search-poster"
                                                        src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/200x300'}
                                                        alt={item.name}
                                                    />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* TIER 3: RELATED SERIES (Replacing Related Discovery) */}
                            {relatedSeries.length > 0 && (
                                <div className="search-tier-section">
                                    <h3 className="tier-title">Related Series</h3>
                                    <div className="tier-row">
                                        {relatedSeries.map(item => (
                                            <div key={item.id} className="search-card" onClick={(e) => handleSeriesClick(e, item)}>
                                                <Link to={selectForFavorite ? '#' : `/tv/${item.id}`} style={{ display: 'block' }}>

                                                    <img
                                                        className="search-poster"
                                                        src={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://via.placeholder.com/200x300'}
                                                        alt={item.name}
                                                    />
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default Search;
