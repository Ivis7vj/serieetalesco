import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { MdArrowBack, MdPerson } from 'react-icons/md';

const Following = () => {
    const { uid } = useParams();
    const [following, setFollowing] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFollowing = async () => {
            if (!uid) return;
            try {
                // 1. Get Target User's following list
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const ids = userDoc.data().following || [];

                    if (ids.length > 0) {
                        const promises = ids.map(id => getDoc(doc(db, 'users', id)));
                        const docs = await Promise.all(promises);
                        const users = docs.map(d => d.exists() ? { id: d.id, ...d.data() } : null).filter(u => u);
                        setFollowing(users);
                    } else {
                        setFollowing([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching following:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFollowing();
    }, [uid]);

    return (
        <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <Link to={`/profile/${uid}`} style={{ color: '#fff', marginRight: '15px' }}><MdArrowBack size={24} /></Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Following</h1>
            </div>

            {loading ? <p>Loading...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {following.map(user => (
                        <Link key={user.id} to={`/profile/${user.id}`} style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none', color: '#fff', padding: '10px', background: '#111', border: '1px solid #333' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: '#333' }}>
                                {user.photoURL ? <img src={user.photoURL} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPerson /></div>}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{user.username || user.email?.split('@')[0]}</div>
                        </Link>
                    ))}
                    {following.length === 0 && <p style={{ color: '#888' }}>No users followed.</p>}
                </div>
            )}
        </div>
    );
};

export default Following;
