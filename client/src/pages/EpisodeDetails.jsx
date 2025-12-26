import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdStar, MdAccessTime, MdPerson, MdRateReview, MdExpandMore, MdExpandLess } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useLoading } from '../context/LoadingContext';
import { tmdbApi } from '../utils/tmdbApi';
import * as reviewService from '../utils/reviewService';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import { useScrollLock } from '../hooks/useScrollLock';
import Skeleton from '../components/Skeleton';
import './EpisodeDetails.css';

const EpisodeDetailsSkeleton = () => (
    <div className="ed-page-container" style={{ background: '#000', minHeight: '100dvh' }}>
        <div className="ed-hero-section">
            <Skeleton height="100%" />
        </div>
        <div className="ed-tab-switcher">
            <Skeleton width="40%" height="20px" borderRadius="10px" />
            <Skeleton width="40%" height="20px" borderRadius="10px" />
        </div>
        <div className="ed-section" style={{ padding: '20px' }}>
            <Skeleton width="70%" height="32px" marginBottom="10px" />
            <Skeleton width="40%" height="20px" marginBottom="20px" />
            <Skeleton height="100px" borderRadius="8px" marginBottom="20px" />
            <div style={{ display: 'flex', gap: '15px' }}>
                <Skeleton width="70px" height="70px" borderRadius="50%" />
                <Skeleton width="70px" height="70px" borderRadius="50%" />
                <Skeleton width="70px" height="70px" borderRadius="50%" />
            </div>
        </div>
    </div>
);

