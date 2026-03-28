import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import './MenuManagement.css';

const AddMenuItem = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: '',
    available: true,
    imageUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.post('/api/menu', {
        ...form,
        price: parseFloat(form.price),
        category: form.category.trim() || 'general',
      });
      navigate('/menu');
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(msgs ? msgs.join(', ') : err.response?.data?.message || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OwnerLayout title="Add Menu Item">
      <div className="mm-add-page">
        <form onSubmit={handleSubmit} className="mm-add-form">
          <div className="mm-field">
            <label>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Masala Chai"
              required
            />
          </div>

          <div className="mm-field-row">
            <div className="mm-field">
              <label>Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="mm-field">
              <label>Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. drinks, food"
              />
            </div>
          </div>

          <div className="mm-field">
            <label>Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="mm-field mm-field-check">
            <label>
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
              />
              Available immediately
            </label>
          </div>

          {error && <div className="mm-error">{error}</div>}

          <div className="mm-add-actions">
            <button type="submit" className="mm-btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Item'}
            </button>
            <button type="button" className="mm-btn-secondary" onClick={() => navigate('/menu')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </OwnerLayout>
  );
};

export default AddMenuItem;
