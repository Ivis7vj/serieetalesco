import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdStar, MdStarHalf, MdEdit, MdDelete, MdShare, MdSave, MdClose, MdCheck } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import * as diaryService from '../utils/diaryService';
import Skeleton from '../components/Skeleton';
import { useScrollLock } from '../hooks/useScrollLock';
import './DiaryDetail.css';

const DiaryDetailSkeleton = () => (
    <div className="diary-detail-page" style={{ minHeight: '100vh', background: '#000' }}>
        <div className="diary-detail-header" style={{ height: '60px' }}>
            <Skeleton width="40px" height="40px" borderRadius="50%" />
        </div>
        <div className="diary-detail-content" style={{ padding: '20px' }}>
            <div className="detail-top-section" style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
                <Skeleton width="120px" height="180px" borderRadius="8px" />
                <div style={{ flex: 1 }}>
                    <Skeleton width="80%" height="24px" marginBottom="10px" />
                    <Skeleton width="100px" height="20px" marginBottom="10px" />
                    <Skeleton width="120px" height="16px" />
                </div>
            </div>
            <Skeleton height="150px" borderRadius="8px" marginBottom="30px" />
            <div style={{ display: 'flex', gap: '10px' }}>
                <Skeleton width="80px" height="40px" borderRadius="20px" />
                <Skeleton width="80px" height="40px" borderRadius="20px" />
                <Skeleton width="80px" height="40px" borderRadius="20px" />
            </div>
        </div>
    </div>
);

const DiaryDetail = () => {
    useScrollLock(true); // Freeze page as requested
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isEditingDate, setIsEditingDate] = useState(false);

    const [editData, setEditData] = useState({
        rating: 0,
        review: '',
        date: ''
    });

    useEffect(() => {
        const fetchEntry = async () => {
            if (!id) return;
            setLoading(true);
            const data = await diaryService.getDiaryEntryById(id);
            if (data) {
                setEntry(data);
                setEditData({
                    rating: data.rating,
                    review: data.review,
                    date: data.date
                });
            } else {
                navigate('/profile');
            }
            setLoading(false);
        };
        fetchEntry();
    }, [id, navigate]);

    const handleSave = async () => {
        try {
            const result = await diaryService.updateDiaryEntry(entry.id, editData);
            if (result.success) {
                setEntry(result.data);
                setIsEditing(false);
            } else {
                alert("Failed to update entry");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleConfirmDelete = async () => {
        const result = await diaryService.deleteDiaryEntry(entry.id);
        if (result.success) {
            navigate('/profile');
        } else {
            alert("Failed to delete entry");
            setShowDeleteConfirm(false);
        }
    };

    const handleShare = () => {
        const stickerData = {
            movie: {
                id: entry.tmdbId,
                name: entry.seriesName,
                poster_path: entry.posterPath,
                seasonEpisode: `Season ${entry.seasonNumber}`
            },
            rating: entry.rating,
            user: {
                username: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User',
                photoURL: currentUser?.photoURL
            },
            seasonCompleted: true,
            isEpisodes: false
        };
        navigate('/share-sticker', { state: { stickerData } });
    };

    const handleStarClick = (starValue, isHalf) => {
        if (!isEditing) return;
        setEditData({ ...editData, rating: isHalf ? starValue - 0.5 : starValue });
    };

    const renderStars = (ratingValue) => {
        return [1, 2, 3, 4, 5].map(star => {
            const isFull = ratingValue >= star;
            const isHalf = ratingValue >= star - 0.5 && ratingValue < star;
            return (
                <div key={star} className="half-star-container">
                    {isEditing && (
                        <>
                            <div className="half-star-overlay" onClick={() => handleStarClick(star, true)} />
                            <div className="half-star-overlay" style={{ left: '50%' }} onClick={() => handleStarClick(star, false)} />
                        </>
                    )}
                    {isHalf ? <MdStarHalf size={26} color="#FFD600" /> : <MdStar size={26} color={isFull ? "#FFD600" : "#333"} />}
                </div>
            );
        });
    };

    if (loading) return <DiaryDetailSkeleton />;
    if (!entry) return null;

    const formattedDate = new Date(isEditing ? editData.date : entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="diary-detail-page" style={{ minHeight: '100%', background: '#000', transform: 'translateZ(0)', paddingBottom: '100px' }}>
            {/* Custom Delete Modal */}
            {showDeleteConfirm && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-content animate-pop">
                        <h2 className="modal-title">Delete Entry?</h2>
                        <p className="modal-desc">Are you sure you want to remove this entry from your diary? This action cannot be undone.</p>
                        <div className="modal-actions">
                            <button className="modal-btn btn-cancel-modal" onClick={() => setShowDeleteConfirm(false)}>CANCEL</button>
                            <button className="modal-btn btn-confirm-delete" onClick={handleConfirmDelete}>DELETE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Centered Date Editor */}
            {isEditingDate && (
                <div className="date-editor-container animate-slide-up">
                    <h2 className="date-editor-title">Edit Watched Date</h2>
                    <input
                        type="date"
                        className="date-input-styled"
                        value={editData.date?.split('T')[0] || ''}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                    />
                    <button className="date-editor-close" onClick={() => setIsEditingDate(false)}>
                        <MdCheck size={24} /> DONE
                    </button>
                </div>
            )}

            <div className="diary-detail-header">
                <button className="back-btn" onClick={() => navigate(-1)}><MdArrowBack /></button>
            </div>

            <div className="diary-detail-content animate-fade-in">
                <div className="detail-top-section">
                    <div className="detail-poster-section">
                        <img src={`https://image.tmdb.org/t/p/w500${entry.posterPath}`} alt={entry.seriesName} className="detail-poster" />
                    </div>
                    <div className="detail-meta-section">
                        <h1 className="detail-title">{entry.seriesName}</h1>
                        <div className="detail-rating">{renderStars(isEditing ? editData.rating : entry.rating)}</div>
                        <div className="detail-date-text" onClick={() => isEditing && setIsEditingDate(true)}>{formattedDate}</div>
                    </div>
                </div>

                <div className="detail-review-section">
                    {isEditing ? (
                        <textarea
                            value={editData.review}
                            onChange={(e) => setEditData({ ...editData, review: e.target.value })}
                            className="review-editor"
                            placeholder="Your thoughts..."
                            autoFocus
                        />
                    ) : (
                        <p className="review-text">{entry.review}</p>
                    )}
                </div>

                <div className="detail-actions">
                    {!isEditing ? (
                        <>
                            <button className="action-btn btn-edit" onClick={() => setIsEditing(true)}><MdEdit /> Edit</button>
                            <button className="action-btn btn-delete" onClick={() => setShowDeleteConfirm(true)}><MdDelete /> Delete</button>
                            <button className="action-btn btn-share" onClick={handleShare}><MdShare /> Share</button>
                        </>
                    ) : (
                        <>
                            <button className="action-btn btn-edit" onClick={() => setIsEditing(false)}><MdClose /> Cancel</button>
                            <button className="action-btn btn-share" onClick={handleShare}><MdShare /> Share</button>
                            <button className="action-btn btn-share" style={{ background: '#46d369' }} onClick={handleSave}><MdSave /> Save</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DiaryDetail;
