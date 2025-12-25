import { MdClose, MdCheck, MdLock, MdLocalFireDepartment } from 'react-icons/md';
import { useScrollLock } from '../hooks/useScrollLock';
import './StreakActionModal.css';

const StreakActionModal = ({ streak = 0, onClose }) => {
    const [animate, setAnimate] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setAnimate(true), 50);
        return () => clearTimeout(timer);
    }, []);

    useScrollLock(true); // Always locked when this component mounts (it returns null if closed handled by parent)

    // Rewards Configuration
    const rewards = [
        { days: 3, label: 'Poster Unlocked', type: 'poster' },
        { days: 7, label: 'Premium Poster', type: 'premium' },
        { days: 15, label: 'Exclusive Artwork', type: 'art' },
        { days: 30, label: 'Rare Poster', type: 'rare' }
    ];

    // Find next goal
    const nextGoal = rewards.find(r => r.days > streak) || rewards[rewards.length - 1];
    const progressPercent = Math.min(100, (streak / nextGoal.days) * 100);

    return (
        <div className="modal-overlay streak-modal-overlay" onClick={onClose}>
            <div
                className={`modal-content streak-modal-content ${animate ? 'slide-up' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                <button className="close-btn" onClick={onClose}>
                    <MdClose />
                </button>

                <div className="streak-header">
                    <div className="streak-icon-large">
                        <MdLocalFireDepartment />
                    </div>
                    <h2>{streak} Day Streak</h2>
                    <p>Keep watching. Keep earning.</p>
                </div>

                <div className="streak-progress-section">
                    <div className="progress-info">
                        <span>Current Progress</span>
                        <span>{streak} / {nextGoal.days} days</span>
                    </div>
                    <div className="progress-bar-bg">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <p className="next-reward-text">
                        Next reward: <strong>{nextGoal.label}</strong> in {nextGoal.days - streak} days
                    </p>
                </div>

                <div className="rewards-timeline">
                    <h3>Rewards Timeline</h3>
                    <div className="timeline-list">
                        {rewards.map((reward, index) => {
                            const isUnlocked = streak >= reward.days;
                            const isNext = reward === nextGoal;

                            return (
                                <div
                                    key={index}
                                    className={`timeline-item ${isUnlocked ? 'unlocked' : ''} ${isNext ? 'next' : ''}`}
                                >
                                    <div className="timeline-marker">
                                        {isUnlocked ? <MdCheck /> : <MdLock />}
                                    </div>
                                    <div className="timeline-content">
                                        <span className="reward-days">{reward.days} Days</span>
                                        <span className="reward-label">{reward.label}</span>
                                    </div>
                                    {isUnlocked && <div className="glow-dot"></div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button className="primary-action-btn" onClick={onClose}>
                    KEEP IT UP
                </button>
            </div>
        </div>
    );
};

export default StreakActionModal;
