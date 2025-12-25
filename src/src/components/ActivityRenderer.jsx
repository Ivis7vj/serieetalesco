import React from 'react';
import { MdStar, MdLockOutline } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import './ActivityRenderer.css';

// 🧠 HELPERS
const normalizeType = (activity) => {
    // If 'category' exists (new format), use it
    if (activity.category) return activity.category;

    // Legacy Mapping
    const t = activity.type;
    if (t === 'watched_episode' || t === 'completed_season' || t === 'watched_season' || t === 'poster_updated') return 'WATCHED';
    if (t === 'watchlist_add') return 'WATCHLIST_ADDED';
    if (t === 'rated_season') return 'REVIEWED';

    return 'WATCHED'; // Default
};

const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const diff = (new Date() - date) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
};

// 1️⃣ TEXT ONLY ROW (Watch / Add)
const TextActivityRow = ({ activity, userId }) => {
    const isMe = activity.userId === userId;
    const authorName = isMe ? 'You' : (activity.username || 'User');

    // Construct Text
    let action = "watched";
    let sub = "";

    if (activity.type === 'watchlist_add') {
        action = "added to watchlist";
        sub = "Watchlist"; // Simplified
    } else if (activity.type === 'watched_episode') {
        action = "watched";
        sub = `Season ${activity.seasonNumber} · Episode ${activity.episodeNumber}`;
    } else if (activity.type === 'completed_season') {
        action = "finished";
        sub = `Season ${activity.seasonNumber}`;
    } else if (activity.type === 'poster_updated') {
        action = "updated poster";
        sub = "";
    }

    // Series Title Check (don't show undefined)
    const title = activity.seriesName || "Unknown Series";

    return (
        <div className="ar-container ar-text-row">
            {/* Avatar */}
            <Link to={`/profile/${activity.userId}`}>
                <img
                    src={activity.userProfilePicURL || `https://ui-avatars.com/api/?name=${activity.username}&background=random`}
                    className="ar-avatar"
                    alt=""
                />
            </Link>

            {/* Text Content */}
            <div className="ar-text-content">
                <div className="ar-meta-text">
                    <strong>{authorName}</strong> {action}
                </div>
                <Link to={`/tv/${activity.tmdbId}`} style={{ textDecoration: 'none' }}>
                    <div className="ar-secondary-text">{title}</div>
                </Link>
                {sub && <div className="ar-sub-info">{sub}</div>}
            </div>

            {/* Time */}
            <div className="ar-time">{formatTimeAgo(activity.createdAt)}</div>
        </div>
    );
};

// 2️⃣ REVIEW ROW (Poster Required)
const ReviewActivityRow = ({ activity, userId, onClick }) => {
    const isMe = activity.userId === userId;
    const authorName = isMe ? 'You' : (activity.username || 'User');
    const rating = activity.rating || 0;
    const reviewText = activity.review || ""; // Text might be empty if just rated

    // Layout: Poster Left, Content Right
    return (
        <div className="ar-container ar-review-row" onClick={() => onClick && onClick(activity)} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            {/* Poster Fixed */}
            <div className="ar-poster-container">
                {activity.posterPath ? (
                    <img src={`https://image.tmdb.org/t/p/w200${activity.posterPath}`} className="ar-poster" alt="" />
                ) : (
                    <div className="ar-poster" style={{ background: '#333' }}></div>
                )}
            </div>

            {/* Content */}
            <div className="ar-review-content">
                <div className="ar-review-header">
                    <div className="ar-meta-text">
                        <strong>{authorName}</strong> watched
                    </div>
                    {/* Rating Stars top right */}
                    <div className="ar-rating">
                        {[...Array(5)].map((_, i) => (
                            <MdStar key={i} size={14} color={i < rating ? "#FFD600" : "#444"} />
                        ))}
                    </div>
                </div>

                <div className="ar-review-title">
                    {activity.seriesName} <span className="ar-review-season">S{activity.seasonNumber}</span>
                </div>

                {/* Review Text (Truncated) */}
                {reviewText && (
                    <div className="ar-review-body ar-truncate">
                        {reviewText}
                    </div>
                )}

                {/* Time (Absolute bottom or top right? Design says vertical stack) */}
                {/* Design image 1 shows time usually next to username or at end. I'll put it at bottom right or leave it. */}
                {/* User Request: "Right Side (Vertical Stack) ... Context line ... Rating ... Review preview" */}
            </div>
        </div>
    );
};

// 3️⃣ FRIEND CARD (Review Only)
const FriendActivityCard = ({ activity }) => {
    // Similar to ReviewRow but different layout (Card style)
    const rating = activity.rating || 0;

    return (
        <div className="ar-friend-card">
            {/* Poster Left */}
            <Link to={`/tv/${activity.tmdbId}`} style={{ display: 'block' }}>
                <img src={`https://image.tmdb.org/t/p/w200${activity.posterPath}`} className="ar-friend-poster" alt="" />
            </Link>

            <div className="ar-friend-content">
                {/* Header: User + Time */}
                <div className="ar-friend-header-row">
                    <Link to={`/profile/${activity.userId}`} className="ar-friend-user" style={{ textDecoration: 'none' }}>
                        <img src={activity.userProfilePicURL} className="ar-avatar" style={{ width: '24px', height: '24px' }} alt="" />
                        <span className="ar-friend-username">{activity.username}</span>
                    </Link>
                    <div className="ar-time">{formatTimeAgo(activity.createdAt)}</div>
                </div>

                {/* Series Info + Rating */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                        {activity.seriesName} <span style={{ color: '#888', fontWeight: 'normal' }}>S{activity.seasonNumber}</span>
                    </div>
                    <div className="ar-rating">
                        {[...Array(5)].map((_, i) => (
                            <MdStar key={i} size={13} color={i < rating ? "#FFD600" : "#444"} />
                        ))}
                    </div>
                </div>

                {/* Full Review (No Truncate) */}
                <div className="ar-review-body" style={{ color: '#ddd' }}>
                    {activity.review || <i>Rated {rating} stars</i>}
                </div>
            </div>
        </div>
    );
};

// 🚀 MAIN RENDERER
const ActivityRenderer = ({ activity, userId, variant = 'feed', onReviewClick }) => {
    const category = normalizeType(activity);

    if (variant === 'friend') {
        // Friends Tab: ONLY Reviews
        // Double check filtering happens at parent, but if something slips through:
        if (category !== 'REVIEWED') return null;
        return <FriendActivityCard activity={activity} />;
    }

    // Profile / Feed Logic
    if (category === 'REVIEWED') {
        return <ReviewActivityRow activity={activity} userId={userId} onClick={onReviewClick} />;
    }

    // Default: Text Row
    return <TextActivityRow activity={activity} userId={userId} />;
};

export default ActivityRenderer;
