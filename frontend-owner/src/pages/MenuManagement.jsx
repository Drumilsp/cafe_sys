import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import './MenuManagement.css';

const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState([]);
  const [tableName, setTableName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    category: 'general',
    available: true,
    imageUrl: '',
  });
  const { logout } = useAuth();

  useEffect(() => {
    fetchMenu();
    fetchTables();
  }, []);

  const fetchMenu = async () => {
    try {
      const response = await axios.get('/api/menu');
      setMenuItems(response.data.data);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const response = await axios.get('/api/tables');
      setTables(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  };

  const handleDelete = async (itemId) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this item?');
    if (!confirmDelete) return;

    try {
      await axios.delete(`/api/menu/${itemId}`);
      fetchMenu();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
      alert('Failed to delete menu item');
    }
  };

  const handleReorder = async (newItems) => {
    setMenuItems(newItems);
    try {
      await axios.put('/api/menu/reorder/all', {
        ids: newItems.map((item) => item._id),
      });
    } catch (error) {
      console.error('Failed to reorder items:', error);
      alert('Failed to reorder items');
      fetchMenu();
    }
  };

  const onDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragOver = (e) => {
    e.preventDefault();
  };

  const onDrop = (e, index) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (Number.isNaN(fromIndex) || fromIndex === index) return;
    const updated = [...menuItems];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(index, 0, moved);
    handleReorder(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await axios.put(`/api/menu/${editingItem._id}`, formData);
      } else {
        await axios.post('/api/menu', formData);
      }
      fetchMenu();
      resetForm();
    } catch (error) {
      console.error('Failed to save menu item:', error);
      alert('Failed to save menu item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
      category: item.category,
      available: item.available,
      imageUrl: item.imageUrl || '',
    });
    setShowForm(true);
  };

  const handleToggleAvailability = async (itemId, currentStatus) => {
    try {
      await axios.patch(`/api/menu/${itemId}/availability`, {
        available: !currentStatus,
      });
      fetchMenu();
    } catch (error) {
      console.error('Failed to toggle availability:', error);
      alert('Failed to update availability');
    }
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    try {
      await axios.post('/api/tables', { name: tableName.trim() });
      setTableName('');
      fetchTables();
    } catch (error) {
      console.error('Failed to add table:', error);
      alert(error.response?.data?.message || 'Failed to add table');
    }
  };

  const handleDeleteTable = async (id) => {
    const confirmDelete = window.confirm('Delete this table?');
    if (!confirmDelete) return;
    try {
      await axios.delete(`/api/tables/${id}`);
      fetchTables();
    } catch (error) {
      console.error('Failed to delete table:', error);
      alert('Failed to delete table');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      price: '',
      category: 'general',
      available: true,
      imageUrl: '',
    });
    setEditingItem(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="menu-management-container">
        <div className="loading">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="menu-management-container">
      <header className="menu-header">
        <div className="header-content">
          <h1>Menu Management</h1>
          <div className="header-actions">
            <Link to="/dashboard" className="nav-link">Dashboard</Link>
            <button onClick={logout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <div className="container">
        <div className="menu-actions">
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancel' : 'Add New Item'}
          </button>
        </div>

        <div className="tables-section">
          <h2 className="section-title">Tables</h2>
          <form onSubmit={handleAddTable} className="menu-form">
            <div className="form-row">
              <div className="form-group">
                <label>Table Name / Number</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="e.g. 1, 2, A1"
                />
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Add Table
              </button>
            </div>
          </form>
          <div className="menu-list">
            {tables.length === 0 ? (
              <div className="empty-state">No tables configured yet.</div>
            ) : (
              <table className="menu-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tables.map((table) => (
                    <tr key={table._id}>
                      <td>{table.name}</td>
                      <td>
                        <button
                          type="button"
                          className="delete-btn"
                          onClick={() => handleDeleteTable(table._id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="menu-form">
            <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Price (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., drinks, food, snacks"
                />
              </div>
              <div className="form-group">
                <label>Image URL</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.available}
                  onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                />
                Available
              </label>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                {editingItem ? 'Update' : 'Add'} Item
              </button>
              {editingItem && (
                <button type="button" onClick={resetForm} className="btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}

        <div className="menu-list">
          {menuItems.length === 0 ? (
            <div className="empty-state">No menu items. Add your first item!</div>
          ) : (
            <table className="menu-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menuItems.map((item, index) => (
                  <tr
                    key={item._id}
                    draggable
                    onDragStart={(e) => onDragStart(e, index)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, index)}
                    className="draggable-row"
                  >
                    <td>
                      <span className="drag-handle">⋮⋮</span>
                    </td>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>₹{item.price}</td>
                    <td>
                      <span className={`status ${item.available ? 'available' : 'unavailable'}`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          onClick={() => handleToggleAvailability(item._id, item.available)}
                          className="toggle-btn"
                        >
                          {item.available ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => handleEdit(item)} className="edit-btn">
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item._id)}
                          className="delete-btn"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MenuManagement;
