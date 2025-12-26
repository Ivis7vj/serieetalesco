import { useState, useEffect } from 'react';
import { MdStarBorder, MdRemoveCircleOutline, MdClose } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as watchlistService from '../utils/watchlistService';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import Skeleton from '../components/Skeleton';
import './Home.css';
import '../pages/Home.css';

const WatchlistSkeleton = () => (
    <div className="section" style={{ padding: '20px', paddingBottom: '80px', minHeight: '100vh' }}>
        <Skeleton width="200px" height="32px" marginBottom="30px" />
        <div className="watchlist-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={{ aspectRatio: '2/3' }}>
                    <Skeleton height="100%" borderRadius="8px" />
                </div>
            ))}
        </div>
    </div>
);

const Watchlist = () => {
    const { currentUser, globalPosters } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser) return;
        const fetchWatchlist = async () => {
            setLoading(true);
            const wl = await watchlistService.getWatchlist(currentUser.uid);
            setWatchlist(wl);
            setLoading(false);
        };
        fetchWatchlist();
    }, [currentUser]);

    // Profile-style Grouping Logic (Season Baskets)
    const processWatchlist = (list) => {
        let processed = [];
        const groups = {}; // Key: "seriesId_SseasonNumber"

        // 1. Identify Episode Baskets
        list.forEach(item => {
            const itemId = item.id || item.tmdb_id;
            const seriesId = item.seriesId || item.series_id || itemId;
            if (item.seasonNumber && item.episodeNumber) {
                const key = `${seriesId}_S${item.seasonNumber}`;
                if (!groups[key]) {
                    groups[key] = {
                        type: 'basket',
                        seriesId: seriesId,
                        seasonNumber: item.seasonNumber,
                        name: item.name,
                        poster_path: item.poster_path, // Base poster
                        pluginPoster: item.seasonPoster, // Potentially explicit season poster
                        episodes: []
                    };
                }
                groups[key].episodes.push(item);
                if (!groups[key].pluginPoster && item.seasonPoster) groups[key].pluginPoster = item.seasonPoster;
            }
        });

        // 2. Add Whole Series/Seasons (Dedupe check)
        list.forEach(item => {
            if (item.seasonNumber && item.episodeNumber) return; // Handled

            const tmdbId = item.tmdb_id || item.id;
            const seriesId = item.seriesId || item.series_id || tmdbId;
            const basketKey = `${seriesId}_S${item.seasonNumber}`;
            if (item.seasonNumber && groups[basketKey]) return; // Deduplicate: specific season exists as basket

            processed.push({
                ...item,
                tmdbId: tmdbId,
                seriesId: seriesId,
                type: 'series',
                isSeason: !!item.seasonNumber
            });
        });

        // 3. Add Baskets to Processed
        Object.values(groups).forEach(basket => {
            basket.tmdbId = basket.seriesId; // Baskets are keyed by seriesId
            basket.episodeCount = basket.episodes.length;
            basket.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
            if (basket.pluginPoster) basket.poster_path = basket.pluginPoster;

            if (basket.episodes[0]) {
                const parts = basket.episodes[0].name.split(' - ');
                basket.name = parts[0] + (basket.seasonNumber ? ` (Season ${basket.seasonNumber})` : '');
            }

            processed.push(basket);
        });

        // Filter out items without a valid poster path
        return processed.filter(item => item.poster_path);
    };

    const removeFromWatchlist = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) return;

        // Optimistic Update
        const updated = watchlist.filter(item => (item.id || item.tmdb_id) !== id);
        setWatchlist(updated);

        try {
            await watchlistService.removeFromWatchlist(currentUser.uid, id);
        } catch (error) { console.error(error); }
    };

    const items = processWatchlist(watchlist);

    if (loading && watchlist.length === 0) return <WatchlistSkeleton />;

    return (
        <div className="section" style={{ padding: '20px', paddingBottom: '80px', minHeight: '100vh', overflowY: 'auto' }}>
            <h2 className="section-title">Your Watchlist <span style={{ fontSize: '1rem', color: '#666', fontWeight: 'normal' }}>({watchlist.length} items)</span></h2>

            {watchlist.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                    <p>Your watchlist is empty.</p>
                    <Link to="/" style={{ color: '#00cc33', textDecoration: 'none' }}>Browse popular titles</Link>
                </div>
            ) : (
                <div className="watchlist-grid">
                    {items.map((item, idx) => (
                        <div key={idx} style={{ position: 'relative' }}>
                            {item.type === 'basket' ? (
                                <div
                                    onClick={() => navigate(`/watchlist/season/${item.seriesId}/${item.seasonNumber}`)}
                                    style={{ cursor: 'pointer', display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative' }}
                                >
                                    <img
                                        src={getResolvedPosterUrl(item.seriesId || item.id, item.poster_path, globalPosters, 'w500', item.seasonNumber)}
                                        alt={item.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                    {/* Season Indicator for Bucket */}
                                    <div style={{
                                        position: 'absolute', bottom: '10px', right: '10px',
                                        background: '#FFCC00', color: '#000',
                                        padding: '4px 8px', borderRadius: '4px',
                                        fontWeight: 'bold', fontSize: '0.8rem',
                                        zIndex: 2
                                    }}>
                                        S{item.seasonNumber}
                                    </div>
                                    {/* Count Badge */}
                                    <div style={{
                                        position: 'absolute', top: '10px', left: '10px',
                                        background: 'rgba(0,0,0,0.7)', color: '#fff',
                                        padding: '2px 6px', borderRadius: '4px',
                                        fontSize: '0.75rem'
                                    }}>
                                        {item.episodeCount} Eps
                                    </div>
                                </div>
                            ) : (
                                <Link to={`/tv/${item.tmdbId || item.id}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative' }}>
                                    <img
                                        src={getResolvedPosterUrl(item.tmdbId || item.id, item.poster_path, globalPosters, 'w500', item.seasonNumber) || 'https://placehold.co/200x300/141414/FFFF00?text=No+Image'}
                                        alt={item.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                    <button
                                        onClick={(e) => removeFromWatchlist(e, item.id || item.tmdb_id)}
                                        style={{
                                            position: 'absolute', top: '10px', right: '10px',
                                            background: 'rgba(0,0,0,0.6)', color: '#ff4444',
                                            border: 'none', borderRadius: '50%',
                                            width: '30px', height: '30px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <MdRemoveCircleOutline size={18} />
                                    </button>
                                    {item.isSeason && (
                                        <div style={{
                                            position: 'absolute', bottom: '10px', right: '10px',
                                            background: '#FFCC00', color: '#000',
                                            padding: '4px 8px', borderRadius: '4px',
                                            fontWeight: 'bold', fontSize: '0.8rem'
                                        }}>
                                            S{item.seasonNumber}
                                        </div>
                                    )}
                                </Link>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Watchlist;
