import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import BIRibbon from '../components/BIRibbon';
import BIInsightsPanel from '../components/BIInsightsPanel';
import BIDashboardCanvas from '../components/BIDashboardCanvas';
import BIVisualizationsFieldsPanel from '../components/BIVisualizationsFieldsPanel';
import './AnalyticsDashboard.css';

/**
 * AnalyticsDashboard Component
 * A professional Power BI inspired dashboard layout.
 */
const AnalyticsDashboard = () => {
    const { fileId } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('Home');
    const [showMeasureBar, setShowMeasureBar] = useState(false);
    const [measureFormula, setMeasureFormula] = useState('Measure = ');
    const [measures, setMeasures] = useState([]);
    const fileInputRef = useRef(null);
    const [fileDetails, setFileDetails] = useState(null);
    const [stats, setStats] = useState(null);
    const [schema, setSchema] = useState([]);
    const [graphs, setGraphs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
    const [sqlForm, setSqlForm] = useState({
        serverName: '',
        databaseName: '',
        authType: 'windows',
        username: '',
        password: '',
        dbType: 'postgresql',
        connectionName: '',
        host: '',
        port: ''
    });
    const [isSqlSubmitting, setIsSqlSubmitting] = useState(false);
    const [sqlError, setSqlError] = useState('');
    const [sqlSuccess, setSqlSuccess] = useState('');

    // Multi-step SQL connection state
    const [sqlModalStep, setSqlModalStep] = useState(1);
    const [sqlActiveTab, setSqlActiveTab] = useState('upload'); // 'upload' or 'connect'
    const [sqlConnections, setSqlConnections] = useState([]);
    const [selectedConnectionId, setSelectedConnectionId] = useState(null);
    const [sqlQuery, setSqlQuery] = useState('');
    const [selectedConnectionName, setSelectedConnectionName] = useState('');

    useEffect(() => {
        if (!fileId) return;

        let pollInterval = null;

        const fetchAllData = async () => {
            try {
                // Fetch file status/details
                const statusRes = await fetch(`/api/files/${fileId}/status`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    setFileDetails(statusData);

                    // If still processing, don't stop polling
                    if (statusData.status === 'pending' || statusData.status === 'processing') {
                        if (!pollInterval) {
                            pollInterval = setInterval(fetchAllData, 3000);
                        }
                    } else {
                        // Status is completed or failed, stop polling
                        if (pollInterval) {
                            clearInterval(pollInterval);
                            pollInterval = null;
                        }
                    }
                }

                // Fetch schema
                const schemaRes = await fetch(`/api/files/${fileId}/schema`);
                if (schemaRes.ok) {
                    const schemaData = await schemaRes.json();
                    setSchema(schemaData);
                }

                // Fetch stats
                const statsRes = await fetch(`/api/files/${fileId}/statistics`);
                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                }

                // Fetch graphs (visualizations)
                const graphsRes = await fetch(`/api/files/${fileId}/graphs`);
                if (graphsRes.ok) {
                    const graphsData = await graphsRes.json();
                    setGraphs(graphsData);
                }
            } catch (err) {
                console.error("Error fetching analytics data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [fileId]);

    const handleAddVisual = async (vizType) => {
        // Simple implementation for adding a visual
        const newVisual = {
            file_id: fileId,
            graph_type: vizType,
            x_axis: schema.length > 0 ? schema[0].column_name : '',
            y_axis: schema.length > 1 ? schema[1].column_name : '',
            options: { title: `New ${vizType} Analysis` }
        };

        try {
            const res = await fetch(`/api/files/${fileId}/save-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newVisual)
            });
            if (res.ok) {
                const savedGraph = await res.json();
                setGraphs(prev => [...prev, savedGraph]);
            }
        } catch (err) {
            console.error("Error saving visual:", err);
        }
    };

    const handleDeleteVisual = async (graphId) => {
        // Optimistic delete: remove from UI immediately for instant feedback
        const previousGraphs = graphs;
        setGraphs(prev => prev.filter(g => g.id !== graphId));

        try {
            const res = await fetch(`/api/graphs/${graphId}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                // Restore on failure
                setGraphs(previousGraphs);
                console.error("Failed to delete visual, restoring.");
            }
        } catch (err) {
            // Restore on network error
            setGraphs(previousGraphs);
            console.error("Error deleting visual:", err);
        }
    };

    const handleUpdateVisual = async (graphId, updates) => {
        // Find existing graph to merge updates
        const existingGraph = graphs.find(g => g.id === graphId);
        if (!existingGraph) return;

        const updatedGraph = {
            ...existingGraph,
            ...updates,
            // Ensure consistent ID and file reference
            id: graphId,
            file_id: fileId
        };

        // Optimistic UI update for layout smoothness
        setGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));

        try {
            await fetch(`/api/files/${fileId}/save-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedGraph)
            });
        } catch (err) {
            console.error("Error updating visual:", err);
            // Non-blocking failure for layout persistence
        }
    };

    const handleRibbonAction = (id) => {
        console.log("AnalyticsDashboard handleRibbonAction:", id);
        switch (id) {
            case 'new_measure':
                setMeasureFormula('Measure = ');
                setShowMeasureBar(true);
                break;
            case 'quick_measure':
                setMeasureFormula('QuickMeasure = CALCULATE(SUM([Column]), FILTER(Table, Table[Status] = "Active"))');
                setShowMeasureBar(true);
                break;
            case 'sql':
                // Open inline SQL Server connection modal
                setIsSqlModalOpen(true);
                setSqlModalStep(2); // Start at connection selection (Step 2 supports PostgreSQL)
                setSqlActiveTab('connect');
                setSqlQuery('');
                setSelectedConnectionId(null);
                setSqlError('');
                setSqlSuccess('');
                setSelectedConnectionName('');
                break;
            case 'excel':
            case 'get_data':
                fileInputRef.current?.click();
                break;
            case 'refresh':
                // In a real app, this would re-fetch all data components
                window.location.reload();
                break;
            default:
                console.log("Generic action triggered:", id);
        }
    };

    const handleMeasureConfirm = () => {
        const formula = measureFormula.trim();
        if (!formula) return;
        // Parse the measure name from "Name = expression"
        const eqIndex = formula.indexOf('=');
        const name = eqIndex > -1
            ? formula.slice(0, eqIndex).trim()
            : formula;
        const expression = eqIndex > -1
            ? formula.slice(eqIndex + 1).trim()
            : '';
        setMeasures(prev => [...prev, { name: name || 'Measure', formula: expression }]);
        setShowMeasureBar(false);
        setMeasureFormula('Measure = ');
    };

    const handleMeasureCancel = () => {
        setShowMeasureBar(false);
        setMeasureFormula('Measure = ');
    };

    const handleSqlConnect = async (e) => {
        e.preventDefault();
        if (isSqlSubmitting) return;

        setIsSqlSubmitting(true);
        setSqlError('');

        try {
            const userId = localStorage.getItem('userId');
            const formData = new FormData();

            if (userId) {
                formData.append('user_id', userId);
            }

            const connectionName = sqlForm.connectionName || (sqlForm.databaseName
                ? `${sqlForm.host || sqlForm.serverName || 'SQL Server'} — ${sqlForm.databaseName}`
                : (sqlForm.host || sqlForm.serverName || 'SQL Server Connection'));

            formData.append('connection_name', connectionName);
            formData.append('db_type', sqlForm.dbType || 'mssql');
            formData.append('host', sqlForm.host || sqlForm.serverName);
            formData.append('port', sqlForm.port || '1433');
            formData.append('database', sqlForm.databaseName);
            formData.append('username', sqlForm.username);
            formData.append('password', sqlForm.password);
            formData.append('auth_type', sqlForm.authType);

            const res = await fetch('/api/sql/connect', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'SQL Server connection failed');
            }

            await res.json().catch(() => ({}));

            // If we reach here, connection was successful
            setSqlSuccess("Connection successful!");

            // Advance logic only on success
            setTimeout(() => {
                if (sqlModalStep === 1) {
                    setSqlModalStep(2); // Advance step 1 to step 2
                } else if (sqlModalStep === 2) {
                    const connName = sqlForm.connectionName || (sqlForm.databaseName
                        ? `${sqlForm.host || sqlForm.serverName || 'SQL Server'} — ${sqlForm.databaseName}`
                        : (sqlForm.host || sqlForm.serverName || 'SQL Server Connection'));
                    setSelectedConnectionName(connName);
                    setSqlModalStep(3); // Advance step 2 to step 3
                }
                setSqlSuccess(''); // Clear for next potential attempt
            }, 1000);

        } catch (err) {
            console.error("SQL Connection Error caught in handleSqlConnect:", err);
            setSqlError(err.message);
        } finally {
            setIsSqlSubmitting(false);
            // Don't clear sqlError/sqlSuccess here so user can read them

            // Always fetch existing connections for Step 2
            const uId = localStorage.getItem('userId');
            if (uId) {
                try {
                    const connsRes = await fetch(`/api/sql/connections/${uId}`);
                    if (connsRes.ok) {
                        const connsData = await connsRes.json();
                        setSqlConnections(connsData);
                    }
                } catch (e) {
                    console.error("Failed to fetch connections", e);
                }
            }
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0] || e;
        if (!file || typeof file === 'string') return;

        const formData = new FormData();
        formData.append('file', file);
        const userId = localStorage.getItem('userId');
        if (userId) formData.append('user_id', userId);

        try {
            setIsLoading(true);
            const res = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                navigate(`/analytics/${data.file_id}`);
                window.location.reload();
            }
        } catch (err) {
            console.error("Upload error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteSql = async () => {
        if (!sqlQuery.trim()) return;
        if (isSqlSubmitting) return;

        setIsSqlSubmitting(true);
        setSqlError('');

        try {
            const userId = localStorage.getItem('userId');
            const formData = new FormData();
            formData.append('query', sqlQuery);
            if (userId) formData.append('user_id', userId);
            if (selectedConnectionId) formData.append('connection_id', selectedConnectionId);

            const res = await fetch('/api/sql/visualize', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.detail || 'SQL Execution failed');
            }

            const data = await res.json();

            // Success! Close modal and navigate to new file
            setIsSqlModalOpen(false);
            if (data.file_id) {
                navigate(`/analytics/${data.file_id}`);
                // Refresh to load the new context if needed, 
                // though navigate should handle it if params change
                window.location.reload();
            }
        } catch (err) {
            console.error("SQL Execution Error:", err);
            setSqlError(err.message);
        } finally {
            setIsSqlSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bi-dashboard-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="bi-loader">Loading Analytics...</div>
            </div>
        );
    }

    return (
        <div className="bi-dashboard-root">
            {/* Top Ribbon Navigation */}
            <BIRibbon
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onAction={handleRibbonAction}
                fileName={fileDetails?.fileName}
            />

            {/* New Measure Formula Bar */}
            {showMeasureBar && (
                <div className="bi-measure-bar">
                    <span className="bi-measure-bar-label">Measure</span>
                    <button
                        className="bi-measure-confirm"
                        onClick={handleMeasureConfirm}
                        title="Confirm measure (Enter)"
                    >✓</button>
                    <button
                        className="bi-measure-cancel"
                        onClick={handleMeasureCancel}
                        title="Cancel (Escape)"
                    >✕</button>
                    <input
                        className="bi-measure-input"
                        type="text"
                        value={measureFormula}
                        onChange={e => setMeasureFormula(e.target.value)}
                        autoFocus
                        spellCheck={false}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleMeasureConfirm();
                            if (e.key === 'Escape') handleMeasureCancel();
                        }}
                    />
                </div>
            )}

            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls,.json,.txt"
            />

            <div className="bi-dashboard-body">
                <PanelGroup direction="horizontal">
                    {/* Left Insights Panel */}
                    <Panel defaultSize={20} minSize={15} collapsible={true}>
                        <BIInsightsPanel
                            stats={stats}
                            fileName={fileDetails?.fileName}
                        />
                    </Panel>

                    <PanelResizeHandle className="bi-resize-handle-v" />

                    {/* Central Canvas */}
                    <Panel defaultSize={60} minSize={40}>
                        {fileDetails?.status === 'failed' ? (
                            <div className="bi-error-state">
                                <div className="bi-error-icon">❌</div>
                                <h3>Processing Failed</h3>
                                <p>{fileDetails?.error || 'An unexpected error occurred during data analysis.'}</p>
                                <button className="sql-btn sql-btn-primary" onClick={() => window.location.reload()}>Retry</button>
                            </div>
                        ) : (fileDetails?.status === 'pending' || fileDetails?.status === 'processing') ? (
                            <div className="bi-processing-state">
                                <div className="bi-processing-spinner"></div>
                                <h3>Analyzing Results...</h3>
                                <p>We are currently crunching the data from your SQL query to generate charts and insights.</p>
                                <div className="bi-processing-progress">
                                    <div className="bi-progress-bar"></div>
                                </div>
                            </div>
                        ) : (
                            <BIDashboardCanvas
                                graphs={graphs}
                                stats={stats}
                                schema={schema}
                                fileId={fileId}
                                onAddVisual={handleAddVisual}
                                onDeleteVisual={handleDeleteVisual}
                                onUpdateVisual={handleUpdateVisual}
                            />
                        )}
                    </Panel>

                    <PanelResizeHandle className="bi-resize-handle-v" />

                    {/* Right Visualizations & Fields Panel */}
                    <Panel defaultSize={20} minSize={15} collapsible={true}>
                        <BIVisualizationsFieldsPanel
                            schema={schema}
                            fileName={fileDetails?.fileName}
                            onAddVisual={handleAddVisual}
                            measures={measures}
                        />
                    </Panel>
                </PanelGroup>
            </div>

            {/* Bottom Status Bar (Optional Power BI feel) */}
            <div className="bi-status-bar">
                <div className="bi-status-item">Page 1 of 1</div>
                <div className="bi-status-item">Dataset: {fileDetails?.fileName || 'Loading...'}</div>
                <div className="bi-status-item">Status: {fileDetails?.status || 'Ready'}</div>
                <div className="bi-status-item">Rows: {fileDetails?.row_count || '0'}</div>
            </div>

            {isSqlModalOpen && (
                <div className="sql-modal-overlay" onClick={() => setIsSqlModalOpen(false)}>
                    {sqlModalStep === 1 && (
                        <div className="sql-modal" onClick={e => e.stopPropagation()}>
                            <div className="sql-modal-header">
                                <h2 className="sql-modal-title">Connect to SQL Server</h2>
                                <button
                                    type="button"
                                    className="sql-modal-close"
                                    onClick={() => setIsSqlModalOpen(false)}
                                    aria-label="Close dialog"
                                >
                                    ×
                                </button>
                            </div>
                            <form className="sql-modal-body" onSubmit={handleSqlConnect}>
                                {sqlError && (
                                    <div className="sql-error-banner">
                                        {sqlError}
                                    </div>
                                )}
                                {sqlSuccess && (
                                    <div className="sql-success-banner">
                                        {sqlSuccess}
                                    </div>
                                )}
                                <div className="sql-form-group">
                                    <label className="sql-label">Server Name</label>
                                    <input
                                        className="sql-input"
                                        value={sqlForm.serverName}
                                        onChange={e => setSqlForm(f => ({ ...f, serverName: e.target.value }))}
                                        placeholder="e.g. myserver.database.windows.net"
                                    />
                                </div>
                                <div className="sql-form-group">
                                    <label className="sql-label">Database Name</label>
                                    <input
                                        className="sql-input"
                                        value={sqlForm.databaseName}
                                        onChange={e => setSqlForm(f => ({ ...f, databaseName: e.target.value }))}
                                        placeholder="e.g. SalesDW"
                                    />
                                </div>
                                <div className="sql-form-row">
                                    <div className="sql-form-group">
                                        <label className="sql-label">Authentication Type</label>
                                        <select
                                            className="sql-select"
                                            value={sqlForm.authType}
                                            onChange={e => setSqlForm(f => ({ ...f, authType: e.target.value }))}
                                        >
                                            <option value="windows">Windows</option>
                                            <option value="sql">SQL Server</option>
                                        </select>
                                    </div>
                                    <div className="sql-form-group">
                                        <label className="sql-label">Username</label>
                                        <input
                                            className="sql-input"
                                            value={sqlForm.username}
                                            onChange={e => setSqlForm(f => ({ ...f, username: e.target.value }))}
                                            placeholder="e.g. analytics_user"
                                        />
                                    </div>
                                </div>
                                <div className="sql-form-row" style={{ alignItems: 'flex-end' }}>
                                    <div className="sql-form-group">
                                        <label className="sql-label">Password</label>
                                        <input
                                            className="sql-input"
                                            type="password"
                                            value={sqlForm.password}
                                            onChange={e => setSqlForm(f => ({ ...f, password: e.target.value }))}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="sql-modal-footer" style={{ margin: 0, paddingBottom: 0 }}>
                                        <button
                                            type="button"
                                            className="sql-btn sql-btn-secondary"
                                            onClick={() => setIsSqlModalOpen(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="sql-btn sql-btn-primary"
                                            disabled={isSqlSubmitting}
                                        >
                                            {isSqlSubmitting ? 'Connecting…' : 'Connect'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}

                    {sqlModalStep === 2 && (
                        <div className="sql-modal sql-step2-modal" onClick={e => e.stopPropagation()}>
                            <button
                                type="button"
                                className="sql-modal-close"
                                onClick={() => setIsSqlModalOpen(false)}
                                aria-label="Close dialog"
                                style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
                            >
                                ×
                            </button>
                            <div className="sql-step2-layout">
                                <div className="sql-step2-main" style={{ padding: '20px 24px' }}>
                                    <div className="sql-form-tabs" style={{ marginBottom: '16px' }}>
                                        <button
                                            className={`tab-btn ${sqlActiveTab === 'upload' ? 'active' : ''}`}
                                            onClick={() => setSqlActiveTab('upload')}
                                        >
                                            Upload SQL File
                                        </button>
                                        <button
                                            className={`tab-btn ${sqlActiveTab === 'connect' ? 'active' : ''}`}
                                            onClick={() => setSqlActiveTab('connect')}
                                        >
                                            Connect Database
                                        </button>
                                    </div>

                                    <div className="sql-step2-content">
                                        {sqlActiveTab === 'upload' && (
                                            <label className="sql-upload-zone" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <input type="file" accept=".sql" style={{ display: 'none' }} onChange={(e) => {
                                                    const file = e.target.files[0];
                                                    if (file) {
                                                        alert(`Selected file: ${file.name}\n(SQL File Upload logic to be implemented)`);
                                                    }
                                                }} />
                                                <div className="upload-icon">📄</div>
                                                <p className="upload-main-text">Click to upload .sql file</p>
                                                <p className="upload-sub-text">Execution will create tables/data in the workspace</p>
                                            </label>
                                        )}
                                        {sqlActiveTab === 'connect' && (
                                            <form className="sql-step2-form" onSubmit={handleSqlConnect} style={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
                                                {sqlError && (
                                                    <div className="sql-error-banner" style={{ margin: '0 24px 12px' }}>
                                                        {sqlError}
                                                    </div>
                                                )}
                                                {sqlSuccess && (
                                                    <div className="sql-success-banner" style={{ margin: '0 24px 12px' }}>
                                                        {sqlSuccess}
                                                    </div>
                                                )}
                                                <div className="sql-form-scrollable" style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                    <div className="sql-form-group">
                                                        <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Database Type</label>
                                                        <select className="sql-select" value={sqlForm.dbType} onChange={e => setSqlForm(f => ({ ...f, dbType: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff' }}>
                                                            <option value="postgresql">PostgreSQL</option>
                                                            <option value="sqlserver">SQL Server</option>
                                                            <option value="mysql">MySQL</option>
                                                        </select>
                                                    </div>
                                                    <div className="sql-form-group">
                                                        <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Connection Name</label>
                                                        <input className="sql-input" placeholder="e.g. Production Data" value={sqlForm.connectionName} onChange={e => setSqlForm(f => ({ ...f, connectionName: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                    </div>
                                                    <div className="sql-form-row" style={{ display: 'flex', gap: '16px' }}>
                                                        <div className="sql-form-group" style={{ flex: 1 }}>
                                                            <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Host</label>
                                                            <input className="sql-input" placeholder="localhost" value={sqlForm.host} onChange={e => setSqlForm(f => ({ ...f, host: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                        </div>
                                                        <div className="sql-form-group" style={{ flex: 1 }}>
                                                            <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Port</label>
                                                            <input className="sql-input" placeholder="5432" value={sqlForm.port} onChange={e => setSqlForm(f => ({ ...f, port: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                        </div>
                                                    </div>
                                                    <div className="sql-form-row" style={{ display: 'flex', gap: '16px' }}>
                                                        <div className="sql-form-group" style={{ flex: 1 }}>
                                                            <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Database Name</label>
                                                            <input className="sql-input" placeholder="db_name" value={sqlForm.databaseName} onChange={e => setSqlForm(f => ({ ...f, databaseName: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                        </div>
                                                        <div className="sql-form-group" style={{ flex: 1 }}>
                                                            <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Username</label>
                                                            <input className="sql-input" placeholder="postgres" value={sqlForm.username} onChange={e => setSqlForm(f => ({ ...f, username: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                        </div>
                                                    </div>
                                                    <div className="sql-form-row" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                                                        <div className="sql-form-group" style={{ flex: 1 }}>
                                                            <label className="sql-label" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em', marginBottom: '6px' }}>Password</label>
                                                            <input className="sql-input" type="password" value={sqlForm.password} onChange={e => setSqlForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '13px' }} />
                                                        </div>
                                                        <div className="sql-form-buttons" style={{ display: 'flex', gap: '8px' }}>
                                                            <button type="button" className="sql-btn sql-btn-secondary" onClick={() => setIsSqlModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px' }}>
                                                                Cancel
                                                            </button>
                                                            <button type="submit" className="sql-btn sql-btn-primary" disabled={isSqlSubmitting} style={{ padding: '8px 24px', borderRadius: '6px' }}>
                                                                {isSqlSubmitting ? 'Connecting…' : 'Connect'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                </div>

                                <div className="sql-step2-sidebar">
                                    <h3 className="side-section-head-title">YOUR CONNECTIONS</h3>
                                    <div className="connection-list">
                                        {sqlConnections.length > 0 ? (
                                            sqlConnections.map(conn => (
                                                <div
                                                    key={conn.id}
                                                    className={`connection-item ${selectedConnectionId === conn.id ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedConnectionId(conn.id);
                                                        setSelectedConnectionName(conn.connection_name);
                                                        setSqlModalStep(3); // Auto advance to next step for demo flow as requested
                                                    }}
                                                >
                                                    <div className="conn-radio">
                                                        {selectedConnectionId === conn.id && <div className="conn-radio-inner" />}
                                                    </div>
                                                    <div className="conn-info">
                                                        <p className="conn-name">{conn.connection_name}</p>
                                                        <span className="conn-meta">{conn.host}:{conn.port}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="sql-btn sql-btn-primary"
                                                        style={{ padding: '4px 12px', fontSize: '12px', marginLeft: 'auto', zIndex: 2 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedConnectionId(conn.id);
                                                            setSelectedConnectionName(conn.connection_name);
                                                            setSqlModalStep(3); // Auto advance to next step for demo flow
                                                        }}
                                                    >Connect</button>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="connection-item">
                                                <div className="conn-radio"></div>
                                                <div className="conn-info">
                                                    <p className="conn-name">localhost — onestop...</p>
                                                    <span className="conn-meta">localhost:5432</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="sql-btn sql-btn-primary"
                                                    style={{ padding: '4px 12px', fontSize: '12px', marginLeft: 'auto', zIndex: 2 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedConnectionName('localhost — onestop...');
                                                        setSqlModalStep(3);
                                                    }}
                                                >Connect</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="sql-sidebar-tip" style={{ marginTop: 'auto', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: '16px' }}>💡</span>
                                            <div>
                                                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#475569' }}>Tip</p>
                                                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                                                    Connecting to your database allows real-time visualization of your tables without manual CSV exports.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {sqlModalStep === 3 && (
                        <div className="sql-modal sql-step3-modal" onClick={e => e.stopPropagation()}>
                            <div className="sql-step3-header">
                                <h3 className="sql-step3-title">
                                    Query Database: <span className="highlight">"{selectedConnectionName || 'Local DB'}"</span>
                                </h3>
                                <button
                                    className="btn-switch-conn"
                                    onClick={() => setSqlModalStep(2)}
                                >
                                    Switch Connection
                                </button>
                            </div>

                            <div className="sql-editor-container" style={{ position: 'relative' }}>
                                {sqlError && (
                                    <div className="sql-error-banner" style={{
                                        margin: '0 0 12px 0',
                                        borderRadius: '6px',
                                        backgroundColor: '#fee2e2',
                                        color: '#dc2626',
                                        padding: '10px 14px',
                                        fontSize: '13px',
                                        border: '1px solid #fecaca'
                                    }}>
                                        {sqlError}
                                    </div>
                                )}
                                <textarea
                                    className="sql-query-textarea"
                                    placeholder="SELECT * FROM table_name WHERE ..."
                                    value={sqlQuery}
                                    onChange={(e) => setSqlQuery(e.target.value)}
                                    autoFocus
                                    disabled={isSqlSubmitting}
                                />
                            </div>

                            <div className="sql-step3-footer">
                                <button
                                    className="btn-execute-visualize"
                                    onClick={handleExecuteSql}
                                    disabled={isSqlSubmitting || !sqlQuery.trim()}
                                >
                                    {isSqlSubmitting ? 'Processing...' : 'Execute & Visualize'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;
