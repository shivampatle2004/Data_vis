import React, { useState, useEffect, useRef } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
    AreaChart, Area, ScatterChart, Scatter,
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Treemap, ComposedChart, Sankey, RadialBarChart, RadialBar, LabelList
} from 'recharts';

const VIBRANT_PALETTE = [
    '#6366F1', // Premium Indigo
    '#10B981', // Emerald Mint
    '#F59E0B', // Amber Gold
    '#EC4899', // Rose Pink
    '#06B6D4', // Cyan Wave
    '#8B5CF6', // Modern Violet
    '#F97316', // Sunset Orange
    '#14B8A6'  // Teal Dream
];
const PIE_COLORS = VIBRANT_PALETTE;

const getThemeColor = (id) => {
    if (!id) return VIBRANT_PALETTE[0];
    // Simple hash to pick a stable color from the palette based on ID
    let hash = 0;
    const strId = String(id);
    for (let i = 0; i < strId.length; i++) {
        hash = ((hash << 5) - hash) + strId.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return VIBRANT_PALETTE[Math.abs(hash) % VIBRANT_PALETTE.length];
};

const DynamicChart = ({ fileId, graphDefinition, onClick, onUpdate, isExporting = false, hideInternalStats = false, isDragging = false }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [textContent, setTextContent] = useState(graphDefinition.content || '');
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);

    // Micro-rendering thresholds
    const isSmall = dimensions.width < 300 || dimensions.height < 220;
    const isMicro = dimensions.width < 200 || dimensions.height < 160;

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries.length) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        setTextContent(graphDefinition.content || '');
    }, [graphDefinition.content]);

    useEffect(() => {
        setTextContent(graphDefinition.content || '');
    }, [graphDefinition.content]);

    // Data-related properties that should trigger a re-fetch
    const dataDeps = JSON.stringify({
        graph_type: graphDefinition.graph_type,
        x_axis: graphDefinition.x_axis,
        y_axis: graphDefinition.y_axis,
        aggregation: graphDefinition.aggregation
    });

    useEffect(() => {
        const { graph_type, x_axis, y_axis, aggregation, cached_data } = graphDefinition;

        // If the data is already provided in the graph definition, use it directly
        if (cached_data) {
            if (cached_data.is_table) {
                setData({
                    columns: cached_data.columns || [],
                    rows: cached_data.rows || []
                });
                setLoading(false);
                return;
            }

            if (Array.isArray(cached_data.labels)) {
                const transformedData = cached_data.labels.map((label, index) => ({
                    name: label,
                    value: cached_data.values ? cached_data.values[index] : null
                }));
                setData(transformedData);
                setLoading(false);
                return;
            }
        }

        if (!fileId || graph_type === 'text') {
            if (graph_type === 'text') {
                setData([{ name: 'text', value: 0 }]);
                setLoading(false);
            }
            return;
        }

        const fetchData = async () => {
            try {
                // Only set loading if we don't already have data to prevent blanking the UI
                if (!data) setLoading(true);

                const response = await fetch(`/api/files/${fileId}/graph-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        graph_type,
                        x_axis,
                        y_axis,
                        aggregation
                    })
                });

                if (!response.ok) throw new Error('Failed to fetch graph data');
                const result = await response.json();

                if (!result || !Array.isArray(result.labels)) {
                    setData([]);
                    return;
                }

                const transformedData = result.labels.map((label, index) => ({
                    name: label,
                    value: result.values ? result.values[index] : null
                }));

                setData(transformedData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fileId, dataDeps]); // Only trigger when file or data definition changes, NOT layout

    if (loading && !data) return <div className="chart-loading">Loading chart...</div>;
    if (error && !data) return <div className="chart-error">Error: {error}</div>;
    if (!data || data.length === 0) {
        if (loading) return <div className="chart-loading">Loading chart...</div>;
        return <div className="chart-empty">No data available</div>;
    }

    const handleClick = (state) => {
        if (!onClick) return;

        let payload = null;
        if (state && state.activePayload && state.activePayload.length > 0) {
            payload = state.activePayload[0].payload;
        } else if (state && state.payload) {
            payload = state.payload;
        } else if (state && state.name && state.value !== undefined) {
            payload = state;
        }

        if (payload) {
            onClick({
                ...payload,
                graphTitle: `${graphDefinition.graph_type.toUpperCase()}: ${graphDefinition.x_axis}`,
                xKey: graphDefinition.x_axis,
                yKey: graphDefinition.y_axis || 'Count'
            });
        }
    };

    const renderChart = () => {
        const animation = !isExporting && !isDragging;
        const opts = graphDefinition.options || {};
        const isSmall = opts.size === 'small' || (opts.width && opts.width < 400);
        const isMicro = opts.size === 'small' || (opts.width && opts.width < 250);
        const mainColor = opts.mainColor || getThemeColor(graphDefinition.id);
        const formatNumber = (num) => {
            if (typeof num !== 'number') return num;
            if (opts.numberFormat === 'integer') return Math.round(num).toLocaleString();
            if (opts.numberFormat === 'decimal') return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            if (opts.numberFormat === 'currency') return '$' + num.toLocaleString();
            if (opts.numberFormat === 'percentage') return num.toLocaleString() + '%';

            // Automatic scaling for large numbers
            if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
            return num.toLocaleString();
        };

        // Prepare and Sort Data
        let chartData = [...data];
        if (opts.sort === 'asc') chartData.sort((a, b) => a.value - b.value);
        if (opts.sort === 'desc') chartData.sort((a, b) => b.value - a.value);

        const totalValue = chartData.reduce((sum, entry) => sum + (entry.value || 0), 0);

        const tooltipFormatter = (value, name, props) => {
            const val = formatNumber(value);
            const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) + '%' : null;
            return [
                <div key="tt" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>{val}</div>
                    {percentage && (
                        <div style={{ fontSize: '11px', color: '#64748b', opacity: 0.8 }}>
                            {percentage} of total
                        </div>
                    )}
                </div>,
                null
            ];
        };

        if (graphDefinition.graph_type === 'table') {
            if (!data || !data.columns || !data.rows) return <div>Invalid table data</div>;
            return (
                <div style={{ width: '100%', height: '100%', overflow: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9fafb', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            <tr>
                                {data.columns.map((col, i) => (
                                    <th key={i} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.rows.map((row, r_idx) => (
                                <tr key={r_idx} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: r_idx % 2 === 0 ? 'white' : '#fcfcfc' }}>
                                    {data.columns.map((col, c_idx) => (
                                        <td key={c_idx} style={{ padding: '0.75rem 1rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
                                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        switch (graphDefinition.graph_type) {
            case 'bar':
            case 'histogram':
                return (
                    <BarChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                minTickGap={10}
                                angle={chartData.length > 5 ? -45 : 0}
                                textAnchor={chartData.length > 5 ? "end" : "middle"}
                                height={45}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={(val) => {
                                    const str = String(val);
                                    return str.length > 10 ? str.substring(0, 8) + '..' : str;
                                }}
                                label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#4b5563', fontWeight: 600 } : undefined}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={formatNumber}
                                width={50}
                                label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined}
                            />
                        )}
                        <Tooltip cursor={{ fill: 'transparent' }} formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
                        <Bar
                            dataKey="value"
                            name={opts.yLabel || graphDefinition.y_axis || 'Value'}
                            radius={[4, 4, 0, 0]}
                            isAnimationActive={animation}
                            fill={mainColor}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={opts.mainColor ? mainColor : VIBRANT_PALETTE[index % VIBRANT_PALETTE.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'line':
                return (
                    <LineChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                minTickGap={10}
                                angle={chartData.length > 5 ? -45 : 0}
                                textAnchor={chartData.length > 5 ? "end" : "middle"}
                                height={45}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={(val) => {
                                    const str = String(val);
                                    return str.length > 10 ? str.substring(0, 8) + '..' : str;
                                }}
                                label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#4b5563', fontWeight: 600 } : undefined}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={formatNumber}
                                width={50}
                                label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined}
                            />
                        )}
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
                        <Line
                            type="monotone"
                            dataKey="value"
                            name={opts.yLabel || graphDefinition.y_axis || 'Value'}
                            stroke={mainColor}
                            strokeWidth={3}
                            dot={{ r: 4, fill: mainColor, strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            isAnimationActive={animation}
                        >
                        </Line>
                    </LineChart>
                );
            case 'area':
                return (
                    <AreaChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                        <defs>
                            <linearGradient id={`colorValue-${graphDefinition.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={mainColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={mainColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                minTickGap={10}
                                angle={chartData.length > 5 ? -45 : 0}
                                textAnchor={chartData.length > 5 ? "end" : "middle"}
                                height={45}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={(val) => {
                                    const str = String(val);
                                    return str.length > 10 ? str.substring(0, 8) + '..' : str;
                                }}
                                label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#4b5563', fontWeight: 600 } : undefined}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={formatNumber}
                                width={50}
                                label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined}
                            />
                        )}
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
                        <Area
                            type="monotone"
                            dataKey="value"
                            name={opts.yLabel || graphDefinition.y_axis || 'Value'}
                            stroke={mainColor}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#colorValue-${graphDefinition.id})`}
                            isAnimationActive={animation}
                        >
                        </Area>
                    </AreaChart>
                );
            case 'pie':
            case 'donut':
                return (
                    <PieChart>
                        <Pie
                            data={chartData}
                            innerRadius={graphDefinition.graph_type === 'donut' ? "50%" : 0}
                            outerRadius="80%"
                            paddingAngle={5}
                            dataKey="value"
                            nameKey="name"
                            onClick={handleClick}
                            style={{ cursor: 'pointer' }}
                            isAnimationActive={animation}
                            label={!isSmall ? ({ name, value }) => `${name}: ${formatNumber(value)}` : false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={opts.mainColor ? mainColor : PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend verticalAlign="bottom" height={36} />}
                    </PieChart>
                );
            case 'scatter':
                return (
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                interval="preserveStartEnd"
                                angle={-35}
                                textAnchor="end"
                                height={45}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#4b5563', fontWeight: 600 } : undefined}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                dataKey="value"
                                fontSize={8}
                                tickFormatter={formatNumber}
                                width={50}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined}
                            />
                        )}
                        <Scatter name={opts.yLabel || graphDefinition.y_axis || 'Data'} data={chartData} fill={mainColor} isAnimationActive={animation} line={{ stroke: mainColor }} shape="circle" />
                    </ScatterChart>
                );
            case 'radar':
                return (
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                        <PolarGrid strokeOpacity={0.1} />
                        <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                        <PolarRadiusAxis tickFormatter={formatNumber} tick={{ fill: '#94a3b8', fontSize: 8 }} />
                        <Radar
                            name={opts.yLabel || graphDefinition.y_axis || 'Value'}
                            dataKey="value"
                            stroke={mainColor}
                            fill={mainColor}
                            fillOpacity={0.6}
                            isAnimationActive={animation}
                        >
                        </Radar>
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend verticalAlign="bottom" height={36} />}
                    </RadarChart>
                );
            case 'polarArea':
                return (
                    <PieChart>
                        <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius="80%"
                            isAnimationActive={animation}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={mainColor} fillOpacity={0.3 + (index / chartData.length) * 0.7} />
                            ))}
                        </Pie>
                        <PolarGrid opacity={0.1} />
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend verticalAlign="bottom" height={36} />}
                    </PieChart>
                );
            case 'treemap':
                return (
                    <Treemap
                        data={chartData}
                        dataKey="value"
                        ratio={4 / 3}
                        stroke="#fff"
                        isAnimationActive={animation}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={mainColor} fillOpacity={1 - (index / chartData.length) * 0.6} />
                        ))}
                        <Tooltip formatter={tooltipFormatter} />
                    </Treemap>
                );
            case 'composed':
                return (
                    <ComposedChart data={chartData} onClick={handleClick} style={{ cursor: 'pointer' }} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                                angle={-35}
                                textAnchor="end"
                                height={45}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 10, fill: '#4b5563', fontWeight: 600 } : undefined}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                fontSize={8}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                                tickFormatter={formatNumber}
                                width={50}
                                label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined}
                            />
                        )}
                        <Tooltip formatter={tooltipFormatter} />
                        {opts.showLegend && !isSmall && <Legend wrapperStyle={{ paddingTop: '20px' }} />}
                        <Bar dataKey="value" name={opts.yLabel || graphDefinition.y_axis || 'Value'} barSize={20} fill={mainColor} opacity={0.4} radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="value" name={opts.yLabel || graphDefinition.y_axis || 'Value'} stroke={mainColor} strokeWidth={3} dot={{ r: 4 }} />
                    </ComposedChart>
                );
            case 'funnel':
                return (
                    <BarChart layout="vertical" data={data} onClick={handleClick} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.1} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" fontSize={8} width={60} tick={{ fill: '#64748b', fontSize: 8 }} />
                        <Tooltip />
                        <Bar dataKey="value" isAnimationActive={animation}>
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={VIBRANT_PALETTE[index % VIBRANT_PALETTE.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'sankey':
                return (
                    <Sankey
                        data={graphDefinition.sankeyData || { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ source: 0, target: 1, value: 100 }] }}
                        margin={{ top: 10, left: 10, right: 10, bottom: 10 }}
                        node={{ stroke: '#fff', strokeWidth: 1, fill: mainColor }}
                        link={{ stroke: mainColor, fillOpacity: 0.2 }}
                    >
                        <Tooltip />
                    </Sankey>
                );
            case 'waterfall':
                return (
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis dataKey="name" fontSize={8} tick={{ fill: '#64748b', fontSize: 8 }} height={35} label={!isMicro ? { value: opts.xLabel || graphDefinition.x_axis, position: 'insideBottom', offset: -10, fontSize: 9, fill: '#4b5563', fontWeight: 600 } : undefined} />
                        <YAxis tickFormatter={formatNumber} fontSize={8} tick={{ fill: '#64748b', fontSize: 8 }} width={50} label={!isMicro ? { value: opts.yLabel || graphDefinition.y_axis || 'Value', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#4b5563', fontWeight: 600, offset: 0 } : undefined} />
                        <Tooltip />
                        <Bar dataKey="base" stackId="a" fill="transparent" />
                        <Bar dataKey="value" stackId="a">
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.value >= 0 ? (opts.positiveColor || '#10B981') : (opts.negativeColor || '#EF4444')}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                );
            case 'radialBar':
                return (
                    <RadialBarChart
                        innerRadius="30%"
                        outerRadius="100%"
                        data={chartData}
                        startAngle={180}
                        endAngle={0}
                    >
                        <RadialBar
                            minAngle={15}
                            label={{ position: 'insideStart', fill: '#fff' }}
                            background
                            clockWise={true}
                            dataKey="value"
                            isAnimationActive={animation}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={VIBRANT_PALETTE[index % VIBRANT_PALETTE.length]} />
                            ))}
                        </RadialBar>
                        <Tooltip />
                        <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
                    </RadialBarChart>
                );
            case 'kpiCard': {
                const kpiLabel = opts.xLabel || graphDefinition.x_axis || 'Metric';
                const kpiValue = totalValue;
                const avgValue = totalValue / (chartData.length || 1);
                return (
                    <div className="kpi-card-visual" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        padding: '24px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                            {kpiLabel}
                        </div>
                        <div style={{ fontSize: 'min(64px, 10vw)', fontWeight: 800, color: mainColor, letterSpacing: '-1.5px', lineHeight: 1 }}>
                            {formatNumber(kpiValue)}
                        </div>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>AVERAGE</span>
                                <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>{formatNumber(avgValue)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>COUNT</span>
                                <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: 700 }}>{chartData.length}</span>
                            </div>
                        </div>
                    </div>
                );
            }
            case 'bubble':
                return (
                    <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 0 }}>
                        {opts.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />}
                        {opts.showXAxis !== false && (
                            <XAxis
                                dataKey="name"
                                fontSize={8}
                                name={opts.xLabel || graphDefinition.x_axis}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                            />
                        )}
                        {opts.showYAxis !== false && (
                            <YAxis
                                dataKey="value"
                                fontSize={8}
                                tickFormatter={formatNumber}
                                width={35}
                                tick={{ fill: '#64748b', fontSize: 8 }}
                            />
                        )}
                        <ZAxis type="number" range={[100, 1000]} />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={tooltipFormatter} />
                        <Scatter name={opts.yLabel || graphDefinition.y_axis || 'Data'} data={chartData} fill={mainColor} fillOpacity={0.6}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={mainColor} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                );
            case 'bullet':
                return (
                    <div style={{ width: '100%', height: '100%', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                        {chartData.slice(0, 5).map((entry, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '10px', width: '50px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, color: '#64748b' }}>{entry.name}</span>
                                <div style={{ flex: 1, height: '14px', backgroundColor: '#f1f5f9', borderRadius: '2px', position: 'relative' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '70%', backgroundColor: '#e2e8f0', borderRadius: '2px' }} />
                                    <div style={{ position: 'absolute', left: 0, top: '2px', height: '10px', width: `${Math.min(100, (entry.value / totalValue) * 300)}%`, backgroundColor: mainColor, borderRadius: '1px' }} />
                                    <div style={{ position: 'absolute', left: '85%', top: 0, height: '100%', width: '2px', backgroundColor: '#1e293b' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'map':
                return (
                    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <svg viewBox="0 0 1000 600" style={{ width: '100%', height: '100%', opacity: 0.15 }}>
                            <path d="M150,150 L250,100 L350,150 L450,100 L550,150 L650,100 L750,150 L850,100 L950,200 L850,300 L750,250 L650,350 L550,250 L450,350 L350,250 L250,350 L150,250 Z" fill={mainColor} />
                            <circle cx="300" cy="200" r="10" fill={mainColor} opacity="0.8" />
                            <circle cx="500" cy="250" r="15" fill={mainColor} opacity="0.8" />
                            <circle cx="700" cy="220" r="12" fill={mainColor} opacity="0.8" />
                        </svg>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                            <Map size={48} color={mainColor} opacity={0.5} />
                            <div style={{ marginTop: '12px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Geospatial View</div>
                        </div>
                    </div>
                );
            case 'sunburst':
                return (
                    <PieChart>
                        <Pie data={chartData} dataKey="value" innerRadius="0%" outerRadius="40%" fill={mainColor} opacity={0.4} isAnimationActive={animation} />
                        <Pie data={chartData} dataKey="value" innerRadius="45%" outerRadius="85%" fill={mainColor} isAnimationActive={animation}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={mainColor} fillOpacity={0.6 + (index / chartData.length) * 0.4} />
                            ))}
                        </Pie>
                        <Tooltip formatter={tooltipFormatter} />
                    </PieChart>
                );
            case 'boxPlot':
                return (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px' }}>
                        {chartData.slice(0, 5).map((entry, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '8px' }}>
                                <div style={{ width: '2px', height: '60%', backgroundColor: '#cbd5e1', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '20%', left: '-10px', width: '22px', height: '40%', backgroundColor: mainColor, borderRadius: '2px', border: '1px solid #fff' }} />
                                    <div style={{ position: 'absolute', top: '0', left: '-5px', width: '12px', height: '2px', backgroundColor: '#94a3b8' }} />
                                    <div style={{ position: 'absolute', bottom: '0', left: '-5px', width: '12px', height: '2px', backgroundColor: '#94a3b8' }} />
                                </div>
                                <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b' }}>{entry.name}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'violin':
                return (
                    <div className="violin-mock-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px' }}>
                        {[0, 1, 2].map(i => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%' }}>
                                <svg width="100%" height="100%" viewBox="0 0 80 180" preserveAspectRatio="xMidYMid meet">
                                    <path
                                        d="M40,10 Q65,40 65,90 Q65,140 40,170 Q15,140 15,90 Q15,40 40,10"
                                        fill={VIBRANT_PALETTE[i % VIBRANT_PALETTE.length]}
                                        opacity="0.7"
                                        stroke={VIBRANT_PALETTE[i % VIBRANT_PALETTE.length]}
                                        strokeWidth="2"
                                    />
                                    <line x1="40" y1="30" x2="40" y2="150" stroke="#1e293b" strokeWidth="2" strokeDasharray="4" />
                                    <rect x="34" y="80" width="12" height="20" fill="#1e293b" rx="2" />
                                    <circle cx="40" cy="90" r="3" fill="#fff" />
                                </svg>
                                <span style={{ fontSize: 'max(8px, 1vw)', color: '#64748b', marginTop: '4px', fontWeight: 600 }}>Seg {i + 1}</span>
                            </div>
                        ))}
                    </div>
                );
            case 'text':
                if (isEditing) {
                    return (
                        <textarea
                            style={{
                                width: '100%',
                                height: '100%',
                                border: '1px solid #3b82f6',
                                borderRadius: '4px',
                                padding: '10px',
                                fontSize: '14px',
                                color: '#1e293b',
                                background: '#f8fafc',
                                resize: 'none',
                                outline: 'none',
                                fontStyle: 'normal'
                            }}
                            autoFocus
                            value={textContent}
                            onChange={(e) => setTextContent(e.target.value)}
                            onBlur={() => {
                                setIsEditing(false);
                                if (onUpdate) onUpdate({ content: textContent });
                            }}
                        />
                    );
                }
                return (
                    <div
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#475569',
                            fontSize: '14px',
                            textAlign: 'center',
                            padding: '10px',
                            fontStyle: 'italic',
                            cursor: 'text',
                            userSelect: 'none'
                        }}
                        onDoubleClick={() => setIsEditing(true)}
                        title="Double-click to edit"
                    >
                        {textContent || 'Double-click to edit text box'}
                    </div>
                );
            default:
                return <div>Unsupported graph type: {graphDefinition.graph_type}</div>;
        }
    };

    const getStats = () => {
        if (!data || !Array.isArray(data)) return null;
        if (graphDefinition.graph_type === 'table') return null;
        if (data.length === 0) return null;

        // Use parseFloat to handle potential string formatted numbers
        const validValues = data.map(d => {
            const val = typeof d.value === 'string' ? parseFloat(d.value.replace(/,/g, '')) : d.value;
            return val;
        }).filter(v => typeof v === 'number' && !isNaN(v));

        if (validValues.length === 0) return null;

        const sum = validValues.reduce((a, b) => a + b, 0);
        const avg = sum / validValues.length;
        const max = Math.max(...validValues);
        const min = Math.min(...validValues);

        return { sum, avg, max, min };
    };

    const stats = getStats();

    return (
        <div ref={containerRef} className="chart-wrapper" style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: graphDefinition.options?.bgColor || 'transparent',
            padding: isMicro ? '2px' : '4px',
            borderRadius: '4px',
            overflow: 'hidden'
        }}>
            {graphDefinition.options?.title && !isMicro && (
                <div style={{
                    fontSize: isSmall ? '10px' : '12px',
                    fontWeight: 700,
                    color: '#1e293b',
                    marginBottom: '4px',
                    textAlign: 'center'
                }}>
                    {graphDefinition.options.title}
                </div>
            )}
            {(!hideInternalStats && stats) && (
                <div className="chart-kpi-row">
                    <div className="chart-kpi-item">
                        <span className="kpi-label">TOTAL</span>
                        <span className="kpi-value">{Math.round(stats.sum).toLocaleString()}</span>
                    </div>
                    <div className="chart-kpi-item">
                        <span className="kpi-label">AVG</span>
                        <span className="kpi-value">{stats.avg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                    </div>
                    <div className="chart-kpi-item">
                        <span className="kpi-label">MAX</span>
                        <span className="kpi-value">{stats.max.toLocaleString()}</span>
                    </div>
                    <div className="chart-kpi-item">
                        <span className="kpi-label">MIN</span>
                        <span className="kpi-value">{stats.min.toLocaleString()}</span>
                    </div>
                </div>
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default React.memo(DynamicChart);
