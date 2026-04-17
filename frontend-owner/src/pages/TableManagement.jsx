import { useEffect, useState } from 'react';
import axios from 'axios';
import OwnerLayout from '../components/OwnerLayout';
import './TableManagement.css';

const TableManagement = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchTables = async () => {
    try {
      const res = await axios.get('/api/tables/all');
      setTables(res.data.data || []);
    } catch (err) {
      console.error('Failed to load tables:', err);
      setError('Unable to load tables right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Table name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await axios.post('/api/tables', { name: trimmedName });
      await fetchTables();
      setName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add table.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (table) => {
    setBusyId(table._id);
    setError('');

    try {
      await axios.patch(`/api/tables/${table._id}/active`, {
        active: !table.active,
      });
      await fetchTables();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update table.');
    } finally {
      setBusyId(null);
    }
  };

  const handleFree = async (table) => {
    setBusyId(table._id);
    setError('');

    try {
      await axios.patch(`/api/tables/${table._id}/free`);
      await fetchTables();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to free table.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (table) => {
    if (!window.confirm(`Delete table "${table.name}"?`)) {
      return;
    }

    setBusyId(table._id);
    setError('');

    try {
      await axios.delete(`/api/tables/${table._id}`);
      setTables((prev) => prev.filter((item) => item._id !== table._id));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete table.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <OwnerLayout title="Manage Tables">
      <div className="tm-page">
        <section className="tm-panel">
          <div className="tm-panel-header">
            <div>
              <h2>Add New Table</h2>
              <p>Use names like `A1`, `5`, `T2`, or any short label your staff uses.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="tm-form">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter table name"
              maxLength="20"
            />
            <button type="submit" className="tm-btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add Table'}
            </button>
          </form>

          {error && <div className="tm-error">{error}</div>}
        </section>

        <section className="tm-panel">
          <div className="tm-panel-header">
            <div>
              <h2>All Tables</h2>
              <p>Disable a table to hide it from customer checkout without deleting it.</p>
            </div>
            <span className="tm-count">{tables.length} total</span>
          </div>

          {loading ? (
            <div className="tm-empty">Loading tables…</div>
          ) : tables.length === 0 ? (
            <div className="tm-empty">No tables yet. Add your first table above.</div>
          ) : (
            <div className="tm-grid">
              {tables.map((table) => (
                <article
                  key={table._id}
                  className={`tm-card ${table.active ? 'is-active' : 'is-inactive'}`}
                >
                  <div className="tm-card-top">
                    <div>
                      <div className="tm-table-name">{table.name}</div>
                      <div className={`tm-status ${table.active ? 'active' : 'inactive'}`}>
                        {table.active ? 'Active' : 'Disabled'}
                      </div>
                      <div className={`tm-occupancy ${table.occupied ? 'occupied' : 'free'}`}>
                        {table.occupied
                          ? `Occupied · ${table.occupiedOrder?.orderId || 'Active Order'}`
                          : 'Free'}
                      </div>
                    </div>
                  </div>

                  <div className="tm-actions">
                    <button
                      type="button"
                      className="tm-btn-secondary"
                      onClick={() => handleToggle(table)}
                      disabled={busyId === table._id}
                    >
                      {busyId === table._id
                        ? 'Saving…'
                        : table.active
                          ? 'Disable'
                          : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className="tm-btn-danger"
                      onClick={() => handleDelete(table)}
                      disabled={busyId === table._id}
                    >
                      Delete
                    </button>
                  </div>
                  {table.occupied && (
                    <button
                      type="button"
                      className="tm-btn-warning"
                      onClick={() => handleFree(table)}
                      disabled={busyId === table._id}
                    >
                      {busyId === table._id ? 'Saving…' : 'Free Table'}
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </OwnerLayout>
  );
};

export default TableManagement;
