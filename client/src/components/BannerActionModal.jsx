import { useState, useEffect } from 'react';
import { MdLock, MdPhotoCamera } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';
import './BannerActionModal.css';

const BannerActionModal = ({ onClose, onSearch, lastUpdated }) => {
    const [daysRemaining, setDaysRemaining] = useState(0);
    const [isLocked, setIsLocked] = useState(false);

    useScrollLock(true);

    useEffect(() => {
        if (lastUpdated) {
            const lastDate = new Date(lastUpdated);
            const now = new Date();
            const diffTime = Math.abs(now - lastDate);
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            if (diffDays < 7) {
                setIsLocked(true);
                setDaysRemaining(Math.ceil(7 - diffDays));
            } else {
                setIsLocked(false);
            }
        } else {
            setIsLocked(false);
        }
    }, [lastUpdated]);

    return (
        <div className="modal-overlay banner-action-modal-overlay" onClick={onClose}>
            <div className="modal-content banner-action-modal" onClick={e => e.stopPropagation()}>
                {isLocked ? (
                    <>
                        <div className="action-icon locked">
                            <MdLock size={40} />
                        </div>
                        <h3>Banner Locked</h3>
                        <p>You can change your banner again in {daysRemaining} days.</p>
                        <button className="action-btn primary" onClick={onClose}>
                            OK
                        </button>
                    </>
                ) : (
                    <>
                        <div className="action-icon unlocked">
                            <MdPhotoCamera size={40} />
                        </div>
                        <h3>Change Profile Banner</h3>
                        <p>You can update your profile banner now.</p>
                        <button
                            className="action-btn primary"
                            onClick={() => {
                                onClose();
                                onSearch();
                            }}
                        >
                            Choose New Banner
                        </button>
                        <button className="action-btn secondary" onClick={onClose}>
                            Cancel
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default BannerActionModal;
