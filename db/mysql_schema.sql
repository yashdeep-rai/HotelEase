-- MySQL schema for HotelEase
-- Create a dedicated database and user first (run as root or admin):
--
-- CREATE DATABASE hotel_ease;
-- CREATE USER 'hotel_user'@'localhost' IDENTIFIED BY 'strong_password';
-- GRANT ALL PRIVILEGES ON hotel_ease.* TO 'hotel_user'@'localhost';
-- FLUSH PRIVILEGES;

USE hotel_ease;

CREATE TABLE room (
  room_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL UNIQUE,
  room_type VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer (
  customer_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reservation (
  reservation_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  room_id BIGINT NOT NULL,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'BOOKED',
  total_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reservation_customer FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE CASCADE,
  CONSTRAINT fk_reservation_room FOREIGN KEY (room_id) REFERENCES room(room_id) ON DELETE RESTRICT,
  CONSTRAINT chk_dates CHECK (checkout_date > checkin_date)
);

CREATE TABLE payment (
  payment_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  reservation_id BIGINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(1000),
  CONSTRAINT fk_payment_reservation FOREIGN KEY (reservation_id) REFERENCES reservation(reservation_id) ON DELETE CASCADE
);

CREATE TABLE staff (
  staff_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50),
  email VARCHAR(200),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO room (room_number, room_type, price, status, description) VALUES ('101', 'Single', 50.00, 'AVAILABLE', 'Single bed, city view');
INSERT INTO room (room_number, room_type, price, status, description) VALUES ('102', 'Double', 80.00, 'AVAILABLE', 'Double bed');
INSERT INTO room (room_number, room_type, price, status, description) VALUES ('201', 'Suite', 200.00, 'MAINTENANCE', 'Suite with living area');

INSERT INTO customer (first_name, last_name, email, phone) VALUES ('Alice', 'Smith', 'alice@example.com', '555-0101');
INSERT INTO customer (first_name, last_name, email, phone) VALUES ('Bob', 'Khan', 'bob@example.com', '555-0202');

COMMIT;
