import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { MdLock, MdCheck, MdArrowBack } from 'react-icons/md';
import { getPosterUnlockStatus } from '../utils/posterUnlockLogic';

const PosterSelection = () => {
    const { id, seasonNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();

    const [posters, setPosters] = useState([]);
    const [unlockStatus, setUnlockStatus] = useState({ unlockCount: 10, isFullSeriesUnlocked: false });
    const [selectedPoster, setSelectedPoster] = useState(null);
    const [seriesDetails, setSeriesDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';

    useEffect(() => {
        fetchData();
    }, [id, seasonNumber]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch series details
            const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`);
            const seriesData = await seriesRes.json();
            setSeriesDetails(seriesData);

            // Fetch season images/posters
            const posterRes = await fetch(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/images?api_key=${TMDB_API_KEY}`);
            const posterData = await posterRes.json();
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

            await updateDoc(userRef, {
                [`selectedPosters.${key}`]: posterPath
            });

            setSelectedPoster(posterPath);

            // Show success feedback
            setTimeout(() => {
                navigate(`/tv/${id}/season/${seasonNumber}`);
            }, 800);

        } catch (error) {
            console.error('Error saving poster selection:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                background: '#000',
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
            }}>
                <div>Loading posters...</div>
            </div>
        );
    }

    return (
        <div style={{
            background: '#000',
            minHeight: '100vh',
            padding: '40px 20px',
            color: '#fff'
        }}>
            {/* Header */}
            <div style={{ maxWidth: '1200px', margin: '0 auto 40px auto' }}>
                <Link
                    to={`/tv/${id}/season/${seasonNumber}`}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#FFD600',
                        textDecoration: 'none',
                        marginBottom: '20px',
                        fontSize: '16px'
                    }}
                >
                    <MdArrowBack size={24} />
                    Back to Season
                </Link>

                <h1 style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    margin: '0 0 10px 0'
                }}>
                    {seriesDetails?.name} - Season {seasonNumber}
                </h1>
                <p style={{ fontSize: '18px', color: '#888', margin: 0 }}>
                    Choose your poster
                </p>

                {!unlockStatus.isFullSeriesUnlocked && (
                    <div style={{
                        marginTop: '15px',
                        padding: '12px 16px',
                        background: 'rgba(255, 214, 0, 0.1)',
                        border: '1px solid rgba(255, 214, 0, 0.3)',
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: '#FFD600'
                    }}>
                        🔒 Finish the whole series to unlock all remaining posters
                    </div>
                )}
            </div>

            {/* Poster Grid */}
            <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '20px'
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
                                cursor: isLocked || saving ? 'not-allowed' : 'pointer',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                aspectRatio: '2/3',
                                background: '#111',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                border: isSelected ? '3px solid #FFD600' : '3px solid transparent',
                                boxShadow: isSelected ? '0 0 30px rgba(255, 214, 0, 0.4)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (!isLocked && !saving) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            <img
                                src={`https://image.tmdb.org/t/p/w500${poster.file_path}`}
                                alt="Poster"
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    filter: isLocked ? 'blur(8px)' : 'none',
                                    opacity: isLocked ? 0.3 : 1
                                }}
                            />

                            {/* Lock Icon */}
                            {isLocked && (
                                <div style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0, 0, 0, 0.8)',
                                    borderRadius: '50%',
                                    padding: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MdLock size={40} color="#FFD600" />
                                </div>
                            )}

                            {/* Selected Badge */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: '#FFD600',
                                    borderRadius: '50%',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
                                }}>
                                    <MdCheck size={24} color="#000" />
                                </div>
                            )}

                            {/* Poster Number */}
                            <div style={{
                                position: 'absolute',
                                bottom: '10px',
                                left: '10px',
                                background: 'rgba(0, 0, 0, 0.7)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>
                                #{index + 1}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* No posters message */}
            {posters.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#888'
                }}>
                    <p style={{ fontSize: '18px' }}>No additional posters available for this season.</p>
                </div>
            )}

            {/* Saving indicator */}
            {saving && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#FFD600',
                    color: '#000',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}>
                    Saving selection...
                </div>
            )}
        </div>
    );
};

export default PosterSelection;
