import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase-config';
import { tmdbApi } from '../utils/tmdbApi';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import PremiumLoader from '../components/PremiumLoader';
import InlinePageLoader from '../components/InlinePageLoader';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import { MdInsertChart, MdClose, MdShare } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';
import './SeriesGraph.css';
import html2canvas from 'html2canvas';

const SeriesGraph = () => {
    const { currentUser, userData, globalPosters } = useAuth();
    const navigate = useNavigate();

    // State
    const [loading, setLoading] = useState(true);
    const [completedSeries, setCompletedSeries] = useState([]);
    const [selectedSeries, setSelectedSeries] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [readyToShare, setReadyToShare] = useState(false);
    const [graphData, setGraphData] = useState(null);
    const graphRef = useRef(null);

    useScrollLock(generating || readyToShare || showConfirm);

    const getCacheBustedUrl = (url) => {
        if (!url) return '';
        return `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    };

    const fetchRatedSeries = async () => {
        if (!currentUser) return;
        try {
            setLoading(true);

            // Query episode_reviews (Graph needs episode ratings)
            const { data: reviews, error } = await supabase
                .from('episode_reviews')
                .select('tmdb_id, series_name, poster_path')
                .eq('user_id', currentUser.uid);

            if (error) throw error;

            // Deduplicate Series
            const uniqueSeriesMap = new Map();
            if (reviews) {
                reviews.forEach(r => {
                    if (r.tmdb_id && !uniqueSeriesMap.has(r.tmdb_id)) {
                        uniqueSeriesMap.set(r.tmdb_id, {
                            id: r.tmdb_id,
                            name: r.series_name || 'Unknown Series',
                            poster_path: r.poster_path
                        });
                    }
                });
            }

            const initialList = Array.from(uniqueSeriesMap.values());

            // 1. Render immediately with what we have (Fastest Time to Interactive)
            // But keep loading=true to show skeleton until posters are enriched as per user request
            // setCompletedSeries(initialList);

            // 2. Background Enrich: Update posters
            const enrichPosters = async () => {
                const enrichedList = await Promise.all(initialList.map(async (s) => {
                    try {
                        const details = await tmdbApi.getSeriesDetails(s.id);
                        return {
                            ...s,
                            name: details.name,
                            poster_path: details.poster_path
                        };
                    } catch (e) {
                        return s;
                    }
                }));
                // Only update if mounted (conceptually) or just update state
                setCompletedSeries(enrichedList);
                setLoading(false); // NOW we stop loading
            };

            enrichPosters();

        } catch (err) {
            console.error("Error fetching rated series:", err);
            setLoading(false);
        }
    };

    const handlePosterClick = (series) => {
        setSelectedSeries(series);
        setShowConfirm(true);
    };

    const generateGraph = async () => {
        if (!selectedSeries) return;
        setShowConfirm(false);
        setGenerating(true);

        try {
            // 1. Fetch Seasons & Episodes details + User Ratings
            const details = await tmdbApi.getSeriesDetails(selectedSeries.id);
            const userRatings = {}; // Map "S-E" -> rating
            const watchedSet = new Set();

            // Fetch Ratings from Supabase (episode_reviews)
            const { data: reviews } = await supabase
                .from('episode_reviews')
                .select('season_number, episode_number, rating')
                .eq('user_id', currentUser.uid)
                .eq('tmdb_id', selectedSeries.id);

            if (reviews) {
                reviews.forEach(r => {
                    userRatings[`${r.season_number}-${r.episode_number}`] = r.rating;
                    watchedSet.add(`${r.season_number}-${r.episode_number}`);
                });
            }

            // Sort seasons and filter out specials (Season 0) to ensure correct grid alignment
            const sortedSeasons = (details.seasons || [])
                .filter(s => s.season_number > 0)
                .sort((a, b) => a.season_number - b.season_number);

            setGraphData({
                ratings: userRatings,
                watched: watchedSet,
                seasons: sortedSeasons
            });

            // Allow DOM to render hidden graph
            setTimeout(async () => {
                if (graphRef.current) {
                    const canvas = await html2canvas(graphRef.current, {
                        useCORS: true,
                        backgroundColor: '#000000',
                        scale: 2 // High res
                    });

                    // Convert to blob/url for sharing
                    const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                    setSelectedSeries(prev => ({ ...prev, generatedBlob: imageBlob }));

                    setGenerating(false);
                    setReadyToShare(true);
                }
            }, 1500); // Wait for images to load in hidden DOM

        } catch (err) {
            console.error("Graph Gen Error:", err);
            setGenerating(false);
            alert("Failed to generate graph.");
        }
    };

    const handleShare = async () => {
        if (selectedSeries?.generatedBlob) {
            const filesArray = [new File([selectedSeries.generatedBlob], 'series-graph.png', { type: 'image/png' })];
            if (navigator.share) {
                try {
                    await navigator.share({
                        files: filesArray,
                        title: 'My Series Graph',
                        text: `Check out my rating graph for ${selectedSeries.name} on Seriee!`
                    });
                } catch (e) {
                    console.log("Share cancelled/failed", e);
                }
            } else {
                alert("Sharing not supported on this device.");
            }
        }
    };

    const cancelGeneration = () => {
        setReadyToShare(false);
        setGraphData(null);
        setSelectedSeries(null); // Clear blobs
    };

    const getRatingClass = (rating, isWatched) => {
        if (!rating && !isWatched) return 'empty';
        if (!rating && isWatched) return 'watched'; // Grey
        if (rating >= 9) return 'high'; // Gold
        if (rating >= 7) return 'mid'; // Green
        return 'low'; // Red/Orange
    };

    useEffect(() => {
        if (currentUser) {
            fetchRatedSeries();
        }
    }, [currentUser]);

    // Removed blocking loader as requested
    // if (loading) return ... 

    return (
        <div className="series-graph-page-wrapper" style={{
            paddingTop: '80px', // Space for fixed header
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            paddingBottom: '100px', // Space for footer
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch'
        }}>
            {/* Header Title */}
            <div className="series-graph-header" style={{
                textAlign: 'center',
                marginBottom: '40px',
                marginTop: '20px'
            }}>
                <h1 className="graph-page-title" style={{
                    fontSize: '28px',
                    fontFamily: "'Anton', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '8px'
                }}>SERIES GRAPH</h1>
                <p className="graph-page-subtitle" style={{ opacity: 0.6 }}>Select a completed series</p>
            </div>

            {/* Loader / Empty State logic */}
            {completedSeries.length === 0 ? (
                loading ? (
                    /* SKELETON GRID */
                    <div className="completed-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                        gap: '20px',
                        padding: '0 20px'
                    }}>
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} style={{ aspectRatio: '2/3', background: '#333', borderRadius: '8px', animation: 'skeleton-pulse 1.5s infinite ease-in-out' }}></div>
                        ))}
                        <style>{`@keyframes skeleton-pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`}</style>
                    </div>
                ) : (
                    <div className="empty-state">
                        <MdInsertChart size={64} style={{ opacity: 0.5 }} />
                        <p style={{ marginTop: 20 }}>No completed series found.</p>
                    </div>
                )
            ) : (
                <div className="completed-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: '20px',
                    padding: '0 20px'
                }}>
                    {completedSeries.map(series => (
                        <div key={series.id} className="completed-card" onClick={() => handlePosterClick(series)}>
                            <div className="poster-container" style={{ aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                                <img
                                    src={`${getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w342') || ''}?t=${Date.now()}`}
                                    alt={series.name}
                                    className="completed-poster"
                                    crossOrigin="anonymous"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                            <h3 className="series-name" style={{ fontSize: '14px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{series.name}</h3>
                        </div>
                    ))}
                </div>
            )}

            {/* Confirm Modal */}
            {showConfirm && (
                <div className="premium-modal-overlay">
                    <div className="premium-confirm-modal">
                        <div className="modal-text">
                            <h3>Generate Graph?</h3>
                            <h4 className="series-highlight">{selectedSeries.name}</h4>
                        </div>
                        <div className="modal-pill-actions">
                            <button className="generate-pill" onClick={generateGraph}>Generate</button>
                            <button className="cancel-pill" onClick={() => setShowConfirm(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* GENERATING LOADER (Portal based) */}
            {generating && <PremiumLoader message="Preparing Story..." />}

            {/* READY TO SHARE POPUP */}
            {readyToShare && (
                <div className="premium-modal-overlay" style={{ zIndex: 10000 }}>
                    <div className="premium-confirm-modal" style={{ gap: '25px', padding: '30px' }}>
                        <div className="modal-text">
                            <h2 style={{ fontFamily: "'Anton', sans-serif", fontSize: '24px', letterSpacing: '1px', textTransform: 'uppercase' }}>GRAPH IS READY TO SHARE</h2>
                        </div>
                        <div className="modal-pill-actions" style={{ flexDirection: 'column', width: '100%', gap: '15px' }}>
                            <button className="generate-pill" onClick={handleShare} style={{ width: '100%', justifyContent: 'center', fontSize: '18px', padding: '15px' }}>
                                <MdShare style={{ marginRight: '8px' }} /> SHARE
                            </button>
                            <button className="cancel-pill" onClick={cancelGeneration} style={{ width: '100%', fontSize: '16px', background: 'rgba(255,255,255,0.1)' }}>
                                CANCEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HIDDEN GRAPH DOM FOR CAPTURE */}
            {graphData && (
                <div className="hidden-graph-staging" style={{
                    position: 'fixed',
                    left: '-9999px',
                    top: 0,
                    visibility: 'visible',
                    pointerEvents: 'none'
                }}>
                    <div className="graph-export-wrapper" style={{ width: '1080px', height: '1920px', background: '#000' }}>
                        <div className="instagram-post-canvas" ref={graphRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>

                            {/* BACKGROUND POSTER (Blurred/Darkened) */}
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                backgroundImage: `url(${getCacheBustedUrl(getResolvedPosterUrl(selectedSeries.id, selectedSeries.poster_path, globalPosters, 'original'))})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                filter: 'brightness(0.3) blur(20px)',
                                transform: 'scale(1.1)', // Prevent blur edges
                                zIndex: 0
                            }}></div>

                            {/* MAIN POSTER (Clean) - Optional, maybe just the graph? Let's keep a nice header */}
                            <div style={{
                                position: 'relative',
                                zIndex: 1,
                                height: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '60px',
                                boxSizing: 'border-box',
                                justifyContent: 'space-between'
                            }}>
                                {/* HEADER */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: '32px', color: '#FFD600', textTransform: 'uppercase' }}>Series Graph</span>
                                        <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: '80px', color: '#fff', margin: '10px 0', lineHeight: '0.9', maxWidth: '800px' }}>
                                            {selectedSeries.name}
                                        </h1>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: '24px', color: 'rgba(255,255,255,0.7)' }}>reviewed by</span>
                                        <span style={{ fontFamily: "'Anton', sans-serif", fontSize: '40px', color: '#fff' }}>@{userData?.username || currentUser.displayName || 'user'}</span>
                                    </div>
                                </div>

                                {/* GRAPH GRID (Centered/Floating) */}
                                <div style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    margin: '60px 0'
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '15px',
                                        background: 'rgba(0,0,0,0.5)',
                                        padding: '40px',
                                        borderRadius: '30px',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        {graphData?.seasons && Array.from({ length: Math.max(...graphData.seasons.map(s => s.episode_count)) }).map((_, eIdx) => (
                                            <div key={eIdx} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                                {/* E-Number Label */}
                                                <div style={{
                                                    width: '50px',
                                                    fontFamily: "'Roboto Mono', monospace",
                                                    fontSize: '24px',
                                                    color: 'rgba(255,255,255,0.5)',
                                                    textAlign: 'right'
                                                }}>E{eIdx + 1}</div>

                                                {/* Season Cells */}
                                                {graphData.seasons.map(s => {
                                                    const epNum = eIdx + 1;
                                                    if (epNum > s.episode_count) return <div key={s.season_number} style={{ width: '60px', height: '60px' }}></div>;

                                                    const rating = graphData.ratings[`${s.season_number}-${epNum}`];
                                                    const isWatched = graphData.watched.has(`${s.season_number}-${epNum}`);

                                                    // Dynamic Color Logic
                                                    let bg = '#1a1a1a';
                                                    let color = '#fff';
                                                    if (rating >= 9) { bg = '#FFD600'; color = '#000'; }
                                                    else if (rating >= 7) { bg = '#4CAF50'; color = '#fff'; }
                                                    else if (rating > 0) { bg = '#FF5722'; color = '#fff'; }
                                                    else if (isWatched) { bg = '#333'; color = '#666'; }

                                                    return (
                                                        <div key={s.season_number} style={{
                                                            width: '60px',
                                                            height: '60px',
                                                            background: bg,
                                                            color: color,
                                                            borderRadius: '8px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontFamily: "'Anton', sans-serif",
                                                            fontSize: '24px',
                                                            boxShadow: rating > 0 ? '0 4px 10px rgba(0,0,0,0.3)' : 'none'
                                                        }}>
                                                            {rating > 0 ? rating.toFixed(1) : (isWatched ? '-' : '')}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}

                                        {/* Season Labels (Bottom) */}
                                        <div style={{ display: 'flex', gap: '15px', marginLeft: '65px', marginTop: '10px' }}>
                                            {graphData?.seasons?.map(s => (
                                                <div key={s.season_number} style={{
                                                    width: '60px',
                                                    textAlign: 'center',
                                                    fontFamily: "'Roboto Mono', monospace",
                                                    fontSize: '24px',
                                                    color: 'rgba(255,255,255,0.5)'
                                                }}>S{s.season_number}</div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* FOOTER */}
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', opacity: 0.8 }}>
                                    <div style={{ fontWeight: 900, fontSize: '32px', color: '#fff', letterSpacing: '2px', fontFamily: "'Anton', sans-serif" }}>SERIEE</div>
                                    <div style={{ width: '8px', height: '8px', background: '#FFD600', borderRadius: '50%' }}></div>
                                    <span style={{ fontFamily: "'Netflix Sans', sans-serif", fontSize: '24px', color: '#ccc' }}>TRACK. RATE. SHARE.</span>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeriesGraph;
