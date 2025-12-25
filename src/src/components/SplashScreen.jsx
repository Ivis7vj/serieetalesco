import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { IoSearchOutline } from 'react-icons/io5';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
    const containerRef = useRef(null);
    const sRef = useRef(null);
    const erieeRef = useRef(null);
    const searchBarRef = useRef(null);
    const logoWrapperRef = useRef(null);

    useEffect(() => {
        const tl = gsap.timeline({
            onComplete: () => {
                if (onComplete) {
                    gsap.to(containerRef.current, {
                        opacity: 0,
                        duration: 0.4,
                        ease: 'power2.inOut',
                        onComplete: onComplete
                    });
                }
            }
        });

        const isMobile = window.innerWidth <= 768;
        const searchWidth = isMobile ? 160 : 280;

        // 1. Initial State
        gsap.set(logoWrapperRef.current, { y: 150 });
        gsap.set([sRef.current, erieeRef.current], { autoAlpha: 0, scale: 1 });
        gsap.set(searchBarRef.current, { opacity: 0, width: 0 });

        // 2. Entrance Animation
        tl.to([sRef.current, erieeRef.current], {
            autoAlpha: 1,
            duration: 0.1
        })
            .to(logoWrapperRef.current, {
                y: 0,
                duration: 0.6,
                ease: 'power4.out'
            })

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
            .to(searchBarRef.current, {
                opacity: 1,
                width: searchWidth,
                duration: 0.3,
                ease: 'power4.inOut'
            }, "-=0.05")

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
    }, [onComplete]);

    return (
        <div className="splash-container" ref={containerRef}>
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
            {/* Scanline effect is handled in CSS */}
        </div>
    );
};

export default SplashScreen;
