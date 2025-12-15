import { useState, useEffect } from 'react';
import { MdStar, MdDelete, MdShare, MdEdit } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

import { Link } from 'react-router-dom';
import StoryCard from '../components/StoryCard';
import ShareModal from '../components/ShareModal';
import ReviewModal from '../components/ReviewModal';
import { useStoryGenerator } from '../hooks/useStoryGenerator';
import './Home.css';

const UserReview = () => {
    const { currentUser } = useAuth();
    const [reviews, setReviews] = useState([]);
    const { generateStory, storyCardRef, isGenerating } = useStoryGenerator();
    const [storyData, setStoryData] = useState(null);
    const [shareModal, setShareModal] = useState({ isOpen: false, imageUrl: '' });

    // Custom Delete Modal State
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        reviewId: null,
        isSeries: false
    });

    // Edit Modal State
    const [editModal, setEditModal] = useState({
        isOpen: false,
        review: null
    });

    // Trigger generation when storyData is updated and component is ready
    useEffect(() => {
        if (storyData) {
            const timer = setTimeout(async () => {
                const result = await generateStory(storyData.movie.name);
                if (result && result.success && result.method === 'fallback') {
                    setShareModal({ isOpen: true, imageUrl: result.url });
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [storyData, generateStory]);

    const handleShare = (reviewItem, isSeries = true) => {
        setStoryData({
            movie: {
                name: reviewItem.name,
                poster_path: reviewItem.poster_path
            },
            rating: reviewItem.rating,
            review: reviewItem.review,
            user: { handle: '@yourapp' }
        });
    };

    useEffect(() => {
        if (!currentUser) return;
        const fetchReviews = async () => {
            const q = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid));
            try {
                const querySnapshot = await getDocs(q);
                const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setReviews(fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            } catch (err) {
                console.error("Error fetching reviews:", err);
            }
        };
        fetchReviews();
    }, [currentUser]);

    const handleEdit = (review) => {
        setEditModal({
            isOpen: true,
            review: review
        });
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

            // Update Local State
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, rating: data.rating, review: data.review } : r));
            setEditModal({ isOpen: false, review: null });
        } catch (error) {
            console.error("Error updating review:", error);
        }
    };

    const { confirm } = useNotification();

    const initiateDelete = (review, isSeries) => {
        if (isSeries) {
            // Open Custom Modal for Series
            setDeleteModal({
                isOpen: true,
                reviewId: review.id,
                tmdbId: review.tmdbId, // Needed to find series in user doc
                isSeries: true
            });
        } else {
            // Standard delete for episodes
            handleStandardDelete(review.id);
        }
    };

    const handleStandardDelete = async (id) => {
        const isConfirmed = await confirm("Are you sure you want to delete this review?", "Delete Review", "Delete", "Cancel");
        if (isConfirmed) {
            await performDelete(id);
        }
    };

    const performDelete = async (id) => {
        try {
            await deleteDoc(doc(db, 'reviews', id));
            const updated = reviews.filter(r => r.id !== id);
            setReviews(updated);
        } catch (err) {
            console.error("Error deleting review:", err);
        }
    };

    const confirmSeriesDelete = async () => {
        if (!deleteModal.reviewId) return;

        try {
            // 1. Delete the review document
            await deleteDoc(doc(db, 'reviews', deleteModal.reviewId));

            // 2. Remove Star Badge logic
            if (currentUser && deleteModal.tmdbId) {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    // Filter out the series from starSeries based on ID
                    // Assuming starSeries is array of objects { id, ... }
                    const updatedStars = (userData.starSeries || []).filter(s => String(s.id) !== String(deleteModal.tmdbId));
                    await updateDoc(userRef, { starSeries: updatedStars });
                }
            }

            // 3. Update Local State
            const updated = reviews.filter(r => r.id !== deleteModal.reviewId);
            setReviews(updated);

            // Close Modal
            setDeleteModal({ isOpen: false, reviewId: null, isSeries: false });

        } catch (err) {
            console.error("Error deleting full review:", err);
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
                                    {group.poster_path ? (
                                        <img
                                            src={`https://image.tmdb.org/t/p/w92${group.poster_path}`}
                                            alt={group.name}
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
                                            {group.name}
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

            {/* Hidden Story Card for Generation */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                {storyData && (
                    <StoryCard
                        ref={storyCardRef}
                        movie={storyData.movie}
                        rating={storyData.rating}
                        review={storyData.review}
                        user={storyData.user}
                    />
                )}
            </div>

            {isGenerating && (
                <div style={{
                    position: 'fixed', top: '20px', right: '20px',
                    background: '#FFCC00', color: 'black', padding: '10px 20px',
                    borderRadius: '4px', fontWeight: 'bold', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                    <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid black', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Preparing Story...
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            )}

            <ShareModal
                isOpen={shareModal.isOpen}
                onClose={() => setShareModal({ ...shareModal, isOpen: false })}
                imageUrl={shareModal.imageUrl}
            />

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