const EpisodeDetails = () => {
    // 1️⃣ PARAMS & NAV
    const { id, seasonNumber, episodeNumber } = useParams(); // Series ID
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    // 2️⃣ STATE
    const [episode, setEpisode] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0); // 0: Details, 1: Reviews
    const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
    const [reviews, setReviews] = useState([]);

    // Pager Ref
    const pagerRef = useRef(null);

    // 3️⃣ DATA FETCHING
    useEffect(() => {
        const fetchAllData = async () => {
            if (!id) return;
            setLoading(true);
            try {
                // Fetch Episode with all metadata
                const data = await tmdbApi.fetchDirect(`/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`, '&append_to_response=credits,images,videos');
                setEpisode(data);

                // Fetch Reviews
                const dbReviews = await reviewService.getEpisodeReviews(
                    parseInt(id),
                    parseInt(seasonNumber),
                    parseInt(episodeNumber)
                );
                setReviews(dbReviews);
            } catch (error) {
                console.error("Failed to load episode details", error);
                triggerErrorAutomation(error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [id, seasonNumber, episodeNumber]);

    const handleTabClick = (index) => {
        setActiveTab(index);
        if (pagerRef.current) {
            pagerRef.current.scrollTo({
                left: index * pagerRef.current.clientWidth,
                behavior: 'smooth'
            });
        }
    };

    const handleScroll = (e) => {
        const scrollLeft = e.target.scrollLeft;
        const width = e.target.clientWidth;
        const newTab = Math.round(scrollLeft / width);
        if (newTab !== activeTab) {
            setActiveTab(newTab);
        }
    };

    if (loading && !episode) return <EpisodeDetailsSkeleton />;
    if (!episode) return <div style={{ color: '#FFD600', textAlign: 'center', marginTop: '100px' }}>Episode not found</div>;

    const backdropUrl = episode.still_path
        ? `https://image.tmdb.org/t/p/original${episode.still_path}`
        : null;

    // Derived Cast Data (Regulars + Guest Stars)
    const allCast = [
        ...(episode.guest_stars || []),
        ...(episode.credits?.cast || [])
    ]; // Show ALL cast as requested

    return (
        <div className="ed-page-container" style={{ minHeight: '100%', transform: 'translateZ(0)', paddingBottom: '100px' }}>
            {/* 1️⃣ TOP POSTER SECTION (HERO) */}
            <div className="ed-hero-section">
                {backdropUrl && <img src={backdropUrl} className="ed-hero-image" alt={episode.name} />}
                <div className="ed-hero-overlay" />

                {/* Back Button */}
                <button className="ed-back-btn" onClick={() => navigate(-1)}>
                    <MdArrowBack size={24} />
                </button>
            </div>

            {/* 2️⃣ SECTION SWITCHER */}
            <div className="ed-tab-switcher">
                <button
                    className={`ed-tab ${activeTab === 0 ? 'active' : ''}`}
                    onClick={() => handleTabClick(0)}
                >
                    Episode Details
                    {activeTab === 0 && <div className="ed-tab-underline" />}
                </button>
                <button
                    className={`ed-tab ${activeTab === 1 ? 'active' : ''}`}
                    onClick={() => handleTabClick(1)}
                >
                    Reviews ({reviews.length})
                    {activeTab === 1 && <div className="ed-tab-underline" />}
                </button>
            </div>

            <div
                className="ed-pager-container hide-scrollbar"
                ref={pagerRef}
                onScroll={handleScroll}
                style={{
                    display: 'flex',
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                    touchAction: 'pan-x pan-y',
                    width: '100%',
                    willChange: 'transform'
                }}
            >
                {/* SECTION 1: DETAILS */}
                <div className="ed-section" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', width: '100%', boxSizing: 'border-box' }}>
                    <h1 className="ed-title">{episode.name}</h1>
                    <div className="ed-meta-row">
                        <span>S{seasonNumber} E{episodeNumber}</span>
                        <span>•</span>
                        <span>{episode.air_date?.substring(0, 4)}</span>
                        {episode.runtime && (
                            <>
                                <span>•</span>
                                <span>{episode.runtime} min</span>
                            </>
                        )}
                    </div>

                    {/* Overview */}
                    <div
                        className={`ed-overview ${!isOverviewExpanded ? 'collapsed' : ''}`}
                        onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}
                    >
                        {episode.overview || "No overview available for this episode."}
                    </div>
                    {episode.overview && episode.overview.length > 200 && (
                        <div className="ed-read-more" onClick={() => setIsOverviewExpanded(!isOverviewExpanded)}>
                            {isOverviewExpanded ? 'Show less' : 'Read more'}
                        </div>
                    )}

                    {/* Cast & Crew Section (REUSED UI) */}
                    {allCast.length > 0 && (
                        <div style={{ marginTop: '40px' }}>
                            <div className="ed-section-header">
                                <span>Cast & Crew</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    overflowX: 'auto',
                                    gap: '15px',
                                    paddingBottom: '20px',
                                    scrollbarWidth: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-x pan-y',
                                    scrollSnapType: 'x proximity',
                                    marginLeft: '-20px',  // Negative margin to flush left
                                    paddingLeft: '20px',   // Compensate padding
                                    willChange: 'transform'
                                }}
                                onScroll={(e) => e.stopPropagation()}
                                onTouchStart={(e) => e.stopPropagation()}
                                onTouchMove={(e) => e.stopPropagation()}
                            >
                                {allCast.map(actor => (
                                    <div
                                        key={`${actor.id}-${actor.character}`}
                                        onClick={() => navigate(`/person/${actor.id}`)}
                                        style={{ flex: '0 0 auto', width: '85px', textAlign: 'center' }}
                                    >
                                        <div style={{
                                            width: '70px',
                                            height: '70px',
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            border: '2px solid #222',
                                            margin: '0 auto 8px',
                                            background: '#111'
                                        }}>
                                            {actor.profile_path ? (
                                                <img
                                                    src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    alt={actor.name}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444' }}>
                                                    <MdPerson size={30} />
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#fff', lineHeight: '1.2' }}>{actor.name.split(' ')[0]}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>{actor.character || actor.job}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* SECTION 2: REVIEWS */}
                <div className="ed-section" style={{ flex: '0 0 100%', scrollSnapAlign: 'start', width: '100%', boxSizing: 'border-box' }}>
                    <div className="ed-section-header">
                        <span>Community Reviews</span>
                        <button
                            onClick={() => navigate(`/review/episode/${id}`, {
                                state: { tmdbId: id, seasonNumber, episodeNumber, name: episode.name, poster_path: episode.still_path }
                            })}
                            style={{
                                background: '#ffd600',
                                color: '#000',
                                border: 'none',
                                padding: '6px 15px',
                                borderRadius: '20px',
                                fontSize: '0.8rem',
                                fontWeight: '800'
                            }}
                        >
                            RATE
                        </button>
                    </div>

                    {reviews.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {reviews.map((rev, idx) => (
                                <div key={idx} style={{
                                    padding: '15px',
                                    background: '#0a0a0a',
                                    borderRadius: '12px',
                                    border: '1px solid #111'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img
                                                src={rev.user_photo_url || `https://ui-avatars.com/api/?name=${rev.user_name}&background=random`}
                                                style={{ width: '30px', height: '30px', borderRadius: '50%' }}
                                                alt={rev.user_name}
                                            />
                                            <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{rev.user_name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ffd600' }}>
                                            <MdStar size={16} />
                                            <span style={{ fontWeight: '900' }}>{rev.rating}</span>
                                        </div>
                                    </div>
                                    <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
                                        {rev.review}
                                    </p>
                                    <div style={{ fontSize: '0.7rem', color: '#444', marginTop: '10px' }}>
                                        {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : 'Recent'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#444' }}>
                            <MdRateReview size={40} style={{ marginBottom: '10px' }} />
                            <p>No reviews yet. Be the first to share your thoughts!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EpisodeDetails;
