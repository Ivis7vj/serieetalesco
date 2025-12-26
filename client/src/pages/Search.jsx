import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { tmdbApi } from '../utils/tmdbApi';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import Skeleton, { SeriesRowSkeleton } from '../components/Skeleton';

const GENRES_MAP = {
    'action': 10759,
    'adventure': 10759,
    'animation': 16,
    'comedy': 35,
    'crime': 80,
    'documentary': 99,
    'drama': 18,
    'family': 10751,
    'kids': 10762,
    'mystery': 9648,
    'news': 10763,
    'reality': 10764,
    'scifi': 10765,
    'sci-fi': 10765,
    'fantasy': 10765,
    'soap': 10766,
    'talk': 10767,
    'war': 10768,
    'politics': 10768,
    'western': 37
};

const Search = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search).get('q');

    const selectForFavorite = location.state?.selectForFavorite;
    const slotIndex = location.state?.slotIndex;

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const [showSuccess, setShowSuccess] = useState(false);
    const [duplicateAlert, setDuplicateAlert] = useState(false);
    const [starSeriesIds, setStarSeriesIds] = useState(new Set());
    const [genreSearchData, setGenreSearchData] = useState(null);
    const [relatedSeries, setRelatedSeries] = useState([]);

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const { currentUser, userData, globalPosters } = useAuth();
    const storageKey = currentUser ? `recentSearches_${currentUser.uid}` : 'recentSearches_guest';

    useEffect(() => {
        let saved = [];
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw && raw !== "[object Object]") {
                saved = JSON.parse(raw);
                if (!Array.isArray(saved)) saved = [];
            }
        } catch (e) { saved = []; }
        setRecentSearches(saved);
    }, [currentUser, storageKey]);

    useEffect(() => {
        if (userData?.starSeries) setStarSeriesIds(new Set(userData.starSeries.map(s => s.id)));
        else setStarSeriesIds(new Set());
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
        let recents = [];
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw && raw !== "[object Object]") {
                recents = JSON.parse(raw);
                if (!Array.isArray(recents)) recents = [];
            }
        } catch (e) { recents = []; }

        if (!recents.includes(term)) {
            recents = [term, ...recents].slice(0, 5);
            localStorage.setItem(storageKey, JSON.stringify(recents));
            setRecentSearches(recents);
        }
    };

    const fetchSearch = async () => {
        setLoading(true);
        setGenreSearchData(null);
        setResults([]);
        setRelatedSeries([]);
        const lowerQ = query.toLowerCase().trim();
        const genreId = GENRES_MAP[lowerQ];

        try {
            if (genreId) {
                const [trending, underrated] = await Promise.all([
                    // Use params string for discoverSeries
                    tmdbApi.discoverSeries(`&with_genres=${genreId}&sort_by=popularity.desc`),
                    tmdbApi.discoverSeries(`&with_genres=${genreId}&sort_by=vote_average.desc&vote_count.gte=200`)
                ]);
                setGenreSearchData({
                    genreName: lowerQ.toUpperCase(),
                    trending: trending.results || [],
                    underrated: underrated.results || []
                });
            } else {
                const data = await tmdbApi.searchSeries(query);
                const currentResults = data.results || [];
                setResults(currentResults);
                if (currentResults.length > 0) await fetchRelatedSeries(currentResults[0]);
            }
            setLoading(false);
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const fetchRelatedSeries = async (topItem) => {
        if (!topItem?.genre_ids) return;
        try {
            let genreIds = topItem.genre_ids;
            let sortBy = 'popularity.desc';
            if (genreIds.includes(16)) genreIds = [16];
            if (topItem.vote_average >= 8) sortBy = 'vote_average.desc';
            const genreQuery = genreIds.join(',');

            const params = `&with_genres=${genreQuery}&sort_by=${sortBy}&vote_count.gte=100`;
            const data = await tmdbApi.discoverSeries(params);

            if (data.results) {
                const filtered = data.results.filter(item => item.id !== topItem.id).slice(0, 12);
                setRelatedSeries(filtered);
            }
        } catch (e) { console.error(e); }
    };

    const handleSeriesClick = async (e, item) => {
        if (selectForFavorite) {
            e.preventDefault();
            if (!currentUser || !userData) return;
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                let currentFavs = userData.favorites || [null, null, null, null, null];
                if (currentFavs.some((fav, idx) => fav && fav.id === item.id && idx !== slotIndex)) {
                    setDuplicateAlert(true);
                    setTimeout(() => setDuplicateAlert(false), 2000);
                    return;
                }
                setShowSuccess(true);
                if (currentFavs.length < 5) currentFavs = [...currentFavs, ...Array(5 - currentFavs.length).fill(null)];
                const newFavs = [...currentFavs];
                newFavs[slotIndex] = item;
                await updateDoc(userRef, { favorites: newFavs });
                setTimeout(() => navigate('/profile'), 2000);
            } catch (err) { console.error(err); }
        }
    };

    const topResult = results.length > 0 ? results[0] : null;
    const exactMatches = results.length > 1 ? results.slice(1, 7) : [];

    return (
        <div className="search-page-container" style={{ position: 'relative', minHeight: '100%', background: '#000', paddingBottom: '110px' }}>
            {showSuccess && (
                <div className="share-success-overlay animate-fade-in">
                    <div className="success-icon-wrapper animate-pop">
                        <MdCheck size={60} color="#000" />
                    </div>
                    <h2 className="success-text">Added to Favorites</h2>
                </div>
            )}

            {duplicateAlert && (
                <div className="duplicate-alert animate-pop">
                    <span>⚠️ This series is already in your favorites!</span>
                </div>
            )}

            {!query ? (
                <div className="recent-searches-wrapper">
                    <h3 className="recent-title">RECENT SEARCHES</h3>
                    <div className="recent-list">
                        {recentSearches.length > 0 ? recentSearches.map((term, i) => (
                            <Link key={i} to={`/search?q=${encodeURIComponent(term)}`} className="recent-item">
                                <MdHistory color="#666" />
                                {term}
                            </Link>
                        )) : (
                            <div className="no-recents">No recent searches</div>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    {loading ? (
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                                {[...Array(9)].map((_, i) => (
                                    <Skeleton key={i} height="150px" borderRadius="12px" />
                                ))}
                            </div>
                        </div>
                    ) : results.length === 0 && !genreSearchData ? (
                        <div className="no-results" style={{ textAlign: 'center', marginTop: '50px', color: '#666' }}>
                            <h2>No results for "{query}"</h2>
                            <p>Try searching for specific series like "Breaking Bad"</p>
                        </div>
                    ) : (
                        <div className="search-content">
                            {genreSearchData ? (
                                /* Old UI: Genre Sections with Circular Grid */
                                <div className="genre-view" style={{ padding: '0 15px' }}>

                                    {/* Trending Section */}
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '15px', marginTop: '10px' }}>Trending in <br /><span style={{ fontSize: '1.5rem', textTransform: 'uppercase' }}>{genreSearchData.genreName}</span></h2>
                                    <div className="genre-grid-layout">
                                        {genreSearchData.trending.map(series => (
                                            <div key={series.id} className="genre-card" onClick={(e) => handleSeriesClick(e, series)}>
                                                <Link to={selectForFavorite ? '#' : `/tv/${series.id}`}>
                                                    <div className="genre-poster-circle">
                                                        <img src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w200')} alt={series.name} />
                                                    </div>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Underrated Section */}
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: '900', marginBottom: '15px', marginTop: '30px' }}>Underrated<br />Gems</h2>
                                    <div className="genre-grid-layout">
                                        {genreSearchData.underrated.map(series => (
                                            <div key={series.id} className="genre-card" onClick={(e) => handleSeriesClick(e, series)}>
                                                <Link to={selectForFavorite ? '#' : `/tv/${series.id}`}>
                                                    <div className="genre-poster-circle">
                                                        <img src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w200')} alt={series.name} />
                                                    </div>
                                                </Link>
                                            </div>
                                        ))}
                                    </div>

                                    <style>{`
                                        .genre-grid-layout {
                                            display: grid;
                                            grid-template-columns: repeat(4, 1fr); /* 4 cols for small circles */
                                            gap: 15px;
                                        }
                                        .genre-poster-circle {
                                            width: 100%;
                                            aspect-ratio: 1/1;
                                            border-radius: 50%;
                                            overflow: hidden;
                                            border: 2px solid #333;
                                        }
                                        .genre-poster-circle img {
                                            width: 100%;
                                            height: 100%;
                                            object-fit: cover;
                                        }
                                    `}</style>
                                </div>
                            ) : (
                                /* Standard Grid for generic search */
                                <div className="search-grid-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', padding: '16px' }}>
                                    {results.map((series) => (
                                        <div key={series.id} className="search-card animate-fade-in" onClick={(e) => handleSeriesClick(e, series)}>
                                            <Link to={selectForFavorite ? '#' : `/tv/${series.id}`} className="search-link">
                                                <div className="poster-wrapper" style={{ width: '100%', aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <img
                                                        src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w500')}
                                                        alt={series.name}
                                                        className="search-poster"
                                                        loading="lazy"
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            <style>{`
                .search-grid-layout {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    padding: 16px;
                }
                .search-card {
                    cursor: pointer;
                }
                .search-poster {
                    width: 100%;
                    aspect-ratio: 2/3;
                    border-radius: 8px;
                    transition: transform 0.2s;
                    object-fit: cover;
                }
                .search-card:active .search-poster {
                    transform: scale(0.95);
                }
            `}</style>
        </div>
    );
};

export default Search;
