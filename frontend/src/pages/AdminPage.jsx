import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AdminPage(){
  const [counts, setCounts] = useState({ rooms:0, customers:0, reservations:0 })
  useEffect(()=>{
    Promise.all([
      axios.get(`${API}/api/rooms`),
      axios.get(`${API}/api/customers`),
      axios.get(`${API}/api/reservations`)
    ]).then(([r1,r2,r3])=> setCounts({ rooms:r1.data.length, customers:r2.data.length, reservations:r3.data.length })).catch(()=>{})
  }, [])
  return (
    <div className="card">
      <h2>Admin Dashboard</h2>
      <div style={{display:'flex',gap:20}}>
        <div className="card">Rooms: {counts.rooms}</div>
        <div className="card">Customers: {counts.customers}</div>
        <div className="card">Reservations: {counts.reservations}</div>
      </div>
    </div>
  )
}
