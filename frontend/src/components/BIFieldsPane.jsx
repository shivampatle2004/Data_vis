import React, { useState } from 'react';
import { Search, Database, ChevronDown, ChevronRight, Hash, Type, Calendar, CheckSquare } from 'lucide-react';

const BIFieldsPane = ({ schema, fileName, measures = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isTableExpanded, setIsTableExpanded] = useState(true);
    const [isMeasuresExpanded, setIsMeasuresExpanded] = useState(true);

    const getIconForType = (type) => {
        if (!type) return <Type size={14} />;
        const t = type.toLowerCase();
        if (t.includes('int') || t.includes('float') || t.includes('numeric')) return <Hash size={14} className="bi-type-num" />;
        if (t.includes('date') || t.includes('time')) return <Calendar size={14} className="bi-type-date" />;
        if (t.includes('bool')) return <CheckSquare size={14} className="bi-type-bool" />;
        return <Type size={14} className="bi-type-text" />;
    };

    const filteredSchema = schema?.filter(s =>
        s.column_name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const filteredMeasures = measures?.filter(m =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const datasetName = fileName || 'Dataset';

    return (
        <div className="bi-pane-view">
            <div className="bi-pane-header">
                <span className="bi-pane-title">Fields</span>
            </div>

            <div className="bi-pane-search">
                <Search size={14} />
                <input
                    type="text"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="bi-pane-scroll">
                {/* ── Measures Section ── */}
                {measures.length > 0 && (
                    <div className="bi-field-tree" style={{ marginBottom: 12 }}>
                        <div
                            className="bi-tree-table"
                            onClick={() => setIsMeasuresExpanded(!isMeasuresExpanded)}
                        >
                            {isMeasuresExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <div className="bi-measure-icon"><span>&Sigma;</span></div>
                            <span className="bi-table-name">Measures</span>
                        </div>
                        {isMeasuresExpanded && (
                            <div className="bi-tree-columns">
                                {filteredMeasures.map((measure, idx) => (
                                    <div key={idx} className="bi-tree-item bi-measure-item">
                                        <div className="bi-item-icon bi-measure-icon">
                                            <span>&Sigma;</span>
                                        </div>
                                        <span className="bi-item-name">{measure.name}</span>
                                    </div>
                                ))}
                                {filteredMeasures.length === 0 && (
                                    <div className="bi-tree-item" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                        No measures match search
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Dataset Fields ── */}
                <div className="bi-field-tree">
                    <div
                        className="bi-tree-table"
                        onClick={() => setIsTableExpanded(!isTableExpanded)}
                    >
                        {isTableExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <Database size={14} className="bi-database-icon" />
                        <span className="bi-table-name">{datasetName}</span>
                    </div>

                    {isTableExpanded && (
                        <div className="bi-tree-columns">
                            {filteredSchema.map(col => (
                                <div key={col.column_name} className="bi-tree-item" draggable>
                                    <div className="bi-item-icon">
                                        {getIconForType(col.data_type)}
                                    </div>
                                    <span className="bi-item-name">{col.column_name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BIFieldsPane;
