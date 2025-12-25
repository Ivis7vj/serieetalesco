import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MdClose, MdStar, MdStarHalf, MdDelete, MdShare, MdPerson, MdEdit, MdArrowBack } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import * as reviewService from '../utils/reviewService';
import { db } from '../firebase-config';
import { doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { tmdbApi } from '../utils/tmdbApi';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import LoadingPopup from '../components/LoadingPopup';

const ReviewAvatar = ({ userId, currentPhoto, userName }) => {
    const [status, setStatus] = useState(currentPhoto ? 'loaded' : 'loading');
    const [src, setSrc] = useState(currentPhoto || null);

    useEffect(() => {
        let isMounted = true;

        const fetchUserPhoto = async () => {
            // If we already have a photo from the review object, use it
            if (currentPhoto) {
                setSrc(currentPhoto);
                setStatus('loaded');
                return;
            }

            // Otherwise, fetch from DB
            setStatus('loading');
            try {
                const userRef = doc(db, 'users', userId);
                const snap = await getDoc(userRef);
                if (isMounted && snap.exists()) {
                    const data = snap.data();
                    if (data.photoURL) {
                        setSrc(data.photoURL);
                        setStatus('loaded');
                    } else {
                        setStatus('error');
                    }
                } else {
                    if (isMounted) setStatus('error');
                }
            } catch (e) {
                if (isMounted) setStatus('error');
            }
        };

        fetchUserPhoto();

        return () => { isMounted = false; };
    }, [userId, currentPhoto]);

    if (status === 'loading') {
        return (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222' }}>
                <div className="spinner" style={{ border: '2px solid rgba(255,204,0,0.3)', borderTop: '2px solid #FFCC00', borderRadius: '50%', width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}></div>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (status === 'error' || !src) {
        return <MdPerson size={24} color="#FFCC00" />;
    }

    return (
        <img
            src={src}
            alt={userName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={() => setStatus('error')}
        />
    );
};

const SeriesReviewsPage = () => {
    const { id, seasonNumber, episodeNumber } = useParams();
    const navigate = useNavigate();
    const { currentUser, userData, globalPosters } = useAuth();
    const { confirm } = useNotification();

    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState(null);

    // Determine type based on params
    const isEpisode = !!episodeNumber;
    const isSeason = !!seasonNumber && !episodeNumber;
    const isSeries = !seasonNumber && !episodeNumber;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const numericId = parseInt(id);
                const numericSeason = seasonNumber ? parseInt(seasonNumber) : null;
                const numericEpisode = episodeNumber ? parseInt(episodeNumber) : null;

                console.log(`🚀 Fetching Data for: ID=${numericId}, Season=${numericSeason}, Episode=${numericEpisode}`);

                // Fetch Details and Reviews in Parallel
                const detailsPromise = tmdbApi.getSeriesDetails(id);
                let reviewsPromise;

                if (isEpisode) {
                    reviewsPromise = reviewService.getEpisodeReviews(numericId, numericSeason, numericEpisode);
                } else if (isSeason) {
                    reviewsPromise = reviewService.getSeasonReviews(numericId, numericSeason);
                } else {
                    reviewsPromise = reviewService.getSeriesReviews(numericId);
                }

                const [seriesDetails, fetchedReviews] = await Promise.all([detailsPromise, reviewsPromise]);

                setDetails(seriesDetails);

                console.log(`✅ Fetched ${fetchedReviews.length} reviews`);

                // Sort: User's own first, then by likes
                setReviews(fetchedReviews.sort((a, b) => {
                    const amIAuthor = a.userId === currentUser?.uid;
                    const bmIAuthor = b.userId === currentUser?.uid;
                    if (amIAuthor && !bmIAuthor) return -1;
                    if (!amIAuthor && bmIAuthor) return 1;
                    const aLikes = a.likes?.length || 0;
                    const bLikes = b.likes?.length || 0;
                    return bLikes - aLikes;
                }));
            } catch (error) {
                console.error("Error fetching reviews data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, seasonNumber, episodeNumber, currentUser]);

    const handleBack = () => {
        navigate(-1);
    };

    const handleDelete = async (reviewId) => {
        const isConfirmed = await confirm("Are you sure you want to delete this review?", "Delete Review");
        if (isConfirmed) {
            try {
                const reviewToDelete = reviews.find(r => r.id === reviewId);
                if (!reviewToDelete) return;

                // Delete from Supabase/Firestore via reviewService logic
                // For simplicity, we manually call the same logic as MovieDetails.jsx
                if (reviewToDelete.source === 'supabase') {
                    if (reviewToDelete.isEpisode) {
                        await reviewService.deleteEpisodeReview(reviewId);
                    } else {
                        await reviewService.deleteSeasonReview(reviewId);
                    }
                } else {
                    await deleteDoc(doc(db, 'reviews', reviewId));
                }

                // If it's a series review, remove star badge
                if (!reviewToDelete.isEpisode && !reviewToDelete.isSeason) {
                    const userRef = doc(db, 'users', currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        const updatedStars = (data.starSeries || []).filter(s => String(s.id) !== String(id));
                        await updateDoc(userRef, { starSeries: updatedStars });
                    }
                }

                setReviews(prev => prev.filter(r => r.id !== reviewId));
            } catch (error) {
                console.error("Error deleting review:", error);
            }
        }
    };

    const handleEdit = (review) => {
        // Navigate to ReviewPage with edit state
        const type = review.isEpisode ? 'episode' : (review.isSeason ? 'season' : 'series');
        navigate(`/review/${type}/${id}`, {
            state: {
                tmdbId: id,
                seasonNumber: review.seasonNumber,
                episodeNumber: review.episodeNumber,
                name: details?.name,
                poster_path: details?.poster_path,
                existingReview: review
            }
        });
    };

    const handleShare = (review) => {
        // We'll need to replicate sticker logic if we want to share from here, 
        // but user asked for "show that revoiews in the new page". 
        // For now, let's just implement the UI and simple share if possible.
        // Actually, let's keep it simple and just show the reviews first.
        console.log("Share review", review);
    };

    if (loading) return <LoadingPopup message="Loading reviews..." />;

    return (
        <div style={{
            backgroundColor: '#000000',
            minHeight: '100vh',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Header */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(20px)',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                borderBottom: '1px solid #222'
            }}>
                <button
                    onClick={handleBack}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <MdArrowBack size={28} />
                </button>
                <div>
                    <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Reviews
                    </h1>
                    <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                        {details?.name} {seasonNumber && `• Season ${seasonNumber}`} {episodeNumber && `• Episode ${episodeNumber}`}
                    </div>
                </div>
            </div>

            {/* List */}
            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
                {reviews.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', marginTop: '100px' }}>
                        <p>No reviews yet for this section.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
                        {reviews.map((review) => (
                            <div key={review.id || Math.random()} style={{
                                background: '#111',
                                borderRadius: '12px',
                                padding: '20px',
                                border: '1px solid #222',
                                position: 'relative'
                            }}>
                                {/* Avatar */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    left: '-10px',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '50%',
                                    background: '#222',
                                    border: '2px solid #FFCC00',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    zIndex: 2,
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.5)'
                                }}>
                                    <ReviewAvatar userId={review.userId} currentPhoto={review.photoURL} userName={review.userName} />
                                </div>

                                {/* Author & Date */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingLeft: '25px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Link
                                            to={`/profile/${review.userId}`}
                                            style={{ color: '#fff', textDecoration: 'none', fontWeight: '900', fontSize: '1rem' }}
                                        >
                                            {review.userName || 'User'}
                                        </Link>
                                        {review.isEpisode ? (
                                            <span style={{ backgroundColor: '#222', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#FFCC00', border: '1px solid #FFCC00' }}>EP {review.episodeNumber}</span>
                                        ) : review.isSeason ? (
                                            <span style={{ backgroundColor: '#222', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#fff', border: '1px solid #444' }}>SEASON {review.seasonNumber}</span>
                                        ) : null}
                                    </div>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                                    </span>
                                </div>

                                {/* Stars */}
                                <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
                                    {[...Array(5)].map((_, i) => {
                                        const ratingValue = i + 1;
                                        const currentRating = parseFloat(review.rating);
                                        return (
                                            <span key={i}>
                                                {currentRating >= ratingValue ? (
                                                    <MdStar size={20} color="#FFCC00" />
                                                ) : currentRating >= ratingValue - 0.5 ? (
                                                    <MdStarHalf size={20} color="#FFCC00" />
                                                ) : (
                                                    <MdStar size={20} color="#333" />
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Text */}
                                {review.review && (
                                    <p style={{
                                        color: '#ddd',
                                        fontSize: '1rem',
                                        lineHeight: '1.6',
                                        margin: '0 0 15px 0'
                                    }}>
                                        {review.review}
                                    </p>
                                )}

                                {/* Actions */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '15px',
                                    borderTop: '1px solid #222',
                                    paddingTop: '12px',
                                    marginTop: '5px'
                                }}>
                                    {currentUser && review.userId === currentUser.uid && (
                                        <>
                                            <button onClick={() => handleEdit(review)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer' }}><MdEdit size={20} /></button>
                                            <button onClick={() => handleDelete(review.id)} style={{ background: 'transparent', border: 'none', color: '#ce2b2b', cursor: 'pointer' }}><MdDelete size={20} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeriesReviewsPage;
