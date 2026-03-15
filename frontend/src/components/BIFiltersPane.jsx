import React from 'react';
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react';

const BIFiltersPane = ({ selectedVisual, schema }) => {
    return (
        <div className="bi-pane-view">
            <div className="bi-pane-header">
                <span className="bi-pane-title">Filters</span>
            </div>

            <div className="bi-pane-scroll">
                <div className="bi-pane-section">
                    <div className="bi-section-subtitle">Filters on this visual</div>
                    <div className="bi-filter-dropzone">
                        {selectedVisual ? (
                            <div className="bi-active-filter">
                                <span className="bi-filter-field">{selectedVisual.x_axis}</span>
                                <span className="bi-filter-type">All</span>
                                <X size={12} className="bi-filter-remove" />
                            </div>
                        ) : (
                            <span className="bi-dropzone-empty">Select a visual to see its filters</span>
                        )}
                        <div className="bi-dropzone-target">Add data fields here</div>
                    </div>
                </div>

                <div className="bi-pane-section">
                    <div className="bi-section-subtitle">Filters on this page</div>
                    <div className="bi-filter-dropzone">
                        <div className="bi-dropzone-target">Add data fields here</div>
                    </div>
                </div>

                <div className="bi-pane-section">
                    <div className="bi-section-subtitle">Filters on all pages</div>
                    <div className="bi-filter-dropzone">
                        <div className="bi-dropzone-target">Add data fields here</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BIFiltersPane;
