// backend/forecast.js
// Simple forecasting helpers: compute occupancy rate for a room type over a date range
// and return a suggested price multiplier and suggested price based on historical occupancy.

/**
 * Compute occupancy and suggested price for a room type.
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} roomTypeId
 * @param {string} fromDate  -- 'YYYY-MM-DD'
 * @param {string} toDate    -- 'YYYY-MM-DD'
 * @returns {Promise<{roomTypeId:number,roomCount:number,bookingsCount:number,occupancyRate:number,basePrice:number,multiplier:number,suggestedPrice:number}>}
 */
export async function suggestPrice(pool, roomTypeId, fromDate, toDate) {
  if (!roomTypeId || !fromDate || !toDate) {
    throw new Error('Missing parameters');
  }

  // 1) Count rooms of that type
  const [[roomCountRow]] = await pool.query('SELECT COUNT(*) as cnt FROM Rooms WHERE RoomTypeID = ?', [roomTypeId]);
  const roomCount = roomCountRow ? roomCountRow.cnt : 0;
  if (!roomCount || roomCount === 0) {
    return { roomTypeId, roomCount: 0, bookingsCount: 0, occupancyRate: 0, basePrice: 0, multiplier: 1.0, suggestedPrice: 0 };
  }

  // 2) Compute booked room-nights overlapping the date range (more accurate occupancy)
  // Using: SUM( DATEDIFF( LEAST(CheckOutDate, toDate), GREATEST(CheckInDate, fromDate) ) )
  const roomNightsQuery = `
    SELECT IFNULL(SUM(
      GREATEST(LEAST(b.CheckOutDate, ?) - GREATEST(b.CheckInDate, ?), 0)
    ), 0) as booked_nights
    FROM Bookings b
    JOIN Rooms r ON b.RoomID = r.RoomID
    WHERE r.RoomTypeID = ?
      AND b.Status != 'Cancelled'
      AND b.CheckInDate < ?
      AND b.CheckOutDate > ?
  `;

  // MySQL DATEDIFF returns integer days; use DATEDIFF(LEAST(...), GREATEST(...)) but avoid negatives
  const ndaysParams = [toDate, fromDate, roomTypeId, toDate, fromDate];
  const [[roomNightsRow]] = await pool.query(roomNightsQuery, ndaysParams);
  const bookedRoomNights = roomNightsRow ? Number(roomNightsRow.booked_nights) : 0;

  // 3) Compute possible room-nights
  const [[daysRow]] = await pool.query('SELECT GREATEST(DATEDIFF(?, ?), 0) as days', [toDate, fromDate]);
  const days = daysRow ? Number(daysRow.days) : 0; // number of nights in range
  const possibleRoomNights = days * roomCount;

  const occupancyRate = possibleRoomNights > 0 ? bookedRoomNights / possibleRoomNights : 0;

  // 4) Get base price for room type
  const [[priceRow]] = await pool.query('SELECT BasePricePerNight as basePrice FROM RoomTypes WHERE RoomTypeID = ?', [roomTypeId]);
  const basePrice = priceRow ? Number(priceRow.basePrice) : 0;

  // 5) Simple multiplier rules (tuneable)
  let multiplier = 1.0;
  if (occupancyRate >= 0.8) multiplier = 1.25;
  else if (occupancyRate >= 0.6) multiplier = 1.15;
  else if (occupancyRate >= 0.4) multiplier = 1.05;

  const suggestedPrice = +(basePrice * multiplier).toFixed(2);

  return {
    roomTypeId,
    roomCount,
    bookedRoomNights,
    possibleRoomNights,
    occupancyRate: +occupancyRate.toFixed(4),
    basePrice: +basePrice,
    multiplier,
    suggestedPrice
  };
}
