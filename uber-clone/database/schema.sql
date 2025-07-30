-- Uber Clone Database Schema

CREATE DATABASE IF NOT EXISTS uber_clone;
USE uber_clone;

-- Users table (both riders and drivers)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(500),
    user_type ENUM('rider', 'driver', 'both') DEFAULT 'rider',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Driver details table
CREATE TABLE drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_year YEAR,
    vehicle_color VARCHAR(30),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type ENUM('economy', 'comfort', 'premium', 'suv') DEFAULT 'economy',
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INT DEFAULT 0,
    is_available BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rides table
CREATE TABLE rides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rider_id INT NOT NULL,
    driver_id INT,
    pickup_address VARCHAR(500) NOT NULL,
    pickup_lat DECIMAL(10,8) NOT NULL,
    pickup_lng DECIMAL(11,8) NOT NULL,
    destination_address VARCHAR(500) NOT NULL,
    destination_lat DECIMAL(10,8) NOT NULL,
    destination_lng DECIMAL(11,8) NOT NULL,
    ride_type ENUM('economy', 'comfort', 'premium', 'suv') DEFAULT 'economy',
    status ENUM('requested', 'accepted', 'in_progress', 'completed', 'cancelled') DEFAULT 'requested',
    fare_amount DECIMAL(10,2),
    distance_km DECIMAL(8,2),
    duration_minutes INT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    rating INT CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Payments table
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('cash', 'card', 'wallet') DEFAULT 'card',
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    transaction_id VARCHAR(100),
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE
);

-- Ratings table
CREATE TABLE ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    rater_id INT NOT NULL,
    rated_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rated_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('ride_request', 'ride_accepted', 'ride_started', 'ride_completed', 'payment', 'general') DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    related_ride_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_ride_id) REFERENCES rides(id) ON DELETE SET NULL
);

-- Promo codes table
CREATE TABLE promo_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
    discount_value DECIMAL(8,2) NOT NULL,
    min_ride_amount DECIMAL(8,2) DEFAULT 0,
    max_discount DECIMAL(8,2),
    usage_limit INT DEFAULT 1,
    used_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User promo usage tracking
CREATE TABLE user_promo_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    promo_code_id INT NOT NULL,
    ride_id INT NOT NULL,
    discount_applied DECIMAL(8,2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id) ON DELETE CASCADE,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_promo (user_id, promo_code_id)
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_drivers_available ON drivers(is_available);
CREATE INDEX idx_drivers_location ON drivers(current_lat, current_lng);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_rider ON rides(rider_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_requested ON rides(requested_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);

-- Insert sample data
INSERT INTO users (email, password_hash, first_name, last_name, phone, user_type) VALUES
('john.rider@example.com', '$2b$10$hashedpassword', 'John', 'Doe', '+1234567890', 'rider'),
('jane.driver@example.com', '$2b$10$hashedpassword', 'Jane', 'Smith', '+1234567891', 'driver'),
('mike.both@example.com', '$2b$10$hashedpassword', 'Mike', 'Johnson', '+1234567892', 'both');

INSERT INTO drivers (user_id, license_number, license_expiry, vehicle_make, vehicle_model, vehicle_year, vehicle_color, license_plate, vehicle_type, current_lat, current_lng, is_available) VALUES
(2, 'DL123456789', '2026-12-31', 'Toyota', 'Camry', 2020, 'Silver', 'ABC123', 'comfort', 37.7749, -122.4194, TRUE),
(3, 'DL987654321', '2025-12-31', 'Honda', 'Civic', 2019, 'Black', 'XYZ789', 'economy', 37.7849, -122.4094, TRUE);

INSERT INTO promo_codes (code, description, discount_type, discount_value, min_ride_amount, max_discount, usage_limit, valid_until) VALUES
('WELCOME20', 'Welcome bonus - 20% off first ride', 'percentage', 20.00, 10.00, 10.00, 1, '2024-12-31 23:59:59'),
('SAVE5', '$5 off any ride', 'fixed', 5.00, 15.00, 5.00, 100, '2024-12-31 23:59:59');