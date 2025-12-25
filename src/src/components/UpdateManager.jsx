import React, { useState, useEffect } from 'react';
import { APP_VERSION, STORAGE_KEY_VERSION, getLatestVersion, getChangelog, getDownloadUrl, getCodeBundleUrl, CHANGELOG_V1_0_1 } from '../utils/versionConfig';
import { MdSystemUpdate, MdCloudDownload, MdCheckCircle, MdRocketLaunch } from 'react-icons/md';
import { Capacitor } from '@capacitor/core';
import './UpdateManager.css';

const UpdateManager = () => {
    const [status, setStatus] = useState('idle'); // idle, prompt, updating, completed
    const [progress, setProgress] = useState(0);
    const [updateChangelog, setUpdateChangelog] = useState([]);
    const [remoteVersion, setRemoteVersion] = useState(null);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [codeBundleUrl, setCodeBundleUrl] = useState(null);

    // Semver comparison to prevent string errors (e.g. 2.1.10 < 2.1.2)
    const isNewer = (remote, local) => {
        if (!remote || !local) return false;
        const rParts = remote.split('.').map(Number);
        const lParts = local.split('.').map(Number);
        for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
            const r = rParts[i] || 0;
            const l = lParts[i] || 0;
            if (r > l) return true;
            if (r < l) return false;
        }
        return false;
    };

    useEffect(() => {
        const checkVersion = async () => {
            // Only run version check logic if we are NOT in the middle of an update status
            if (status !== 'idle') return;

            try {
                const latestVer = await getLatestVersion();
                console.log(`🔍 Version Check: Installed=${APP_VERSION}, Remote=${latestVer}`);

                // 1. If versions match (or local is somehow newer), ensure we are IDLE and clear any skip flags for THIS version (since we are on it)
                if (!isNewer(latestVer, APP_VERSION)) {
                    // We are up to date!
                    // If we previously skipped an older version, we can clear it, but checking if we skipped THIS version is irrelevant as we have it.
                    // Just return.
                    return;
                }

                // 2. Remote is NEWER. Check if user skipped this specific version.
                const skippedVer = localStorage.getItem('skipped_update_ver');
                if (skippedVer === latestVer) {
                    console.log("User previously skipped update:", latestVer);
                    return; // Don't prompt again for this specific version
                }

                // 3. New Update Available AND Not Skipped
                const changeLog = await getChangelog();
                const apkUrl = await getDownloadUrl();
                const zipUrl = await getCodeBundleUrl();

                setUpdateChangelog(changeLog);
                setRemoteVersion(latestVer);
                setDownloadUrl(apkUrl);
                setCodeBundleUrl(zipUrl);

                // Mark as seen/skipped IMMEDIATELY so it doesn't prompt on every reload
                localStorage.setItem('skipped_update_ver', latestVer);

                // Delay prompt slightly
                setTimeout(() => {
                    setStatus('prompt');
                }, 3000);

            } catch (err) {
                console.error("OTA Check Failed:", err);
            }
        };

        checkVersion();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    const handleUpdate = async () => {
        if (downloadUrl) {
            // Validate URL before opening
            if (downloadUrl.startsWith('http')) {
                window.open(downloadUrl, '_system');
            } else {
                alert("Invalid download link configuration.");
            }
            setStatus('idle');
        } else {
            alert("Update link missing. Please contact support.");
            setStatus('idle');
        }
    };

    const handleNotNow = () => {
        // User clicked "Not Now". Persist this choice for THIS version.
        if (remoteVersion) {
            localStorage.setItem('skipped_update_ver', remoteVersion);
        }
        setStatus('idle');
    };

    const handleCloseChangelog = () => {
        localStorage.setItem(STORAGE_KEY_VERSION, APP_VERSION);
        setStatus('idle');
    };

    if (status === 'idle') return null;

    // --- FULL SCREEN CONTAINER (Z-Index High) ---
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            zIndex: 99999, // Higher than everything
            background: 'rgba(0,0,0,0.95)', // Pure black
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>

            {/* --- 1. PROMPT (Pure Black Card) --- */}
            {status === 'prompt' && (
                <div className="update-card-enter" style={{
                    background: '#000', padding: '40px 30px', borderRadius: '24px',
                    width: '90%', maxWidth: '360px', textAlign: 'center',
                    border: '1px solid #222',
                    boxShadow: '0 0 60px rgba(0,0,0,0.8)'
                }}>
                    <div style={{
                        margin: '0 auto 20px', width: '70px', height: '70px',
                        background: '#111', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid #333'
                    }}>
                        <MdSystemUpdate size={32} color="#FFD700" />
                    </div>

                    <h2 style={{ color: '#fff', marginBottom: '10px', fontSize: '1.5rem', fontFamily: 'Anton, sans-serif', letterSpacing: '0.5px' }}>
                        UPDATE AVAILABLE
                    </h2>

                    <p style={{ color: '#888', marginBottom: '30px', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        Version <span style={{ color: '#fff', fontWeight: 'bold' }}>{remoteVersion}</span> is ready.
                        <br />
                        Download and install to continue.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <button
                            onClick={handleUpdate}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                                background: '#FFD700', color: '#000', fontWeight: '800',
                                fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            <MdCloudDownload size={20} />
                            DOWNLOAD UPDATE
                        </button>

                        <button
                            onClick={handleNotNow}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #333',
                                background: 'transparent', color: '#666', fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Not Now
                        </button>
                    </div>
                </div>
            )}

            {/* --- 3. COMPLETED / CHANGELOG (Pure Black) --- */}
            {status === 'completed' && (
                <div className="update-card-enter" style={{
                    background: '#000', padding: '0', borderRadius: '24px',
                    width: '90%', maxWidth: '420px', height: '70vh',
                    border: '1px solid #222', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                    boxShadow: '0 0 80px rgba(255, 215, 0, 0.1)'
                }}>
                    {/* Header */}
                    <div style={{ padding: '30px', borderBottom: '1px solid #1a1a1a', background: '#050505' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                            <MdRocketLaunch color="#FFD700" size={24} />
                            <span style={{ color: '#FFD700', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px' }}>WHAT'S NEW</span>
                        </div>
                        <h1 style={{ color: '#fff', fontSize: '2rem', margin: 0, fontFamily: 'Anton, sans-serif' }}>
                            v{remoteVersion || APP_VERSION}
                        </h1>
                    </div>

                    {/* Scrollable Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '30px' }}>
                        <ul style={{ paddingLeft: '0', listStyle: 'none', margin: 0 }}>
                            {updateChangelog.map((item, idx) => (
                                <li key={idx} style={{
                                    marginBottom: '20px', color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6',
                                    display: 'flex', gap: '12px'
                                }}>
                                    <MdCheckCircle color="#333" size={20} style={{ minWidth: '20px', marginTop: '3px' }} />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '20px 30px', borderTop: '1px solid #1a1a1a', background: '#050505' }}>
                        <button
                            onClick={handleCloseChangelog}
                            style={{
                                width: '100%', padding: '16px', borderRadius: '12px',
                                background: '#fff', color: '#000', fontWeight: '800', border: 'none', fontSize: '1rem',
                                cursor: 'pointer'
                            }}
                        >
                            LET'S GO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UpdateManager;
