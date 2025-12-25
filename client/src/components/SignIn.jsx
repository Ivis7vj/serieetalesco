import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const SignIn = ({ onToggle, onLogin }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError('Please enter both username and password');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(formData.username, formData.password);
      if (onLogin) onLogin();
      navigate('/'); // Navigate to home on success
    } catch (err) {
      console.error(err);
      setError('Failed to sign in. ' + err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1 className="login-title">Sign In</h1>

      {error && <p className="error-message">{error}</p>}

      <div className="form-group">
        <label>Username or Email</label>
        <input
          type="text"
          name="username"
          placeholder="Enter username or email"
          className="input-field"
          value={formData.username}
          onChange={handleChange}
          autoComplete="username"
          required
        />
      </div>

      <div className="form-group">
        <label>Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            className="input-field"
            placeholder="Enter password"
            style={{ width: '100%', paddingRight: '40px' }}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#888', cursor: 'pointer'
            }}
          >
            {showPassword ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'right', marginBottom: '15px' }}>
        <span className="forgot-link" onClick={() => onToggle('forgot')}>Forgot Password?</span>
      </div>

      <button type="submit" className="submit-button" disabled={loading}>
        {loading ? 'Signing In...' : 'Sign In'}
      </button>

      <div className="divider"></div>

      <p className="toggle-text">
        New to this app?{' '}
        <span className="toggle-link" onClick={() => onToggle('signup')}>
          Sign Up
        </span>
      </p>
    </form>
  );
};

export default SignIn;
