import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function UserPage(){
  const [reservations, setReservations] = useState([])
  useEffect(()=>{ axios.get(`${API}/api/reservations?customerId=1`).then(r=>setReservations(r.data)).catch(()=>{}) }, [])
  return (
    <div className="card">
      <h2>Your Dashboard</h2>
      <p>Quick summary for customer #1</p>
      <ul>
        {reservations.map(r=> <li key={r.reservationId}>Reservation {r.reservationId} — {r.status} — {r.checkinDate} to {r.checkoutDate}</li>)}
      </ul>
    </div>
  )
}