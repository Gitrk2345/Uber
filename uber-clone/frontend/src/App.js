import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RideRequest from './pages/RideRequest';
import DriverDashboard from './pages/DriverDashboard';
import RideHistory from './pages/RideHistory';
import Profile from './pages/Profile';
import { Container } from 'react-bootstrap';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <div className="App">
            <Navbar />
            <Container fluid className="p-0">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/request-ride"
                  element={
                    <ProtectedRoute>
                      <RideRequest />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/driver-dashboard"
                  element={
                    <ProtectedRoute requiredRole="driver">
                      <DriverDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ride-history"
                  element={
                    <ProtectedRoute>
                      <RideHistory />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Container>
          </div>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
