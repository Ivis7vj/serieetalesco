import { useState, useEffect } from 'react';
import { MdStarBorder, MdPlayArrow } from 'react-icons/md';
import { TbTrendingUp } from 'react-icons/tb';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase-config';

import './Home.css';
import './Home_Trending.css';
import { trendingMoments } from '../data/trendingMomentsData';

const Home = () => {
  const [trendingSeries, setTrendingSeries] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);
  const [newSeries, setNewSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, userData } = useAuth();
  const [starSeriesIds, setStarSeriesIds] = useState(new Set());
  const navigate = useNavigate();
  const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

  // Hero Carousel State


  // Trending Moments State
  const [momentIndex, setMomentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  // Filter moments: Show if series is in ANY fetched list (Trending, Top Rated, or New)
  // This ensures better coverage so rotation actually happens.
  const allFetchedSeries = [...trendingSeries, ...topRatedSeries, ...newSeries];
  const activeMoments = trendingMoments.filter(moment =>
    allFetchedSeries.some(s => s.id === moment.id)
  );

  // Auto Rotate Moments with Fade Effect
  useEffect(() => {
    // Only rotate if we have more than 1 moment
    if (activeMoments.length <= 1) return;

    const interval = setInterval(() => {
      // 1. Fade Out
      setIsFading(true);

      // 2. Switch Content after Fade Out duration (matches CSS 0.5s)
      setTimeout(() => {
        setMomentIndex(prev => (prev + 1) % activeMoments.length);

        // 3. Fade In (allow small buffer for DOM update)
        requestAnimationFrame(() => {
          setIsFading(false);
        });
      }, 500); // 500ms match CSS transition

    }, 5000); // 5 seconds display time

    return () => clearInterval(interval);
  }, [activeMoments.length]);

  useEffect(() => {
    if (userData?.starSeries) {
      setStarSeriesIds(new Set(userData.starSeries.map(s => s.id)));
    } else {
      setStarSeriesIds(new Set());
    }
  }, [userData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trending, topRated, newReleases] = await Promise.all([
          fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`).then(r => r.json()),
          fetch(`${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}`).then(r => r.json()),
          fetch(`${TMDB_BASE_URL}/tv/airing_today?api_key=${TMDB_API_KEY}`).then(r => r.json())
        ]);

        setTrendingSeries(trending.results.slice(0, 12));
        setTopRatedSeries(topRated.results.slice(0, 12));
        setNewSeries(newReleases.results.slice(0, 12));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching series:', error);
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const SeriesCard = ({ series }) => {
    if (!series) return null;

    return (
      <div className="series-card-container">
        <Link to={`/tv/${series.id}`} className="series-card">

          <div className="series-poster-wrapper">
            <img
              className="series-poster"
              src={series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : (series.backdrop_path ? `https://image.tmdb.org/t/p/w500${series.backdrop_path}` : 'https://via.placeholder.com/200x300/141414/FFFF00?text=No+Image')}
              alt={series.name}
              draggable={false}
              onError={(e) => {
                e.target.src = `https://via.placeholder.com/200x300/141414/FFFF00?text=${series.name}`;
              }}
            />
          </div>
        </Link>
      </div>
    );
  };

  const currentMoment = activeMoments[momentIndex];

  return (
    <>
      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="home-scroller">
          {/* HERO SPLIT SECTION */}
          {/* HERO VERTICAL SECTION */}
          <div className="hero-vertical-section">
            {/* TRENDING MOMENT CARD (Conditional) */}
            {activeMoments.length > 0 && currentMoment && (
              <div className="trending-moments-container">
                <div
                  className={`trending-moment-card ${isFading ? 'fading' : ''}`}
                  /* Key removed to prevent unmount, allowing smooth opacity transition */
                  style={{
                    display: 'flex',
                    '--accent-color': currentMoment.accent
                  }}
                  onClick={() => navigate(`/tv/${currentMoment.id}`)}
                >
                  {/* Left Poster */}
                  <div className="moment-poster-wrapper">
                    <img
                      src={`https://image.tmdb.org/t/p/w342${currentMoment.poster_path}`}
                      alt={currentMoment.title}
                      className="moment-poster"
                    />
                  </div>

                  {/* Right Content */}
                  <div className="moment-content">
                    <div className="moment-label">Trending Moment</div>
                    <div className="moment-quote">
                      "{currentMoment.quote}"
                    </div>
                    <div className="moment-source">
                      {currentMoment.title}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Note: Previous Hero Text Stack Removed */}

            {/* POSTER (Bottom) */}
            {/* POSTER REMOVED */}
          </div>

          {/* Continue Watching Section */}


          {/* Trending Series Section */}
          <section className="section">
            <h2 className="section-title">
              Trending Series
            </h2>
            <div className="series-row">
              {trendingSeries.map((series) => (
                <SeriesCard key={series.id} series={series} />
              ))}
            </div>
          </section>

          {/* Top Rated Series Section */}
          <section className="section">
            <h2 className="section-title">
              Highest Rated Series
            </h2>
            <div className="series-row">
              {topRatedSeries.map((series) => (
                <SeriesCard key={series.id} series={series} />
              ))}
            </div>
          </section>

          {/* New Releases Section */}
          <section className="section">
            <h2 className="section-title">New This Month</h2>
            <div className="series-row">
              {newSeries.map((series) => (
                <SeriesCard key={series.id} series={series} />
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default Home;
