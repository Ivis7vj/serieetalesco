import { useState, useEffect } from 'react';
import { MdClose, MdMoreVert, MdEdit, MdDelete, MdCalendarToday, MdStar, MdSave } from 'react-icons/md';
import './DiaryDetailOverlay.css';

const DiaryDetailOverlay = ({ entry, onClose, onUpdate, onDelete }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        rating: entry.rating,
        review: entry.review,
        date: entry.date
    });

    // Body scroll lock
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const handleSave = async () => {
        await onUpdate(entry.id, editData);
        setIsEditing(false);
    };

    const handleDelete = async () => {
        if (window.confirm("Are you sure you want to delete this diary entry? This cannot be undone.")) {
            await onDelete(entry.id);
            onClose();
        }
    };

    return (
        <div className="diary-overlay enter-active">
            <div className="diary-overlay-content">
                {/* Header */}
                <div className="diary-header">
                    <button className="close-btn" onClick={onClose}><MdClose size={24} /></button>
                    {!isEditing && (
                        <div className="menu-container">
                            <button className="menu-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                                <MdMoreVert size={24} />
                            </button>
                            {isMenuOpen && (
                                <div className="detail-dropdown">
                                    <button onClick={() => { setIsEditing(true); setIsMenuOpen(false); }}>
                                        <MdEdit /> Edit Diary
                                    </button>
                                    <button onClick={handleDelete} className="delete-option">
                                        <MdDelete /> Delete Diary
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="diary-body">
                    {/* Poster Section */}
                    <div className="diary-poster-container">
                        <img
                            src={`https://image.tmdb.org/t/p/w500${entry.posterPath}`}
                            alt={entry.seriesName}
                            className="diary-poster"
                        />
                    </div>

                    {/* Content Section */}
                    <div className="diary-info">
                        <h2 className="diary-title">{entry.seriesName}</h2>
                        <div className="diary-meta">
                            <span className="season-badge">Season {entry.seasonNumber}</span>
                            <span className="diary-date">
                                {isEditing ? (
                                    <input
                                        type="date"
                                        value={editData.date.split('T')[0]}
                                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                                        className="date-input"
                                    />
                                ) : (
                                    new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                )}
                            </span>
                        </div>

                        {/* Rating */}
                        <div className="diary-rating">
                            {[1, 2, 3, 4, 5].map(star => (
                                <MdStar
                                    key={star}
                                    size={24}
                                    color={star <= (isEditing ? editData.rating : entry.rating) ? "#FFD600" : "#444"}
                                    onClick={() => isEditing && setEditData({ ...editData, rating: star })}
                                    style={{ cursor: isEditing ? 'pointer' : 'default' }}
                                />
                            ))}
                        </div>

                        {/* Review Text */}
                        <div className="diary-review">
                            {isEditing ? (
                                <textarea
                                    value={editData.review}
                                    onChange={(e) => setEditData({ ...editData, review: e.target.value })}
                                    className="review-editor"
                                    rows={10}
                                />
                            ) : (
                                <p className="review-text">{entry.review}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Fixed Save Button (Edit Mode Only) */}
                {isEditing && (
                    <div className="edit-actions">
                        <button className="save-btn" onClick={handleSave}>
                            <MdSave /> Save Changes
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DiaryDetailOverlay;
