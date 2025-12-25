import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const SignUp = ({ onToggle, onSuccess }) => {
  const { signup, checkUsernameAvailability } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    dob: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ level: 'Weak', color: '#ff4444' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (e.target.name === 'password') {
      checkStrength(e.target.value);
    }
    setError('');
  };

  const checkStrength = (pass) => {
    let score = 0;
    if (pass.length > 6) score++;
    if (pass.length > 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    // Sequence check (Simple)
    if (pass.includes('123') || pass.includes('abc') || pass.includes('qwerty')) score -= 2;

    let level = 'Weak';
    let color = '#ff4444'; // Red

    if (score > 3) {
      level = 'Moderate';
      color = '#FFCC00'; // Yellow
    }
    if (score >= 5) {
      level = 'Strong';
      color = '#00cc33'; // Green
    }

    if (pass.length < 1) {
      level = '';
      color = 'transparent';
    }

    setPasswordStrength({ level, color });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.email || !formData.password || !formData.dob) {
      setError('All fields are required');
      return;
    }

    const age = new Date().getFullYear() - new Date(formData.dob).getFullYear();
    if (age < 15) {
      setError('You must be at least 15 years old to create an account');
      return;
    }

    // Basic validation
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    try {
      setError('');
      setLoading(true);

      // Unique Username Check
      const isAvailable = await checkUsernameAvailability(formData.username);
      if (!isAvailable) {
        setLoading(false);
        return setError('Username is already taken');
      }

      await signup(formData.email, formData.password, { dob: formData.dob, username: formData.username });
      onSuccess('Account created successfully! Please sign in to continue.');
    } catch (err) {
      console.error(err);
      setError('Failed to create an account. ' + err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h1 className="login-title">Sign Up</h1>

      {error && <p className="error-message">{error}</p>}

      <div className="form-group">
        <label>Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
          className="input-field"
          placeholder="Choose a username"
          autoComplete="username"
        />
      </div>

      <div className="form-group">
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          className="input-field"
          placeholder="Enter your email"
          autoComplete="email"
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
            placeholder="Create a password"
            style={{ width: '100%', paddingRight: '40px' }}
            autoComplete="new-password"
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
        {formData.password && (
          <div style={{ marginTop: '5px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Strength:</span>
            <div style={{
              padding: '2px 8px', borderRadius: '4px',
              background: passwordStrength.color, color: '#000', fontWeight: 'bold'
            }}>
              {passwordStrength.level}
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Date of Birth</label>
        <input
          type="date"
          name="dob"
          placeholder="Date of Birth"
          className="input-field"
          value={formData.dob}
          onChange={handleChange}
          max={new Date().toISOString().split('T')[0]}
        />
      </div>

      <button type="submit" className="submit-button" disabled={loading}>
        {loading ? 'Creating Account...' : 'Create Account'}
      </button>

      <div className="divider"></div>

      <p className="toggle-text">
        Already have an account?{' '}
        <span className="toggle-link" onClick={() => onToggle('signin')}>
          Sign In
        </span>
      </p>
    </form>
  );
};

export default SignUp;
