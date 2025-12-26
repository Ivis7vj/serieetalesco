
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack } from 'react-icons/md';
import { useLoading } from '../context/LoadingContext';
import { tmdbApi } from '../utils/tmdbApi';

const Biography = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [credits, setCredits] = useState({ cast: [] });
    const { setIsLoading, stopLoading } = useLoading();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch Person Details & Credits using tmdbApi
                const [personData, creditsData] = await Promise.all([
                    tmdbApi.getPersonDetails(id),
                    tmdbApi.getPersonCredits(id)
                ]);

                setPerson(personData);
                setCredits(creditsData);
            } catch (err) {
                console.error("Failed to fetch biography data", err);
            } finally {
                stopLoading();
            }
        };
        fetchData();
    }, [id]);

    if (!person) return null;

    // Filter and Sort: Best TV Series (Cast or Crew)
    const combinedCredits = [
        ...(credits.cast || []),
        ...(credits.crew || [])
    ];

    // Deduplicate by ID and Filter for TV
    const knownForMap = new Map();
    combinedCredits.forEach(c => {
        if (c.media_type === 'tv' && !knownForMap.has(c.id)) {
            knownForMap.set(c.id, c);
        }
    });

    const knownFor = Array.from(knownForMap.values())
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 15);

    return (
        <div className="biography-page" style={{
            background: '#000',
            minHeight: '100vh',
            color: '#fff',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 2000,
            overflowY: 'auto',
            animation: 'slideInRight 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
        }}>
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .biography-page::-webkit-scrollbar { display: none; }
                .known-for-carousel::-webkit-scrollbar { display: none; }
            `}</style>

            {/* Cinematic Header Overlay */}
            <div style={{
                position: 'sticky',
                top: 0,
                zIndex: 100,
                padding: '20px',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
                display: 'flex',
                alignItems: 'center'
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        padding: '10px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <MdArrowBack size={24} />
                </button>
            </div>

            <div className="bio-container" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0 20px 100px 20px',
                maxWidth: '600px',
                margin: '0 auto'
            }}>
                {/* 1. Large Circular Profile Photo */}
                <div style={{
                    marginTop: '20px',
                    width: '180px',
                    height: '180px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '4px solid #1a1a1a',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    background: '#111'
                }}>
                    <img
                        src={person.profile_path ? `https://image.tmdb.org/t/p/h632${person.profile_path}` : 'https://via.placeholder.com/180'}
                        alt={person.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                </div>

                {/* 2. Person Name & Primary Role */}
                <h1 style={{
                    fontSize: '2.2rem',
                    fontWeight: '900',
                    marginTop: '25px',
                    marginBottom: '5px',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>
                    {person.name}
                </h1>
                <div style={{
                    fontSize: '1rem',
                    color: '#888',
                    fontWeight: '600',
                    marginBottom: '30px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px'
                }}>
                    {person.known_for_department}
                </div>

                {/* 3. Biography Content */}
                <div className="bio-text" style={{
                    lineHeight: '1.8',
                    fontSize: '1.05rem',
                    color: '#ddd',
                    textAlign: 'center',
                    whiteSpace: 'pre-line',
                    marginBottom: '50px'
                }}>
                    {person.biography || `${person.name} is a known figure in the ${person.known_for_department} department.`}
                </div>

                {/* 4. Known For Section (Horizontal Row) */}
                {knownFor.length > 0 && (
                    <div style={{ width: '100vw', maxWidth: '1000px', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)' }}>
                        <h2 style={{
                            fontSize: '0.9rem',
                            color: '#555',
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            fontWeight: 'bold',
                            padding: '0 20px',
                            marginBottom: '15px'
                        }}>
                            Known For
                        </h2>

                        <div className="known-for-carousel" style={{
                            display: 'flex',
                            overflowX: 'auto',
                            gap: '15px',
                            padding: '0 20px 20px 20px',
                            WebkitOverflowScrolling: 'touch',
                            touchAction: 'pan-x pan-y',
                            willChange: 'transform'
                        }}>
                            {knownFor.map(show => (
                                <div
                                    key={show.id}
                                    onClick={() => navigate(`/tv/${show.id}`)}
                                    style={{ flex: '0 0 auto', width: '110px', cursor: 'pointer' }}
                                >
                                    <div style={{
                                        width: '100%',
                                        aspectRatio: '2/3',
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        background: '#111',
                                        marginBottom: '8px'
                                    }}>
                                        <img
                                            src={show.poster_path ? `https://image.tmdb.org/t/p/w300${show.poster_path}` : 'https://via.placeholder.com/150x225'}
                                            alt={show.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{
                                        fontSize: '0.75rem',
                                        color: '#fff',
                                        fontWeight: '700',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textAlign: 'center'
                                    }}>
                                        {show.name || show.original_name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Biography;

