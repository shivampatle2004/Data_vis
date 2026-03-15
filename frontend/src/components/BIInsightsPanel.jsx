import React from 'react';
import { ChevronDown, FileText, Database, Layers, BarChart3, Info, ChevronRight, ChevronLeft } from 'lucide-react';
import './BIInsightsPanel.css';

const BIInsightsPanel = ({ stats, fileName, selection, isCollapsed, onToggleCollapse }) => {

    // Determine data metrics safely
    const columnCount = stats ? Object.keys(stats).length : 0;
    const statsArray = stats ? Object.entries(stats) : [];

    // Pick the most interesting stats to show as highlights
    // For example, columns with the most unique values or specific distributions
    const highlights = statsArray.slice(0, 6).map(([key, value]) => ({
        label: key,
        detail: value.top_values ? `${Object.keys(value.top_values).length} unique categories` : 'Numeric distribution',
        value: value.mean_value ? value.mean_value.toFixed(2) : (value.max_value || 'N/A')
    }));

    if (isCollapsed) {
        return (
            <div className="bi-panel-container bi-panel-collapsed" onClick={onToggleCollapse}>
                <div className="bi-panel-collapsed-icons">
                    <div className="bi-collapsed-toggle-btn">
                        <ChevronRight size={16} />
                    </div>
                    <FileText size={18} className="bi-collapsed-icon" title="Data Summary" />
                    <BarChart3 size={18} className="bi-collapsed-icon" title="Stats" />
                </div>
            </div>
        );
    }

    return (
        <div className="bi-panel-container">
            <div className="bi-panel-header">
                <div className="bi-header-top-row">
                    <div className="bi-panel-title">Data Summary</div>
                    <button className="bi-panel-minimize" onClick={onToggleCollapse} title="Minimize">
                        <ChevronLeft size={16} />
                    </button>
                </div>
                <div className="bi-panel-subtitle">{fileName || 'Active Dataset'}</div>
            </div>

            <div className="bi-panel-content bi-insights-content">
                {selection ? (
                    <div className="bi-selection-detail">
                        <div className="bi-selection-header">
                            <span className="bi-selection-title">Selection Detail</span>
                            <button className="bi-clear-selection" onClick={() => window.location.reload()}>Reset</button>
                        </div>
                        <div className="bi-card bi-detail-card">
                            <div className="bi-detail-metric">{selection.graphTitle}</div>
                            <div className="bi-detail-value">{selection.name}</div>
                            <div className="bi-detail-sub">
                                <strong>{selection.value?.toLocaleString() || 'N/A'}</strong> {selection.yKey}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bi-summary-view">
                        {/* File Metadata Section */}
                        <div className="bi-summary-section">
                            <div className="bi-summary-item">
                                <FileText size={16} className="bi-summary-icon" />
                                <div className="bi-summary-info">
                                    <span className="bi-summary-label">Columns Identified</span>
                                    <span className="bi-summary-value">{columnCount}</span>
                                </div>
                            </div>
                            <div className="bi-summary-item">
                                <Database size={16} className="bi-summary-icon" />
                                <div className="bi-summary-info">
                                    <span className="bi-summary-label">Data Availability</span>
                                    <span className="bi-summary-value">100% Sync</span>
                                </div>
                            </div>
                        </div>

                        <div className="bi-section-divider"></div>

                        {/* Statistical Highlights */}
                        <div className="bi-highlights-header">
                            <BarChart3 size={14} />
                            <span>Statistical Highlights</span>
                        </div>

                        <div className="bi-highlights-list">
                            {highlights.length > 0 ? highlights.map((item, idx) => (
                                <div key={idx} className="bi-highlight-card">
                                    <div className="bi-highlight-main">
                                        <span className="bi-highlight-label">{item.label}</span>
                                        <span className="bi-highlight-value">{item.value}</span>
                                    </div>
                                    <div className="bi-highlight-footer">
                                        <span>{item.detail}</span>
                                    </div>
                                </div>
                            )) : (
                                <div className="bi-empty-highlights">
                                    <Info size={16} />
                                    <span>No detailed stats available yet.</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!selection && (
                <div className="bi-panel-footer">
                    <span>Generated from live dataset processing</span>
                </div>
            )}
        </div>
    );
};

export default BIInsightsPanel;
