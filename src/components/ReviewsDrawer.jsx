import React, { useEffect } from 'react';
import { MdClose, MdStar, MdStarHalf, MdDelete, MdShare, MdPerson, MdFavorite, MdFavoriteBorder, MdEdit } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { Link } from 'react-router-dom';

const ReviewsDrawer = ({ isOpen, onClose, reviews, onDelete, onShare, onLike, onEdit, currentUser, theme }) => {
    const { confirm } = useNotification();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleDelete = async (id) => {
        const isConfirmed = await confirm("Are you sure you want to delete this review?", "Delete Review");
        if (isConfirmed) {
            onDelete(id);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            pointerEvents: 'none'
        }}>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(2px)',
                    opacity: isOpen ? 1 : 0,
                    transition: 'opacity 0.3s ease',
                    pointerEvents: isOpen ? 'auto' : 'none'
                }}
            />

            {/* Drawer */}
            <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: '100%',
                maxWidth: '400px',
                background: '#1a1a1a',
                boxShadow: '-5px 0 30px rgba(0,0,0,0.5)',
                transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderLeft: '1px solid #333'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#222'
                }}>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Reviews</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#aaa',
                            cursor: 'pointer',
                            fontSize: '1.5rem',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <MdClose />
                    </button>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                }}>
                    {reviews.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#666', marginTop: '40px' }}>
                            No reviews yet. Be the first to add one!
                        </div>
                    ) : (
                        reviews.map((review) => (
                            <div key={review.id || Math.random()} style={{
                                background: '#000000', // Pure Black
                                borderRadius: '8px',
                                padding: '16px',
                                border: '1px solid #333',
                                position: 'relative'
                            }}>
                                {/* Source Indicator / Avatar */}
                                <div style={{
                                    position: 'absolute',
                                    top: '-10px',
                                    left: '-10px',
                                    width: '48px', // Increased Size
                                    height: '48px', // Increased Size
                                    borderRadius: '50%',
                                    background: review.source === 'tmdb' ? '#0d253f' : '#222',
                                    border: review.source === 'tmdb' ? '1px solid #01b4e4' : '2px solid #FFCC00',
                                    color: review.source === 'tmdb' ? '#fff' : '#FFCC00',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    zIndex: 2,
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                                    overflow: 'hidden'
                                }}>
                                    {review.source === 'tmdb' ? (
                                        <img
                                            src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
                                            alt="TMDB"
                                            style={{ width: '28px', height: '28px' }}
                                        />
                                    ) : (
                                        review.userId ? (
                                            <Link to={`/profile/${review.userId}`} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFCC00' }}>
                                                {review.photoURL ? <img src={review.photoURL} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <MdPerson size={24} />}
                                            </Link>
                                        ) : <MdPerson size={24} />
                                    )}
                                </div>

                                {/* Header: Author & Date */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingLeft: '25px' }}> {/* Increased paddingLeft due to larger avatar */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ fontWeight: '900', color: '#fff', fontSize: '1rem', fontFamily: 'Inter, sans-serif' }}>
                                            {review.userId ? <Link to={`/profile/${review.userId}`} style={{ color: 'inherit', textDecoration: 'none' }}>{(review.author || 'User').split('@')[0]}</Link> : (review.author || 'User').split('@')[0]}
                                        </div>
                                        {review.isEpisode && review.episodeNumber ? (
                                            <span style={{
                                                background: '#333', color: '#fff', fontSize: '0.75rem',
                                                fontWeight: '900', padding: '2px 6px', borderRadius: '4px',
                                                border: '1px solid #555'
                                            }}>
                                                EP{review.episodeNumber}
                                            </span>
                                        ) : (!review.isEpisode && review.seasonNumber) ? (
                                            <span style={{
                                                background: '#333', color: '#fff', fontSize: '0.75rem',
                                                fontWeight: '900', padding: '2px 6px', borderRadius: '4px',
                                                border: '1px solid #555'
                                            }}>
                                                S{review.seasonNumber}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#888', fontWeight: '500' }}>
                                        {review.date ? new Date(review.date).toLocaleDateString() : ''}
                                    </div>
                                </div>

                                {/* Rating & Review Logic */}
                                <div style={{ paddingLeft: '10px', marginBottom: '10px' }}>
                                    {/* Stars Row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: review.review ? '8px' : '0' }}>
                                        {[...Array(5)].map((_, i) => {
                                            const ratingValue = i + 1;
                                            return (
                                                <span key={i}>
                                                    {review.rating >= ratingValue ? (
                                                        <MdStar size={18} color="#FFCC00" />
                                                    ) : review.rating >= ratingValue - 0.5 ? (
                                                        <MdStarHalf size={18} color="#FFCC00" />
                                                    ) : (
                                                        <MdStar size={18} color="#444" />
                                                    )}
                                                </span>
                                            );
                                        })}
                                    </div>

                                    {/* Review Text (Only if present) */}
                                    {review.review && (
                                        <p style={{
                                            color: '#e0e0e0',
                                            fontSize: '0.95rem',
                                            lineHeight: '1.5',
                                            margin: '0',
                                            fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif',
                                            fontWeight: '500' // Rich text feel
                                        }}>
                                            {review.review}
                                        </p>
                                    )}
                                </div>

                                {/* Actions (Only for 'Seriee' / Internal reviews) */}
                                {review.source === 'app' && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #333', paddingTop: '10px', marginTop: '10px', alignItems: 'center' }}>



                                        {/* Edit Button */}
                                        {currentUser && review.userId === currentUser.uid && (
                                            <button
                                                onClick={() => onEdit && onEdit(review)}
                                                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                                                title="Edit"
                                            >
                                                <MdEdit size={18} />
                                            </button>
                                        )}

                                        {/* Share Button */}
                                        {currentUser && review.userId === currentUser.uid && (
                                            <button
                                                onClick={() => onShare(review)}
                                                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
                                                title="Share"
                                            >
                                                <MdShare size={18} />
                                            </button>
                                        )}

                                        {/* Delete Button */}
                                        {currentUser && review.userId === currentUser.uid && (
                                            <button
                                                onClick={() => handleDelete(review.id)}
                                                style={{ background: 'transparent', border: 'none', color: '#ce2b2b', cursor: 'pointer' }}
                                                title="Delete"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReviewsDrawer;
