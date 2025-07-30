import React from 'react';
import { Navbar as BSNavbar, Nav, Container, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { isAuthenticated, user, logout, isDriver } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <BSNavbar bg="light" expand="lg" className="navbar-custom">
      <Container>
        <BSNavbar.Brand as={Link} to="/" className="navbar-brand-custom">
          🚗 UberClone
        </BSNavbar.Brand>
        
        <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
        
        <BSNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {isAuthenticated && (
              <>
                <Nav.Link as={Link} to="/dashboard" className="nav-link-custom">
                  Dashboard
                </Nav.Link>
                <Nav.Link as={Link} to="/request-ride" className="nav-link-custom">
                  Request Ride
                </Nav.Link>
                {isDriver && (
                  <Nav.Link as={Link} to="/driver-dashboard" className="nav-link-custom">
                    Driver Dashboard
                  </Nav.Link>
                )}
                <Nav.Link as={Link} to="/ride-history" className="nav-link-custom">
                  Ride History
                </Nav.Link>
              </>
            )}
          </Nav>
          
          <Nav>
            {isAuthenticated ? (
              <NavDropdown
                title={
                  <span>
                    👤 {user?.first_name} {user?.last_name}
                    {user?.user_type === 'both' && (
                      <Badge bg="info" className="ms-2">Driver</Badge>
                    )}
                    {user?.user_type === 'driver' && (
                      <Badge bg="success" className="ms-2">Driver</Badge>
                    )}
                  </span>
                }
                id="user-dropdown"
                align="end"
              >
                <NavDropdown.Item as={Link} to="/profile">
                  My Profile
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/ride-history">
                  Ride History
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <>
                <Nav.Link as={Link} to="/login" className="nav-link-custom">
                  Login
                </Nav.Link>
                <Nav.Link as={Link} to="/register" className="nav-link-custom">
                  Sign Up
                </Nav.Link>
              </>
            )}
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
};

export default Navbar;