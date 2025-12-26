import { useRef, useEffect, useState } from 'react';
import { MdStar, MdDelete, MdShare, MdEdit } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { tmdbApi } from '../utils/tmdbApi';
import * as reviewService from '../utils/reviewService';
import PremiumLoader from '../components/PremiumLoader';
import InlinePageLoader from '../components/InlinePageLoader';

// Sticker Logic

import { Link, useNavigate } from 'react-router-dom';
import ReviewModal from '../components/ReviewModal';
import LoadingPopup from '../components/LoadingPopup';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { useScrollLock } from '../hooks/useScrollLock';
import './Home.css';

const reviewCache = {}; // Simple in-memory cache

const UserReview = () => {
    const navigate = useNavigate();
    const { currentUser, userData, globalPosters } = useAuth(); // userData is still used in handleShare

    // Initial State from Cache if available
    const [reviews, setReviews] = useState(() => {
        return (currentUser && reviewCache[currentUser.uid]) || [];
    });

    const [loading, setLoading] = useState(!currentUser || !reviewCache[currentUser.uid]);
    const [editModal, setEditModal] = useState({ isOpen: false, review: null });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, reviewId: null }); // Removed tmdbId, isSeries as per diff

    // Global Scroll Lock
    useScrollLock(editModal.isOpen || deleteModal.isOpen);

    // Metadata Cache for missing posters/titles
    const [missingDetails, setMissingDetails] = useState({});

    const handleEdit = (review) => {
        setEditModal({ isOpen: true, review });
    };

    const handleShare = (reviewItem, isSeries = true) => {
        const dataToPass = {
            movie: {
                seriesId: reviewItem.tmdbId,
                name: reviewItem.name,
                poster_path: reviewItem.poster_path,
                seasonEpisode: reviewItem.isEpisode ? `S${reviewItem.seasonNumber} E${reviewItem.episodeNumber}` : (reviewItem.isSeason ? `S${reviewItem.seasonNumber}` : null),
                seasonNumber: reviewItem.seasonNumber || 0
            },
            rating: reviewItem.rating ? parseFloat(reviewItem.rating) * 2 : 0,
            user: {
                username: userData?.username || 'User',
                photoURL: currentUser?.photoURL,
                uid: currentUser?.uid
            },
            isEpisodes: reviewItem.isEpisode
        };
        navigate('/share-sticker', { state: { stickerData: dataToPass } });
    };

    useEffect(() => {
        if (!currentUser) return;
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const fetched = await reviewService.getUserReviews(currentUser.uid);
                setReviews(fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

                // Identify missing details
                const missingIds = new Set();
                fetched.forEach(r => {
                    if ((!r.poster_path || !r.name) && r.tmdbId) {
                        missingIds.add(r.tmdbId);
                    }
                });

                // Fetch missing details
                if (missingIds.size > 0) {
                    const detailsMap = {};
                    await Promise.all(Array.from(missingIds).map(async (id) => {
                        try {
                            const details = await tmdbApi.getSeriesDetails(id);
                            detailsMap[id] = {
                                poster_path: details.poster_path,
                                name: details.name
                            };
                        } catch (err) {
                            console.error(`Failed to fetch details for ${id}`, err);
                        }
                    }));
                    setMissingDetails(prev => ({ ...prev, ...detailsMap }));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [currentUser]);

    const refreshReviewsBackground = async () => {
        if (!currentUser) return;
        const fetched = await reviewService.getUserReviews(currentUser.uid);
        setReviews(fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };

    const handleUpdateReview = async (data) => {
        if (!editModal.review) return;
        const reviewId = editModal.review.id;

        try {
            const reviewRef = doc(db, 'reviews', reviewId);
            await updateDoc(reviewRef, {
                rating: data.rating,
                review: data.review,
                updatedAt: new Date().toISOString()
            });

            // Optimistic Update
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, rating: data.rating, review: data.review } : r));
            setEditModal({ isOpen: false, review: null });

            // Background Refresh
            await refreshReviewsBackground();

        } catch (error) {
            console.error("Error updating review:", error);
        }
    };

    const { confirm } = useNotification();

    const initiateDelete = (review, isSeries) => {
        if (isSeries) {
            setDeleteModal({
                isOpen: true,
                reviewId: review.id,
                tmdbId: review.tmdbId,
                isSeries: true
            });
        } else {
            handleStandardDelete(review);
        }
    };

    const handleStandardDelete = async (review) => {
        const isConfirmed = await confirm("Are you sure you want to delete this review?", "Delete Review", "Delete", "Cancel");
        if (isConfirmed) {
            await performDelete(review);
        }
    };

    const performDelete = async (review) => {
        const id = review.id;
        try {
            // Delete based on source or try both
            if (review.source === 'supabase') {
                if (review.isEpisode) {
                    await reviewService.deleteEpisodeReview(id);
                } else {
                    await reviewService.deleteSeasonReview(id);
                }
            } else {
                // Firebase delete
                await deleteDoc(doc(db, 'reviews', id));
            }

            // Optimistic Update
            const updated = reviews.filter(r => r.id !== id);
            setReviews(updated);

            // Background Refresh
            await refreshReviewsBackground();
        } catch (err) {
            console.error("Error deleting review:", err);
        }
    };

    const confirmSeriesDelete = async () => {
        if (!deleteModal.reviewId) return;

        try {
            // 1. Delete based on source
            const reviewToDelete = reviews.find(r => r.id === deleteModal.reviewId);

            if (reviewToDelete) {
                if (reviewToDelete.source === 'supabase') {
                    await reviewService.deleteSeasonReview(deleteModal.reviewId);
                } else {
                    await deleteDoc(doc(db, 'reviews', deleteModal.reviewId));
                }
            } else {
                await deleteDoc(doc(db, 'reviews', deleteModal.reviewId));
            }

            // 2. Remove Star Badge logic
            if (currentUser && deleteModal.tmdbId) {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    const updatedStars = (userData.starSeries || []).filter(s => String(s.id) !== String(deleteModal.tmdbId));
                    await updateDoc(userRef, { starSeries: updatedStars });
                }
            }

            // 3. Optimistic Update
            const updated = reviews.filter(r => r.id !== deleteModal.reviewId);
            setReviews(updated);
            setDeleteModal({ isOpen: false, reviewId: null, isSeries: false });

            // Background Refresh
            await refreshReviewsBackground();

        } catch (err) {
            console.error("Error deleting full review:", err);
        }
    };

    if (loading && reviews.length === 0) {
        return (
            <div className="section" style={{ minHeight: '100vh', background: '#000' }}>
                <h2 className="section-title">Your Reviews</h2>
                <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '20px', opacity: 1 }}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} style={{ display: 'flex', gap: '15px' }}>
                            {/* Poster Placeholder */}
                            <div style={{ width: '60px', height: '90px', background: '#222', borderRadius: '4px', animation: 'skeleton-pulse 1.5s infinite ease-in-out' }}></div>
                            {/* Text Lines */}
                            <div style={{ flex: 1, paddingTop: '5px' }}>
                                <div style={{ width: '40%', height: '15px', background: '#222', borderRadius: '4px', marginBottom: '10px', animation: 'skeleton-pulse 1.5s infinite ease-in-out' }}></div>
                                <div style={{ width: '80%', height: '12px', background: '#222', borderRadius: '4px', marginBottom: '8px', animation: 'skeleton-pulse 1.5s infinite ease-in-out', animationDelay: '0.1s' }}></div>
                                <div style={{ width: '60%', height: '12px', background: '#222', borderRadius: '4px', animation: 'skeleton-pulse 1.5s infinite ease-in-out', animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    ))}
                    <style>{`@keyframes skeleton-pulse { 0% { opacity: 0.3; } 50% { opacity: 0.6; } 100% { opacity: 0.3; } }`}</style>
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <h2 className="section-title">Your Reviews <span style={{ fontSize: '1rem', color: '#666', fontWeight: 'normal' }}>({reviews.length})</span></h2>

            {reviews.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                    <p>You haven't reviewed anything yet.</p>
                </div>
            ) : (
                <div className="reviews-list" style={{ maxWidth: '800px' }}>
                    {Object.values(reviews.reduce((acc, review) => {
                        const key = review.tmdbId || review.id;
                        if (!acc[key]) {
                            acc[key] = {
                                ...review,
                                episodes: []
                            };
                        }
                        if (review.isEpisode) {
                            acc[key].episodes.push(review);
                        } else {
                            acc[key].seriesReview = review;
                        }
                        return acc;
                    }, {})).map((group) => (
                        <div key={group.tmdbId} style={{ background: '#222', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Link to={`/${group.type || 'tv'}/${group.tmdbId}`}>
                                    {group.poster_path || missingDetails[group.tmdbId]?.poster_path ? (
                                        <img
                                            src={getResolvedPosterUrl(group.tmdbId, group.poster_path || missingDetails[group.tmdbId]?.poster_path, globalPosters, 'w92')}
                                            alt={group.name || missingDetails[group.tmdbId]?.name}
                                            style={{ borderRadius: '4px', width: '60px' }}
                                        />
                                    ) : (
                                        <div style={{ width: '60px', height: '90px', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                                            <span style={{ fontSize: '2rem', color: '#555' }}>?</span>
                                        </div>
                                    )}
                                </Link>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <Link to={`/${group.type || 'tv'}/${group.tmdbId}`} style={{ color: 'white', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                            {group.name || missingDetails[group.tmdbId]?.name || 'Unknown Series'}
                                        </Link>
                                    </div>

                                    {/* Main Series Review if exists */}
                                    {group.seriesReview && !group.seriesReview.isEpisode && (
                                        <div style={{ marginBottom: '1rem', borderBottom: group.episodes.length ? '1px solid #333' : 'none', paddingBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <div style={{ color: '#FFCC00', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px' }}>SERIES REVIEW</div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button onClick={() => handleEdit(group.seriesReview)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }} title="Edit Review">
                                                        <MdEdit />
                                                    </button>
                                                    <button onClick={() => handleShare(group.seriesReview, true)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }} title="Share Story">
                                                        <MdShare />
                                                    </button>
                                                    <button onClick={() => initiateDelete(group.seriesReview, true)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><MdDelete /></button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', color: '#00cc33', marginBottom: '5px' }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <MdStar key={i} color={i < group.seriesReview.rating ? "#00cc33" : "#444"} />
                                                ))}
                                            </div>
                                            <p style={{ color: '#ccc', fontSize: '0.9rem' }}>{group.seriesReview.review}</p>
                                        </div>
                                    )}

                                    {/* Episode Reviews List */}
                                    {group.episodes.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {group.episodes.map(ep => (
                                                <div key={ep.id} style={{ background: '#1a1a1a', padding: '10px', borderRadius: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                                                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>S{ep.seasonNumber}E{ep.episodeNumber} - {ep.episodeName}</div>
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <button onClick={() => handleEdit(ep)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem' }} title="Edit Review">
                                                                <MdEdit size={14} />
                                                            </button>
                                                            <button onClick={() => handleShare(ep, false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem' }} title="Share Story">
                                                                <MdShare size={14} />
                                                            </button>
                                                            <button onClick={() => initiateDelete(ep, false)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', color: '#FFCC00', marginBottom: '5px' }}>
                                                        {[...Array(5)].map((_, i) => (
                                                            <MdStar key={i} size={14} color={i < ep.rating ? "#FFCC00" : "#444"} />
                                                        ))}
                                                    </div>
                                                    <p style={{ color: '#aaa', fontSize: '0.9rem', margin: 0 }}>{ep.review}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <ReviewModal
                isOpen={editModal.isOpen}
                onClose={() => setEditModal({ isOpen: false, review: null })}
                onSubmit={handleUpdateReview}
                initialRating={editModal.review?.rating || 0}
                initialReview={editModal.review?.review || ''}
                modalTitle="Edit Review"
                movieName={editModal.review?.name || 'Review'}
            />

            {/* Custom Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 20000, backdropFilter: 'blur(4px)', padding: '20px'
                }} onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
                    <div style={{
                        background: '#191919', // Prime Dark
                        padding: '30px',
                        width: '100%',
                        maxWidth: '400px',
                        textAlign: 'center',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        fontFamily: '"Amazon Ember", Arial, sans-serif'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{
                            color: '#ffffff',
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            marginBottom: '15px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            fontFamily: '"Amazon Ember", Arial, sans-serif'
                        }}>
                            Are you sure you want to delete this full review?
                        </h3>
                        <p style={{
                            color: '#bbbbbb',
                            fontSize: '0.95rem',
                            marginBottom: '25px',
                            lineHeight: '1.5'
                        }}>
                            You will lose the Star Badge for this series.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                            <button onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })} style={{
                                background: 'transparent',
                                color: '#f2f2f2',
                                border: '1px solid #555',
                                padding: '10px 30px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                borderRadius: '4px',
                                fontFamily: '"Amazon Ember", Arial, sans-serif'
                            }}>
                                No
                            </button>
                            <button onClick={confirmSeriesDelete} style={{
                                background: '#EDF1F3', // Prime White
                                color: '#0F1111',
                                border: '1px solid #EDF1F3',
                                padding: '10px 30px',
                                fontSize: '0.9rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                borderRadius: '4px',
                                fontFamily: '"Amazon Ember", Arial, sans-serif',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                            }}>
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default UserReview;
