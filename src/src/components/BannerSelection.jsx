import React, { useState, useEffect } from 'react';
import { MdArrowBack, MdLock } from 'react-icons/md';
import { db } from '../firebase-config';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { tmdbApi } from '../utils/tmdbApi'; // Added import
import './BannerSelection.css';
import PremiumLoader from '../components/PremiumLoader';
import { triggerErrorAutomation } from '../utils/errorAutomation';

const BannerSelection = ({ series, onClose, onBack, onSelectSeries }) => {
    useScrollLock(true);
    const [backdrops, setBackdrops] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBackdrop, setSelectedBackdrop] = useState(null);
    const [saving, setSaving] = useState(false);
    const [daysRemaining, setDaysRemaining] = useState(0);
    const [canUpdate, setCanUpdate] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);

    const { currentUser } = useAuth();
    const { alert } = useNotification();

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

    // Check Limit on Mount
    useEffect(() => {
        const checkLimit = async () => {
            if (!currentUser) return;
            const userRef = doc(db, 'users', currentUser.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const data = snap.data();
                if (data.bannerUpdatedAt) {
                    const lastUpdate = new Date(data.bannerUpdatedAt);
                    const now = new Date();
                    const diffTime = Math.abs(now - lastUpdate);
                    // diffDays is purely difference. We need to check if 7 days PASSED.

                    const daysPassed = (now - lastUpdate) / (1000 * 60 * 60 * 24);

                    if (daysPassed < 7) {
                        setCanUpdate(false);
                        setDaysRemaining(Math.ceil(7 - daysPassed));
                    }
                }
            }
        };
        checkLimit();
    }, [currentUser]);

    // Fetch Backdrops
    useEffect(() => {
        const fetchImages = async () => {
            setLoading(true);
            try {
                const response = await fetch(`${TMDB_BASE_URL}/tv/${series.id}/images?api_key=${TMDB_API_KEY}`);
                const data = await response.json();

                // Filter for backdrops
                let validBackdrops = (data.backdrops || []).filter(b => b.width > 1280);
                if (validBackdrops.length === 0) validBackdrops = data.backdrops || [];

                setBackdrops(validBackdrops);

                // If no backdrops, show recommendations 
                if (validBackdrops.length === 0) {
                    const recs = await tmdbApi.getRecommendations(series.id);
                    setRecommendedSeries(recs.slice(0, 12));
                }
            } catch (error) {
                triggerErrorAutomation(error);
            }
            setLoading(false);
        };
        if (series) fetchImages();
    }, [series, TMDB_API_KEY]);

    const [recommendedSeries, setRecommendedSeries] = useState([]); // New state for recommendations

    const handleSaveClick = () => {
        if (!canUpdate) {
            alert(`You can change your banner again in ${daysRemaining} days.`, "Weekly Limit Reached");
            return;
        }
        if (!selectedBackdrop) return;
        setShowConfirm(true); // Open Confirmation Modal
    };

    const confirmSave = async () => {
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                bannerSeriesId: series.id,
                bannerBackdropPath: selectedBackdrop.file_path,
                bannerUpdatedAt: new Date().toISOString()
            });
            setShowConfirm(false);
            onClose();
        } catch (error) {
            triggerErrorAutomation(error);
            setShowConfirm(false);
        }
        setSaving(false);
    };

    return (
        <div className="banner-selection-overlay">
            <div className="selection-header">
                <button className="back-btn" onClick={onBack}><MdArrowBack size={24} /></button>
                <h3>Choose Banner for {series.name}</h3>
            </div>

            <div className="selection-content">
                {loading ? (
                    <div style={{ position: 'relative', height: '300px' }}><PremiumLoader message="Loading backdrops..." /></div>
                ) : backdrops.length === 0 ? (
                    <div className="no-backdrops-container">
                        <div className="no-results" style={{ marginBottom: '20px' }}>No high-quality backdrops available for this series.</div>
                        <h4 style={{ color: 'var(--text-muted)', marginBottom: '15px', textAlign: 'center' }}>TRY THESE INSTEAD:</h4>
                        <div className="results-grid">
                            {recommendedSeries.map(rec => (
                                <div key={rec.id} className="result-card" onClick={() => { setBackdrops([]); setLoading(true); tmdbApi.getSeriesDetails(rec.id).then(onSelectSeries || (() => { })); }}>
                                    <div className="result-poster-wrapper">
                                        <img
                                            src={`https://image.tmdb.org/t/p/w500${rec.poster_path}`}
                                            alt={rec.name}
                                            className="result-poster"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    <div className="result-name">{rec.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="backdrop-list">
                        {backdrops.map(backdrop => (
                            <div
                                key={backdrop.file_path}
                                className={`backdrop-item ${selectedBackdrop?.file_path === backdrop.file_path ? 'selected' : ''}`}
                                onClick={() => setSelectedBackdrop(backdrop)}
                            >
                                <img
                                    src={`https://image.tmdb.org/t/p/w780${backdrop.file_path}`}
                                    alt="Banner Option"
                                    loading="lazy"
                                />
                                {selectedBackdrop?.file_path === backdrop.file_path && (
                                    <div className="selection-indicator" />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className={`selection-footer ${selectedBackdrop ? 'visible' : ''}`}>
                {!canUpdate && (
                    <div className="limit-warning">
                        <MdLock size={16} /> Update available in {daysRemaining} days
                    </div>
                )}
                {selectedBackdrop && (
                    <button
                        className="set-banner-btn"
                        disabled={saving || !canUpdate}
                        onClick={handleSaveClick}
                    >
                        {saving ? 'Saving...' : canUpdate ? 'Set as Banner' : 'Locked'}
                    </button>
                )}
            </div>


            {/* Custom Confirmation Modal */}
            {
                showConfirm && (
                    <div className="confirm-modal-overlay">
                        <div className="confirm-modal">
                            <h3>Confirm Banner Change</h3>
                            <p>Once selected, you can only change your banner again after <b>7 days</b>.</p>
                            <div className="confirm-actions">
                                <button className="confirm-btn cancel" onClick={() => setShowConfirm(false)}>Cancel</button>
                                <button className="confirm-btn ok" onClick={confirmSave}>Set Banner</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default BannerSelection;
