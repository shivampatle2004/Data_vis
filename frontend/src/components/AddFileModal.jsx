import React from 'react';
import './AddFileModal.css';

/**
 * Add File Modal Component
 * Displays options to upload, browse, or create a blank report.
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to close the modal
 * @param {function} onUpload - Handler for 'Upload File'
 * @param {function} onBrowse - Handler for 'Browse Files'
 * @param {function} onCreateEmpty - Handler for 'Create Empty Report'
 */
const AddFileModal = ({ isOpen, onClose, onUpload }) => {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="add-file-modal-overlay" onClick={handleOverlayClick}>
            <div className="add-file-modal-container">
                <button
                    className="add-file-modal-close"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    ×
                </button>

                <div className="add-file-modal-header">
                    <h2 className="add-file-modal-title">Add File to Start Report</h2>
                    <p className="add-file-modal-subtitle">Upload your dataset to begin visualizing insights</p>
                </div>

                <div className="add-file-modal-body">
                    <div className="add-file-single-option">
                        <button
                            className="add-file-upload-card"
                            onClick={() => {
                                onUpload();
                                onClose();
                            }}
                        >
                            <div className="add-file-svg-wrapper">
                                <svg
                                    width="48"
                                    height="48"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="upload-svg-icon"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <div className="add-file-option-info">
                                <span className="add-file-option-label">Upload File</span>
                                <span className="add-file-option-desc">Select a CSV, Excel, or JSON file from your computer</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddFileModal;
