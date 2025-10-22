CREATE DATABASE IF NOT EXISTS hotel_management;
USE hotel_management;

-- Table for Room Types and Details
CREATE TABLE rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(10) NOT NULL UNIQUE,
    room_type VARCHAR(50) NOT NULL, -- e.g., 'Single', 'Double', 'Suite'
    rate DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Available' -- e.g., 'Available', 'Occupied', 'Maintenance'
);

-- Table for Guest Information
CREATE TABLE guests (
    guest_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20)
);

-- Table for Bookings (linking guests and rooms)
CREATE TABLE bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT NOT NULL,
    room_id INT NOT NULL,
    check_in_date DATE NOT NULL,
    check_out_date DATE NOT NULL,
    total_amount DECIMAL(10, 2),
    status VARCHAR(20) NOT NULL DEFAULT 'Confirmed', -- e.g., 'Confirmed', 'Checked-In', 'Checked-Out', 'Cancelled'
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id),
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- (Optional) Example Data to get started
INSERT INTO rooms (room_number, room_type, rate, status)
VALUES
('101', 'Single', 100.00, 'Available'),
('102', 'Single', 100.00, 'Available'),
('201', 'Double', 150.00, 'Available'),
('202', 'Double', 150.00, 'Maintenance'),
('301', 'Suite', 250.00, 'Available');

INSERT INTO guests (first_name, last_name, email, phone)
VALUES
('Alice', 'Smith', 'alice@example.com', '555-1234'),
('Bob', 'Johnson', 'bob@example.com', '555-5678');


