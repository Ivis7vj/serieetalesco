import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Watchlist from './pages/Watchlist';
import UserReview from './pages/user_review';
import Profile from './pages/Profile';
import EditProfile from './pages/EditProfile';
import MovieDetails from './pages/MovieDetails';
import EpisodeDetails from './pages/EpisodeDetails';
import Biography from './pages/Biography';
import Settings from './pages/Settings';
import Followers from './pages/Followers';
import Following from './pages/Following';
import News from './pages/News';
import Friends from './pages/Friends';

import Search from './pages/Search';
import Layout from './Layout';
import ProtectedRoute from './components/ProtectedRoute'; // Import ProtectedRoute
import './App.css';

import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';

import { AuthProvider } from './context/AuthContext';

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Public Routes within Layout */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/news" element={<News />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/search" element={<Search />} />
                <Route path="/movie/:id" element={<MovieDetails />} />
                <Route path="/tv/:id" element={<MovieDetails />} />
                <Route path="/tv/:id/season/:seasonNumber" element={<MovieDetails />} />
                <Route path="/tv/:id/season/:seasonNumber/episode/:episodeNumber" element={<EpisodeDetails />} />
                <Route path="/person/:id" element={<Biography />} />

                {/* Protected Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/watchlist" element={<Watchlist />} />
                  <Route path="/reviews" element={<UserReview />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:uid" element={<Profile />} />
                  <Route path="/edit-profile" element={<EditProfile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/profile/:uid/followers" element={<Followers />} />
                  <Route path="/profile/:uid/following" element={<Following />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
