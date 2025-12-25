import React, { useState, useEffect } from 'react';
import { MdStarBorder, MdPlayArrow, MdLocalFireDepartment, MdStar, MdCalendarMonth, MdRecommend, MdAutoAwesome } from 'react-icons/md';
import { TbTrendingUp } from 'react-icons/tb';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, animate } from 'framer-motion';

import './Home.css';
import './Home_Trending.css';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { tmdbApi } from '../utils/tmdbApi';
import { useLoading } from '../context/LoadingContext';
import HeroCarousel from '../components/HeroCarousel';
import { triggerErrorAutomation } from '../utils/errorAutomation';
import ChangelogModal from '../components/ChangelogModal';
import PremiumLoader from '../components/PremiumLoader';



const Home = () => {
  const [trendingSeries, setTrendingSeries] = useState([]);
  const [topRatedSeries, setTopRatedSeries] = useState([]);
  const [newSeries, setNewSeries] = useState([]);
  const [heroEpisodes, setHeroEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [lastWatchedName, setLastWatchedName] = useState('');
  const [error, setError] = useState(null);
  const { setIsLoading, stopLoading } = useLoading();
  const { currentUser, userData, globalPosters } = useAuth();
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // ... existing fetch logic ...
      try {
        // Only trigger global loader if we don't have hero episodes (initial load)
        if (heroEpisodes.length === 0) setIsLoading(true);

        // Fetch each section individually to ensure partial loads work if one fails
        const [trendingRes, topRatedRes, newReleasesRes, heroRes] = await Promise.allSettled([
          tmdbApi.getTrending('weekly'),
          tmdbApi.getTopRated(),
          tmdbApi.getNewReleases(),
          tmdbApi.getHeroEpisodes()
        ]);

        const trendingData = trendingRes.status === 'fulfilled' ? trendingRes.value : [];
        const topRated = topRatedRes.status === 'fulfilled' ? topRatedRes.value : [];
        const newReleases = newReleasesRes.status === 'fulfilled' ? newReleasesRes.value : [];
        const heroData = heroRes.status === 'fulfilled' ? heroRes.value : [];

        setTrendingSeries(trendingData?.slice(0, 12) || []);
        setTopRatedSeries(topRated?.slice(0, 12) || []);
        setNewSeries(newReleases?.slice(0, 12) || []);

        const validHero = (heroData || []).filter(s => {
          if (!s.backdrop_path && !s.poster_path) return false;

          const today = new Date();
          const twoWeeksAgo = new Date(today);
          twoWeeksAgo.setDate(today.getDate() - 14);

          const oneWeekFuture = new Date(today);
          oneWeekFuture.setDate(today.getDate() + 7);

          // Check Last Episode (Released)
          let lastDate = null;
          if (s.last_episode_to_air?.air_date) {
            lastDate = new Date(s.last_episode_to_air.air_date);
          }

          // Check Next Episode (Upcoming)
          let nextDate = null;
          if (s.next_episode_to_air?.air_date) {
            nextDate = new Date(s.next_episode_to_air.air_date);
          }

          // strict filter: must have an episode in the [-14, +7] days window
          const isRecent = lastDate && lastDate >= twoWeeksAgo && lastDate <= today; // Released recently
          const isUpcoming = nextDate && nextDate >= today && nextDate <= oneWeekFuture; // Coming soon

          // attach metadata for sorting preference
          s.filterDate = nextDate && isUpcoming ? nextDate : lastDate;
          s.isUpcoming = !!(nextDate && isUpcoming); // Flag for UI

          return isRecent || isUpcoming;
        });

        // Sorting: Upcoming/Today first, then descending by date
        validHero.sort((a, b) => {
          const dateA = new Date(a.filterDate || 0);
          const dateB = new Date(b.filterDate || 0);
          return dateB - dateA; // Newest/Future first
        });

        setHeroEpisodes(validHero.slice(0, 20)); // Show 20 items

        stopLoading();
      } catch (error) {
        console.error("Home Data Fetch Error:", error);
        setError("Unable to load latest content. Please check your connection.");
        stopLoading();
      }
    };

    fetchData();

    // Changelog Logic
    const lastSeenVersion = localStorage.getItem('last_seen_version');
    if (lastSeenVersion !== '3.0.0') {
      setIsChangelogOpen(true);
      localStorage.setItem('last_seen_version', '3.0.0');
    }
  }, [currentUser, setIsLoading, stopLoading]);

  // Personalization Effect
  useEffect(() => {
    const fetchPersonalized = async () => {
      if (!userData?.watched || userData.watched.length === 0) return;

      // Get last watched series
      // Sort by date desc if possible, assuming array order might vary
      // userData.watched usually has { id, name, date }
      const sortedWatched = [...userData.watched].sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastWatched = sortedWatched[0];

      if (lastWatched) {
        setLastWatchedName(lastWatched.name);
        try {
          const recs = await tmdbApi.getRecommendations(lastWatched.id);
          setRecommendations(recs.slice(0, 10));
        } catch (e) {
          console.error("Personalization Error:", e);
        }
      }
    };

    fetchPersonalized();
  }, [userData]);

  const SeriesCard = ({ series }) => {
    if (!series) return null;

    return (
      <div className="series-card-container">
        <Link to={`/tv/${series.id}`} className="series-card">

          <div className="series-poster-wrapper">
            <img
              className="series-poster"
              src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w500')
                || (series.backdrop_path ? `https://image.tmdb.org/t/p/w500${series.backdrop_path}` : '')}
              alt={series.name}
              draggable={false}
              style={{ background: '#1a1a1a' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        </Link>
      </div>
    );
  };

  /* Pull to Refresh Logic */
  /* SMOOTH 120FPS PULL TO REFRESH */
  const pullY = useMotionValue(0);
  const pullSpring = useSpring(pullY, { stiffness: 400, damping: 40 });
  const pullProgress = useTransform(pullY, [0, 60], [0, 1]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const touchStart = React.useRef(0);

  const handleTouchStart = (e) => {
    if (isRefreshing) return;
    const scroller = document.querySelector('.home-scroller');
    if (scroller && scroller.scrollTop <= 0) {
      touchStart.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e) => {
    if (!isPulling || isRefreshing) return;
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStart.current;

    if (diff > 0) {
      // High-performance direct MotionValue update (bypasses React state for 120fps feel)
      // Resistance curve: diff / (1 + diff * 0.01)
      const resistance = diff / (1 + diff * 0.005);
      pullY.set(Math.min(resistance, 100));
    } else {
      pullY.set(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isPulling || isRefreshing) return;
    setIsPulling(false);

    if (pullY.get() > 65) {
      setIsRefreshing(true);
      // Native-like feedback before reload
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      animate(pullY, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  };

  return (
    <>
      {error ? (
        <div style={{ color: '#FFD600', textAlign: 'center', marginTop: '100px', padding: '20px', fontSize: '1.1rem' }}>
          {error}
        </div>
      ) : (
        <motion.div
          className="home-scroller"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            y: pullSpring,
            background: '#000'
          }}
        >

          {/* Refresh Indicator */}
          <div style={{
            position: 'absolute',
            top: '-60px',
            left: 0,
            width: '100%',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFD600',
            overflow: 'hidden'
          }}>
            <motion.div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: pullProgress,
                scale: pullProgress
              }}
            >
              {isRefreshing ? (
                <MdAutoAwesome className="spin" size={28} />
              ) : (
                <MdLocalFireDepartment size={28} />
              )}
              <span style={{ fontWeight: '900', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {isRefreshing ? 'Refreshing...' : 'Pull to Refresh'}
              </span>
            </motion.div>
          </div>

          {/* LOADING STATE - User said animation not showing */}
          {heroEpisodes.length === 0 && !error && (
            <div style={{
              height: '80vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#000'
            }}>
              <PremiumLoader message="Preparing your feed..." />
            </div>
          )}



          {/* NEW HERO CAROUSEL SECTION */}
          {/* Dynamically previews Newly Released Episodes */}
          <HeroCarousel episodes={heroEpisodes} />

          {/* Trending Series Section */}
          {trendingSeries.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                <MdLocalFireDepartment color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                Trending Series
              </h2>
              <div className="series-row">
                {trendingSeries.map((series) => (
                  <SeriesCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          )}

          {/* Top Rated Series Section */}
          {topRatedSeries.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                <MdStar color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                Highest Rated Series
              </h2>
              <div className="series-row">
                {topRatedSeries.map((series) => (
                  <SeriesCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          )}

          {/* New Releases Section */}
          {newSeries.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                <MdCalendarMonth color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                New This Month
              </h2>
              <div className="series-row">
                {newSeries.map((series) => (
                  <SeriesCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          )}

          {/* Personalized Section */}
          {recommendations.length > 0 && (
            <section className="section">
              <h2 className="section-title">
                <MdRecommend color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                Because you watched <span style={{ color: '#FFD600', marginLeft: '6px', fontWeight: '400', opacity: 0.9 }}>{lastWatchedName}</span>
              </h2>
              <div className="series-row">
                {recommendations.map((series) => (
                  <SeriesCard key={series.id} series={series} />
                ))}
              </div>
            </section>
          )}
        </motion.div>

      )}

      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
    </>
  );
};

export default Home;
