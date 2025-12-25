import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdRemoveCircleOutline } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import * as watchlistService from '../utils/watchlistService';
import '../pages/Home.css';

const WatchlistSeason = () => {
    const { seriesId, seasonNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { stopLoading } = useLoading();
    const [episodes, setEpisodes] = useState([]);
    const [seasonName, setSeasonName] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        const fetchEpisodes = async () => {
            const allItems = await watchlistService.getWatchlist(currentUser.uid);

            // Filter for specific series and season
            const seasonEps = allItems.filter(item => {
                const itemSeriesId = item.seriesId || item.series_id || (item.id || item.tmdb_id); // Fallback logic similar to Watchlist.jsx
                // Note: Watchlist.jsx uses purely loose matching, let's try to match strict first
                const currentIdStr = String(seriesId);
                const itemIdStr = String(itemSeriesId);

                // We need to ensure we are matching the correct series ID logic from Watchlist.jsx
                // In Watchlist.jsx: const seriesId = item.seriesId || item.series_id || itemId;
                // Here we receive 'seriesId' from URL which should be the grouped ID.

                // Let's rely on the fact that the URL param comes from the grouper.

                const isSeriesMatch = String(item.seriesId || item.series_id || item.tmdb_id || item.id) === currentIdStr;
                const isSeasonMatch = String(item.seasonNumber) === String(seasonNumber);

                return isSeriesMatch && isSeasonMatch && item.episodeNumber;
            });

            // Sort by episode number
            seasonEps.sort((a, b) => a.episodeNumber - b.episodeNumber);

            setEpisodes(seasonEps);

            // Set Name
            if (seasonEps.length > 0) {
                const parts = seasonEps[0].name.split(' - ');
                setSeasonName(parts[0]);
            }

            stopLoading();
        };

        fetchEpisodes();
    }, [currentUser, seriesId, seasonNumber, stopLoading]);

    const removeFromWatchlist = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) return;

        // Optimistic Update
        const updated = episodes.filter(item => (item.id || item.tmdb_id) !== id);
        setEpisodes(updated);

        try {
            await watchlistService.removeFromWatchlist(currentUser.uid, id);
        } catch (error) { console.error(error); }

        // If empty, go back
        if (updated.length === 0) {
            navigate(-1);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: '#000',
            padding: '20px',
            paddingTop: '60px', /* Safe area for back button */
            color: '#fff',
            fontFamily: '"Inter", sans-serif'
        }}>
            {/* Header */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '60px',
                background: '#000',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                borderBottom: '1px solid #222'
            }}>
                <button onClick={() => navigate(-1)} style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fff',
                    fontSize: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    marginRight: '15px',
                    cursor: 'pointer'
                }}>
                    <MdArrowBack />
                </button>
                <h2 style={{
                    margin: 0,
                    fontSize: '1.2rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    fontFamily: '"Anton", sans-serif',
                    color: '#FFCC00'
                }}>
                    {seasonName} <span style={{ color: '#fff', marginLeft: '5px' }}>Season {seasonNumber}</span>
                </h2>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
                {episodes.map(ep => (
                    <div key={ep.id} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        {/* Poster Container */}
                        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden' }}>
                            <img
                                src={`https://image.tmdb.org/t/p/w500${ep.still_path || ep.poster_path}`}
                                alt={ep.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />

                            {/* Remove Button (Top Right, Clean) */}
                            <button onClick={(e) => removeFromWatchlist(e, ep.id)} style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'rgba(0,0,0,0.6)',
                                color: '#ff4444',
                                border: 'none',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                            }}>
                                <MdRemoveCircleOutline size={18} />
                            </button>
                        </div>

                        {/* Meta Info (Below Poster) */}
                        <div style={{ padding: '0 5px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '4px'
                            }}>
                                <span style={{
                                    color: '#FFCC00',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                }}>
                                    Episode {ep.episodeNumber}
                                </span>
                            </div>
                            <div style={{
                                color: '#ddd',
                                fontSize: '0.9rem',
                                fontWeight: '500',
                                lineHeight: '1.4'
                            }}>
                                {ep.name.split(' - ').pop()}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WatchlistSeason;
