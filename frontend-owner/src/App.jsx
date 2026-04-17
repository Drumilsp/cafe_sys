import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import AddMenuItem from './pages/AddMenuItem';
import TableManagement from './pages/TableManagement';
import ManualOrder from './pages/ManualOrder';
import OrderHistory from './pages/OrderHistory';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu"
              element={
                <ProtectedRoute>
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/menu/add"
              element={
                <ProtectedRoute>
                  <AddMenuItem />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tables"
              element={
                <ProtectedRoute>
                  <TableManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manual-order"
              element={
                <ProtectedRoute>
                  <ManualOrder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <OrderHistory />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
