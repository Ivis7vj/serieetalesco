import { useRef, useEffect, useState } from 'react';
import { MdStar, MdDelete, MdShare, MdEdit } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { tmdbApi } from '../utils/tmdbApi';
import * as reviewService from '../utils/reviewService';

// Sticker Logic

import { Link, useNavigate } from 'react-router-dom';
import ReviewModal from '../components/ReviewModal';
import LoadingPopup from '../components/LoadingPopup';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { useScrollLock } from '../hooks/useScrollLock';
import './Home.css';

const UserReview = () => {
    const navigate = useNavigate();
    const { currentUser, userData, globalPosters } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [editModal, setEditModal] = useState({ isOpen: false, review: null });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, reviewId: null, tmdbId: null, isSeries: false });

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
                name: reviewItem.name,
                poster_path: reviewItem.poster_path,
                seasonEpisode: reviewItem.isEpisode ? `S${reviewItem.seasonNumber} E${reviewItem.episodeNumber}` : (reviewItem.isSeason ? `S${reviewItem.seasonNumber}` : null)
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

    const { startLoading, stopLoading } = useLoading();

    useEffect(() => {
        if (!currentUser) return;
        const fetchReviews = async () => {
            // Only show global loader on FIRST load if empty
            if (reviews.length === 0) {
                startLoading("Fetching reviews...");
            }
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
                stopLoading();
            }
        };
        fetchReviews();
    }, [currentUser]); // Note: dependency on currentUser only

    const refreshReviewsBackground = async () => {
        if (!currentUser) return;
        const fetched = await reviewService.getUserReviews(currentUser.uid);
        setReviews(fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    };

    const handleUpdateReview = async (data) => {
        if (!editModal.review) return;
        const reviewId = editModal.review.id;

        startLoading("Updating review...");

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
        } finally {
            stopLoading();
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
        startLoading("Deleting review...");
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
        } finally {
            stopLoading();
        }
    };

    const confirmSeriesDelete = async () => {
        if (!deleteModal.reviewId) return;

        startLoading("Deleting series review...");

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
        } finally {
            stopLoading();
        }
    };

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
                        const key = review.tmdbId;
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
