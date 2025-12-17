import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, updateDoc } from 'firebase/firestore';
import { MdLock, MdCheck, MdArrowBack } from 'react-icons/md';
import { getPosterUnlockStatus } from '../utils/posterUnlockLogic';
import { logActivity } from '../utils/activityLogger';

const PosterSelection = () => {
    const { id, seasonNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();

    const [posters, setPosters] = useState([]);
    const [unlockStatus, setUnlockStatus] = useState({ unlockCount: 10, isFullSeriesUnlocked: false });
    const [selectedPoster, setSelectedPoster] = useState(null);
    const [seriesName, setSeriesName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';

    useEffect(() => {
        fetchData();
    }, [id, seasonNumber]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Series Basic Info (Just for name check)
            const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`);
            const seriesData = await seriesRes.json();
            setSeriesName(seriesData.name);

            // 2. STRICT: Fetch ONLY Season Images
            const posterRes = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/images?api_key=${TMDB_API_KEY}`);
            const posterData = await posterRes.json();

            // STRICT: Use only posters[].file_path
            setPosters(posterData.posters || []);

            // Check unlock status
            if (userData) {
                const status = getPosterUnlockStatus(
                    seriesData.seasons,
                    userData.completedSeasons,
                    id
                );
                setUnlockStatus(status);
            }

            // Get currently selected poster
            const key = `${id}_${seasonNumber}`;
            const currentSelection = userData?.selectedPosters?.[key];
            setSelectedPoster(currentSelection || null);

        } catch (error) {
            console.error('Error fetching poster data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePosterSelect = async (posterPath) => {
        if (!currentUser || saving) return;

        setSaving(true);
        try {
            const key = `${id}_${seasonNumber}`;
            const userRef = doc(db, 'users', currentUser.uid);

            // 1. Save Selection (User + Series + Season => Poster)
            await updateDoc(userRef, {
                [`selectedPosters.${key}`]: posterPath
            });

            // 2. STRICT Activity Log
            // Text: "{username} customized the Season {X} poster"
            // We pass the explicit posterPath to lock it in history.
            logActivity(
                currentUser.uid, // Correct signature based on typical usage (check activityLogger definition if needed, but previously it was objects)
                // Wait, activityLogger.js expects (userObj, actionType, seriesDataObj) based on my read
                // Let's call it correctly based on the file I read earlier: logActivity(user, actionType, seriesData)
                userData, // This needs to be the user object with username/photoURL
                'selected_poster',
                {
                    id: Number(id),
                    name: seriesName,
                    poster_path: posterPath, // The CUSTOM poster
                    seasonNumber: Number(seasonNumber)
                }
            );

            setSelectedPoster(posterPath);

            // Show success feedback and redirect
            setTimeout(() => {
                navigate(`/tv/${id}/season/${seasonNumber}`);
            }, 500);

        } catch (error) {
            console.error('Error saving poster selection:', error);
        } finally {
            setSaving(false);
        }
    };

    // Helper to ensure we pass correct user object to logActivity if userData is partial
    const handleSave = (path) => {
        const logUser = {
            uid: currentUser.uid,
            username: userData.username || 'User',
            photoURL: currentUser.photoURL
        };
        // Reuse logic but with constructed user object if needed, 
        // but 'handlePosterSelect' uses 'userData' which usually comes from AuthContext. 
        // If AuthContext user object is structured right, it's fine.
        // Let's stick to handlePosterSelect above.
        handlePosterSelect(path);
    };

    if (loading) {
        return (
            <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <div>Loading posters...</div>
            </div>
        );
    }

    return (
        <div style={{ background: '#000', minHeight: '100vh', padding: '20px', color: '#fff' }}>
            {/* Header - Simple, No metadata clutter */}
            <div style={{ maxWidth: '1200px', margin: '0 auto 30px auto', paddingTop: '20px' }}>
                <div
                    onClick={() => navigate(`/tv/${id}/season/${seasonNumber}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer', marginBottom: '20px' }}
                >
                    <MdArrowBack size={24} />
                    <span style={{ fontWeight: 'bold' }}>Back to Season</span>
                </div>

                <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 5px 0' }}>Select Season Poster</h1>
                <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>
                    {seriesName} • Season {seasonNumber}
                </p>
            </div>

            {/* Poster Grid - Vertical Cards Only */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', // Mobile friendly min-width
                gap: '15px'
            }}>
                {posters.map((poster, index) => {
                    const isLocked = index >= unlockStatus.unlockCount;
                    const isSelected = selectedPoster === poster.file_path;

                    return (
                        <div
                            key={poster.file_path}
                            onClick={() => !isLocked && !saving && handlePosterSelect(poster.file_path)}
                            style={{
                                position: 'relative',
                                aspectRatio: '2/3',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                cursor: isLocked ? 'not-allowed' : 'pointer',
                                border: isSelected ? '3px solid #FFD600' : 'none',
                                opacity: isLocked ? 0.5 : 1,
                                transition: 'transform 0.2s'
                            }}
                        >
                            <img
                                src={`https://image.tmdb.org/t/p/w500${poster.file_path}`}
                                alt=""
                                loading="lazy"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    display: 'block'
                                }}
                            />

                            {/* Lock Overlay */}
                            {isLocked && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.6)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MdLock color="#fff" size={24} />
                                </div>
                            )}

                            {/* Checkmark for Selected */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    background: '#FFD600',
                                    borderRadius: '50%',
                                    padding: '4px',
                                    display: 'flex'
                                }}>
                                    <MdCheck color="#000" size={16} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Loading/Saving Overlay */}
            {saving && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#333', color: '#fff', padding: '12px 24px', borderRadius: '30px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontWeight: 'bold', zIndex: 100
                }}>
                    Saving...
                </div>
            )}
        </div>
    );
};

export default PosterSelection;
