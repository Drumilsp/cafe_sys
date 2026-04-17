import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import './MenuManagement.css';

const CATEGORIES_ALL = 'All';

const EditModal = ({ item, onClose, onSaved }) => {
  const [form, setForm] = useState({
    name: item.name,
    price: item.price.toString(),
    category: item.category || 'general',
    available: item.available,
    isVeg: item.isVeg !== false,
    imageUrl: item.imageUrl || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.put(`/api/menu/${item._id}`, {
        ...form,
        price: parseFloat(form.price),
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mm-modal-overlay" onClick={onClose}>
      <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mm-modal-header">
          <h2>Edit Item</h2>
          <button className="mm-modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="mm-modal-form">
          <div className="mm-field">
            <label>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
          <div className="mm-field">
            <label>Food Type</label>
            <select
              value={form.isVeg ? 'veg' : 'nonveg'}
              onChange={(e) => setForm({ ...form, isVeg: e.target.value === 'veg' })}
            >
              <option value="veg">Veg</option>
              <option value="nonveg">Non-Veg</option>
            </select>
          </div>
          <div className="mm-field mm-field-check">
            <label>
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
              />
              Available
            </label>
          </div>
          {error && <div className="mm-error">{error}</div>}
          <div className="mm-modal-actions">
            <button type="button" className="mm-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="mm-btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(CATEGORIES_ALL);
  const [editingItem, setEditingItem] = useState(null);
  const [togglingId, setTogglingId] = useState(null);
  const [togglingCategory, setTogglingCategory] = useState(null);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await axios.get('/api/menu');
      setMenuItems(res.data.data);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMenu(); }, [fetchMenu]);

  const categories = [CATEGORIES_ALL, ...Array.from(new Set(menuItems.map((i) => i.category || 'general')))];

  const filtered = menuItems.filter((item) => {
    const matchCat = activeCategory === CATEGORIES_ALL || (item.category || 'general') === activeCategory;
    const term = search.trim().toLowerCase();
    const matchSearch = !term || item.name.toLowerCase().includes(term);
    return matchCat && matchSearch;
  });

  const handleToggle = async (item) => {
    setTogglingId(item._id);
    try {
      await axios.patch(`/api/menu/${item._id}/availability`, { available: !item.available });
      setMenuItems((prev) => prev.map((i) => i._id === item._id ? { ...i, available: !i.available } : i));
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    try {
      await axios.delete(`/api/menu/${item._id}`);
      setMenuItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Failed to delete item');
    }
  };

  const handleCategoryToggle = async (category, available) => {
    setTogglingCategory(category);
    try {
      await axios.patch(`/api/menu/category/${encodeURIComponent(category)}/availability`, { available });
      setMenuItems((prev) =>
        prev.map((item) =>
          (item.category || 'general') === category ? { ...item, available } : item
        )
      );
    } catch (err) {
      console.error('Failed to toggle category availability:', err);
      alert('Failed to update category');
    } finally {
      setTogglingCategory(null);
    }
  };

  const handleDragStart = (e, index) => e.dataTransfer.setData('text/plain', index.toString());
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = async (e, toIndex) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(fromIndex) || fromIndex === toIndex) return;
    const updated = [...menuItems];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setMenuItems(updated);
    try {
      await axios.put('/api/menu/reorder/all', { ids: updated.map((i) => i._id) });
    } catch (err) {
      console.error('Reorder failed:', err);
      fetchMenu();
    }
  };

  // Group filtered items by category for display
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <OwnerLayout title="Manage Menu">
        <div className="mm-loading">Loading menu…</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout title="Manage Menu">
      <div className="mm-toolbar">
        <input
          className="mm-search"
          type="text"
          placeholder="Search items…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Link to="/menu/add" className="mm-btn-primary mm-add-link">+ Add Item</Link>
      </div>

      <div className="mm-cat-pills">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`mm-cat-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mm-empty">
          {search ? `No items matching "${search}"` : 'No items yet. Add your first item!'}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <section key={cat} className="mm-category-section">
            <div className="mm-category-head">
              <h2 className="mm-category-label">{cat.charAt(0).toUpperCase() + cat.slice(1)}</h2>
              <button
                type="button"
                className={`mm-category-toggle ${items.every((item) => item.available) ? '' : 'disabled'}`}
                disabled={togglingCategory === cat}
                onClick={() => handleCategoryToggle(cat, !items.every((item) => item.available))}
              >
                {togglingCategory === cat
                  ? 'Saving…'
                  : items.every((item) => item.available)
                    ? 'Disable Category'
                    : 'Enable Category'}
              </button>
            </div>
            <div className="mm-item-grid">
              {items.map((item, idx) => {
                const globalIdx = menuItems.findIndex((m) => m._id === item._id);
                return (
                  <div
                    key={item._id}
                    className={`mm-item-card ${!item.available ? 'unavailable' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, globalIdx)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, globalIdx)}
                  >
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="mm-item-img" />
                    ) : (
                      <div className="mm-item-img mm-item-img-placeholder">🍽</div>
                    )}
                    <div className="mm-item-body">
                      <div className="mm-item-name">{item.name}</div>
                      <div className="mm-item-price">₹{item.price}</div>
                      <div className="mm-item-cat-tag">{item.category || 'general'}</div>
                    </div>
                    <div className="mm-item-footer">
                      <label className="mm-toggle" title={item.available ? 'Disable' : 'Enable'}>
                        <input
                          type="checkbox"
                          checked={item.available}
                          disabled={togglingId === item._id}
                          onChange={() => handleToggle(item)}
                        />
                        <span className="mm-toggle-track">
                          <span className="mm-toggle-thumb" />
                        </span>
                        <span className={`mm-avail-label ${item.available ? 'on' : 'off'}`}>
                          {item.available ? 'Available' : 'Unavailable'}
                        </span>
                      </label>
                      <div className="mm-item-actions">
                        <button className="mm-edit-btn" onClick={() => setEditingItem(item)}>Edit</button>
                        <button className="mm-delete-btn" onClick={() => handleDelete(item)}>Delete</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={() => { setEditingItem(null); fetchMenu(); }}
        />
      )}
    </OwnerLayout>
  );
};

export default MenuManagement;
