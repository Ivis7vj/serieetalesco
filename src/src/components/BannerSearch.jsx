import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdSearch } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { getResolvedPosterUrl } from '../utils/globalPosterResolver';
import './BannerSearch.css';

const BannerSearch = ({ onClose, onSelectSeries }) => {
    useScrollLock(true);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const { globalPosters } = useAuth();

    const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '05587a49bd4890a9630d6c0e544e0f6f';
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    useEffect(() => {
        const fetchSearch = async () => {
            if (!query.trim()) {
                // Fetch recommendations if no query
                try {
                    const response = await fetch(`${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`);
                    const data = await response.json();
                    setResults(data.results.slice(0, 12) || []);
                } catch (error) {
                    console.error("Failed to fetch trending", error);
                }
                return;
            }
            setLoading(true);
            try {
                const response = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`);
                const data = await response.json();
                setResults(data.results || []);
            } catch (error) {
                console.error("Search failed", error);
            }
            setLoading(false);
        };

        const timeoutId = setTimeout(() => {
            fetchSearch();
        }, 500); // Debounce

        return () => clearTimeout(timeoutId);
    }, [query, TMDB_API_KEY]);

    return (
        <div className="banner-search-overlay">
            <div className="banner-search-header">
                <button className="close-btn" onClick={onClose}><MdClose size={24} /></button>
                <div className="search-input-wrapper">
                    <MdSearch className="search-icon" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search series for banner"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="banner-search-input"
                    />
                </div>
            </div>

            <div className="banner-search-results">
                {loading && <div className="loading-text">Searching...</div>}

                {!loading && query && results.length === 0 && (
                    <div className="no-results">
                        <p>showing only there is no series</p>
                        <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>Try searching something else</p>
                    </div>
                )}

                {!loading && !query && results.length > 0 && (
                    <div className="recommendations-header" style={{ color: '#888', fontSize: '0.9rem', marginBottom: '15px', fontWeight: 'bold' }}>
                        TRENDING SERIES
                    </div>
                )}

                <div className="results-grid">
                    {results.map(series => (
                        <div key={series.id} className="result-card" onClick={() => onSelectSeries(series)}>
                            <div className="result-poster-wrapper">
                                <img
                                    src={getResolvedPosterUrl(series.id, series.poster_path, globalPosters, 'w500')
                                        || (series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : 'https://via.placeholder.com/342x513?text=No+Poster')}
                                    alt={series.name}
                                    className="result-poster"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="result-name">{series.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BannerSearch;
