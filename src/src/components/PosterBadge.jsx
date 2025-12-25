import React from 'react';
import { IoMdStar } from "react-icons/io";

const PosterBadge = ({ style = {} }) => {
    return (
        <div className="poster-badge" style={{
            position: 'absolute',
            top: '-20px',    // Overhang Top
            left: '-20px',   // Overhang Left
            zIndex: 10,      // On top of poster
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            width: '50px',   // Medium Size
            height: '50px',
            ...style
        }}>
            <IoMdStar
                style={{
                    width: '100%',
                    height: '100%',
                    color: 'black', // Filled Black
                    overflow: 'visible'
                }}
                stroke="white"
                strokeWidth="20" // White Border (Ionicons are usually 512 units, 20 is ~2px visual)
            />
        </div>
    );
};

export default PosterBadge;
