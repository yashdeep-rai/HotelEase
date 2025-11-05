import { useState, useEffect } from 'react';
import './HotelManagementPage.css';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiTrash2, FiSave, FiCheck } from 'react-icons/fi';

export default function HotelManagementPage() {
    const { token } = useAuth();
    const [roomTypeOptions, setRoomTypeOptions] = useState([]);
    const [dynamicEnabled, setDynamicEnabled] = useState(true);
    const [dynamicMultiplier, setDynamicMultiplier] = useState(1.0);

    const [newRoomNumber, setNewRoomNumber] = useState('');
    const [newRoomTypeId, setNewRoomTypeId] = useState('');
    const [deleteFloorValue, setDeleteFloorValue] = useState('');

    const [selectedRoomTypeAdjust, setSelectedRoomTypeAdjust] = useState('');
    const [newBaseForAdjust, setNewBaseForAdjust] = useState('');

    useEffect(() => {
        async function fetchRoomTypes() {
            try {
                const response = await fetch('/api/rooms', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                //console.log('Fetched room data:', data);

                const map = new Map();
                for (const r of data) {
                    if (r.room_type_id) map.set(String(r.room_type_id), r.room_type || `Type ${r.room_type_id}`);
                }
                const opts = Array.from(map.entries()).map(([id, name]) => ({ id, name }));
                //console.log('Processed room type options:', opts);

                setRoomTypeOptions(opts);
                if (opts.length > 0) {
                    if (!newRoomTypeId) setNewRoomTypeId(opts[0].id);
                    if (!selectedRoomTypeAdjust) setSelectedRoomTypeAdjust(opts[0].id);
                }
            } catch (err) {
                console.error("Failed to fetch or process room types:", err);
            }
        }

        async function fetchSettings() {
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
            fetchRoomTypes();
            fetchSettings();
        }
    }, [token]);

    const handleSaveSettings = async () => {
        try {
            const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ dynamic_pricing_enabled: dynamicEnabled, dynamic_pricing_multiplier: dynamicMultiplier }) });
            if (!res.ok) throw new Error('Failed to save settings');
            alert('Settings updated');
        } catch (e) { console.error(e); alert(e.message || 'Save settings failed'); }
    };

    const handleAddRoom = async () => {
        if (!newRoomNumber || !newRoomTypeId) return alert('Provide room number and type');
        try {
            const res = await fetch('/api/admin/rooms', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ room_number: newRoomNumber, room_type_id: parseInt(newRoomTypeId, 10) })
            });
            if (!res.ok) throw new Error('Failed to add room');
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
            alert(j.message || 'Floor deleted');
            // Refresh room list after deletion
            fetchRoomTypes();
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
            setNewBaseForAdjust('');
        } catch (e) { console.error(e); alert(e.message || 'Update base price failed'); }
    };

    return (
        <div className="hotel-management-page">
            <main className="hotel-management-main">
                <h1 className="page-title">Hotel Management</h1>
                <p className="page-subtitle">A centralized dashboard to manage your hotel's operations.</p>

                <div className="management-container">
                    <section className="management-section">
                        <h2 className="section-title">Dynamic Pricing</h2>
                        <div className="section-content">
                            <div className="setting-item">
                                <div style={{ display: 'inline-flex', gap: '35px' }}>

                                    <div className="toggle-switch">
                                        <input id="dynamicToggle" type="checkbox" checked={dynamicEnabled} onChange={(e) => setDynamicEnabled(e.target.checked)} />
                                        <label htmlFor="dynamicToggle" />
                                    </div>
                                    <label htmlFor="dynamicToggle" style={{ fontSize: '1.1em' }}>Enable Dynamic Pricing</label>
                                </div>

                            </div>
                            <div className="setting-item">
                                <label htmlFor="multiplier">Pricing Multiplier</label>
                                <input id="multiplier" type="number" step="0.05" value={dynamicMultiplier} onChange={(e) => setDynamicMultiplier(e.target.value)} disabled={!dynamicEnabled} />
                            </div>
                            <button className="btn-save" onClick={handleSaveSettings}>

                                <FiSave />
                                <span>Save</span>
                            </button>
                        </div>
                    </section>

                    <section className="management-section">
                        <h2 className="section-title">Price Management</h2>
                        <div className="section-content">
                            <div className="setting-item">
                                <label htmlFor="roomTypeAdjust">Room Type</label>
                                <select id="roomTypeAdjust" value={selectedRoomTypeAdjust} onChange={(e) => setSelectedRoomTypeAdjust(e.target.value)}>
                                    {roomTypeOptions.map(opt => (
                                        <option key={opt.id} value={opt.id}>{opt.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-item">
                                <label htmlFor="newBaseRate">New Base Rate</label>
                                <div className="input-with-button">
                                    <input id="newBaseRate" placeholder="e.g., 1500" value={newBaseForAdjust} onChange={(e) => setNewBaseForAdjust(e.target.value)} />
                                    <button className="btn-set" onClick={() => handleAdjustBasePrice(selectedRoomTypeAdjust, 'set', newBaseForAdjust)}><FiCheck size={24}/></button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="management-section">
                        <h2 className="section-title">Room Inventory</h2>
                        <div className="section-content">
                            <div className="setting-item">
                                <label htmlFor="roomTypeAdd">Room Type</label>
                                <select id="roomTypeAdd" value={newRoomTypeId} onChange={(e) => setNewRoomTypeId(e.target.value)}>
                                    {roomTypeOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
                                </select>
                            </div>
                            <div className="setting-item">
                                <label htmlFor="roomNumber">Room Number</label>
                                <div className="input-with-button">
                                    <input id="roomNumber" placeholder="e.g., 101" value={newRoomNumber} onChange={(e) => setNewRoomNumber(e.target.value)} />
                                    <button className="btn-add" onClick={handleAddRoom}>
                                        <FiPlus size={24}/>
                                    </button>
                                </div>
                            </div>
                            <div className="setting-item danger-zone">
                                <label htmlFor="floorDelete">Delete by Floor</label>
                                <div className="input-with-button">
                                    <input id="floorDelete" placeholder="e.g., 1" value={deleteFloorValue} onChange={(e) => setDeleteFloorValue(e.target.value)} />
                                    <button className="btn-delete" onClick={handleDeleteFloor}>
                                        <FiTrash2 size={24}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}