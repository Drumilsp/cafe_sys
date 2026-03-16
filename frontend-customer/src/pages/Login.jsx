import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
  const [step, setStep] = useState('request'); // 'request' or 'verify'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/request-otp', { name, phone });
      setOtpSent(true);
      setStep('verify');
      if (res.data?.otp) {
        setOtp(res.data.otp);
      }
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
      login(response.data.data.user, response.data.data.token);
      
      // Redirect to the page user was trying to access, or menu
      const redirect = searchParams.get('redirect') || '/menu';
      navigate(redirect);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Show redirect message if coming from checkout
  const redirectPath = searchParams.get('redirect');

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Welcome to Cafe</h1>
        <p className="subtitle">Scan QR code to order</p>
        {redirectPath === '/checkout' && (
          <p className="redirect-notice">Please login to proceed with checkout</p>
        )}

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
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                required
              />
              {otpSent && (
                <p className="otp-hint">
                  {otp ? `OTP: ${otp}` : `OTP sent to ${phone}.`}
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
