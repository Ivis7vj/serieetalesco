import { useState, useEffect } from 'react';
import { MdStarBorder, MdRemoveCircleOutline, MdClose } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import * as watchlistService from '../utils/watchlistService';
import './Home.css';
import '../pages/Home.css'; // Ensure CSS is loaded

const Watchlist = () => {
    const { currentUser } = useAuth();
    const [watchlist, setWatchlist] = useState([]);
    const navigate = useNavigate();
    const { stopLoading } = useLoading();

    useEffect(() => {
        if (!currentUser) return;
        const fetchWatchlist = async () => {
            const wl = await watchlistService.getWatchlist(currentUser.uid);
            setWatchlist(wl);
            stopLoading();
        };
        fetchWatchlist();
    }, [currentUser, stopLoading]);

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
                        poster_path: item.poster_path,
                        pluginPoster: item.seasonPoster,
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

        return processed;
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
                                    <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
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
                                    <div style={{
                                        position: 'absolute', top: '10px', left: '10px',
                                        background: 'rgba(0,0,0,0.6)', color: '#fff',
                                        padding: '2px 6px', borderRadius: '4px',
                                        fontSize: '0.7rem', backdropFilter: 'blur(4px)'
                                    }}>
                                        {item.episodeCount} EPS
                                    </div>
                                </div>
                            ) : (
                                <Link to={item.seasonNumber ? `/tv/${item.tmdbId}/season/${item.seasonNumber}` : `/tv/${item.tmdbId}`} style={{ display: 'block', border: 'none', aspectRatio: '2/3', position: 'relative' }}>
                                    <img src={`https://image.tmdb.org/t/p/w500${item.poster_path}`} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                    {item.seasonNumber && !item.episodeNumber && (
                                        <div style={{
                                            position: 'absolute', bottom: '10px', right: '10px',
                                            background: '#FFCC00', color: '#000', // Changed to match design request (Season Indicator)
                                            padding: '4px 8px', borderRadius: '4px',
                                            fontWeight: 'bold', fontSize: '0.8rem',
                                            zIndex: 2
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

            {/* Basket Drawer (Restored & Fixed) */}

        </div>
    );
};

export default Watchlist;
