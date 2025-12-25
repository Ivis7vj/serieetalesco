import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MdStar, MdStarHalf, MdStarBorder, MdClose } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import * as reviewService from '../utils/reviewService';
import * as ratingsService from '../utils/ratingsService';
import * as watchedService from '../utils/watchedService';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc, arrayUnion, addDoc, collection } from 'firebase/firestore';
import { Share } from '@capacitor/share';
import { useScrollLock } from '../hooks/useScrollLock';
import * as diaryService from '../utils/diaryService';
import * as watchlistService from '../utils/watchlistService';

const ReviewPage = () => {
    // Lock Scroll on this page
    useScrollLock(true);
    const { type, id } = useParams(); // type: 'series', 'season', 'episode'
    const location = useLocation();
    const navigate = useNavigate();
    const { currentUser, userData } = useAuth();

    // State from navigation or params
    // Resilience: Try to get from state, fallback to params if applicable
    const {
        tmdbId: stateTmdbId,
        seasonNumber,
        episodeNumber,
        name,
        poster_path,
        existingReview
    } = location.state || {}; // Fallback to fetching if state is missing?

    // For series/season, id in param IS the tmdbId. For episodes, we rely on state or stateTmdbId.
    const tmdbId = stateTmdbId || id;

    const [rating, setRating] = useState(existingReview?.rating || 0);
    const [reviewText, setReviewText] = useState(existingReview?.review || '');
    const [hoverRating, setHoverRating] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRatingClick = (star) => {
        // Toggle half star: if clicking the current full star, make it half.
        if (rating === star) {
            setRating(star - 0.5);
        } else if (rating === star - 0.5) {
            setRating(star);
        } else {
            setRating(star);
        }
    };

    const renderStar = (star) => {
        const ratingVal = parseFloat(rating);
        const isFull = (hoverRating || ratingVal) >= star;
        const isHalf = (hoverRating || ratingVal) >= star - 0.5 && (hoverRating || ratingVal) < star;

        if (isHalf) return <MdStarHalf size={40} color="#FFD700" />;
        if (isFull) return <MdStar size={40} color="#FFD700" />;
        return <MdStarBorder size={40} color="#333" />;
    };

    const handleBack = () => {
        navigate(-1); // Go back to recent page (SeriesDetails)
    };

    const handleSubmit = async () => {
        if (!currentUser) return;
        setIsSubmitting(true);

        // Logic copied/adapted from MovieDetails.jsx handleReviewSubmit
        // Using reviewService for Supabase integration

        let success = false;
        const numericRating = parseFloat(rating);
        const finalReviewText = reviewText.trim();
        const safePosterPath = poster_path || null;
        const safeName = name || 'Unknown Title';

        try {
            if (type === 'episode') {
                // CREATE or UPDATE Episode Review
                if (existingReview?.id) {
                    // Update
                    await reviewService.updateEpisodeReview(existingReview.id, finalReviewText, numericRating);
                    await ratingsService.setEpisodeRating(currentUser.uid, parseInt(tmdbId), parseInt(seasonNumber), parseInt(episodeNumber), numericRating);
                } else {
                    // Create
                    await reviewService.createEpisodeReview(
                        currentUser.uid,
                        parseInt(tmdbId),
                        parseInt(seasonNumber),
                        parseInt(episodeNumber),
                        finalReviewText,
                        numericRating,
                        userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                        currentUser.photoURL,
                        safeName,
                        safePosterPath
                    );
                    // Also Rate
                    await ratingsService.setEpisodeRating(currentUser.uid, parseInt(tmdbId), parseInt(seasonNumber), parseInt(episodeNumber), numericRating);
                }
                success = true;

            } else if (type === 'season') {
                if (existingReview?.id) {
                    await reviewService.updateSeasonReview(existingReview.id, finalReviewText, numericRating);
                    await ratingsService.setSeasonRating(currentUser.uid, parseInt(tmdbId), parseInt(seasonNumber), numericRating);
                } else {
                    await reviewService.createSeasonReview(
                        currentUser.uid,
                        parseInt(tmdbId),
                        parseInt(seasonNumber),
                        finalReviewText,
                        numericRating,
                        userData?.username || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
                        currentUser.photoURL,
                        safeName,
                        safePosterPath
                    );
                    await ratingsService.setSeasonRating(currentUser.uid, parseInt(tmdbId), parseInt(seasonNumber), numericRating);
                }
                success = true;

            } else if (type === 'series') {
                // Legacy / Firestore fallback for Series as per MovieDetails logic
                // Or if migrating to Supabase, use that. Sticking to MovieDetails logic for safety.
                // Actually MovieDetails had a large block for Series review creation in Firestore.
                // We will replicate the Firestore Logic here for consistency.

                const reviewDataPayload = {
                    userId: currentUser.uid,
                    userName: currentUser.displayName || 'User',
                    tmdbId: parseInt(tmdbId),
                    name: safeName,
                    poster_path: safePosterPath,
                    rating: numericRating,
                    review: finalReviewText,
                    updatedAt: new Date().toISOString(),
                    type: 'series',
                    isEpisode: false,
                    isSeason: false,
                    seasonNumber: null,
                    episodeNumber: null,
                    createdAt: new Date().toISOString(),
                    likes: []
                };

                if (existingReview?.id) {
                    // Update existing Firestore doc
                    const reviewRef = doc(db, 'reviews', existingReview.id);
                    await updateDoc(reviewRef, {
                        rating: numericRating,
                        review: finalReviewText,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    await addDoc(collection(db, 'reviews'), reviewDataPayload);

                    // Add to starSeries
                    const userRef = doc(db, 'users', currentUser.uid);
                    await updateDoc(userRef, {
                        starSeries: arrayUnion({
                            id: tmdbId.toString(),
                            name: safeName,
                            poster_path: safePosterPath,
                            date: new Date().toISOString()
                        })
                    });
                }
                success = true;
            }

            // Common Auto-Watched Logic
            if (success) {
                if (type === 'episode') {
                    await watchedService.markEpisodeWatched(currentUser.uid, parseInt(tmdbId), parseInt(seasonNumber), parseInt(episodeNumber));
                } else if (type === 'season') {
                    // Automatically mark whole season as watched
                    if (location.state?.totalEpisodes) {
                        await watchedService.markSeasonWatched(
                            currentUser.uid,
                            parseInt(tmdbId),
                            parseInt(seasonNumber),
                            location.state.totalEpisodes
                        );
                    }

                    // STRICT DIARY ENTRY CREATION
                    console.log("📝 Attempting Diary Entry creation on Review Submission...");
                    const diaryResult = await diaryService.createDiaryEntry(
                        currentUser.uid,
                        { id: tmdbId, name: safeName, poster_path: safePosterPath },
                        parseInt(seasonNumber),
                        { rating: numericRating, review: finalReviewText }
                    );

                    if (diaryResult.success) {
                        console.log("✅ DIARY ENTRY SAVED SUCCESSFULLY:", diaryResult.data);
                        // Auto-Remove from Watchlist on Diary Entry
                        await watchlistService.removeFromWatchlist(currentUser.uid, parseInt(tmdbId));
                    } else {
                        console.error("❌ DIARY SAVE FAILED:", diaryResult.error);
                    }
                }
            }
        } catch (error) {
            console.error("Review Submission Error", error);
        }

        setIsSubmitting(false);
        if (success) {
            navigate(-1);
        }
    };

    return (
        <div style={{
            backgroundColor: '#000000',
            height: '100vh',
            color: '#fff',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header / Close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                <button onClick={handleBack} style={{ background: 'transparent', border: 'none', color: '#fff' }}>
                    <MdClose size={30} />
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

                {/* Poster & Title Info */}
                <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', alignItems: 'center', width: '100%' }}>
                    {poster_path ? (
                        <img
                            src={`https://image.tmdb.org/t/p/w200${poster_path}`}
                            alt={name}
                            style={{ width: '100px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                        />
                    ) : (
                        <div style={{ width: '100px', height: '150px', background: '#333', borderRadius: '8px' }}></div>
                    )}

                    <div>
                        <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px', textTransform: 'uppercase' }}>
                            {type === 'episode' ? 'EPISODE REVIEW' : (type === 'season' ? 'SEASON REVIEW' : 'SERIES REVIEW')}
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', lineHeight: '1.2' }}>{name}</h2>
                        {type === 'episode' && <div style={{ color: '#aaa', marginTop: '5px' }}>Season {seasonNumber} • Episode {episodeNumber}</div>}
                        {type === 'season' && <div style={{ color: '#aaa', marginTop: '5px' }}>Season {seasonNumber}</div>}
                    </div>
                </div>

                {/* Rating */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <div
                            key={star}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => handleRatingClick(star)}
                            style={{ cursor: 'pointer', display: 'flex' }}
                        >
                            {renderStar(star)}
                        </div>
                    ))}
                </div>
                <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '30px', fontSize: '1.2rem' }}>
                    {rating > 0 ? `${rating} Stars` : 'Tap to Rate'}
                </div>

                {/* Review Text */}
                <div style={{ width: '100%', marginBottom: '30px' }}>
                    <label style={{ display: 'block', color: '#888', marginBottom: '10px', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        Your Review
                    </label>
                    <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Write your thoughts..."
                        style={{
                            width: '100%',
                            minHeight: '150px',
                            backgroundColor: '#111',
                            border: '1px solid #333',
                            borderRadius: '8px',
                            color: '#fff',
                            padding: '15px',
                            fontSize: '1rem',
                            resize: 'none',
                            outline: 'none'
                        }}
                    />
                </div>

                {/* Submit Button */}
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{
                        width: '100%',
                        backgroundColor: '#fff',
                        color: '#000',
                        padding: '16px',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                        border: 'none',
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.7 : 1
                    }}
                >
                    {isSubmitting ? 'Posting...' : (existingReview ? 'UPDATE REVIEW' : 'POST REVIEW')}
                </button>

            </div>
        </div >
    );
};

export default ReviewPage;
