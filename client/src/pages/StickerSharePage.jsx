import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdIosShare, MdClose } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import StorySticker from '../components/StorySticker';
import LoadingPopup from '../components/LoadingPopup';
import PremiumLoader from '../components/PremiumLoader';
import { useScrollLock } from '../hooks/useScrollLock';
import { generateShareImage, sharePoster } from '../utils/shareUtils';

const StickerSharePage = () => {
    // Lock Scroll on this page
    useScrollLock(true);
    const location = useLocation();
    const navigate = useNavigate();
    const { globalPosters } = useAuth();
    const stickerData = location.state?.stickerData;
    const stickerRef = useRef(null);

    const [status, setStatus] = useState('idle'); // idle, preparing, ready
    const [generatedImage, setGeneratedImage] = useState(null);
    const isMounted = useRef(true);
    const generateTimeoutRef = useRef(null);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (generateTimeoutRef.current) {
                clearTimeout(generateTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!stickerData) {
            navigate(-1);
            return;
        }
        handleGenerate();
    }, [stickerData]);

    const handleGenerate = async () => {
        if (!stickerRef.current) {
            // Wait for ref if not immediately available
            generateTimeoutRef.current = setTimeout(handleGenerate, 100);
            return;
        }

        if (!isMounted.current) return;
        setStatus('preparing');

        // Wait for images in StorySticker (via data-attributes or natural state)
        const waitForImages = async () => {
            const maxWait = 10000;
            const startTime = Date.now();
            while (Date.now() - startTime < maxWait) {
                const posterLoaded = stickerRef.current?.getAttribute('data-poster-loaded') === 'true';
                const pfpLoaded = stickerRef.current?.getAttribute('data-pfp-loaded') === 'true';

                const posterImg = stickerRef.current?.querySelector('img[alt="Poster"]');
                const isPosterReallyLoaded = posterImg ? posterImg.complete && posterImg.naturalWidth > 0 : false;

                if ((posterLoaded || isPosterReallyLoaded) && pfpLoaded) return true;
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        };

        await waitForImages();
        await new Promise(r => setTimeout(r, 500)); // Layout settle

        try {
            const dataUrl = await generateShareImage(stickerRef.current, {
                width: 1080,
                height: 1920,
                style: {
                    display: 'flex',
                    position: 'relative',
                    transform: 'none',
                    margin: '0',
                }
            });
            if (!isMounted.current) return;
            setGeneratedImage(dataUrl);
            setStatus('ready');
        } catch (error) {
            console.error("Sticker Generation Error:", error);
            if (isMounted.current) {
                setStatus('idle');
            }
        }
    };

    const handleShare = async () => {
        if (!generatedImage) return;
        await sharePoster(generatedImage, 'My Series Rating', 'Check it out on SERIEE!');
    };

    if (!stickerData) return null;

    return (
        <div style={{
            height: '100vh',
            backgroundColor: '#000',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, sans-serif',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #222',
                background: 'rgba(0,0,0,0.8)',
                backdropFilter: 'blur(20px)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                    <MdArrowBack size={28} />
                </button>
                <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Share Poster
                </h1>
                <div style={{ width: '28px' }}></div> {/* Spacer */}
            </div>

            {/* Content Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {status === 'preparing' && (
                    <div style={{ textAlign: 'center', zIndex: 5 }}>
                        <PremiumLoader message="Designing your poster..." />
                    </div>
                )}

                {status === 'ready' && generatedImage && (
                    <div style={{
                        width: '100%',
                        maxWidth: '380px',
                        animation: 'fadeIn 0.5s ease-out',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}>
                        <img
                            src={generatedImage}
                            alt="Sticker Preview"
                            style={{
                                width: 'auto',
                                maxWidth: '100%',
                                maxHeight: '55vh',
                                borderRadius: '16px',
                                border: '1px solid #333',
                                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                objectFit: 'contain'
                            }}
                        />
                        <button
                            onClick={handleShare}
                            style={{
                                marginTop: '30px',
                                background: '#FFD600',
                                color: '#000',
                                border: 'none',
                                borderRadius: '50px',
                                padding: '16px 40px',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                boxShadow: '0 10px 20px rgba(255,214,0,0.2)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <MdIosShare size={22} />
                            Share Now
                        </button>
                    </div>
                )}

                {/* Hidden Capture Target */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: -1,
                    width: '1080px',
                    height: '1920px',
                    overflow: 'hidden'
                }}>
                    <StorySticker
                        ref={stickerRef}
                        movie={stickerData.movie}
                        rating={stickerData.rating}
                        user={stickerData.user}
                        isEpisodes={stickerData.isEpisodes}
                        globalPosters={globalPosters}
                    />
                </div>
            </div>

            <style>
                {`
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>
        </div>
    );
};

export default StickerSharePage;
