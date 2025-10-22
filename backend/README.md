# HotelEase - Backend (Node.js + Express + MySQL)

Prerequisites
- Node.js (v16+ recommended)
- MySQL server (or MariaDB)

Setup
1. Create database and user (example):

```sql
CREATE DATABASE hotel_ease;
CREATE USER 'hotel_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON hotel_ease.* TO 'hotel_user'@'localhost';
FLUSH PRIVILEGES;
```

2. Run the schema script located at `db/mysql_schema.sql` to create tables and seed sample data.

3. Copy `.env.example` to `.env` and update credentials.

4. Install dependencies and run:

```powershell
cd backend
npm install
npm run dev
```

API
- GET /api/rooms
- GET /api/rooms/:id
- POST /api/rooms
- GET /api/reservations
- POST /api/reservations
