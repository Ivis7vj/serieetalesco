import { MdClose } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';
import './BannerViewModal.css';

const BannerViewModal = ({ src, onClose }) => {
    useScrollLock(!!src);
    if (!src) return null;

    return (
        <div className="modal-overlay banner-view-modal" onClick={onClose}>
            <div className="modal-content banner-view-container">
                <div className="banner-view-backdrop">
                    <img src={src} alt="Background" />
                </div>
                <div className="banner-view-content">
                    <button className="view-close-btn" onClick={onClose}>
                        <MdClose size={30} />
                    </button>
                    <img src={src} alt="Banner Full" className="banner-full-img" />
                </div>
            </div>
        </div>
    );
};

export default BannerViewModal;
