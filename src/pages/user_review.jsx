import { useState, useEffect, useRef } from 'react';
import { MdStar, MdDelete, MdShare, MdEdit } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

import { Link } from 'react-router-dom';
import StorySticker from '../components/StorySticker';
import ShareModal from '../components/ShareModal';
import ReviewModal from '../components/ReviewModal';
import LoadingPopup from '../components/LoadingPopup';
import html2canvas from 'html2canvas';
import './Home.css';

const UserReview = () => {
    const { currentUser } = useAuth();
    const [reviews, setReviews] = useState([]);
    const [editModal, setEditModal] = useState({ isOpen: false, review: null });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, reviewId: null, tmdbId: null, isSeries: false });


    // Sticker Logic
    const [stickerModalOpen, setStickerModalOpen] = useState(false);
    const [stickerStatus, setStickerStatus] = useState('idle');
    const [stickerData, setStickerData] = useState(null);
    const [generatedStickerImage, setGeneratedStickerImage] = useState(null);
    const stickerRef = useRef(null);

    const generateSticker = async () => {
        if (!stickerRef.current) return;
        setStickerStatus('preparing');

        // CRITICAL FIX: Wait for images to load before capture
        await new Promise(r => setTimeout(r, 100));

        // Wait for both images
        const waitForImages = async () => {
            const maxWait = 4000;
            const startTime = Date.now();

            while (Date.now() - startTime < maxWait) {
                const posterLoaded = stickerRef.current?.getAttribute('data-poster-loaded') === 'true';
                const pfpLoaded = stickerRef.current?.getAttribute('data-pfp-loaded') === 'true';

                if (posterLoaded && pfpLoaded) return true;
                await new Promise(r => setTimeout(r, 50));
            }

            console.warn('Image load timeout');
            return false;
        };

        await waitForImages();
        await new Promise(r => setTimeout(r, 400)); // Mobile font/layout delay

        try {
            const canvas = await html2canvas(stickerRef.current, {
                useCORS: true, scale: 2, backgroundColor: null, width: 1080, height: 1920,
                logging: false, allowTaint: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('story-sticker-element');
                    if (el) { el.style.display = 'flex'; el.style.transform = 'none'; }
                }
            });
            canvas.toBlob((blob) => {
                if (!blob) return;
                setGeneratedStickerImage(URL.createObjectURL(blob));
                setStickerStatus('ready');
            }, 'image/png');
        } catch (e) {
            console.error(e);
            setStickerStatus('idle');
        }
    };

    useEffect(() => {
        if (stickerModalOpen && stickerData && stickerStatus === 'idle') {
            generateSticker();
        }
    }, [stickerModalOpen, stickerData, stickerStatus]);

    const handleShareSticker = async () => {
        if (!generatedStickerImage) return;
        try {
            const blob = await fetch(generatedStickerImage).then(r => r.blob());
            const file = new File([blob], `Share_${Date.now()}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
            } else {
                const a = document.createElement('a');
                a.href = generatedStickerImage; a.download = file.name;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
        } catch (e) { console.error(e); }
    };

    const closeStickerModal = () => {
        setStickerModalOpen(false); setStickerStatus('idle'); setGeneratedStickerImage(null); setStickerData(null);
    };

    const handleShare = (reviewItem, isSeries = true) => {
        setStickerData({
            movie: {
                name: reviewItem.name,
                poster_path: reviewItem.poster_path, // Fallback if needed
                seasonEpisode: reviewItem.isEpisode ? `S${reviewItem.seasonNumber} E${reviewItem.episodeNumber}` : (reviewItem.isSeason ? `S${reviewItem.seasonNumber}` : null)
            },
            rating: reviewItem.rating ? parseFloat(reviewItem.rating) * 2 : 0,
            user: currentUser,
            isEpisodes: reviewItem.isEpisode
        });
        setStickerModalOpen(true);
        setStickerStatus('idle');
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

            {/* NEW STORY STICKER MODAL */}
            {stickerModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.95)', zIndex: 10000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column'
                }}>
                    {stickerStatus === 'preparing' && <LoadingPopup />}
                    {stickerStatus === 'ready' && generatedStickerImage && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%' }}>
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', maxWidth: '400px' }}>
                                <img src={generatedStickerImage} style={{ width: '100%', borderRadius: '16px' }} />
                            </div>
                            <div style={{ padding: '30px', display: 'flex', gap: '20px', width: '100%', justifyContent: 'center', background: '#000' }}>
                                <button onClick={closeStickerModal} style={{ background: '#333', color: 'white', padding: '16px 32px', borderRadius: '50px', border: 'none' }}>Close</button>
                                <button onClick={handleShareSticker} style={{ background: '#FFD600', color: 'black', padding: '16px 32px', borderRadius: '50px', border: 'none', fontWeight: 'bold' }}>Share</button>
                            </div>
                        </div>
                    )}
                    {/* Hidden Render Target (Using opacity 0 to ensure images load) */}
                    <div style={{ position: 'absolute', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1000, width: '1080px', height: '1920px', overflow: 'hidden' }}>
                        {stickerData && (
                            <StorySticker
                                ref={stickerRef}
                                movie={stickerData.movie}
                                rating={stickerData.rating}
                                user={stickerData.user}
                                isEpisodes={stickerData.isEpisodes}
                            />
                        )}
                    </div>
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
