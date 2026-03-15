import React, { useState } from 'react';
import './BIVisualizationsPane.css';
import {
    BarChart, BarChart2, LineChart, PieChart, Activity,
    Layers, ScatterChart, Table, Grid, Map,
    Square, Type, Zap, Maximize2, Settings2, Palette, Layout,
    Gauge, Milestone, Table2, Trello, Compass, Waves, Boxes, Hash,
    Sun, Radar, Target, Circle, ChevronDown
} from 'lucide-react';

const BIVisualizationsPane = ({ selectedVisual, onUpdateVisual, onAddVisual, schema, measures = [] }) => {
    const [viewMode, setViewMode] = useState('build'); // 'build', 'format', 'general'
    const [isSelectorCollapsed, setIsSelectorCollapsed] = useState(false);

    const visualTypes = [
        { type: 'bar', icon: <BarChart2 size={16} />, label: 'Bar' },
        { type: 'column', icon: <BarChart size={16} />, label: 'Column' },
        { type: 'line', icon: <LineChart size={16} />, label: 'Line' },
        { type: 'area', icon: <Activity size={16} />, label: 'Area' },
        { type: 'pie', icon: <PieChart size={16} />, label: 'Pie' },
        { type: 'donut', icon: <PieChart size={16} />, label: 'Donut' },
        { type: 'treemap', icon: <Layers size={16} />, label: 'Treemap' },
        { type: 'scatter', icon: <ScatterChart size={16} />, label: 'Scatter' },
        { type: 'waterfall', icon: <Activity size={16} />, label: 'Waterfall' },
        { type: 'funnel', icon: <Waves size={16} />, label: 'Funnel' },
        { type: 'radar', icon: <Radar size={16} />, label: 'Radar' },
        { type: 'radialBar', icon: <Gauge size={16} />, label: 'Gauge' },
        { type: 'polarArea', icon: <Compass size={16} />, label: 'Polar Area' },
        { type: 'kpiCard', icon: <Hash size={16} />, label: 'KPI Card' },
        { type: 'heatmap', icon: <Grid size={16} />, label: 'Heatmap' },
        { type: 'bubble', icon: <Circle size={16} />, label: 'Bubble' },
        { type: 'bullet', icon: <Target size={16} />, label: 'Bullet' },
        { type: 'sankey', icon: <Milestone size={16} />, label: 'Sankey' },
        { type: 'map', icon: <Map size={16} />, label: 'Map' },
        { type: 'sunburst', icon: <Sun size={16} />, label: 'Sunburst' },
        { type: 'boxPlot', icon: <Boxes size={16} />, label: 'Box Plot' },
        { type: 'composed', icon: <Layout size={16} />, label: 'Composed' },
        { type: 'table', icon: <Table size={16} />, label: 'Table' },
    ];

    const currentOptions = selectedVisual?.options || {};

    const handleOptionUpdate = (key, value) => {
        if (!selectedVisual) return;
        const newOptions = { ...currentOptions, [key]: value };
        onUpdateVisual(selectedVisual.id, { options: newOptions });
    };

    const VIBRANT_PALETTE = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6', '#F97316', '#14B8A6', '#1e293b'];

    const handleTypeChange = (type) => {
        if (selectedVisual) {
            onUpdateVisual(selectedVisual.id, { graph_type: type });
        } else {
            onAddVisual(type);
        }
    };

    return (
        <div className="bi-pane-view">
            <div className="bi-pane-header">
                <span className="bi-pane-title">Visualizations</span>
                <button
                    className={`bi-pane-toggle-btn ${isSelectorCollapsed ? 'collapsed' : ''}`}
                    onClick={() => setIsSelectorCollapsed(!isSelectorCollapsed)}
                    title={isSelectorCollapsed ? "Expand Charts" : "Collapse Charts"}
                >
                    <ChevronDown size={16} />
                </button>
            </div>

            <div className={`bi-viz-selector-container ${isSelectorCollapsed ? 'collapsed' : ''}`}>
                <div className="bi-viz-selector-grid">
                    {visualTypes.map(v => (
                        <div
                            key={v.type}
                            className={`bi-viz-type ${selectedVisual?.graph_type === v.type ? 'active' : ''}`}
                            title={v.label}
                            onClick={() => handleTypeChange(v.type)}
                            draggable="true"
                            onDragStart={(e) => {
                                e.dataTransfer.setData('bi/viz-type', v.type);
                                e.dataTransfer.effectAllowed = 'move';

                                // Create a temporary ghost image
                                const dragPreview = e.target.cloneNode(true);
                                dragPreview.style.position = 'absolute';
                                dragPreview.style.top = '-1000px';
                                document.body.appendChild(dragPreview);
                                e.dataTransfer.setDragImage(dragPreview, 20, 20);
                                setTimeout(() => document.body.removeChild(dragPreview), 0);
                            }}
                        >
                            {v.icon}
                            <span className="bi-viz-label">{v.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bi-viz-sub-tabs">
                <div
                    className={`bi-viz-sub-tab ${viewMode === 'build' ? 'active' : ''}`}
                    onClick={() => setViewMode('build')}
                    title="Build Visual"
                >
                    <Layout size={16} />
                </div>
                <div
                    className={`bi-viz-sub-tab ${viewMode === 'format' ? 'active' : ''}`}
                    onClick={() => setViewMode('format')}
                    title="Format Visual"
                >
                    <Palette size={16} />
                </div>
                <div
                    className={`bi-viz-sub-tab ${viewMode === 'general' ? 'active' : ''}`}
                    onClick={() => setViewMode('general')}
                    title="General Settings"
                >
                    <Settings2 size={16} />
                </div>
            </div>

            <div className="bi-pane-scroll">
                {viewMode === 'build' && (
                    <div className="bi-build-area">
                        <div className="bi-build-bucket">
                            <span className="bi-bucket-label">Y-Axis</span>
                            <div className="bi-bucket-drop">
                                <select
                                    className="bi-bucket-select"
                                    value={selectedVisual?.y_axis || ''}
                                    onChange={(e) => onUpdateVisual(selectedVisual.id, { y_axis: e.target.value })}
                                    disabled={!selectedVisual}
                                >
                                    <option value="">Add data fields here</option>
                                    <optgroup label="Columns">
                                        {schema?.map(col => (
                                            <option key={col.column_name} value={col.column_name}>
                                                {col.column_name}
                                            </option>
                                        ))}
                                    </optgroup>
                                    {measures && measures.length > 0 && (
                                        <optgroup label="Measures">
                                            {measures.map(m => (
                                                <option key={m.name} value={m.name}>
                                                    Σ {m.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="bi-build-bucket">
                            <span className="bi-bucket-label">X-Axis</span>
                            <div className="bi-bucket-drop">
                                <select
                                    className="bi-bucket-select"
                                    value={selectedVisual?.x_axis || ''}
                                    onChange={(e) => onUpdateVisual(selectedVisual.id, { x_axis: e.target.value })}
                                    disabled={!selectedVisual}
                                >
                                    <option value="">Add data fields here</option>
                                    <optgroup label="Columns">
                                        {schema?.map(col => (
                                            <option key={col.column_name} value={col.column_name}>
                                                {col.column_name}
                                            </option>
                                        ))}
                                    </optgroup>
                                    {measures && measures.length > 0 && (
                                        <optgroup label="Measures">
                                            {measures.map(m => (
                                                <option key={m.name} value={m.name}>
                                                    Σ {m.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                        </div>
                        <div className="bi-build-bucket">
                            <span className="bi-bucket-label">Legend</span>
                            <div className="bi-bucket-drop">
                                <span className="bi-bucket-placeholder">Add data fields here</span>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'format' && (
                    <div className="bi-format-area">
                        {!selectedVisual ? (
                            <div className="bi-format-placeholder">Select a visual to format</div>
                        ) : (
                            <>
                                <div className="bi-format-section">
                                    <div className="bi-format-section-header">Visual Title</div>
                                    <div className="bi-format-field">
                                        <input
                                            type="text"
                                            className="bi-format-input"
                                            placeholder="Enter visual title..."
                                            value={currentOptions.title || ''}
                                            onChange={(e) => handleOptionUpdate('title', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {selectedVisual.graph_type === 'waterfall' ? (
                                    <>
                                        <div className="bi-format-section">
                                            <div className="bi-format-section-header">Increase Color</div>
                                            <div className="bi-color-grid">
                                                {VIBRANT_PALETTE.map(color => (
                                                    <div
                                                        key={`inc-${color}`}
                                                        className={`bi-color-swatch ${currentOptions.positiveColor === color ? 'selected' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => handleOptionUpdate('positiveColor', color)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bi-format-section">
                                            <div className="bi-format-section-header">Decrease Color</div>
                                            <div className="bi-color-grid">
                                                {VIBRANT_PALETTE.map(color => (
                                                    <div
                                                        key={`dec-${color}`}
                                                        className={`bi-color-swatch ${currentOptions.negativeColor === color ? 'selected' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                        onClick={() => handleOptionUpdate('negativeColor', color)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="bi-format-section">
                                        <div className="bi-format-section-header">Chart Color</div>
                                        <div className="bi-color-grid">
                                            {VIBRANT_PALETTE.map(color => (
                                                <div
                                                    key={color}
                                                    className={`bi-color-swatch ${currentOptions.mainColor === color ? 'selected' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                    onClick={() => handleOptionUpdate('mainColor', color)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="bi-format-section">
                                    <div className="bi-format-toggle-item">
                                        <span>Show X-Axis</span>
                                        <input
                                            type="checkbox"
                                            checked={currentOptions.showXAxis !== false}
                                            onChange={(e) => handleOptionUpdate('showXAxis', e.target.checked)}
                                        />
                                    </div>
                                    <div className="bi-format-toggle-item">
                                        <span>Show Y-Axis</span>
                                        <input
                                            type="checkbox"
                                            checked={currentOptions.showYAxis !== false}
                                            onChange={(e) => handleOptionUpdate('showYAxis', e.target.checked)}
                                        />
                                    </div>
                                    <div className="bi-format-toggle-item">
                                        <span>Data Labels</span>
                                        <input
                                            type="checkbox"
                                            checked={currentOptions.showDataLabels === true}
                                            onChange={(e) => handleOptionUpdate('showDataLabels', e.target.checked)}
                                        />
                                    </div>
                                </div>

                                <div className="bi-format-section">
                                    <div className="bi-format-section-header">Background Color</div>
                                    <div className="bi-color-grid">
                                        {['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0'].map(color => (
                                            <div
                                                key={color}
                                                className={`bi-color-swatch ${currentOptions.bgColor === color ? 'selected' : ''}`}
                                                style={{ backgroundColor: color, border: '1px solid #dee2e6' }}
                                                onClick={() => handleOptionUpdate('bgColor', color)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {viewMode === 'general' && (
                    <div className="bi-general-area">
                        <div className="bi-format-item">Position</div>
                        <div className="bi-format-item">Size</div>
                        <div className="bi-format-item">Alt Text</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BIVisualizationsPane;
