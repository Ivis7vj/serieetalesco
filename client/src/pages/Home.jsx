import React, { useState, useEffect } from 'react';
import { MdStarBorder, MdPlayArrow, MdLocalFireDepartment, MdStar, MdCalendarMonth, MdRecommend } from 'react-icons/md';
import { TbTrendingUp } from 'react-icons/tb';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

import './Home.css';
import './Home_Trending.css';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import { tmdbApi } from '../utils/tmdbApi';
import HeroCarousel from '../components/HeroCarousel';
import ChangelogModal from '../components/ChangelogModal';
import PremiumLoader from '../components/PremiumLoader';
import InlinePageLoader from '../components/InlinePageLoader';

const Home = () => {
  const [trendingSeries, setTrendingSeries] = useState(null);
  const [topRatedSeries, setTopRatedSeries] = useState(null);
  const [newSeries, setNewSeries] = useState(null);
  const [heroEpisodes, setHeroEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [lastWatchedName, setLastWatchedName] = useState('');
  const [error, setError] = useState(null);
  const { currentUser, userData, globalPosters } = useAuth();
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch each section individually
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

          let lastDate = s.last_episode_to_air?.air_date ? new Date(s.last_episode_to_air.air_date) : null;
          let nextDate = s.next_episode_to_air?.air_date ? new Date(s.next_episode_to_air.air_date) : null;

          const isRecent = lastDate && lastDate >= twoWeeksAgo && lastDate <= today;
          const isUpcoming = nextDate && nextDate >= today && nextDate <= oneWeekFuture;

          s.filterDate = nextDate && isUpcoming ? nextDate : lastDate;
          s.isUpcoming = !!(nextDate && isUpcoming);
          return isRecent || isUpcoming;
        });

        validHero.sort((a, b) => new Date(b.filterDate || 0) - new Date(a.filterDate || 0));
        setHeroEpisodes(validHero.slice(0, 20));
        setLoading(false);
      } catch (error) {
        console.error("Home Data Fetch Error:", error);
        setError("Unable to load latest content.");
        setLoading(false);
      }
    };

    fetchData();

    const lastSeenVersion = localStorage.getItem('last_seen_version');
    if (lastSeenVersion !== '3.0.2') {
      setIsChangelogOpen(true);
      localStorage.setItem('last_seen_version', '3.0.2');
    }
  }, [currentUser]);

  // Personalized recommendations logic...
  useEffect(() => {
    const fetchPersonalized = async () => {
      if (!userData?.watched?.length) return;
      const sortedWatched = [...userData.watched].sort((a, b) => new Date(b.date) - new Date(a.date));
      const lastWatched = sortedWatched[0];
      if (lastWatched) {
        setLastWatchedName(lastWatched.name);
        try {
          const recs = await tmdbApi.getRecommendations(lastWatched.id);
          setRecommendations(recs.slice(0, 10));
        } catch (e) { console.error(e); }
      }
    };
    fetchPersonalized();
  }, [userData]);

  const SeriesCard = ({ series }) => (
    <div className="series-card-container">
      <Link to={`/tv/${series.id}`} className="series-card">
        <div className="series-poster-wrapper">
          <img
            className="series-poster animate-fade-in"
            src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w500')}
            alt={series.name}
            loading="lazy"
          />
        </div>
      </Link>
    </div>
  );

  return (
    <div className="home-container">
      {loading ? <InlinePageLoader message="Loading Series..." /> : (
        <>
          {error && <div className="error-message">{error}</div>}

          <div className="home-scroller">
            {/* Hero Section */}
            <HeroCarousel episodes={heroEpisodes} />

            {/* Trending Series */}
            <section className="section">
              <h2 className="section-title">
                <MdLocalFireDepartment color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                Trending Series
              </h2>
              <div className="series-row">
                {trendingSeries?.map(s => <SeriesCard key={s.id} series={s} />)}
              </div>
            </section>

            {/* Top Rated Series */}
            <section className="section">
              <h2 className="section-title">
                <MdStar color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                Highest Rated
              </h2>
              <div className="series-row">
                {topRatedSeries?.map(s => <SeriesCard key={s.id} series={s} />)}
              </div>
            </section>

            {/* New Releases */}
            <section className="section">
              <h2 className="section-title">
                <MdCalendarMonth color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                New This Month
              </h2>
              <div className="series-row">
                {newSeries?.map(s => <SeriesCard key={s.id} series={s} />)}
              </div>
            </section>

            {/* Recommendations */}
            {userData?.watched?.length > 0 && recommendations.length > 0 && (
              <section className="section">
                <h2 className="section-title">
                  <MdRecommend color="#FFD600" size={24} style={{ marginRight: '8px' }} />
                  Because you watched <span style={{ color: '#FFD600', marginLeft: '6px' }}>{lastWatchedName}</span>
                </h2>
                <div className="series-row">
                  {recommendations.map(s => <SeriesCard key={s.id} series={s} />)}
                </div>
              </section>
            )}
          </div>

          <ChangelogModal isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
        </>
      )}
    </div>
  );
};

export default Home;
