import { useState } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { MdStar, MdStarHalf, MdStarBorder, MdClose } from 'react-icons/md';

const ReviewModal = ({ isOpen, onClose, onSubmit, movieName, initialRating = 5, initialReview = '', modalTitle, posterPath }) => {
    const [rating, setRating] = useState(initialRating);
    const [review, setReview] = useState(initialReview);
    const [hoverRating, setHoverRating] = useState(0);
    const [showSuccess, setShowSuccess] = useState(false);

    // Reset or Set values when modal opens
    if (!isOpen && (rating !== initialRating || review !== initialReview)) {
        // Optional: reset on close needed? logic handled below
    }

    // Better: Effect to sync props to state when modal opens
    // We can't rely just on props change, we need to reset when isOpen changes to true.
    // However, hooks can't be conditional.
    // Let's use a key or simpler: just set defaults and maybe a specific effect if props change while open (unlikely).
    // Actually, best pattern is to Key the modal or use Effect.
    // Let's use Effect.

    // Re-initialize when isOpen becomes true or props change
    const [prevIsOpen, setPrevIsOpen] = useState(false);
    if (isOpen && !prevIsOpen) {
        setRating(initialRating || 5);
        setReview(initialReview || '');
        setPrevIsOpen(true);
    } else if (!isOpen && prevIsOpen) {
        setPrevIsOpen(false);
    }

    if (!isOpen) return null;
    // ... (rest of component)

    const handleStarClick = (star) => {
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

        if (isHalf) return <MdStarHalf size={36} color="#FFCC00" />;
        if (isFull) return <MdStar size={36} color="#FFCC00" />;
        return <MdStarBorder size={36} color="#444" />;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ rating, review });

        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            onClose();
        }, 1500);
    };

    useScrollLock(isOpen);


    // ... (success view)

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{
                background: '#191919', // Prime Dark
                padding: '30px',
                borderRadius: '8px',
                width: '100%',
                maxWidth: '500px',
                border: 'none',
                position: 'relative',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                fontFamily: '"Amazon Ember", Arial, sans-serif',
                margin: '20px', // Ensure margin on small screens
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}
                >
                    <MdClose size={24} />
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '1.5rem' }}>
                    {posterPath && (
                        <img
                            src={`https://image.tmdb.org/t/p/w92${posterPath}`}
                            alt={movieName}
                            style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                        />
                    )}
                    <div>
                        <h2 style={{ color: '#ffffff', marginTop: 0, marginBottom: '5px', fontFamily: '"Amazon Ember", Arial, sans-serif', fontSize: '1.2rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {modalTitle || (initialReview ? 'Edit Review:' : 'Review')}
                        </h2>
                        <div style={{ fontSize: '1rem', color: '#ccc', fontWeight: 'bold' }}>{movieName}</div>
                        <span style={{ fontSize: '0.8rem', color: '#888', display: 'block', marginTop: '5px', fontWeight: 'normal', textTransform: 'none' }}>(Click star again for half)</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <div
                                    key={star}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    onClick={() => handleStarClick(star)}
                                    style={{ cursor: 'pointer', display: 'flex' }}
                                >
                                    {renderStar(star)}
                                </div>
                            ))}
                        </div>
                        <div style={{ color: '#FFCC00', marginTop: '8px', fontWeight: '600', fontSize: '1.1rem' }}>{rating} Stars</div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', color: '#bbbbbb', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>YOUR REVIEW</label>
                        <textarea
                            value={review}
                            onChange={(e) => setReview(e.target.value)}
                            placeholder="Write your thoughts..."
                            rows="5"
                            style={{
                                width: '100%',
                                background: '#111',
                                border: '1px solid #333',
                                borderRadius: '4px',
                                padding: '12px',
                                color: '#f2f2f2',
                                fontSize: '0.95rem',
                                resize: 'vertical',
                                outline: 'none',
                                fontFamily: '"Amazon Ember", Arial, sans-serif',
                                lineHeight: '1.5'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        className='popup-btn'
                        style={{
                            width: '100%',
                            background: '#EDF1F3', // Prime White Button
                            color: '#0F1111',
                            border: '1px solid #EDF1F3',
                            padding: '12px',
                            fontSize: '0.95rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            textTransform: 'uppercase',
                            borderRadius: '4px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                        }}
                    >
                        {initialReview ? 'Update Review' : 'Post Review'}
                    </button>
                </form>
            </div >
        </div >
    );
};

export default ReviewModal;
