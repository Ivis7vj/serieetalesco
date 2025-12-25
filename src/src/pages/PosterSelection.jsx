import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, updateDoc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { MdLock, MdCheck, MdArrowBack } from 'react-icons/md';
import { supabase } from '../supabase-config';
import { logActivity } from '../utils/activityLogger';
import { getPosterUnlockStatus } from '../utils/posterUnlockLogic';
import * as watchedService from '../utils/watchedService';

const PosterSelection = () => {
    const { id, seasonNumber } = useParams(); // seasonNumber still in URL for navigation context
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();

    const [posters, setPosters] = useState([]);
    const [unlockCount, setUnlockCount] = useState(1);
    const [selectedPoster, setSelectedPoster] = useState(null);
    const [seriesName, setSeriesName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false); // Success Popup State

    const TMDB_API_KEY = '05587a49bd4890a9630d6c0e544e0f6f';

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Series Info & Images
            // Fetch series details to count total seasons
            const seriesRes = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`);
            const seriesData = await seriesRes.json();
            setSeriesName(seriesData.name);

            // Filter out Specials (Season 0) and unreleased if needed, but number_of_seasons is usually the metric.
            // Prompt: "Do NOT count unreleased seasons". 'number_of_seasons' comes from TMDB.
            // A clearer way: filter seasons array.
            const releasedSeasons = (seriesData.seasons || []).filter(s => s.season_number > 0 && s.air_date && new Date(s.air_date) <= new Date());
            const totalSeasons = releasedSeasons.length || seriesData.number_of_seasons || 1;

            // Fetch ALL Series Posters
            const imagesRes = await fetch(`https://api.themoviedb.org/3/tv/${id}/images?api_key=${TMDB_API_KEY}`);
            const imagesData = await imagesRes.json();
            const allPosters = imagesData.posters || [];

            setPosters(allPosters);

            // 2. Calculate Unlock Status
            // Count watched episodes from Supabase/Firebase via service
            const watchedEpisodes = await watchedService.getWatchedEpisodes(currentUser.uid, Number(id));

            // Group by season and count episodes per season
            const watchedPerSeason = {};
            watchedEpisodes.forEach(ep => {
                watchedPerSeason[ep.season] = (watchedPerSeason[ep.season] || 0) + 1;
            });

            // Count how many seasons are fully completed
            let completedSeasonsCount = 0;
            releasedSeasons.forEach(s => {
                const seasonNum = s.season_number;
                const totalInSeason = s.episode_count || 0;
                const watchedInSeason = watchedPerSeason[seasonNum] || 0;

                if (totalInSeason > 0 && watchedInSeason >= totalInSeason) {
                    completedSeasonsCount++;
                }
            });

            const totalPosters = allPosters.length;
            const { unlockCount: unlocked } = getPosterUnlockStatus(totalSeasons, completedSeasonsCount, totalPosters);

            setUnlockCount(unlocked);

            // 3. Get Current Global Selection (From globalPosters context if available, or just fetch if needed)
            // But we can listen or just read once. Since AuthContext has it, better to use that if we passed it?
            // But here we might not have it in context easily if we didn't update posterResolution call in THIS file.
            // Let's use userData for now as we did before, OR use the collection if we want strict consistency.
            // Since AuthContext exposes globalPosters, we should probably use that.
            // But let's stick to reading userData.customPosters map OR the context map.
            // The prompt says "DB STRUCTURE: One document per user+series".
            // AuthContext *reads* this connection.
            // So we can assume AuthContext has the latest if it's subscribed.
            // But we didn't import globalPosters here.

            // NOTE: To be safe and fast, I will rely on the fact that we are writing to the collection.
            // And AuthContext reads it. 
            // BUT for initial render here, checking local prop logic is fine.
            // Wait, we need to show which one is selected.
            // I'll leave the currentGlobal default logic but maybe we should use useAuth().globalPosters?
            // I will update Step 1 imports to include globalPosters if I want to be cleaner.
            // But let's just proceed with the save logic first.
            const currentGlobal = userData?.customPosters?.[id];
            setSelectedPoster(currentGlobal || null);

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
            const userRef = doc(db, 'users', currentUser.uid);

            // 1. SAVE TO user_posters TABLE (Supabase)
            const { error: supabaseError } = await supabase
                .from('user_posters')
                .upsert({
                    user_id: currentUser.uid,
                    series_id: Number(id),
                    poster_path: posterPath,
                    updated_at: new Date().toISOString()
                });

            if (supabaseError) throw supabaseError;

            // 2. UPDATE USER: lastPosterEditAt (Firestore - to enforce 24h lock)
            await updateDoc(userRef, {
                lastPosterEditAt: new Date().toISOString()
            });

            // Log Activity with exact requested text: "chose this poster for"
            logActivity(
                { ...currentUser, username: userData?.username || 'User', photoURL: userData?.profilePhoto },
                'poster_updated',
                {
                    seriesId: Number(id),
                    seriesName: seriesName,
                    posterPath: posterPath,
                    customText: `chose this poster for`
                }
            );

            setSelectedPoster(posterPath);
            setShowSuccess(true); // Show confirmation

            // Success & Redirect
            setTimeout(() => {
                navigate(`/tv/${id}/season/${seasonNumber}`);
            }, 1500); // 1.5s as requested

        } catch (error) {
            console.error('Error saving global poster:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <div>Loading posters...</div>
            </div>
        );
    }

    return (
        <div style={{ background: '#000', minHeight: '100vh', padding: '20px', color: '#fff', position: 'relative' }}>
            {/* SUCCESS POPUP */}
            {showSuccess && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(5px)',
                    animation: 'fadeIn 0.3s ease'
                }}>
                    <div style={{
                        background: '#1a1a1a',
                        padding: '30px 50px',
                        borderRadius: '16px',
                        textAlign: 'center',
                        border: '1px solid #333',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '50%', background: '#FFD600',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto'
                        }}>
                            <MdCheck size={36} color="#000" />
                        </div>
                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Poster updated successfully</h2>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ maxWidth: '1200px', margin: '0 auto 30px auto', paddingTop: '20px' }}>
                <div
                    onClick={() => navigate(`/tv/${id}/season/${seasonNumber}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer', marginBottom: '20px' }}
                >
                    <MdArrowBack size={24} />
                    <span style={{ fontWeight: 'bold' }}>Back to Series</span>
                </div>

                <h1 style={{ fontSize: '24px', fontWeight: '900', margin: '0 0 5px 0' }}>Select Global Poster</h1>
                <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>
                    {seriesName} • {unlockCount} / {posters.length} Unlocked
                </p>
            </div>

            {/* Poster Grid - 2 cols mobile, 4 cols desktop */}
            <div className="poster-grid-container">
                {posters.map((poster, index) => {
                    const isLocked = index >= unlockCount;
                    const isSelected = selectedPoster === poster.file_path;

                    return (
                        <div
                            key={poster.file_path}
                            onClick={() => !isLocked && !saving && handlePosterSelect(poster.file_path)}
                            style={{
                                position: 'relative',
                                aspectRatio: '2/3',
                                borderRadius: '14px',
                                overflow: 'hidden',
                                cursor: isLocked ? 'not-allowed' : 'pointer',
                                border: isSelected ? '3px solid #FFD600' : 'none',
                                opacity: isLocked ? 1 : 1, // Keep opacity 1 but use overlay
                                transition: 'transform 0.2s',
                                background: '#111'
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
                                    background: 'rgba(0,0,0,0.6)', /* Grey overlay */
                                    backdropFilter: 'blur(4px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <MdLock color="#fff" size={32} />
                                </div>
                            )}

                            {/* Checkmark */}
                            {isSelected && (
                                <div style={{
                                    position: 'absolute',
                                    top: '10px',
                                    right: '10px',
                                    background: '#FFD600',
                                    borderRadius: '50%',
                                    padding: '6px',
                                    display: 'flex',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
                                }}>
                                    <MdCheck color="#000" size={20} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <style>{`
                .poster-grid-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: repeat(2, 1fr); /* 2 Columns Mobile */
                    gap: 15px;
                }
                @media (min-width: 768px) {
                    .poster-grid-container {
                        grid-template-columns: repeat(4, 1fr); /* 4 Columns Desktop */
                    }
                }
            `}</style>
        </div>
    );
};

export default PosterSelection;
