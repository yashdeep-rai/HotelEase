CREATE DATABASE IF NOT EXISTS hotel_management;
USE hotel_management;

-- Drop existing objects in FK-safe order (children before parents). Include all tables created in this script.
DROP TABLE IF EXISTS BookingGuests;
DROP TABLE IF EXISTS Bookings;
DROP TABLE IF EXISTS AdminActivityLog;
DROP TABLE IF EXISTS DemandLog;
DROP TABLE IF EXISTS RoomMaintenance;
DROP TABLE IF EXISTS Promotions;
DROP TABLE IF EXISTS Rooms;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS Guests;
DROP TABLE IF EXISTS RoomTypes;
-- Drop triggers and procedure if they exist to allow re-run
DROP TRIGGER IF EXISTS trg_promotions_after_insert;
DROP TRIGGER IF EXISTS trg_promotions_after_update;
DROP TRIGGER IF EXISTS trg_promotions_after_delete;
DROP TRIGGER IF EXISTS trg_maintenance_after_insert;
DROP TRIGGER IF EXISTS trg_maintenance_after_update;
DROP TRIGGER IF EXISTS trg_maintenance_after_delete;
DROP PROCEDURE IF EXISTS UpdateDynamicRoomPrices;

CREATE TABLE RoomTypes (
    RoomTypeID INT AUTO_INCREMENT PRIMARY KEY,
    TypeName VARCHAR(50) NOT NULL UNIQUE,
    Description TEXT,
    BasePricePerNight DECIMAL(10,2) NOT NULL,
    MaxOccupancy INT NOT NULL,
    BedConfiguration VARCHAR(100),
    Amenities TEXT,
    CleaningBufferMinutes INT NOT NULL DEFAULT 30, -- Time needed between bookings for cleaning/preparation
    CHECK (BasePricePerNight >= 0),
    CHECK (MaxOccupancy > 0),
    CHECK (CleaningBufferMinutes >= 0)
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


CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    guest_id INT,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','guest') NOT NULL DEFAULT 'guest',
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES Guests(GuestID) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE Rooms (
    RoomID INT AUTO_INCREMENT PRIMARY KEY,
    RoomNumber VARCHAR(10) NOT NULL UNIQUE,
    RoomTypeID INT NOT NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'Available', -- Available, Occupied, Maintenance
    FOREIGN KEY (RoomTypeID) REFERENCES RoomTypes(RoomTypeID)
) ENGINE=InnoDB;

-- New table for promotions and discounts
CREATE TABLE Promotions (
    PromoID INT AUTO_INCREMENT PRIMARY KEY,
    PromoCode VARCHAR(50) NOT NULL UNIQUE,
    DiscountType ENUM('percentage', 'fixed') NOT NULL,
    DiscountValue DECIMAL(5,2) NOT NULL, -- e.g., 0.15 for 15%, or 25.00 for $25 off
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    RoomTypeID INT, -- Optional: applies to a specific room type
    MinStayNights INT DEFAULT 1,
    MaxUses INT DEFAULT NULL, -- NULL for unlimited uses
    CurrentUses INT DEFAULT 0,
    IsActive BOOLEAN DEFAULT TRUE,
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RoomTypeID) REFERENCES RoomTypes(RoomTypeID) ON DELETE SET NULL,
    CHECK (DiscountValue > 0),
    CHECK (EndDate >= StartDate)
) ENGINE=InnoDB;

-- New table for managing room maintenance schedules
CREATE TABLE RoomMaintenance (
    MaintenanceID INT AUTO_INCREMENT PRIMARY KEY,
    RoomID INT NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    Reason VARCHAR(255),
    CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RoomID) REFERENCES Rooms(RoomID) ON DELETE CASCADE,
    CHECK (EndDate >= StartDate)
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

-- New table for logging demand (availability searches)
CREATE TABLE DemandLog (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    RoomTypeID INT,
    SearchDate DATE NOT NULL,
    SearchCount INT NOT NULL DEFAULT 1,
    LastSearchedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (RoomTypeID) REFERENCES RoomTypes(RoomTypeID) ON DELETE SET NULL,
    UNIQUE KEY uq_demand_log (RoomTypeID, SearchDate)
) ENGINE=InnoDB;

