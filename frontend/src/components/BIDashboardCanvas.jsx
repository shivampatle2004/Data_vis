import React from 'react';
import DynamicChart from './DynamicChart';
import './BIDashboardCanvas.css';

const BIDashboardCanvas = ({
    graphs, stats, schema, fileId, onDataClick, isExporting, activeVisualId, onSelectVisual, onAddVisual,
    onResizeChart,
    onUpdateVisual, onDeleteVisual
}) => {
    const [focusedGraph, setFocusedGraph] = React.useState(null);
    const [isDraggingOverCanvas, setIsDraggingOverCanvas] = React.useState(false);
    const workspaceRef = React.useRef(null);
    const initializedLayoutIdsRef = React.useRef(new Set());

    // Interactive Dragging State
    const [draggingGraphId, setDraggingGraphId] = React.useState(null);
    const [dragStartMouse, setDragStartMouse] = React.useState({ x: 0, y: 0 });
    const [dragStartCard, setDragStartCard] = React.useState({ x: 0, y: 0 });

    // Interactive Resizing State
    const [resizingGraphId, setResizingGraphId] = React.useState(null);
    const [resizeDir, setResizeDir] = React.useState(null);
    const [initialPos, setInitialPos] = React.useState({ x: 0, y: 0 });
    const [initialSize, setInitialSize] = React.useState({ width: 0, height: 0 });
    const [initialResizeCard, setInitialResizeCard] = React.useState({ x: 0, y: 0, width: 0, height: 0 });

    // High-performance drag rendering state (local only, does not affect backend).
    // We track deltas from the committed layout position so we can use transforms.
    const dragLivePositionRef = React.useRef({});
    const dragAnimationFrameRef = React.useRef(null);
    const dragLastPersistTimeRef = React.useRef(0);
    const [dragRenderTick, setDragRenderTick] = React.useState(0);

    // Generate KPI data from stats/schema if available, otherwise use defaults
    const kpiData = schema && schema.length > 0 ? schema.slice(0, 5).map(col => ({
        label: col.column_name,
        value: (col.unique_count !== undefined && col.unique_count !== null) ? col.unique_count.toLocaleString() : 'N/A'
    })) : stats ? Object.keys(stats).slice(0, 5).map(key => ({
        label: key,
        value: (stats[key]?.unique_count || stats[key]?.count || 'N/A').toLocaleString()
    })) : [
        { value: '0', label: 'No Data' }
    ];

    const handleChartClick = React.useCallback((graph) => {
        setFocusedGraph(graph);
        if (onDataClick) onDataClick(null);
    }, [onDataClick]);

    const handleUpdate = React.useCallback((id, updates) => {
        if (onUpdateVisual) onUpdateVisual(id, updates);
    }, [onUpdateVisual]);

    // State for fetched data used to compute KPI stats in focus mode
    const [focusData, setFocusData] = React.useState(null);

    // Whenever a graph is focused, load its data (from cache or API)
    React.useEffect(() => {
        setFocusData(null);
        if (!focusedGraph) return;

        // Try cached_data first (fastest)
        const cd = focusedGraph.cached_data;
        if (cd && Array.isArray(cd.values) && cd.values.length > 0) {
            setFocusData(cd.values);
            return;
        }

        // Fall back to fetching from the API
        if (!fileId || !focusedGraph.x_axis) return;
        const fetchFocusData = async () => {
            try {
                const res = await fetch(`/api/files/${fileId}/graph-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        graph_type: focusedGraph.graph_type,
                        x_axis: focusedGraph.x_axis,
                        y_axis: focusedGraph.y_axis,
                        aggregation: focusedGraph.aggregation
                    })
                });
                if (!res.ok) return;
                const result = await res.json();
                if (result && Array.isArray(result.values)) {
                    setFocusData(result.values);
                }
            } catch (_) { /* silent fail */ }
        };
        fetchFocusData();
    }, [focusedGraph, fileId]);

    // Compute KPI stats from focusData
    const focusStats = React.useMemo(() => {
        if (!focusData || !Array.isArray(focusData)) return null;
        const nums = focusData
            .map(v => parseFloat(String(v).replace(/,/g, '')))
            .filter(v => !isNaN(v));
        if (nums.length === 0) return null;
        const total = nums.reduce((a, b) => a + b, 0);
        return {
            total,
            avg: total / nums.length,
            max: Math.max(...nums),
            min: Math.min(...nums),
        };
    }, [focusData]);

    const handleCanvasDragOver = (e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('bi/viz-type')) {
            setIsDraggingOverCanvas(true);
            e.dataTransfer.dropEffect = 'move';
        }
    };

    const handleCanvasDragLeave = () => {
        setIsDraggingOverCanvas(false);
    };

    const handleCanvasDrop = (e) => {
        e.preventDefault();
        setIsDraggingOverCanvas(false);
        const vizType = e.dataTransfer.getData('bi/viz-type');
        if (vizType && onAddVisual) {
            onAddVisual(vizType);
        }
    };

    // Smooth Dragging Handlers
    const handleSmoothDragStart = (e, graph) => {
        // Only trigger on left click on header or handle
        if (e.button !== 0) return;

        const isHandle = e.target.closest('.bi-drag-handle');
        const isHeader = e.target.closest('.bi-visual-header');
        if (!isHandle && !isHeader) return;

        e.preventDefault();
        e.stopPropagation();

        // Seed live drag delta for smooth, transform-based movement.
        if (graph?.id) {
            dragLivePositionRef.current[graph.id] = {
                dx: 0,
                dy: 0,
            };
        }

        // Ensure this visual has an absolute layout anchor (x/y/width/height) before we start dragging,
        // so the free-position (Power BI style) mode activates immediately.
        let baseX = graph.options?.x ?? 0;
        let baseY = graph.options?.y ?? 0;
        let baseWidth = graph.options?.width || 0;
        let baseHeight = graph.options?.height || 0;

        const cardElement = e.target.closest('.bi-visual-card');
        const gridElement = cardElement?.closest('.bi-visuals-grid');

        if (cardElement && gridElement && (graph.options?.x == null && graph.options?.y == null)) {
            const cardRect = cardElement.getBoundingClientRect();
            const gridRect = gridElement.getBoundingClientRect();
            baseX = cardRect.left - gridRect.left;
            baseY = cardRect.top - gridRect.top;
            baseWidth = cardElement.offsetWidth;
            baseHeight = cardElement.offsetHeight;

            if (onUpdateVisual && graph.id) {
                const existingOptions = graph.options || {};
                onUpdateVisual(graph.id, {
                    options: {
                        ...existingOptions,
                        x: baseX,
                        y: baseY,
                        width: baseWidth,
                        height: baseHeight,
                        size: existingOptions.size || 'custom'
                    }
                });
            }
        }

        setDraggingGraphId(graph.id);
        setDragStartMouse({ x: e.clientX, y: e.clientY });
        setDragStartCard({
            x: baseX,
            y: baseY,
            width: baseWidth,
            height: baseHeight,
            size: graph.options?.size || 'medium'
        });

        if (onSelectVisual) onSelectVisual(graph.id);
    };

    // Resize Handlers
    const handleResizeStart = (e, graph, direction) => {
        e.preventDefault();
        e.stopPropagation();

        setResizingGraphId(graph.id);
        setResizeDir(direction);
        setInitialPos({ x: e.clientX, y: e.clientY });

        // Get current element dimensions and anchor resize calculations to the current layout.
        const element = e.target.closest('.bi-visual-card');
        if (element) {
            const measuredWidth = element.offsetWidth;
            const measuredHeight = element.offsetHeight;
            setInitialSize({
                width: measuredWidth,
                height: measuredHeight
            });
            const opts = graph.options || {};
            setInitialResizeCard({
                x: typeof opts.x === 'number' ? opts.x : 0,
                y: typeof opts.y === 'number' ? opts.y : 0,
                width: measuredWidth,
                height: measuredHeight
            });
        }
    };

    React.useEffect(() => {
        const handleMouseMove = (e) => {
            // Handle Resizing
            if (resizingGraphId && resizeDir) {
                const deltaX = e.clientX - initialPos.x;
                const deltaY = e.clientY - initialPos.y;

                // Start from the anchored layout position and size.
                let newWidth = initialSize.width;
                let newHeight = initialSize.height;
                let newX = initialResizeCard.x;
                let newY = initialResizeCard.y;

                // Horizontal resizing
                if (resizeDir.includes('right')) {
                    // Right edge moves, left edge fixed.
                    newWidth = initialSize.width + deltaX;
                } else if (resizeDir.includes('left')) {
                    // Left edge moves, right edge fixed: adjust width and x.
                    newWidth = initialSize.width - deltaX;
                    newX = initialResizeCard.x + deltaX;
                }

                // Vertical resizing
                if (resizeDir.includes('bottom')) {
                    // Bottom edge moves, top edge fixed.
                    newHeight = initialSize.height + deltaY;
                } else if (resizeDir.includes('top')) {
                    // Top edge moves, bottom edge fixed: adjust height and y.
                    newHeight = initialSize.height - deltaY;
                    newY = initialResizeCard.y + deltaY;
                }

                newWidth = Math.max(newWidth, 150);
                newHeight = Math.max(newHeight, 120);

                if (onResizeChart) {
                    onResizeChart(resizingGraphId, newWidth, newHeight);
                }
                // Persist both size and position into visual options so layout state matches Power BI-style behavior.
                if (onUpdateVisual) {
                    const currentOptions = graphs.find(g => g.id === resizingGraphId)?.options || {};
                    onUpdateVisual(resizingGraphId, {
                        options: {
                            ...currentOptions,
                            x: newX,
                            y: newY,
                            width: newWidth,
                            height: newHeight,
                            size: 'custom'
                        }
                    });
                }
                return;
            }

            // Handle Smooth Dragging
            if (draggingGraphId) {
                const deltaX = e.clientX - dragStartMouse.x;
                const deltaY = e.clientY - dragStartMouse.y;

                const newX = Math.max(0, dragStartCard.x + deltaX);
                const newY = Math.max(0, dragStartCard.y + deltaY);

                // Compute deltas from the committed layout position for transform-based movement.
                const dx = newX - dragStartCard.x;
                const dy = newY - dragStartCard.y;

                // Update high-performance local drag delta (no parent re-render or backend write).
                dragLivePositionRef.current[draggingGraphId] = { dx, dy };

                // Schedule a single React render per animation frame for smooth transforms.
                if (!dragAnimationFrameRef.current) {
                    dragAnimationFrameRef.current = window.requestAnimationFrame(() => {
                        dragAnimationFrameRef.current = null;
                        setDragRenderTick((tick) => tick + 1);
                    });
                }

                // Power BI free-form canvas: no swap/reflow logic while dragging.
            }
        };

        const handleMouseUp = (e) => {
            if (draggingGraphId) {
                const draggedOptions = graphs.find(g => g.id === draggingGraphId)?.options || {};

                // Commit final layout once using the accumulated delta.
                if (onUpdateVisual) {
                    const live = dragLivePositionRef.current[draggingGraphId] || { dx: 0, dy: 0 };
                    const baseX = typeof draggedOptions.x === 'number' ? draggedOptions.x : 0;
                    const baseY = typeof draggedOptions.y === 'number' ? draggedOptions.y : 0;
                    const finalX = baseX + (live.dx || 0);
                    const finalY = baseY + (live.dy || 0);

                    onUpdateVisual(draggingGraphId, {
                        options: {
                            ...draggedOptions,
                            x: finalX,
                            y: finalY,
                            size: 'custom'
                        }
                    });
                }

                // Clear live delta for this visual.
                if (dragLivePositionRef.current[draggingGraphId]) {
                    delete dragLivePositionRef.current[draggingGraphId];
                }
            }

            setResizingGraphId(null);
            setResizeDir(null);
            setDraggingGraphId(null);
        };

        if (resizingGraphId || draggingGraphId) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingGraphId, draggingGraphId, resizeDir, initialPos, initialSize, dragStartMouse, dragStartCard, graphs, onResizeChart, onUpdateVisual]);

    // Clean up any pending animation frame when the canvas unmounts.
    React.useEffect(() => {
        return () => {
            if (dragAnimationFrameRef.current) {
                window.cancelAnimationFrame(dragAnimationFrameRef.current);
                dragAnimationFrameRef.current = null;
            }
        };
    }, []);

    // Power BI free-form canvas: every visual needs a persisted absolute layout.
    // If any visual is missing x/y/width/height, we assign a stable default once and persist it.
    React.useEffect(() => {
        if (!onUpdateVisual || !Array.isArray(graphs) || graphs.length === 0) return;

        const workspaceWidth = workspaceRef.current?.clientWidth || 1200;

        const sizeDefaults = (size) => {
            switch (size) {
                case 'small': return { width: 360, height: 240 };
                case 'large': return { width: 980, height: 520 };
                case 'wide': return { width: 980, height: 320 };
                case 'medium':
                default: return { width: 520, height: 360 };
            }
        };

        // Default placement should look like the old 2-column dashboard, but remain free-form after.
        const padding = 24;
        const gap = 24;
        const colCount = 2;
        const colWidth = Math.max(320, Math.floor((workspaceWidth - padding * 2 - gap * (colCount - 1)) / colCount));
        const colX = [padding, padding + colWidth + gap];
        const colCursorY = [padding, padding];

        for (const graph of graphs) {
            if (!graph?.id) continue;
            if (initializedLayoutIdsRef.current.has(graph.id)) continue;

            const opts = graph.options || {};
            const hasX = typeof opts.x === 'number';
            const hasY = typeof opts.y === 'number';
            const hasW = typeof opts.width === 'number';
            const hasH = typeof opts.height === 'number';

            if (hasX && hasY && hasW && hasH) {
                initializedLayoutIdsRef.current.add(graph.id);
                continue;
            }

            const baseSize = sizeDefaults(opts.size);
            const width = hasW ? opts.width : Math.min(baseSize.width, colWidth);
            const height = hasH ? opts.height : baseSize.height;

            // Pick the column with the smallest current height (masonry-like, 2 columns).
            const targetCol = colCursorY[0] <= colCursorY[1] ? 0 : 1;
            const x = hasX ? opts.x : colX[targetCol];
            const y = hasY ? opts.y : colCursorY[targetCol];
            colCursorY[targetCol] = y + height + gap;

            initializedLayoutIdsRef.current.add(graph.id);
            onUpdateVisual(graph.id, {
                options: {
                    ...opts,
                    x,
                    y,
                    width,
                    height,
                    size: 'custom'
                }
            });
        }
    }, [graphs, onUpdateVisual]);

    return (
        <div
            className={`bi-canvas ${isDraggingOverCanvas ? 'drag-over' : ''} ${resizingGraphId ? 'resizing-active' : ''}`}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
        >
            {/* Grid Overlay for Visual Alignment */}
            <div className="bi-canvas-grid-lines" />
            {/* Drag Over Hint */}
            {isDraggingOverCanvas && (
                <div className="bi-drag-hint">
                    <div className="bi-drag-hint-box">
                        <div className="bi-drag-hint-icon">➕</div>
                        <p>Drop to add visualization</p>
                    </div>
                </div>
            )}
            {/* Focus Mode Overlay */}
            {focusedGraph && (
                <div className="bi-focus-overlay">
                    <div className="bi-focus-content">
                        <div className="bi-focus-header">
                            <div className="bi-focus-title-group">
                                <h2 className="bi-focus-title">{focusedGraph.options?.title || `${focusedGraph.graph_type.toUpperCase()} Analysis`}</h2>
                            </div>

                            {/* KPI Summary Bar — Moved into header */}
                            {focusStats && (
                                <div className="bi-focus-kpi-bar">
                                    <div className="bi-focus-kpi-item">
                                        <span className="bi-focus-kpi-label">TOTAL</span>
                                        <span className="bi-focus-kpi-value">{Math.round(focusStats.total).toLocaleString()}</span>
                                    </div>
                                    <div className="bi-focus-kpi-item">
                                        <span className="bi-focus-kpi-label">AVG</span>
                                        <span className="bi-focus-kpi-value">{focusStats.avg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                    </div>
                                    <div className="bi-focus-kpi-item">
                                        <span className="bi-focus-kpi-label">MAX</span>
                                        <span className="bi-focus-kpi-value">{focusStats.max.toLocaleString()}</span>
                                    </div>
                                    <div className="bi-focus-kpi-item">
                                        <span className="bi-focus-kpi-label">MIN</span>
                                        <span className="bi-focus-kpi-value">{focusStats.min.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bi-focus-header-right">
                                <div className="bi-focus-stats">
                                    <div className="bi-focus-stat-item">
                                        <label>Field</label>
                                        <span>{focusedGraph.x_axis}</span>
                                    </div>
                                    {focusedGraph.y_axis && (
                                        <div className="bi-focus-stat-item">
                                            <label>Metric</label>
                                            <span>{focusedGraph.y_axis}</span>
                                        </div>
                                    )}
                                </div>
                                <button className="bi-focus-close" onClick={() => setFocusedGraph(null)}>✕</button>
                            </div>
                        </div>

                        <div className="bi-focus-body">
                            <DynamicChart
                                fileId={fileId}
                                graphDefinition={focusedGraph}
                                isExporting={isExporting}
                                hideInternalStats={true}
                                onUpdate={(updates) => handleUpdate(focusedGraph.id, updates)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Top KPI Section */}
            <div className="bi-canvas-header">
                <div className="bi-kpi-row">
                    {kpiData.map((kpi, idx) => (
                        <div key={idx} className="bi-kpi-card">
                            <div className="bi-kpi-value">{kpi.value}</div>
                            <div className="bi-kpi-label">{kpi.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Visuals Grid */}
            <div className="bi-visuals-grid" ref={workspaceRef}>
                {Array.isArray(graphs) && graphs.length > 0 ? (
                    graphs.map((graph, index) => {
                        const opts = graph.options || {};

                        // While dragging, prefer high-frequency local delta for smoothness.
                        const livePos = dragLivePositionRef.current[graph.id] || null;
                        const isActivelyDragging = draggingGraphId === graph.id;
                        const getResizeCursor = () => {
                            if (!resizingGraphId) return 'move';
                            switch (resizeDir) {
                                case 'top': case 'bottom': return 'ns-resize';
                                case 'left': case 'right': return 'ew-resize';
                                case 'top-left': case 'bottom-right': return 'nwse-resize';
                                case 'top-right': case 'bottom-left': return 'nesw-resize';
                                default: return 'move';
                            }
                        };

                        // Power BI style: all visuals are absolutely positioned in the workspace.
                        const cardStyles = {
                            position: 'absolute',
                            left: `${typeof opts.x === 'number' ? opts.x : 0}px`,
                            top: `${typeof opts.y === 'number' ? opts.y : 0}px`,
                            transform: livePos ? `translate(${livePos.dx || 0}px, ${livePos.dy || 0}px)` : 'none',
                            width: typeof opts.width === 'number' ? `${opts.width}px` : '520px',
                            height: typeof opts.height === 'number' ? `${opts.height}px` : '360px',
                            cursor: resizingGraphId ? getResizeCursor() : (draggingGraphId ? 'move' : 'default'),
                            zIndex: isActivelyDragging || activeVisualId === graph.id ? 1000 : 1
                        };

                        return (
                            <div
                                key={graph.id || index}
                                data-visual-id={graph.id}
                                className={`bi-card bi-visual-card 
                                    ${activeVisualId === graph.id ? 'selected' : ''} 
                                    ${draggingGraphId === graph.id ? 'dragging' : ''}
                                    ${resizingGraphId === graph.id ? 'resizing' : ''}
                                    ${graph.graph_type === 'text' ? 'bi-is-text' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectVisual) onSelectVisual(graph.id);
                                }}
                                onMouseDown={(e) => handleSmoothDragStart(e, graph)}
                                style={cardStyles}
                            >
                                {(!graph.options?.noHeader || activeVisualId === graph.id) && (
                                    <div className="bi-visual-header">
                                        <div className="bi-header-left">
                                            <div className="bi-drag-handle">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                    <circle cx="9" cy="5" r="2" />
                                                    <circle cx="9" cy="12" r="2" />
                                                    <circle cx="9" cy="19" r="2" />
                                                    <circle cx="15" cy="5" r="2" />
                                                    <circle cx="15" cy="12" r="2" />
                                                    <circle cx="15" cy="19" r="2" />
                                                </svg>
                                            </div>
                                            <span className="bi-visual-title">
                                                {graph.options?.title || (graph.graph_type === 'text' ? '' : `${graph.graph_type.toUpperCase()}: ${graph.x_axis}`)}
                                            </span>
                                        </div>
                                        <div className="bi-header-actions">
                                            <button
                                                className="bi-delete-btn"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("Delete this visualization?")) {
                                                        onDeleteVisual(graph.id);
                                                    }
                                                }}
                                                title="Delete Visualization"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                                </svg>
                                            </button>
                                            <button
                                                className="bi-expand-btn"
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleChartClick(graph);
                                                }}
                                                title="Expand to Full Mode"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="15 3 21 3 21 9"></polyline>
                                                    <polyline points="9 21 3 21 3 15"></polyline>
                                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )
                                }
                                <div className="bi-visual-content">
                                    <DynamicChart
                                        key={`${fileId}-${graph.id}`}
                                        fileId={fileId}
                                        graphDefinition={graph}
                                        isExporting={isExporting}
                                        hideInternalStats={true}
                                        isDragging={draggingGraphId === graph.id || resizingGraphId === graph.id}
                                        onUpdate={(updates) => handleUpdate(graph.id, updates)}
                                    />
                                </div>

                                {/* Multi-Directional Resize Handles */}
                                {
                                    ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'].map(dir => (
                                        <div
                                            key={dir}
                                            className={`bi-resize-handle bi-resize-${dir}`}
                                            onMouseDown={(e) => handleResizeStart(e, graph, dir)}
                                        />
                                    ))
                                }
                            </div>
                        );
                    })
                ) : (
                    <div className="bi-empty-canvas">
                        <div className="bi-empty-icon">📊</div>
                        <p>No visualizations added yet.</p>
                        <span>Use the side panels or ribbon to add charts.</span>
                    </div>
                )}
            </div>
        </div >
    );
};

export default BIDashboardCanvas;
