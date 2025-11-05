// utils/dynamicPricing.js or top of your server file

async function performDynamicPricing(pool, interval_seconds = 10) {
    try {
        const intervalMs = interval_seconds * 1000;
        cleanOldRequests(intervalMs);

        const recentRequests = requestTimestamps.length;

        // get available rooms count
        const [rooms] = await pool.query(`SELECT COUNT(*) AS available FROM Rooms WHERE Status = 'Available'`);
        const availableRooms = rooms[0].available;

        const surgeMultiplier = calculateSurgeMultiplier(recentRequests, availableRooms);

        if (recentRequests > 3) {
            const updateQuery = `
                UPDATE RoomTypes
                SET BasePricePerNight = ROUND(BasePricePerNight * ?, 2)
            `;
            await pool.query(updateQuery, [surgeMultiplier]);
            //console.log(`💰 Prices updated with surge multiplier ${surgeMultiplier}`);
        }

        return {
            recent_requests: recentRequests,
            available_rooms: availableRooms,
            surge_multiplier: surgeMultiplier
        };
    } catch (err) {
        console.error('Dynamic pricing error:', err);
        throw err;
    }
}
export { performDynamicPricing };