-- New table for admin activity logging
CREATE TABLE AdminActivityLog (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    UserID INT NOT NULL,
    ActionType VARCHAR(50) NOT NULL, -- e.g., 'ROOM_STATUS_UPDATE', 'PRICE_ADJUSTMENT', 'USER_DELETED'
    TargetTable VARCHAR(50), -- e.g., 'Rooms', 'RoomTypes', 'users'
    TargetID INT, -- ID of the record affected
    OldValue TEXT,
    NewValue TEXT,
    Timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (UserID) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_guests_email ON Guests(Email);
CREATE INDEX idx_bookings_primaryguest ON Bookings(PrimaryGuestID);
CREATE INDEX idx_bookings_room ON Bookings(RoomID);
CREATE INDEX idx_bookings_checkin ON Bookings(CheckInDate);
CREATE INDEX idx_bookingguests_booking ON BookingGuests(BookingID);
CREATE INDEX idx_bookingguests_guest ON BookingGuests(GuestID);
CREATE INDEX idx_users_email ON users(email);


INSERT INTO RoomTypes (TypeName, Description, BasePricePerNight, MaxOccupancy, BedConfiguration, Amenities)
VALUES
('Single', 'Single room with one bed', 100.00, 1, '1 Single Bed', 'Free Wi-Fi, TV'),
('Double', 'Double room with two beds', 150.00, 2, '2 Single Beds', 'Free Wi-Fi, TV, Mini-bar'),
('Suite', 'Suite with living area', 250.00, 4, '1 King + Sofa bed', 'Free Wi-Wi, TV, Mini-bar, Balcony');

INSERT INTO Rooms (RoomNumber, RoomTypeID, Status)
VALUES
('101', 1, 'Available'),
('102', 1, 'Available'),
('201', 2, 'Available'),
('202', 2, 'Maintenance'),
('301', 3, 'Available');

-- INSERT INTO Guests (FirstName, LastName, Email, Phone)
-- VALUES
-- ('Alice', 'Smith', 'alice@example.com', '555-1234'),
-- ('Bob', 'Johnson', 'bob@example.com', '555-5678'),
-- ('Charlie', 'Smith', 'charlie.smith@example.com', '555-9999');

-- NOTE: sample user and booking inserts were removed to avoid storing plaintext or dummy passwords in the schema file.
-- Create users/bookings via the API instead (POST /api/auth/register and POST /api/bookings).


ALTER TABLE RoomTypes
ADD COLUMN CurrentPricePerNight DECIMAL(10,2) AFTER BasePricePerNight;

UPDATE RoomTypes
SET CurrentPricePerNight = BasePricePerNight;

DELIMITER //

CREATE PROCEDURE UpdateDynamicRoomPrices(
    IN recentRequests INT,
    IN currentAvailableRooms INT
)
BEGIN
    DECLARE surgeMultiplier DECIMAL(5,2);
    DECLARE demandRatio DECIMAL(5,2);
    DECLARE currentHour INT;

    -- Calculate demand ratio
    IF currentAvailableRooms = 0 THEN
        SET demandRatio = 999.0; -- Effectively infinite demand if no rooms
    ELSE
        SET demandRatio = recentRequests / currentAvailableRooms;
    END IF;

    -- Determine base surge multiplier based on demand ratio
    IF demandRatio < 1 THEN
        SET surgeMultiplier = 1.0;
    ELSEIF demandRatio < 2 THEN
        SET surgeMultiplier = 1.1;
    ELSEIF demandRatio < 3 THEN
        SET surgeMultiplier = 1.25;
    ELSEIF demandRatio < 5 THEN
        SET surgeMultiplier = 1.5;
    ELSE
        SET surgeMultiplier = 2.0; -- Max surge
    END IF;

    -- Apply night-time surge
    SET currentHour = HOUR(NOW());
    IF currentHour >= 21 OR currentHour < 4 THEN
        SET surgeMultiplier = surgeMultiplier * 1.15;
    END IF;

    -- Apply surge only if there’s significant demand (e.g., at least 2 requests)
    IF recentRequests >= 2 THEN
        UPDATE RoomTypes
        SET CurrentPricePerNight = ROUND(BasePricePerNight * surgeMultiplier, 2);
    ELSE
        -- Low demand → reset to base price
        UPDATE RoomTypes
        SET CurrentPricePerNight = BasePricePerNight;
    END IF;

END //

DELIMITER ;

-- TRIGGERS: Populate AdminActivityLog for Promotions and RoomMaintenance
DELIMITER //

CREATE TRIGGER trg_promotions_after_insert
AFTER INSERT ON Promotions
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'PROMOTION_CREATED', 'Promotions', NEW.PromoID, NULL, CONCAT('PromoCode=', NEW.PromoCode, '; Discount=', NEW.DiscountType, ':', NEW.DiscountValue));
END;//

CREATE TRIGGER trg_promotions_after_update
AFTER UPDATE ON Promotions
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'PROMOTION_UPDATED', 'Promotions', NEW.PromoID, CONCAT('PromoCode=', OLD.PromoCode, '; Discount=', OLD.DiscountType, ':', OLD.DiscountValue), CONCAT('PromoCode=', NEW.PromoCode, '; Discount=', NEW.DiscountType, ':', NEW.DiscountValue));
END;//

CREATE TRIGGER trg_promotions_after_delete
AFTER DELETE ON Promotions
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'PROMOTION_DELETED', 'Promotions', OLD.PromoID, CONCAT('PromoCode=', OLD.PromoCode, '; Discount=', OLD.DiscountType, ':', OLD.DiscountValue), NULL);
END;//

CREATE TRIGGER trg_maintenance_after_insert
AFTER INSERT ON RoomMaintenance
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'MAINTENANCE_SCHEDULED', 'RoomMaintenance', NEW.MaintenanceID, NULL, CONCAT('RoomID=', NEW.RoomID, '; Start=', NEW.StartDate, '; End=', NEW.EndDate));
END;//

CREATE TRIGGER trg_maintenance_after_update
AFTER UPDATE ON RoomMaintenance
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'MAINTENANCE_UPDATED', 'RoomMaintenance', NEW.MaintenanceID, CONCAT('RoomID=', OLD.RoomID, '; Start=', OLD.StartDate, '; End=', OLD.EndDate), CONCAT('RoomID=', NEW.RoomID, '; Start=', NEW.StartDate, '; End=', NEW.EndDate));
END;//

CREATE TRIGGER trg_maintenance_after_delete
AFTER DELETE ON RoomMaintenance
FOR EACH ROW
BEGIN
    INSERT INTO AdminActivityLog (UserID, ActionType, TargetTable, TargetID, OldValue, NewValue)
    VALUES (COALESCE(@current_admin_user_id, NULL), 'MAINTENANCE_CANCELLED', 'RoomMaintenance', OLD.MaintenanceID, CONCAT('RoomID=', OLD.RoomID, '; Start=', OLD.StartDate, '; End=', OLD.EndDate), NULL);
END;//

DELIMITER ;