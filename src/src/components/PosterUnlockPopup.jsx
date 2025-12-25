import { useNavigate } from 'react-router-dom';
import { MdClose, MdEdit } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';

const PosterUnlockPopup = ({ isOpen, onClose, seriesId, seasonNumber }) => {
    const navigate = useNavigate();

    useScrollLock(isOpen);

    if (!isOpen) return null;

    const handleEditPoster = () => {
        navigate(`/series/${seriesId}/season/${seasonNumber}/posters`);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{
                background: '#111',
                borderRadius: '16px',
                padding: '40px',
                maxWidth: '500px',
                width: '90%',
                textAlign: 'center',
                position: 'relative',
                border: '2px solid #FFD600',
                boxShadow: '0 20px 60px rgba(255, 214, 0, 0.2)'
            }}>
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        fontSize: '24px',
                        cursor: 'pointer',
                        padding: '5px'
                    }}
                >
                    <MdClose />
                </button>

                {/* Completion badge */}
                <div style={{
                    display: 'inline-block',
                    background: 'rgba(255, 214, 0, 0.15)',
                    border: '1.5px solid rgba(255, 214, 0, 0.4)',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    marginBottom: '20px'
                }}>
                    <span style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#FFD600',
                        letterSpacing: '0.5px'
                    }}>
                        Season {seasonNumber} • Completed
                    </span>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#fff',
                    margin: '0 0 15px 0'
                }}>
                    Posters Unlocked! 🎨
                </h2>

                {/* Message */}
                <p style={{
                    fontSize: '16px',
                    color: '#ccc',
                    lineHeight: '1.6',
                    margin: '0 0 30px 0'
                }}>
                    You unlocked posters for this season. You can now customize the poster displayed on your profile, in stories, and across the app.
                </p>

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    gap: '15px',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={handleEditPoster}
                        style={{
                            background: '#FFD600',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 24px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'transform 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                        onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                        <MdEdit size={20} />
                        Edit Poster
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            color: '#fff',
                            border: '2px solid #333',
                            borderRadius: '8px',
                            padding: '12px 24px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.borderColor = '#555'}
                        onMouseLeave={(e) => e.target.style.borderColor = '#333'}
                    >
                        Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosterUnlockPopup;
