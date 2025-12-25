import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const ForgotPassword = ({ onToggle }) => {
  const { verifyAndResetPassword } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    dob: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleVerify = async (e) => {
    e.preventDefault();

    if (!formData.username || !formData.dob) {
      setError('Please enter both username and date of birth');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');
      await verifyAndResetPassword(formData.username, formData.dob);
      setMessage('Identity verified. A password reset link has been sent to your registered email.');
      // Optional: Call onSuccess if you want to switch view, but message is better here.
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to verify details. Please check your username and date of birth.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleVerify} className="auth-form">
      <h1 className="login-title">Forgot Password</h1>

      {!message ? (
        <p className="login-subtitle">
          Enter your Username and Date of Birth to reset your password.
        </p>
      ) : (
        <div className="success-message" style={{ color: '#00cc33', marginBottom: '20px', textAlign: 'center' }}>
          {message}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {!message && (
        <>
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              placeholder="Enter your username"
              className="input-field"
              value={formData.username}
              onChange={handleChange}
              autoComplete="username"
              required
            />
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
              required
            />
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Verifying...' : 'Reset Password'}
          </button>
        </>
      )}

      <div className="divider"></div>

      <p className="back-link" onClick={() => onToggle('signin')} style={{ cursor: 'pointer', textAlign: 'center', color: '#888', fontSize: '0.9rem', marginTop: '15px' }}>
        ← Back to Sign In
      </p>
    </form>
  );
};

export default ForgotPassword;
