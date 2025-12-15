import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase-config';
import { doc, getDoc, getDocs, query, collection, where, documentId } from 'firebase/firestore';
import { MdArrowBack, MdPerson } from 'react-icons/md';

const Followers = () => {
    const { uid } = useParams();
    const [followers, setFollowers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFollowers = async () => {
            if (!uid) return;
            try {
                // 1. Get Target User's follower list
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    const ids = userDoc.data().followers || [];

                    if (ids.length > 0) {
                        // 2. Fetch details for these IDs
                        // batch in 10s if needed, or if fetching logic needs optimization
                        // For now, simpler: Promise.all of getDoc (safer for random IDs) OR one query if < 30
                        // 'in' query works for up to 10 items. Promise.all is safer for larger lists.

                        const promises = ids.map(id => getDoc(doc(db, 'users', id)));
                        const docs = await Promise.all(promises);
                        const users = docs.map(d => d.exists() ? { id: d.id, ...d.data() } : null).filter(u => u);
                        setFollowers(users);
                    } else {
                        setFollowers([]);
                    }
                }
            } catch (error) {
                console.error("Error fetching followers:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchFollowers();
    }, [uid]);

    return (
        <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <Link to={`/profile/${uid}`} style={{ color: '#fff', marginRight: '15px' }}><MdArrowBack size={24} /></Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Followers</h1>
            </div>

            {loading ? <p>Loading...</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {followers.map(user => (
                        <Link key={user.id} to={`/profile/${user.id}`} style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none', color: '#fff', padding: '10px', background: '#111', border: '1px solid #333' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: '#333' }}>
                                {user.photoURL ? <img src={user.photoURL} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPerson /></div>}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{user.username || user.email?.split('@')[0]}</div>
                        </Link>
                    ))}
                    {followers.length === 0 && <p style={{ color: '#888' }}>No followers yet.</p>}
                </div>
            )}
        </div>
    );
};

export default Followers;
