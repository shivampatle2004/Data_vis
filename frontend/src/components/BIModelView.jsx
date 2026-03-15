import React, { useState, useRef, useCallback } from 'react';
import './BIModelView.css';

const TABLE_COLORS = [
    '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

const BIModelView = ({ schema, fileName }) => {
    const [tables, setTables] = useState(() => {
        if (!schema || schema.length === 0) return [];
        return [
            {
                id: 'main',
                name: fileName || 'Dataset',
                colorIndex: 0,
                x: 80,
                y: 80,
                columns: schema.map(col => ({
                    name: col.column_name,
                    type: col.data_type || 'text',
                    isPrimary: false,
                })),
            }
        ];
    });

    const [relationships, setRelationships] = useState([]);
    const [dragging, setDragging] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const canvasRef = useRef(null);

    const onMouseDown = useCallback((e, tableId) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const table = tables.find(t => t.id === tableId);
        setDragging(tableId);
        setDragOffset({
            x: e.clientX - rect.left - table.x,
            y: e.clientY - rect.top - table.y,
        });
        e.stopPropagation();
    }, [tables]);

    const onMouseMove = useCallback((e) => {
        if (!dragging) return;
        const rect = canvasRef.current.getBoundingClientRect();
        setTables(prev => prev.map(t =>
            t.id === dragging
                ? { ...t, x: Math.max(0, e.clientX - rect.left - dragOffset.x), y: Math.max(0, e.clientY - rect.top - dragOffset.y) }
                : t
        ));
    }, [dragging, dragOffset]);

    const onMouseUp = useCallback(() => setDragging(null), []);

    const getTypeIcon = (type) => {
        if (!type) return '∑';
        const t = type.toLowerCase();
        if (t.includes('int') || t.includes('float') || t.includes('num') || t.includes('dec')) return '∑';
        if (t.includes('date') || t.includes('time')) return '📅';
        if (t.includes('bool')) return '◉';
        return 'T';
    };

    if (!schema || schema.length === 0) {
        return (
            <div className="bi-model-empty">
                <div className="bi-model-empty-icon">⬡</div>
                <p>No data model available.</p>
                <span>Upload a dataset to see the model view.</span>
            </div>
        );
    }

    return (
        <div className="bi-model-view">
            <div className="bi-model-toolbar">
                <span className="bi-model-toolbar-label">Model View</span>
                <span className="bi-model-hint">Drag tables to rearrange</span>
            </div>

            <div
                className="bi-model-canvas"
                ref={canvasRef}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            >
                {/* Relationship lines (SVG layer) */}
                <svg className="bi-model-relations-svg">
                    {relationships.map((rel, idx) => {
                        const from = tables.find(t => t.id === rel.fromTable);
                        const to = tables.find(t => t.id === rel.toTable);
                        if (!from || !to) return null;
                        const x1 = from.x + 180, y1 = from.y + 40;
                        const x2 = to.x, y2 = to.y + 40;
                        return (
                            <g key={idx}>
                                <path
                                    d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                                    fill="none"
                                    stroke="#94a3b8"
                                    strokeWidth="1.5"
                                    strokeDasharray="4"
                                />
                                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fontSize="10" fill="#64748b" textAnchor="middle">
                                    {rel.cardinality || '1:N'}
                                </text>
                            </g>
                        );
                    })}
                </svg>

                {/* Table Cards */}
                {tables.map((table) => (
                    <div
                        key={table.id}
                        className="bi-model-table"
                        style={{ left: table.x, top: table.y }}
                        onMouseDown={(e) => onMouseDown(e, table.id)}
                    >
                        <div
                            className="bi-model-table-header"
                            style={{ backgroundColor: TABLE_COLORS[table.colorIndex % TABLE_COLORS.length] }}
                        >
                            <span className="bi-model-table-name">{table.name}</span>
                            <span className="bi-model-table-count">{table.columns.length} columns</span>
                        </div>
                        <div className="bi-model-table-body">
                            {table.columns.slice(0, 12).map((col, idx) => (
                                <div key={idx} className="bi-model-column-row">
                                    <span className="bi-model-col-type">{getTypeIcon(col.type)}</span>
                                    <span className="bi-model-col-name">{col.name}</span>
                                    <span className="bi-model-col-dtype">{col.type || 'text'}</span>
                                </div>
                            ))}
                            {table.columns.length > 12 && (
                                <div className="bi-model-more">
                                    +{table.columns.length - 12} more columns
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {tables.length === 0 && (
                    <div className="bi-model-placeholder">
                        <p>No tables to display</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BIModelView;
