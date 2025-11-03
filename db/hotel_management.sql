CREATE DATABASE IF NOT EXISTS hotel_management;
USE hotel_management;

-- Drop existing tables in FK-safe order (child tables first)
DROP TABLE IF EXISTS BookingGuests;
DROP TABLE IF EXISTS Bookings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS Guests;
DROP TABLE IF EXISTS Rooms;
DROP TABLE IF EXISTS RoomTypes;

CREATE TABLE RoomTypes (
    RoomTypeID INT AUTO_INCREMENT PRIMARY KEY,
    TypeName VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    BasePricePerNight DECIMAL(10,2) NOT NULL,
    MaxOccupancy INT NOT NULL,
    BedConfiguration VARCHAR(100),
    Amenities TEXT,
    CHECK (BasePricePerNight >= 0),
    CHECK (MaxOccupancy > 0)
) ENGINE=InnoDB;

-- Rooms: individual room instances referencing a RoomType
CREATE TABLE Rooms (
    RoomID INT AUTO_INCREMENT PRIMARY KEY,
    RoomNumber VARCHAR(10) NOT NULL UNIQUE,
    RoomTypeID INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'Available', -- Available, Occupied, Maintenance
    FOREIGN KEY (RoomTypeID) REFERENCES RoomTypes(RoomTypeID)
) ENGINE=InnoDB;

CREATE TABLE Guests (
    GuestID INT AUTO_INCREMENT PRIMARY KEY,
    FirstName VARCHAR(50) NOT NULL,
    LastName VARCHAR(50) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Phone VARCHAR(20),
    DateOfBirth DATE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Users table for authentication / RBAC (links to Guests)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','guest') NOT NULL DEFAULT 'guest',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES Guests(GuestID) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Bookings (
    BookingID INT AUTO_INCREMENT PRIMARY KEY,
    PrimaryGuestID INT NOT NULL,
    UserID INT DEFAULT NULL,
    RoomID INT NOT NULL,
    CheckInDate DATE NOT NULL,
    CheckOutDate DATE NOT NULL,
    NumGuests INT NOT NULL DEFAULT 1,
    TotalAmount DECIMAL(12,2),
    Status VARCHAR(20) NOT NULL DEFAULT 'Confirmed', -- Confirmed, Checked-In, Checked-Out, Cancelled
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PrimaryGuestID) REFERENCES Guests(GuestID),
    FOREIGN KEY (RoomID) REFERENCES Rooms(RoomID),
    FOREIGN KEY (UserID) REFERENCES users(user_id) ON DELETE SET NULL,
    CHECK (CheckOutDate > CheckInDate),
    CHECK (NumGuests > 0)
) ENGINE=InnoDB;

CREATE TABLE BookingGuests (
    BookingGuestID INT AUTO_INCREMENT PRIMARY KEY,
    BookingID INT NOT NULL,
    GuestID INT NOT NULL,
    IsPrimary BOOL NOT NULL DEFAULT FALSE,
    FOREIGN KEY (BookingID) REFERENCES Bookings(BookingID) ON DELETE CASCADE,
    FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE,
    UNIQUE KEY uq_booking_guest (BookingID, GuestID)
) ENGINE=InnoDB;

CREATE INDEX idx_guests_email ON Guests(Email);
CREATE INDEX idx_bookings_primaryguest ON Bookings(PrimaryGuestID);
CREATE INDEX idx_bookings_room ON Bookings(RoomID);
CREATE INDEX idx_bookings_checkin ON Bookings(CheckInDate);
CREATE INDEX idx_bookingguests_booking ON BookingGuests(BookingID);
CREATE INDEX idx_bookingguests_guest ON BookingGuests(GuestID);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','guest') NOT NULL DEFAULT 'guest',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES Guests(GuestID) ON DELETE SET NULL
) ENGINE=InnoDB;

INSERT INTO RoomTypes (TypeName, Description, BasePricePerNight, MaxOccupancy, BedConfiguration, Amenities)
VALUES
('Single', 'Single room with one bed', 100.00, 1, '1 Single Bed', 'Free Wi-Fi, TV'),
('Double', 'Double room with two beds', 150.00, 2, '2 Single Beds', 'Free Wi-Fi, TV, Mini-bar'),
('Suite', 'Suite with living area', 250.00, 4, '1 King + Sofa bed', 'Free Wi-Fi, TV, Mini-bar, Balcony');

INSERT INTO Rooms (RoomNumber, RoomTypeID, Status)
VALUES
('101', 1, 'Available'),
('102', 1, 'Available'),
('201', 2, 'Available'),
('202', 2, 'Maintenance'),
('301', 3, 'Available');

INSERT INTO Guests (FirstName, LastName, Email, Phone)
VALUES
('Alice', 'Smith', 'alice@example.com', '555-1234'),
('Bob', 'Johnson', 'bob@example.com', '555-5678'),
('Charlie', 'Smith', 'charlie.smith@example.com', '555-9999');

INSERT INTO users (guest_id, email, password_hash, role)
VALUES
((SELECT GuestID FROM Guests WHERE Email='alice@example.com'), 'alice@example.com', 'changeme', 'guest');

INSERT INTO Bookings (PrimaryGuestID, UserID, RoomID, CheckInDate, CheckOutDate, NumGuests, TotalAmount, Status)
VALUES
((SELECT GuestID FROM Guests WHERE Email='alice@example.com'),
 (SELECT user_id FROM users WHERE email='alice@example.com' LIMIT 1),
 (SELECT RoomID FROM Rooms WHERE RoomNumber='101'),
 '2024-12-20', '2024-12-23', 2, 300.00, 'Confirmed');

INSERT INTO BookingGuests (BookingID, GuestID, IsPrimary)
VALUES
((SELECT BookingID FROM Bookings WHERE PrimaryGuestID=(SELECT GuestID FROM Guests WHERE Email='alice@example.com') LIMIT 1),
 (SELECT GuestID FROM Guests WHERE Email='alice@example.com'),
 TRUE),
((SELECT BookingID FROM Bookings WHERE PrimaryGuestID=(SELECT GuestID FROM Guests WHERE Email='alice@example.com') LIMIT 1),
 (SELECT GuestID FROM Guests WHERE Email='charlie.smith@example.com'),
 FALSE);



