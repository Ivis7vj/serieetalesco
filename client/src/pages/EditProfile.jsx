import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaInstagram, FaTwitter } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase-config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import './Home.css';
import { triggerErrorAutomation } from '../utils/errorAutomation';

const EditProfile = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [instaLink, setInstaLink] = useState('');
    const [twitterLink, setTwitterLink] = useState('');

    useEffect(() => {
        if (!currentUser) return;
        const fetchUserData = async () => {
            const userRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const data = userSnap.data();
                setUsername(data.username || '');
                setBio(data.bio || '');
                setInstaLink(data.instaLink || '');
                setTwitterLink(data.twitterLink || '');
            }
        };
        fetchUserData();
    }, [currentUser]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                username,
                bio,
                instaLink,
                twitterLink
            });
            navigate('/profile');
        } catch (error) {
            triggerErrorAutomation(error);
        }
    };

    return (
        <div className="section" style={{ maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
            <h2 className="section-title" style={{ marginBottom: '2rem' }}>Edit Profile</h2>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: '#999', fontSize: '0.9rem' }}>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        style={{ background: '#111', border: '1px solid #333', padding: '10px', color: '#fff', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: '#999', fontSize: '0.9rem' }}>Bio</label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows="4"
                        style={{ background: '#111', border: '1px solid #333', padding: '10px', color: '#fff', outline: 'none', resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: '#999', fontSize: '0.9rem' }}>Social Links</label>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', border: '1px solid #333', padding: '0 10px' }}>
                        <FaInstagram style={{ color: '#999' }} />
                        <input
                            type="text"
                            placeholder="Instagram Profile URL"
                            value={instaLink}
                            onChange={(e) => setInstaLink(e.target.value)}
                            style={{ background: 'transparent', border: 'none', padding: '10px 0', color: '#fff', outline: 'none', flex: 1 }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', border: '1px solid #333', padding: '0 10px' }}>
                        <FaTwitter style={{ color: '#999' }} />
                        <input
                            type="text"
                            placeholder="X (Twitter) Profile URL"
                            value={twitterLink}
                            onChange={(e) => setTwitterLink(e.target.value)}
                            style={{ background: 'transparent', border: 'none', padding: '10px 0', color: '#fff', outline: 'none', flex: 1 }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ border: 'none' }}>Save Changes</button>
                    <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid #333', color: '#fff' }} onClick={() => navigate('/profile')}>Cancel</button>
                </div>

            </form>
        </div>
    );
};

export default EditProfile;
