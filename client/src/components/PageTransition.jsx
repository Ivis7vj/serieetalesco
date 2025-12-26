import { motion } from 'framer-motion';
import { useAnimation } from '../context/AnimationContext';
import { useLocation } from 'react-router-dom';

const variants = {
    enter: (direction) => ({
        x: direction === 'right' ? '-100%' : '100%',
        opacity: 0,
        zIndex: 1, // Prepare to be on top
        scale: 1, // Remove scaling for native feel
    }),
    center: {
        x: 0,
        opacity: 1,
        zIndex: 1,
        scale: 1,
        transition: {
            x: { type: "spring", stiffness: 200, damping: 24, mass: 1 }, // Slower, smoother
            opacity: { duration: 0.3 }
        }
    },
    exit: (direction) => ({
        x: direction === 'right' ? '100%' : '-100%',
        opacity: 0,
        zIndex: 0,
        scale: 0.95, // Slight scale down for depth
        transition: {
            x: { type: "spring", stiffness: 200, damping: 24, mass: 1 },
            opacity: { duration: 0.3 }
        }
    })
};

const PageTransition = ({ children }) => {
    const { direction } = useAnimation();
    const location = useLocation();

    return (
        <motion.div
            key={location.pathname}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                backgroundColor: 'var(--bg-primary)' // Ensure background avoids transparency overlap
            }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
