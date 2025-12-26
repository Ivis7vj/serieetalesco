import React from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Watchlist from './pages/Watchlist';
import WatchlistSeason from './pages/WatchlistSeason';
import UserReview from './pages/user_review';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import MovieDetails from './pages/MovieDetails';
import EpisodeDetails from './pages/EpisodeDetails';
import Biography from './pages/Biography';
import Settings from './pages/Settings';
import Followers from './pages/Followers';
import Following from './pages/Following';
import SeriesGraph from './pages/SeriesGraph';
import Friends from './pages/Friends';
import PosterSelection from './pages/PosterSelection';
import DiaryDetail from './pages/DiaryDetail';
import ReviewPage from './pages/ReviewPage';
import SeriesReviewsPage from './pages/SeriesReviewsPage';
import StickerSharePage from './pages/StickerSharePage';

import Search from './pages/Search';
import Layout from './Layout';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import './App.css';

import { ThemeProvider } from './context/ThemeContext';
import { OnboardingProvider } from './context/OnboardingContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { LoadingProvider } from './context/LoadingContext';
import ErrorBoundary from './components/ErrorBoundary';
import Maintenance from './pages/Maintenance';
import OfflineBanner from './components/OfflineBanner';
import SplashScreen from './components/SplashScreen';
import InstallPrompt from './components/InstallPrompt';
import ScrollToTop from './components/ScrollToTop';
import { App as NativeApp } from '@capacitor/app';
import UpdateManager from './components/UpdateManager';
import GlobalErrorAutomation from './components/GlobalErrorAutomation';
import GlobalLoadingOverlay from './components/GlobalLoadingOverlay';
import { AnimationProvider } from './context/AnimationContext';
// Move this inside the App component

import { Capacitor } from '@capacitor/core';
import PremiumLoader from './components/PremiumLoader';

const MAINTENANCE_MODE = false;

// CORRUPTION FIX: Clear any localStorage items that are wrongly stored as "[object Object]"
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const val = localStorage.getItem(key);
    if (val === "[object Object]") {
      console.warn(`Removing corrupted key: ${key}`);
      localStorage.removeItem(key);
    }
  }
} catch (e) { console.error("Storage cleanup failed", e); }

// Auth Gate Component to prevent login page flash
function AuthGate({ children }) {
  const { currentUser, userData, loading } = useAuth(); // Use Global Loading State
  const location = useLocation();

  // Show loader while auth is resolving
  if (loading) {
    return (
      <div style={{ background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PremiumLoader message="Loading..." />
      </div>
    );
  }

  // If user is authenticated and trying to access login, redirect to home
  if (currentUser && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  const location = useLocation();
  const navigate = useNavigate();



  // Handle Native Back Button
  React.useEffect(() => {
    let backButtonListener;
    const setupListener = async () => {
      if (!Capacitor.isNativePlatform()) return;

      backButtonListener = await NativeApp.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          NativeApp.exitApp();
        }
      });
    };
    setupListener();

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
    };
  }, [location, navigate]);

  // SCROLL CLAMP LOGIC: Prevent scrolling if content < viewport
  React.useEffect(() => {
    const checkHeight = () => {
      const appRoot = document.getElementById('app-scroll-container');
      if (!appRoot) return;

      // Auto-toggle overflow based on content height
      if (appRoot.scrollHeight <= appRoot.clientHeight + 1) {
        appRoot.style.overflowY = 'hidden';
      } else {
        appRoot.style.overflowY = 'auto';
      }
    };

    checkHeight();
    const observer = new MutationObserver(checkHeight);
    const appRoot = document.getElementById('app-scroll-container');
    if (appRoot) observer.observe(appRoot, { childList: true, subtree: true });

    window.addEventListener('resize', checkHeight);
    return () => {
      window.removeEventListener('resize', checkHeight);
      observer.disconnect();
    };
  }, [location.pathname]);

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <ThemeProvider>
          <NotificationProvider>
            <OnboardingProvider>
              <AuthProvider>
                <ScrollToTop />
                <OfflineBanner />
                <UpdateManager />
                <GlobalErrorAutomation />
                <InstallPrompt />
                {MAINTENANCE_MODE ? (
                  <Maintenance />
                ) : (
                  <AuthGate>
                    <GlobalLoadingOverlay />
                    <AnimationProvider>
                      <div className="app-root">
                        <Routes>
                          <Route path="/login" element={<Login />} />

                          {/* Public Routes within Layout */}
                          <Route element={<Layout />}>
                            <Route path="/" element={<Home />} />
                            <Route path="/series-graph" element={<SeriesGraph />} />
                            <Route path="/friends" element={<Friends />} />
                            <Route path="/search" element={<Search />} />
                            <Route path="/movie/:id" element={<MovieDetails />} />
                            <Route path="/tv/:id" element={<MovieDetails />} />
                            <Route path="/tv/:id/season/:seasonNumber" element={<MovieDetails />} />
                            <Route path="/tv/:id/season/:seasonNumber/poster" element={<PosterSelection />} />
                            <Route path="/tv/:id/season/:seasonNumber/episode/:episodeNumber" element={<EpisodeDetails />} />
                            <Route path="/person/:id" element={<Biography />} />

                            <Route path="/tv/:id/reviews" element={<SeriesReviewsPage />} />
                            <Route path="/tv/:id/season/:seasonNumber/reviews" element={<SeriesReviewsPage />} />
                            <Route path="/tv/:id/season/:seasonNumber/episode/:episodeNumber/reviews" element={<SeriesReviewsPage />} />
                            <Route path="/movie/:id/reviews" element={<SeriesReviewsPage />} />

                            {/* Protected Routes */}
                            <Route element={<ProtectedRoute />}>
                              <Route path="/watchlist" element={<Watchlist />} />
                              <Route path="/watchlist/season/:seriesId/:seasonNumber" element={<WatchlistSeason />} />
                              <Route path="/reviews" element={<UserReview />} />
                              <Route path="/profile" element={<Profile />} />
                              <Route path="/profile/:uid" element={<Profile />} />
                              <Route path="/edit-profile" element={<EditProfile />} />
                              <Route path="/settings" element={<Settings />} />
                              <Route path="/profile/:uid/followers" element={<Followers />} />
                              <Route path="/profile/:uid/following" element={<Following />} />
                              <Route path="/profile/:uid/followers" element={<Followers />} />
                              <Route path="/profile/:uid/following" element={<Following />} />
                              <Route path="/review/:type/:id" element={<ReviewPage />} />
                              <Route path="/diary/:id" element={<DiaryDetail />} />
                              <Route path="/share-sticker" element={<StickerSharePage />} />
                            </Route>
                          </Route>

                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                      </div>
                    </AnimationProvider>
                  </AuthGate>
                )}
              </AuthProvider>
            </OnboardingProvider>
          </NotificationProvider>
        </ThemeProvider>
      </LoadingProvider>
    </ErrorBoundary>
  );
}

export default App;
