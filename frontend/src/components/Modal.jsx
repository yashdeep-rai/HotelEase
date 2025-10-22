import './Modal.css';

export default function Modal({ isOpen, onClose, onConfirm, title, children }) {
    if (!isOpen) {
        return null;
    }

    return (
        // The overlay captures clicks to close the modal
        <div className="modal-overlay" onClick={onClose}>
            {/* The content stops click propagation */}
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button onClick={onConfirm} className="btn btn-primary">
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}