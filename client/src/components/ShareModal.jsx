import { MdClose, MdFileDownload, MdContentCopy, MdOpenInNew } from 'react-icons/md';
import { useNotification } from '../context/NotificationContext';
import { useScrollLock } from '../hooks/useScrollLock';

const ShareModal = ({ isOpen, onClose, imageUrl }) => {
    const { alert } = useNotification();

    useScrollLock(isOpen);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            await alert('Image copied to clipboard!', 'Success');
        } catch (err) {
            console.error('Failed to copy image:', err);
            await alert('Failed to copy image to clipboard.', 'Error');
        }
    };

    const handleOpenInstagram = () => {
        window.open('https://www.instagram.com', '_blank');
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{
                background: '#1a1a1a',
                borderRadius: '16px',
                padding: '24px',
                width: '90%',
                maxWidth: '400px',
                border: '1px solid #333',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
            }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'transparent',
                        border: 'none',
                        color: '#666',
                        cursor: 'pointer'
                    }}
                >
                    <MdClose size={24} />
                </button>

                <div style={{ textAlign: 'center' }}>
                    <h3 style={{ color: 'white', marginBottom: '8px', fontSize: '1.2rem' }}>Share to Instagram</h3>
                    <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: '1.4' }}>
                        We've generated your story card! Since we can't open the app directly, please save the image and post it manually.
                    </p>
                </div>

                <div style={{
                    width: '100%',
                    height: '200px',
                    background: '#000',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <img
                        src={imageUrl}
                        alt="Preview"
                        style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleSave}
                        style={{
                            background: '#FFCC00',
                            color: 'black',
                            border: 'none',
                            padding: '12px',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                        }}
                    >
                        <MdFileDownload size={20} /> Save Image
                    </button>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={handleCopy}
                            style={{
                                flex: 1,
                                background: '#333',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <MdContentCopy size={18} /> Copy
                        </button>
                        <button
                            onClick={handleOpenInstagram}
                            style={{
                                flex: 1,
                                background: '#333',
                                color: 'white',
                                border: 'none',
                                padding: '12px',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                fontSize: '0.9rem'
                            }}
                        >
                            <MdOpenInNew size={18} /> Open Insta
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
