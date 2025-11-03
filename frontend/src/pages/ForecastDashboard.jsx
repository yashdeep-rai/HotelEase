import React, { useState } from 'react';
import './ForecastDashboard.css';

const ROOM_TYPES = [
  { id: 1, name: 'Single' },
  { id: 2, name: 'Double' },
  { id: 3, name: 'Suite' }
];

export default function ForecastDashboard() {
  const [roomTypeId, setRoomTypeId] = useState(1);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchForecast() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      // Helper to safely parse possibly-empty JSON responses
      const safeParseResponse = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
      };

      const res = await fetch(
        `/api/forecast/price?roomTypeID=${roomTypeId}&from=${date}&to=${date.replace(/\d+$/, d => String(Number(d) + 1).padStart(2, '0'))}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        const err = await safeParseResponse(res);
        throw new Error((err && (err.error || err.message)) || 'API error');
      }
      const data = await safeParseResponse(res);
      setResult(data);
    } catch (err) {
      setError('Failed to fetch forecast');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="forecast-dashboard">
      <h2>Forecast & Dynamic Pricing</h2>
      <div className="controls">
        <label>
          Room Type:
          <select value={roomTypeId} onChange={e => setRoomTypeId(Number(e.target.value))}>
            {ROOM_TYPES.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date:
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <button onClick={fetchForecast} disabled={loading}>Get Forecast</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {result && (
        <div className="forecast-result">
          <h3>Suggested Price for {ROOM_TYPES.find(rt => rt.id === roomTypeId)?.name} on {date}</h3>
          <ul>
            <li>Base Price: ₹{result.basePrice}</li>
            <li>Occupancy Rate: {(result.occupancyRate * 100).toFixed(1)}%</li>
            <li>Multiplier: {result.multiplier}</li>
            <li>Suggested Price: <b>₹{result.suggestedPrice}</b></li>
            {result.holiday && <li className="holiday">Holiday Boost Applied</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
