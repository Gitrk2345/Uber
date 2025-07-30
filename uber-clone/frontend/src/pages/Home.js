import React from 'react';
import { Container, Row, Col, Button, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: '🚗',
      title: 'Quick Rides',
      description: 'Get a ride in minutes with our extensive network of drivers.'
    },
    {
      icon: '💰',
      title: 'Affordable Prices',
      description: 'Transparent pricing with no hidden fees. Know your fare upfront.'
    },
    {
      icon: '🛡️',
      title: 'Safe & Secure',
      description: 'All drivers are background checked and rides are tracked in real-time.'
    },
    {
      icon: '⭐',
      title: 'Highly Rated',
      description: 'Our drivers maintain high ratings to ensure quality service.'
    },
    {
      icon: '🕒',
      title: '24/7 Available',
      description: 'Get rides anytime, anywhere. We operate round the clock.'
    },
    {
      icon: '📱',
      title: 'Easy to Use',
      description: 'Simple and intuitive app interface for seamless booking.'
    }
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <Container>
          <Row className="align-items-center min-vh-75">
            <Col lg={6} className="hero-content">
              <h1 className="hero-title fade-in">
                Your Ride, Your Way
              </h1>
              <p className="hero-subtitle fade-in">
                Experience the future of transportation with UberClone. 
                Fast, reliable, and affordable rides at your fingertips.
              </p>
              <div className="d-flex gap-3 flex-wrap">
                {isAuthenticated ? (
                  <>
                    <Button 
                      as={Link} 
                      to="/request-ride" 
                      className="btn-primary-custom"
                      size="lg"
                    >
                      Book a Ride
                    </Button>
                    <Button 
                      as={Link} 
                      to="/dashboard" 
                      className="btn-outline-custom"
                      size="lg"
                    >
                      Go to Dashboard
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      as={Link} 
                      to="/register" 
                      className="btn-primary-custom"
                      size="lg"
                    >
                      Get Started
                    </Button>
                    <Button 
                      as={Link} 
                      to="/login" 
                      className="btn-outline-custom"
                      size="lg"
                    >
                      Sign In
                    </Button>
                  </>
                )}
              </div>
            </Col>
            <Col lg={6} className="text-center">
              <div className="hero-image">
                <div style={{ fontSize: '15rem', opacity: 0.8 }}>🚕</div>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-5">
        <Container>
          <Row className="text-center mb-5">
            <Col>
              <h2 className="display-5 fw-bold mb-3">Why Choose UberClone?</h2>
              <p className="lead text-muted">
                We provide the best ride-hailing experience with modern technology and reliable service.
              </p>
            </Col>
          </Row>
          
          <Row>
            {features.map((feature, index) => (
              <Col md={6} lg={4} key={index} className="mb-4">
                <Card className="feature-card h-100">
                  <Card.Body className="text-center">
                    <div className="feature-icon">
                      {feature.icon}
                    </div>
                    <Card.Title className="h5 mb-3">{feature.title}</Card.Title>
                    <Card.Text className="text-muted">
                      {feature.description}
                    </Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-5 bg-primary text-white">
        <Container>
          <Row className="text-center">
            <Col>
              <h2 className="display-6 fw-bold mb-3">Ready to Get Started?</h2>
              <p className="lead mb-4">
                Join millions of users who trust UberClone for their daily transportation needs.
              </p>
              {!isAuthenticated && (
                <div className="d-flex gap-3 justify-content-center flex-wrap">
                  <Button 
                    as={Link} 
                    to="/register" 
                    variant="light" 
                    size="lg"
                    className="px-4"
                  >
                    Sign Up as Rider
                  </Button>
                  <Button 
                    as={Link} 
                    to="/register" 
                    variant="outline-light" 
                    size="lg"
                    className="px-4"
                  >
                    Become a Driver
                  </Button>
                </div>
              )}
            </Col>
          </Row>
        </Container>
      </section>

      {/* Footer */}
      <footer className="bg-dark text-light py-4">
        <Container>
          <Row>
            <Col md={6}>
              <h5>🚗 UberClone</h5>
              <p className="text-muted">
                The most reliable ride-hailing platform built with modern technology.
              </p>
            </Col>
            <Col md={3}>
              <h6>Quick Links</h6>
              <ul className="list-unstyled">
                <li><Link to="/" className="text-muted text-decoration-none">Home</Link></li>
                <li><Link to="/login" className="text-muted text-decoration-none">Login</Link></li>
                <li><Link to="/register" className="text-muted text-decoration-none">Sign Up</Link></li>
              </ul>
            </Col>
            <Col md={3}>
              <h6>Contact</h6>
              <p className="text-muted mb-1">📧 support@uberclone.com</p>
              <p className="text-muted mb-1">📞 +1 (555) 123-4567</p>
            </Col>
          </Row>
          <hr className="text-muted" />
          <Row>
            <Col className="text-center">
              <p className="text-muted mb-0">
                © 2024 UberClone. All rights reserved.
              </p>
            </Col>
          </Row>
        </Container>
      </footer>
    </div>
  );
};

export default Home;