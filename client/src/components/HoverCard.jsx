import { useState, useRef } from 'react';
import { MdStar, MdPlayArrow, MdError, MdAdd } from 'react-icons/md';
import { Link } from 'react-router-dom';
import '../pages/Home.css';

const HoverCard = ({ series, children }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverTimeout = useRef(null);

    const handleMouseEnter = () => {
        hoverTimeout.current = setTimeout(() => {
            setIsHovered(true);
        }, 500);
    };

    const handleMouseLeave = () => {
        clearTimeout(hoverTimeout.current);
        setIsHovered(false);
    };

    return (
        <div
            className="hover-card-wrapper"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'relative' }}
        >
            {children}

            {isHovered && (
                <div
                    className="hover-popup"
                    style={{
                        position: 'absolute',
                        top: '-50%', // Move up to center vertically roughly or clear the top
                        left: '-50%', // Move left to center horizontally
                        width: '200%', // Make it wide (landscape)
                        zIndex: 1000,
                        background: '#141414',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.9)',
                        borderRadius: '6px',
                        border: 'none',
                        overflow: 'hidden',
                        animation: 'fadeIn 0.3s ease-out',
                        transformOrigin: 'center center'
                    }}
                >
                    <div className="media-container" style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img src={`https://image.tmdb.org/t/p/w500${series.backdrop_path || series.poster_path}`} alt={series.name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                        </div>
                    </div>

                    <div className="popup-info" style={{ padding: '15px', background: '#181818' }}>
                        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>{series.name}</h4>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' }}>
                            <span style={{ color: '#46d369', fontWeight: 'bold', fontSize: '0.9rem' }}>98% Match</span>
                            <span style={{ border: '1px solid #666', padding: '0 4px', fontSize: '0.7rem', color: '#ccc' }}>16+</span>
                            <span style={{ fontSize: '0.9rem', color: '#ccc' }}>{series.first_air_date?.split('-')[0] || 'N/A'}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flex: 1, gap: '5px' }}>
                                <div style={{
                                    background: '#fff',
                                    color: 'black',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}>
                                    <MdPlayArrow size={24} />
                                </div>
                                <div style={{
                                    border: '2px solid #666',
                                    color: 'white',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}>
                                    <MdAdd size={20} />
                                </div>
                            </div>

                            <Link
                                to={`/tv/${series.id}`}
                                className="popup-btn"
                                style={{
                                    background: 'transparent',
                                    color: '#fff',
                                    padding: '5px 10px',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    textDecoration: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    border: '1px solid #666',
                                    borderRadius: '4px'
                                }}
                            >
                                Info
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HoverCard;
