import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [step, setStep] = useState('request');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/auth/request-otp', { name, phone });
      setOtpSent(true);
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/auth/verify-otp', { phone, otp });
      const userData = response.data.data.user;
      
      // Check if user is owner (in production, backend should handle this)
      // For now, we'll check after login
      login(userData, response.data.data.token);
      
      // Verify owner role
      const meResponse = await axios.get('/api/auth/me');
      if (meResponse.data.data.role !== 'owner') {
        setError('Access denied. Owner account required.');
        return;
      }
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP or access denied');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Owner Dashboard</h1>
        <p className="subtitle">Login to manage your cafe</p>

        {step === 'request' ? (
          <form onSubmit={handleRequestOTP}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10 digit phone number"
                maxLength="10"
                pattern="[0-9]{10}"
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div className="form-group">
              <label>Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 4-digit OTP"
                maxLength="4"
                required
              />
              {otpSent && (
                <p className="otp-hint">
                  OTP sent to {phone}. Use <strong>1234</strong> for testing.
                </p>
              )}
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setOtp('');
                setError('');
              }}
              className="btn-secondary"
            >
              Change Phone Number
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
