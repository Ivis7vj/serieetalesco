import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { IoSearchOutline } from 'react-icons/io5';
import './SplashScreen.css'; // Reuse existing styles

const UpdateAnimation = () => {
    const sRef = useRef(null);
    const erieeRef = useRef(null);
    const searchBarRef = useRef(null);
    const logoWrapperRef = useRef(null);

    useEffect(() => {
        const tl = gsap.timeline({
            repeat: -1, // Infinite loop
            repeatDelay: 0.5
        });

        // Use same responsive logic
        const isMobile = window.innerWidth <= 768;
        const searchWidth = isMobile ? 160 : 280;

        // 1. Initial State (Reset for safety)
        tl.addLabel("start")

            // 2. Entrance Animation
            .fromTo([sRef.current, erieeRef.current],
                { autoAlpha: 0, scale: 1 },
                { autoAlpha: 1, duration: 0.1 }
            )
            .fromTo(logoWrapperRef.current,
                { y: 150 },
                { y: 0, duration: 0.6, ease: 'power4.out' },
                "<"
            )

            // 3. 'S' Click Simulation
            .to(sRef.current, {
                scale: 0.9,
                duration: 0.1,
                ease: 'power2.inOut'
            }, "+=0.05")
            .to(sRef.current, {
                scale: 1,
                duration: 0.1,
                ease: 'back.out(2)'
            })

            // 4. Reveal Search Bar
            .fromTo(searchBarRef.current,
                { opacity: 0, width: 0 },
                {
                    opacity: 1,
                    width: searchWidth,
                    duration: 0.3,
                    ease: 'power4.inOut'
                },
                "-=0.05"
            )

            // 5. Reverse Animation & Exit
            .to(searchBarRef.current, {
                opacity: 0,
                width: 0,
                duration: 0.3,
                delay: 0.6,
                ease: 'power4.inOut'
            })
            .to(logoWrapperRef.current, {
                y: -150,
                duration: 0.6,
                ease: 'power4.in'
            });

        return () => tl.kill();
    }, []);

    return (
        // Container style is simpler here - purely for centering, no fixed/fullscreen mess
        <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative' // Ensure absolute children are contained if needed
        }}>
            <div className="splash-content">
                <div className="mask-boundary">
                    <div className="logo-wrapper" ref={logoWrapperRef}>
                        <div className="s-container" ref={sRef}>
                            <span className="logo-s">S</span>
                        </div>

                        <div className="search-bar-revealer" ref={searchBarRef}>
                            <div className="search-bar-mock">
                                <IoSearchOutline className="search-icon-small" />
                                <span className="search-placeholder">Search...</span>
                            </div>
                        </div>

                        <div className="eriee-container" ref={erieeRef}>
                            <span className="logo-eriee">ERIEE</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UpdateAnimation;
