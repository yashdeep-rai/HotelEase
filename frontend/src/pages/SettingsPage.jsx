import { useState, useEffect } from 'react';
import './RoomManagementPage.css';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
    const { token } = useAuth();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [dynamicEnabled, setDynamicEnabled] = useState(true);
    const [dynamicMultiplier, setDynamicMultiplier] = useState(1.0);

    const [roomTypeOptions, setRoomTypeOptions] = useState([]);
    const [newRoomNumber, setNewRoomNumber] = useState('');
    const [newRoomTypeId, setNewRoomTypeId] = useState('');
    const [deleteFloorValue, setDeleteFloorValue] = useState('');

    const [selectedRoomTypeAdjust, setSelectedRoomTypeAdjust] = useState('');
    const [newBaseForAdjust, setNewBaseForAdjust] = useState('');

    useEffect(() => {
        async function fetchRooms() {
            try {
                setLoading(true);
                const response = await fetch('/api/rooms', { headers: { 'Authorization': `Bearer ${token}` } });
                const safeParseResponse = async (res) => {
                    const text = await res.text();
                    if (!text) return null;
                    try { return JSON.parse(text); } catch (e) { console.warn('safeParseResponse: invalid JSON', e); return null; }
                };
                if (!response.ok) {
                    const err = await safeParseResponse(response);
                    throw new Error((err && (err.error || err.message)) || 'Failed to fetch rooms');
                }
                const data = await safeParseResponse(response) || [];
                setRooms(data);
                const map = new Map();
                for (const r of data) {
                    if (r.room_type_id) map.set(String(r.room_type_id), r.room_type || `Type ${r.room_type_id}`);
                }
                const opts = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
                setRoomTypeOptions(opts);
                if (opts.length > 0 && !newRoomTypeId) setNewRoomTypeId(opts[0].id);
                setError(null);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        async function fetchSettings(){
            try {
                const res = await fetch('/api/admin/settings', { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const j = await res.json();
                    setDynamicEnabled(!!j.dynamic_pricing_enabled);
                    setDynamicMultiplier(j.dynamic_pricing_multiplier || 1.0);
                }
            } catch (e) { /* ignore */ }
        }

        if (token) {
            fetchRooms();
            fetchSettings();
        }
    }, [token]);

    useEffect(() => {
        if (!selectedRoomTypeAdjust && roomTypeOptions && roomTypeOptions.length > 0) {
            setSelectedRoomTypeAdjust(roomTypeOptions[0].id);
        }
    }, [roomTypeOptions]);

    const handleSaveSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ dynamic_pricing_enabled: dynamicEnabled, dynamic_pricing_multiplier: dynamicMultiplier }) });
            if (!res.ok) throw new Error('Failed to save settings');
            alert('Settings updated');
            const refreshed = await (await fetch('/api/rooms', { headers: { 'Authorization': `Bearer ${token}` } })).json();
            setRooms(refreshed);
        } catch (e) { console.error(e); alert(e.message || 'Save settings failed'); }
    };

    const handleAddRoom = async () => {
        if (!newRoomNumber || !newRoomTypeId) return alert('Provide room number and type');
        try {
            const res = await fetch('/api/admin/rooms', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ room_number: newRoomNumber, room_type_id: parseInt(newRoomTypeId,10) })
            });
            if (!res.ok) throw new Error('Failed to add room');
            const j = await res.json();
            setRooms(prev => [...prev, { room_id: j.room_id, room_number: newRoomNumber, room_type_id: parseInt(newRoomTypeId,10), room_type: roomTypeOptions.find(o => o.id === newRoomTypeId)?.name || 'Type', rate: 0, status: 'Available' }]);
            setNewRoomNumber('');
            alert('Room added');
        } catch (e) { console.error(e); alert(e.message || 'Add room failed'); }
    };

    const handleDeleteFloor = async () => {
        if (!deleteFloorValue) return alert('Provide floor number');
        if (!confirm(`Delete all rooms on floor ${deleteFloorValue}?`)) return;
        try {
            const res = await fetch(`/api/admin/rooms/floor/${deleteFloorValue}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to delete floor');
            const j = await res.json();
            const refreshed = await (await fetch('/api/rooms', { headers: { 'Authorization': `Bearer ${token}` } })).json();
            setRooms(refreshed);
            alert(j.message || 'Floor deleted');
        } catch (e) { console.error(e); alert(e.message || 'Delete floor failed'); }
    };

    const handleAdjustBasePrice = async (roomTypeId, action, amount) => {
        try {
            let body = {};
            if (action === 'set') {
                body = { new_base: amount };
            } else {
                body = { action, amount };
            }
            const res = await fetch(`/api/admin/roomtypes/${roomTypeId}/baseprice`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(body) });
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || 'Failed to update base price');
            }
            alert('Base price updated');
            const refreshed = await (await fetch('/api/rooms', { headers: { 'Authorization': `Bearer ${token}` } })).json();
            setRooms(refreshed);
            setNewBaseForAdjust('');
        } catch (e) { console.error(e); alert(e.message || 'Update base price failed'); }
    };

    return (
        <div className="settings-page" style={{padding: '1.5rem'}}>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Centralized admin settings for pricing, room types, and bulk actions.</p>

            <div className="admin-controls">
                <h3>Pricing Settings</h3>
                <div className="settings-row">
                    <div className="toggle-wrap">
                        <input id="dynamicToggleSettings" type="checkbox" checked={dynamicEnabled} onChange={(e)=>setDynamicEnabled(e.target.checked)} />
                        <label htmlFor="dynamicToggleSettings" className="toggle-pill" />
                        <span className="toggle-text">Dynamic Pricing</span>
                    </div>
                </div>
                <div className="settings-row">
                    <label className="multiplier-label">
                        <span>Multiplier:</span>
                        <input type="number" step="0.05" value={dynamicMultiplier} onChange={(e)=>setDynamicMultiplier(e.target.value)} disabled={!dynamicEnabled} />
                    </label>
                </div>
                <div className="settings-row">
                    <button className="btn-primary" onClick={handleSaveSettings}>Save Pricing</button>
                </div>
            </div>

            <div style={{height:'1rem'}} />

            <div className="admin-controls">
                <h3>Manage Rooms</h3>
                <div className="settings-row">
                    <input placeholder="Room Number" value={newRoomNumber} onChange={(e)=>setNewRoomNumber(e.target.value)} />
                </div>
                <div className="settings-row">
                    <select value={newRoomTypeId} onChange={(e)=>setNewRoomTypeId(e.target.value)}>
                        {roomTypeOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                    </select>
                </div>
                <div className="settings-row">
                    <button className="btn-primary" onClick={handleAddRoom}>Add Room</button>
                </div>
                <div className="settings-row" style={{marginTop: '1rem'}}>
                    <input placeholder="Floor number (e.g. 1)" value={deleteFloorValue} onChange={(e)=>setDeleteFloorValue(e.target.value)} />
                </div>
                <div className="settings-row">
                    <button className="btn-primary" onClick={handleDeleteFloor}>Delete Floor</button>
                </div>
            </div>

            <div style={{height:'1rem'}} />

            <div className="roomtype-controls">
                <h3>Adjust Base Rate</h3>
                <div className="roomtype-row">
                    <div className="roomtype-info">
                        <select id="roomtype-select-settings" value={selectedRoomTypeAdjust} onChange={(e)=>setSelectedRoomTypeAdjust(e.target.value)}>
                            {roomTypeOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.name}</option>
                            ))}
                        </select>
                        <span className="muted">Current: ₹{rooms.find(r=>String(r.room_type_id) === String(selectedRoomTypeAdjust))?.rate ?? '-'}</span>
                    </div>
                    <div className="roomtype-set">
                        <input className="small-input" placeholder="Set new base" value={newBaseForAdjust} onChange={(e)=>setNewBaseForAdjust(e.target.value)} />
                        <button className="btn-primary btn-small" onClick={async ()=>{
                            const nb = parseFloat(newBaseForAdjust);
                            if (isNaN(nb)) return alert('Enter a numeric base price');
                            await handleAdjustBasePrice(selectedRoomTypeAdjust, 'set', nb);
                        }}>Set</button>
                    </div>
                </div>
            </div>

            {loading && <p>Loading...</p>}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
}
