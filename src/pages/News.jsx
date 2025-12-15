import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MdPlayArrow, MdInfoOutline, MdDateRange } from 'react-icons/md';
import './News.css';

const News = () => {
    const [heroNews, setHeroNews] = useState([]);
    const [trendingNews, setTrendingNews] = useState([]);
    const [whatsNew, setWhatsNew] = useState([]);
    const [activeHeroIndex, setActiveHeroIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    const CACHE_KEY = 'series_news_cache_v1';
    const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 Hours

    useEffect(() => {
        const fetchNews = async () => {
            // Check Cache
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { timestamp, data } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    setHeroNews(data.hero);
                    setTrendingNews(data.trending);
                    setWhatsNew(data.whatsNew);
                    setLoading(false);
                    return;
                }
            }

            try {
                const API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
                const BASE_URL = 'https://api.themoviedb.org/3';

                // 1. Fetch Latest Updates (Airing Today/On The Air)
                const airingRes = await fetch(`${BASE_URL}/tv/airing_today?api_key=${API_KEY}&language=en-US&page=1`);
                const airingData = await airingRes.json();

                const onAirRes = await fetch(`${BASE_URL}/tv/on_the_air?api_key=${API_KEY}&language=en-US&page=1`);
                const onAirData = await onAirRes.json();

                // 2. Fetch Trending
                const trendingRes = await fetch(`${BASE_URL}/trending/tv/day?api_key=${API_KEY}`);
                const trendingData = await trendingRes.json();

                // 3. New Discoveries (Just Released)
                const discoverRes = await fetch(`${BASE_URL}/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=first_air_date.desc&vote_count.gte=50&page=1`);
                const discoverData = await discoverRes.json();

                // PROCESS HERO (Mix of Airing Today & On The Air)
                const combinedHero = [...(airingData.results || []), ...(onAirData.results || [])].slice(0, 8).map(item => ({
                    id: item.id,
                    title: item.name,
                    poster: item.poster_path,
                    backdrop: item.backdrop_path,
                    date: item.first_air_date || new Date().toISOString(),
                    update: "New Episode Dropped", // Generic update text
                    overview: item.overview
                }));

                // PROCESS TRENDING
                const processedTrending = (trendingData.results || []).slice(0, 10).map(item => ({
                    id: item.id,
                    title: item.name,
                    poster: item.poster_path,
                    rank: item.vote_average.toFixed(1)
                }));

                // PROCESS WHAT'S NEW
                const processedNew = (discoverData.results || []).slice(0, 10).map(item => ({
                    id: item.id,
                    title: item.name,
                    poster: item.poster_path,
                    date: item.first_air_date,
                    overview: item.overview
                }));

                setHeroNews(combinedHero);
                setTrendingNews(processedTrending);
                setWhatsNew(processedNew);

                // Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: { hero: combinedHero, trending: processedTrending, whatsNew: processedNew }
                }));

            } catch (error) {
                console.error("News Fetch Error:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, []);

    // Auto Swipe Hero
    useEffect(() => {
        if (loading || heroNews.length === 0) return;
        const interval = setInterval(() => {
            setActiveHeroIndex(prev => (prev + 1) % heroNews.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [heroNews, loading]);

    if (loading) return <div className="news-loading">Checking for updates...</div>;

    return (
        <div className="news-page-container">
            {/* HERO SECTION */}
            <section className="news-hero-section">
                <h2 className="news-section-title">LATEST UPDATES</h2>
                <div className="news-carousel">
                    {heroNews.map((item, index) => {
                        let positionClass = 'news-card-hidden';
                        if (index === activeHeroIndex) positionClass = 'news-card-active';
                        else if (index === (activeHeroIndex - 1 + heroNews.length) % heroNews.length) positionClass = 'news-card-prev';
                        else if (index === (activeHeroIndex + 1) % heroNews.length) positionClass = 'news-card-next';

                        return (
                            <div key={item.id} className={`news-hero-card ${positionClass}`} onClick={() => setActiveHeroIndex(index)}>
                                <img src={`https://image.tmdb.org/t/p/w500${item.poster}`} alt={item.title} className="news-poster-square" />
                                <div className="news-card-overlay">
                                    <h3 className="news-card-title">{item.title}</h3>
                                    <p className="news-update-text">{item.update}</p>
                                    <span className="news-date">{new Date(item.date).toLocaleDateString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* TRENDING SECTION */}
            <section className="news-section">
                <h2 className="news-section-title">TRENDING NOW</h2>
                <div className="news-horizontal-scroll">
                    {trendingNews.map(item => (
                        <Link to={`/tv/${item.id}`} key={item.id} className="news-trend-card">
                            <img src={`https://image.tmdb.org/t/p/w342${item.poster}`} alt={item.title} className="news-poster-small-square" />
                            <div className="news-trend-rank">★ {item.rank}</div>
                        </Link>
                    ))}
                </div>
            </section>

            {/* WHAT'S NEW LIST */}
            <section className="news-section">
                <h2 className="news-section-title">THIS WEEK</h2>
                <div className="news-vertical-list">
                    {whatsNew.map(item => (
                        <Link to={`/tv/${item.id}`} key={item.id} className="news-list-item">
                            <img src={`https://image.tmdb.org/t/p/w185${item.poster}`} alt={item.title} className="news-list-poster" />
                            <div className="news-list-content">
                                <h4 className="news-list-title">{item.title}</h4>
                                <p className="news-list-desc">Series Premiere • {new Date(item.date).toLocaleDateString()}</p>
                                <p className="news-list-overview line-clamp-2">{item.overview}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default News;
