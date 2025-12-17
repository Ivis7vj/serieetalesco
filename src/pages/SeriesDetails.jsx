import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MdEdit, MdStar, MdStarBorder } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { resolvePoster } from '../utils/posterResolution';

const SeriesDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();

  const [series, setSeries] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [seasonProgress, setSeasonProgress] = useState({});
  const [popupVisible, setPopupVisible] = useState(false);
  const [completedSeason, setCompletedSeason] = useState(null);
  const [showEditHint, setShowEditHint] = useState({});

  // Refs for scrolling - Map season number to ref
  const seasonRefs = useRef({});

  const TMDB_API_KEY = '05587a49bd4890a9630d6c0e544e0f6f';

  useEffect(() => {
    fetchSeriesData();
    loadSeasonProgress();
  }, [id]);

  const fetchSeriesData = async () => {
    try {
      const response = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`);
      const data = await response.json();
      setSeries(data);
      setSeasons(data.seasons || []);
    } catch (error) {
      console.error('Error fetching series:', error);
    }
  };

  const loadSeasonProgress = () => {
    const saved = localStorage.getItem(`seasonProgress_${currentUser.username}_${id}`);
    if (saved) {
      setSeasonProgress(JSON.parse(saved));
    }
  };

  const saveSeasonProgress = (newProgress) => {
    localStorage.setItem(`seasonProgress_${currentUser.username}_${id}`, JSON.stringify(newProgress));
    setSeasonProgress(newProgress);
  };

  const completeSeasonHandler = (seasonNumber) => {
    const newProgress = {
      ...seasonProgress,
      [seasonNumber]: {
        ...seasonProgress[seasonNumber],
        userId: currentUser.username,
        seriesId: id,
        seasonNumber,
        completed: true,
        rated: seasonProgress[seasonNumber]?.rated || false,
        ratingValue: seasonProgress[seasonNumber]?.ratingValue || null,
        selectedPosterPath: seasonProgress[seasonNumber]?.selectedPosterPath || null
      }
    };

    saveSeasonProgress(newProgress);
    setCompletedSeason(seasonNumber);
    setPopupVisible(true);
  };

  const closePopup = () => {
    setPopupVisible(false);

    // Auto scroll and highlight after popup closes
    // STRICT FIX: Check against 'completedSeason' state directly
    if (completedSeason) {
      setTimeout(() => {
        const targetRef = seasonRefs.current[completedSeason];
        if (targetRef) {
          targetRef.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Show edit hint and glow
          setShowEditHint(prev => ({ ...prev, [completedSeason]: true }));

          // Remove hint after 5 seconds
          setTimeout(() => {
            setShowEditHint(prev => ({ ...prev, [completedSeason]: false }));
          }, 5000);
        }
      }, 100);
    }
  };

  const rateSeason = (seasonNumber, rating) => {
    const newProgress = {
      ...seasonProgress,
      [seasonNumber]: {
        ...seasonProgress[seasonNumber],
        userId: currentUser.username,
        seriesId: id,
        seasonNumber,
        completed: seasonProgress[seasonNumber]?.completed || false,
        rated: true,
        ratingValue: rating,
        selectedPosterPath: seasonProgress[seasonNumber]?.selectedPosterPath || null
      }
    };

    saveSeasonProgress(newProgress);
  };

  const getSeasonPoster = (season) => {
    // GLOBAL FIX: Resolve from userData (Firestore) > Fallback to TMDB
    // Priority: User Selection > TMDB Season Poster (from API) > Fallback
    const resolvedPath = resolvePoster(userData, id, season.season_number, season.poster_path);

    return resolvedPath ? `https://image.tmdb.org/t/p/w500${resolvedPath}` : fallback;
  };

  if (!series) return <div className="loading">Loading...</div>;

  return (
    <div className="series-details">
      {/* Completion Popup */}
      {popupVisible && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="completion-popup">
            <h2>Congratulations 🎉</h2>
            <p>You completed Season {completedSeason}</p>
          </div>
        </div>
      )}

      <div className="series-header">
        <h1>{series.name}</h1>
        <p>{series.overview}</p>
      </div>

      <div className="seasons-grid">
        {seasons.map((season) => {
          const progress = seasonProgress[season.season_number] || {};
          const isCompleted = progress.completed;
          const isRated = progress.rated;
          const showHint = showEditHint[season.season_number];

          return (
            <div key={season.season_number} className="season-card">
              <div
                className="season-poster-container"
                ref={el => seasonRefs.current[season.season_number] = el}
              >
                <img
                  src={getSeasonPoster(season)}
                  alt={`Season ${season.season_number}`}
                  className="season-poster"
                />

                {/* Edit Poster Button - Only show if completed */}
                {isCompleted && (
                  <Link
                    to={`/tv/${id}/season/${season.season_number}/poster`}
                    className={`edit-poster-btn ${showHint ? 'highlight' : ''}`}
                    title="Edit Season Poster"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                  >
                    <MdEdit />
                  </Link>
                )}

                {/* Edit Hint - "You earned a poster customisation..." */}
                {showHint && (
                  <div className="edit-hint incoming">
                    You earned a poster customisation for this season
                  </div>
                )}
              </div>

              <div className="season-info">
                <h3>Season {season.season_number}</h3>
                <p>{season.episode_count} episodes</p>

                {/* Complete Season Button */}
                {!isCompleted && (
                  <button
                    className="complete-btn"
                    onClick={() => completeSeasonHandler(season.season_number)}
                  >
                    Mark as Completed
                  </button>
                )}

                {/* Rating Section - Per Season */}
                <div className="rating-section">
                  <span>Rate this season:</span>
                  <div className="stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => rateSeason(season.season_number, star)}
                        className="star-btn"
                      >
                        {progress.ratingValue >= star ? <MdStar /> : <MdStarBorder />}
                      </button>
                    ))}
                  </div>
                  {isRated && <span>Rated: {progress.ratingValue}/5</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SeriesDetails;