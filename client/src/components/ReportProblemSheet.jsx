
import React, { useState, useEffect, useRef } from 'react';
import { MdClose, MdCloudUpload, MdErrorOutline } from 'react-icons/md';
import emailjs from '@emailjs/browser';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const ReportProblemSheet = ({ isOpen, onClose }) => {
    const { currentUser, userData } = useAuth();
    const { alert } = useNotification();

    const [issueType, setIssueType] = useState('Something else');
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const sheetRef = useRef(null);
    const [touchStart, setTouchStart] = useState(null);

    // Visibility handling for animation
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setIsVisible(true), 10);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Handle swipe down to dismiss
    const handleTouchStart = (e) => setTouchStart(e.touches[0].clientY);
    const handleTouchMove = (e) => {
        if (!touchStart) return;
        const currentTouch = e.touches[0].clientY;
        const diff = currentTouch - touchStart;
        if (diff > 100) {
            onClose();
            setTouchStart(null);
        }
    };

    const handleScreenshotChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("Screenshot must be less than 2MB", "File Too Large");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setScreenshotPreview(reader.result);
                // Compress logic: we'll send the base64 or a slightly downscaled version
                compressImage(reader.result, (compressed) => {
                    setScreenshot(compressed);
                });
            };
            reader.readAsDataURL(file);
        }
    };

    const compressImage = (base64, callback) => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 800; // Professional max size for email

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validation
        if (description.length < 10) {
            alert("Please provide at least 10 characters.", "Description Too Short");
            return;
        }

        // 2. Rate Limiting Check
        const today = new Date().toDateString();
        const reports = JSON.parse(localStorage.getItem('seriee_reports') || '{}');
        const count = reports[today] || 0;

        if (count >= 3) {
            alert("Maximum 3 reports per day reached. Thank you for your feedback!", "Rate Limit Reached");
            return;
        }

        setLoading(true);

        // 3. Prepare Data
        const templateParams = {
            user_name: userData?.username || currentUser?.displayName || 'Unknown User',
            user_id: currentUser?.uid || 'N/A',
            user_email: currentUser?.email || 'N/A',
            platform: window.innerWidth < 768 ? 'Mobile Web' : 'Web',
            app_version: '1.2.1',
            device_info: navigator.userAgent,
            issue_type: issueType,
            message: description,
            time: new Date().toLocaleString(),
            screenshot: screenshot || ''
        };

        try {
            // NOTE: Using environment variables for security
            // Service ID: service_seriee
            // Template ID: template_report
            // Public Key: provided via VITE_EMAILJS_KEY

            await emailjs.send(
                import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_u9cqqkx',
                import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_5jl022s',
                templateParams,
                import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'dr1f1m6VNzfkpvaq0'
            );

            // 4. Success handling
            reports[today] = count + 1;
            localStorage.setItem('seriee_reports', JSON.stringify(reports));

            alert("Report sent to the admin.", "Success");
            onClose();
            // Reset form
            setDescription('');
            setIssueType('Something else');
            setScreenshot(null);
            setScreenshotPreview(null);
        } catch (error) {
            console.error("EmailJS Error:", error);
            alert("Couldn't send report. Try again.", "Submission Failed");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen && !isVisible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0,0,0,0.7)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'flex-end',
                transition: 'opacity 0.3s ease',
                opacity: isVisible ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none'
            }}
            onClick={onClose}
        >
            <div
                ref={sheetRef}
                style={{
                    width: '100%',
                    height: '85%',
                    backgroundColor: '#000000',
                    borderTopLeftRadius: '24px',
                    borderTopRightRadius: '24px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s ease-out',
                    transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
                    position: 'relative'
                }}
                onClick={e => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ color: '#FFD400', fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>Report a problem</h2>
                        <p style={{ color: '#9A9A9A', fontSize: '0.85rem', margin: '4px 0 0 0' }}>We read every report. Be honest.</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#FFFFFF', padding: '4px', cursor: 'pointer' }}
                    >
                        <MdClose size={28} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>

                    {/* Issue Type Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ color: '#FFFFFF', fontSize: '0.9rem', fontWeight: '600' }}>What’s the issue?</label>
                        <select
                            value={issueType}
                            onChange={(e) => setIssueType(e.target.value)}
                            style={{
                                background: '#111111',
                                border: '1px solid #222222',
                                borderRadius: '8px',
                                padding: '14px',
                                color: '#FFFFFF',
                                fontSize: '1rem',
                                outline: 'none',
                                appearance: 'none',
                                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%239A9A9A%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 14px top 50%',
                                backgroundSize: '12px auto'
                            }}
                        >
                            <option value="App not responding">App not responding</option>
                            <option value="UI / layout issue">UI / layout issue</option>
                            <option value="Data not updating">Data not updating</option>
                            <option value="Login / account issue">Login / account issue</option>
                            <option value="Performance problem">Performance problem</option>
                            <option value="Something else">Something else</option>
                        </select>
                    </div>

                    {/* Description Textarea */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ color: '#FFFFFF', fontSize: '0.9rem', fontWeight: '600' }}>Explain the problem</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What happened? What were you trying to do?"
                            style={{
                                background: '#111111',
                                border: '1px solid #222222',
                                borderRadius: '8px',
                                padding: '14px',
                                color: '#FFFFFF',
                                fontSize: '1rem',
                                minHeight: '120px',
                                outline: 'none',
                                resize: 'none',
                                lineHeight: '1.5'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.75rem', color: description.length < 10 ? '#ff5555' : '#444' }}>
                                {description.length}/500
                            </span>
                        </div>
                    </div>

                    {/* Screenshot Upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <label
                            htmlFor="screenshot-upload"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 20px',
                                background: '#111111',
                                border: '1px dashed #333333',
                                borderRadius: '8px',
                                color: '#FFD400',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                transition: 'background 0.2s'
                            }}
                        >
                            <MdCloudUpload size={20} />
                            {screenshotPreview ? 'Change screenshot' : 'Add screenshot (optional)'}
                            <input
                                id="screenshot-upload"
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={handleScreenshotChange}
                            />
                        </label>
                        <p style={{ color: '#9A9A9A', fontSize: '0.75rem', margin: 0 }}>Screenshots help us fix it faster.</p>

                        {screenshotPreview && (
                            <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #333' }}>
                                <img src={screenshotPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button
                                    onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', color: 'white', padding: '2px', cursor: 'pointer' }}
                                >
                                    <MdClose size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || description.length < 10}
                        style={{
                            padding: '16px',
                            background: loading || description.length < 10 ? '#333333' : '#FFD400',
                            color: '#000000',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            cursor: loading || description.length < 10 ? 'default' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            transition: 'transform 0.1s ease, background 0.3s',
                            marginTop: '10px', // Reduced margin top
                            marginBottom: '40px' // Added some bottom padding for scroll space
                        }}
                        onMouseDown={e => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={e => !loading && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {loading ? 'Sending...' : 'Send report'}
                    </button>

                </form>
            </div>
        </div>
    );
};

export default ReportProblemSheet;
