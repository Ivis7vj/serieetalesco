import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase-config';
import { useLoading } from '../context/LoadingContext';
import { doc, getDoc } from 'firebase/firestore';
import { MdArrowBack, MdPerson } from 'react-icons/md';

const Followers = () => {
    const { uid } = useParams();
    const [allIds, setAllIds] = useState([]);
    const [displayedUsers, setDisplayedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const { stopLoading } = useLoading();
    const BATCH_SIZE = 20;

    useEffect(() => {
        let isMounted = true;

        const fetchFollowers = async () => {
            if (!uid) return;
            try {
                // 1. Get Target User's follower list
                const userDoc = await getDoc(doc(db, 'users', uid));
                if (userDoc.exists()) {
                    let ids = userDoc.data().followers || [];

                    // Deduplicate IDs to save storage/reads
                    const uniqueIds = [...new Set(ids)];
                    if (uniqueIds.length !== ids.length) {
                        try {
                            await import('firebase/firestore').then(({ updateDoc }) =>
                                updateDoc(doc(db, 'users', uid), { followers: uniqueIds })
                            );
                            console.log("Cleaned up duplicate followers in DB");
                        } catch (err) {
                            console.error("Failed to cleanup duplicates:", err);
                        }
                        ids = uniqueIds;
                    }

                    setAllIds(ids); // Store full list of IDs

                    // 2. Fetch Initial Batch
                    if (ids.length > 0 && isMounted) {
                        await fetchBatch(ids.slice(0, BATCH_SIZE));
                    }
                }
            } catch (error) {
                console.error("Error fetching followers:", error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                    stopLoading();
                }
            }
        };

        // Reset state on uid change
        setDisplayedUsers([]);
        setAllIds([]);
        setLoading(true);

        fetchFollowers();

        return () => {
            isMounted = false;
        };
    }, [uid]);

    const fetchBatch = async (batchIds) => {
        const promises = batchIds.map(id => getDoc(doc(db, 'users', id)));
        const docs = await Promise.all(promises);
        const users = docs.map(d => d.exists() ? { id: d.id, ...d.data() } : null).filter(u => u);
        setDisplayedUsers(prev => {
            // Safety check to prevent duplicates if race condition occurred
            const existingIds = new Set(prev.map(u => u.id));
            const newUsers = users.filter(u => !existingIds.has(u.id));
            return [...prev, ...newUsers];
        });
    };

    const handleLoadMore = async () => {
        if (loadingMore) return;
        setLoadingMore(true);
        const nextBatch = allIds.slice(displayedUsers.length, displayedUsers.length + BATCH_SIZE);
        await fetchBatch(nextBatch);
        setLoadingMore(false);
    };

    return (
        <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <Link to={`/profile/${uid}`} style={{ color: '#fff', marginRight: '15px' }}><MdArrowBack size={24} /></Link>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', margin: 0 }}>Followers</h1>
            </div>

            {loading ? null : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {displayedUsers.map(user => (
                        <Link key={user.id} to={`/profile/${user.id}`} style={{ display: 'flex', alignItems: 'center', gap: '15px', textDecoration: 'none', color: '#fff', padding: '10px', background: '#111', border: '1px solid #333' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', overflow: 'hidden', background: '#333' }}>
                                {user.photoURL ? <img src={user.photoURL} alt={user.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><MdPerson /></div>}
                            </div>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{user.username || user.email?.split('@')[0]}</div>
                        </Link>
                    ))}
                    {displayedUsers.length === 0 && <p style={{ color: '#FFD600' }}>No followers yet.</p>}

                    {/* Load More Button */}
                    {displayedUsers.length < allIds.length && (
                        <button
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                            style={{
                                marginTop: '20px',
                                padding: '12px',
                                background: '#222',
                                color: '#fff',
                                border: '1px solid #444',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                            }}
                        >
                            {loadingMore ? 'Loading...' : 'LOAD MORE'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default Followers;
