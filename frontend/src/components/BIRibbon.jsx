import React, { useState, useRef, useEffect } from 'react';
import {
    Scissors, Copy, Clipboard, Paintbrush,
    Database, FileSpreadsheet, Table, Server, Plus, Clock,
    RotateCcw, FileCode, ChevronDown, ChevronUp,
    BarChart2, Type, MoreHorizontal,
    Calculator, Zap,
    Shield, Share2,
    Search, User, Monitor, FilePlus, Layout, MessageSquare, Activity, GitBranch, FileText,
    AppWindow, Image, MousePointer2, TrendingUp, Square, Circle, Minus, Triangle, ArrowRight,
    Users, Eye, Lock, Globe, Settings, Play, BookOpen, ExternalLink, Terminal, Cpu, Info, Palette,
    Calendar, RefreshCw, UserCheck, Languages, Binary, FileJson, Smartphone, Layers, Timer, Filter, Bookmark, Link2
} from 'lucide-react';
import './BIRibbon.css';

// ── Dropdown Component ───────────────────────────────────────────────────────
const Dropdown = ({ options, onClose, onSelect }) => {
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        document.addEventListener('mouseup', handler);
        return () => document.removeEventListener('mouseup', handler);
    }, [onClose]);

    return (
        <div className="bi-dropdown-menu" ref={ref}>
            {options.map((opt, i) =>
                opt === null ? (
                    <div key={i} className="bi-dropdown-divider" />
                ) : (
                    <button
                        key={opt.id}
                        className={`bi-dropdown-item ${opt.disabled ? 'disabled' : ''}`}
                        onClick={() => { if (!opt.disabled) { onSelect(opt.id); onClose(); } }}
                        title={opt.tooltip || opt.label}
                    >
                        {opt.icon && <span className="bi-dropdown-item-icon">{opt.icon}</span>}
                        <div>
                            <div className="bi-dropdown-item-label">{opt.label}</div>
                            {opt.sub && <div className="bi-dropdown-item-sub">{opt.sub}</div>}
                        </div>
                    </button>
                )
            )}
        </div>
    );
};

// ── Toolbar Button Components ────────────────────────────────────────────────
const RibbonBtn = ({ icon, label, onClick, disabled, tooltip, children, className = '' }) => (
    <button
        className={`bi-ribbon-tool bi-tool-large ${disabled ? 'bi-tool-disabled' : ''} ${className}`}
        onClick={disabled ? undefined : onClick}
        title={tooltip || label}
        disabled={disabled}
    >
        {icon}
        <span>{label}{children}</span>
    </button>
);

const SmallBtn = ({ icon, label, onClick, disabled, tooltip }) => (
    <button
        className={`bi-ribbon-tool-small ${disabled ? 'bi-tool-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
        title={tooltip || label}
        disabled={disabled}
    >
        {icon}
        {label}
    </button>
);

const Group = ({ label, children }) => (
    <>
        <div className="bi-tool-group">
            <div className="bi-tool-row">{children}</div>
            <div className="bi-group-label">{label}</div>
        </div>
        <div className="bi-group-divider" />
    </>
);

// ── Main Ribbon ──────────────────────────────────────────────────────────────
const BIRibbon = ({ activeTab, setActiveTab, onAction, fileName, activeMeasure, setActiveMeasure }) => {
    let tabs = ['File', 'Home', 'Insert', 'Modeling', 'View', 'Help', 'Table tools', 'External Tools'];
    if (activeMeasure) {
        tabs.push('Measure tools');
    }
    const [openDropdown, setOpenDropdown] = useState(null);
    const [ribbonCollapsed, setRibbonCollapsed] = useState(false);

    const toggleDropdown = (name) => setOpenDropdown(prev => prev === name ? null : name);
    const closeDropdown = () => setOpenDropdown(null);

    const handleTabClick = (tab) => {
        if (tab === activeTab && !ribbonCollapsed) {
            // Double-click same tab collapses (Power BI behavior via single click when already active)
            setRibbonCollapsed(true);
        } else {
            setActiveTab(tab);
            setRibbonCollapsed(false);
        }
    };

    const act = (id) => { onAction(id); closeDropdown(); };

    // ── Get Data sub-items
    const getDataOptions = [
        { id: 'excel', icon: <FileSpreadsheet size={16} />, label: 'Excel Workbook', sub: 'Import .xlsx files' },
        { id: 'onelake', icon: <Database size={16} />, label: 'OneLake Catalog', sub: 'Connect to centralized catalog' },
        { id: 'sql', icon: <Server size={16} />, label: 'SQL Server', sub: 'Server + auth configuration' },
        { id: 'enter_data', icon: <Table size={16} />, label: 'Enter Data', sub: 'Manual table entry' },
        { id: 'dataverse', icon: <Database size={16} />, label: 'Dataverse', sub: 'Connect to Dataverse source' },
        null,
        { id: 'more_connectors', icon: <Plus size={16} />, label: 'More...', sub: 'View all data connectors' },
    ];

    const recentSourcesOptions = [
        { id: 'recent_none', label: 'No recent sources', disabled: true },
    ];

    const transformDataOptions = [
        { id: 'transform_data', icon: <FileCode size={16} />, label: 'Transform Data', sub: 'Open Power Query editor' },
        { id: 'edit_queries', icon: <FileCode size={16} />, label: 'Edit Queries', sub: 'Edit existing query steps' },
        null,
        { id: 'data_src_settings', icon: <Database size={16} />, label: 'Data Source Settings' },
        { id: 'manage_parameters', icon: <Calculator size={16} />, label: 'Manage Parameters' },
    ];

    const moreVisualsOptions = [
        { id: 'vis_appsource', icon: <Search size={16} />, label: 'From AppSource', sub: 'Import from marketplace' },
        { id: 'vis_file', icon: <FileText size={16} />, label: 'From file...', sub: 'Import local visual' },
        null,
        { id: 'vis_remove', icon: <Plus size={16} />, label: 'Remove a visual', style: { transform: 'rotate(45deg)' } },
    ];

    const buttonsOptions = [
        { id: 'btn_blank', label: 'Blank' },
        { id: 'btn_back', label: 'Back' },
        { id: 'btn_drillthrough', label: 'Drill through' },
        { id: 'btn_page_nav', label: 'Page navigation' },
        { id: 'btn_bookmark', label: 'Bookmark' },
        { id: 'btn_info', label: 'Information' },
    ];

    const shapesOptions = [
        { id: 'shp_rect', icon: <Square size={16} />, label: 'Rectangle' },
        { id: 'shp_oval', icon: <Circle size={16} />, label: 'Oval' },
        { id: 'shp_line', icon: <Minus size={16} />, label: 'Line' },
        { id: 'shp_tri', icon: <Triangle size={16} />, label: 'Triangle' },
        { id: 'shp_arrow', icon: <ArrowRight size={16} />, label: 'Arrow' },
    ];

    const newCalcOptions = [
        { id: 'vcalc_custom', label: 'Custom' },
        { id: 'vcalc_run_sum', label: 'Running sum' },
        { id: 'vcalc_mov_avg', label: 'Moving average' },
        { id: 'vcalc_perc_parent', label: 'Percent of parent' },
        { id: 'vcalc_perc_grand', label: 'Percent of grand total' },
        { id: 'vcalc_avg_child', label: 'Average of children' },
        { id: 'vcalc_vs_prev', label: 'Versus previous' },
        { id: 'vcalc_vs_next', label: 'Versus next' },
        { id: 'vcalc_vs_first', label: 'Versus first' },
        { id: 'vcalc_vs_last', label: 'Versus last' },
        { id: 'vcalc_ctx_lookup', label: 'Look up a value with context' },
        { id: 'vcalc_tot_lookup', label: 'Look up a value with totals' },
    ];

    const securityOptions = [
        { id: 'manage_roles', icon: <Lock size={16} />, label: 'Manage roles', sub: 'Define row-level security' },
        { id: 'view_as', icon: <Eye size={16} />, label: 'View as', sub: 'Test RLS roles' },
    ];

    const parameterOptions = [
        { id: 'param_numeric', label: 'Numeric range', sub: 'What-if parameter' },
        { id: 'param_field', label: 'Fields', sub: 'Field parameter' },
    ];

    const themesOptions = [
        { id: 'theme_default', label: 'Power BI' },
        { id: 'theme_dark', label: 'Dark Mode' },
        { id: 'theme_high_contrast', label: 'High Contrast' },
        null,
        { id: 'theme_gallery', icon: <Palette size={16} />, label: 'Theme gallery' },
        { id: 'theme_import', icon: <Plus size={16} />, label: 'Browse for themes' },
        { id: 'theme_save', icon: <Share2 size={16} />, label: 'Save current theme' },
    ];

    const qnaOptions = [
        { id: 'qna_setup', icon: <Settings size={16} />, label: 'Q&A Setup', sub: 'Configure field synonyms' },
        { id: 'qna_language', icon: <Languages size={16} />, label: 'Language', sub: 'Select NLP language' },
        { id: 'qna_schema', icon: <FileJson size={16} />, label: 'Linguistic Schema', sub: 'Import/Export schema' },
    ];

    const pageViewOptions = [
        { id: 'view_fit_page', label: 'Fit to page' },
        { id: 'view_fit_width', label: 'Fit to width' },
        { id: 'view_actual', label: 'Actual size' },
    ];

    const sensitivityOptions = [
        { id: 'sens_general', label: 'General' },
        { id: 'sens_public', label: 'Public' },
        { id: 'sens_internal', label: 'Internal' },
        { id: 'sens_confidential', label: 'Confidential' },
        { id: 'sens_highly_conf', label: 'Highly Confidential' },
    ];

    const renderHomeToolbar = () => (
        <>
            {/* ── Clipboard ── */}
            <Group label="Clipboard">
                <RibbonBtn
                    icon={<Clipboard size={22} />}
                    label="Paste"
                    onClick={() => act('paste')}
                    tooltip="Paste (Ctrl+V)"
                />
                <div className="bi-tool-column">
                    <SmallBtn icon={<Scissors size={13} />} label="Cut" onClick={() => act('cut')} tooltip="Cut (Ctrl+X)" />
                    <SmallBtn icon={<Copy size={13} />} label="Copy" onClick={() => act('copy')} tooltip="Copy (Ctrl+C)" />
                    <SmallBtn icon={<Paintbrush size={13} />} label="Format Painter" onClick={() => act('format_painter')} tooltip="Copy formatting and apply to another visual" />
                </div>
            </Group>

            {/* ── Data ── */}
            <Group label="Data">
                {/* Get Data with dropdown */}
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Database size={22} />}
                        label="Get data"
                        onClick={() => toggleDropdown('get_data')}
                        tooltip="Connect to a data source"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'get_data' && (
                        <Dropdown options={getDataOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>

                <RibbonBtn
                    icon={<FileSpreadsheet size={22} />}
                    label="Excel workbook"
                    onClick={() => act('excel')}
                    tooltip="Import an Excel workbook (.xlsx)"
                />

                <RibbonBtn
                    icon={<Plus size={22} />}
                    label="Enter data"
                    onClick={() => act('enter_data')}
                    tooltip="Manually enter data into a table"
                />

                {/* Recent Sources with dropdown */}
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Clock size={22} />}
                        label="Recent sources"
                        onClick={() => toggleDropdown('recent_sources')}
                        tooltip="Reconnect to a recent data source"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'recent_sources' && (
                        <Dropdown options={recentSourcesOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>

            {/* ── Queries ── */}
            <Group label="Queries">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<FileCode size={22} />}
                        label="Transform data"
                        onClick={() => toggleDropdown('transform_data')}
                        tooltip="Open the data transformation editor"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'transform_data' && (
                        <Dropdown options={transformDataOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>

                <RibbonBtn
                    icon={<RotateCcw size={22} />}
                    label="Refresh"
                    onClick={() => act('refresh')}
                    tooltip="Reload all connected data sources and refresh visuals"
                />
            </Group>

            {/* ── Insert ── */}
            <Group label="Insert">
                <RibbonBtn
                    icon={<BarChart2 size={22} />}
                    label="New visual"
                    onClick={() => act('new_visual')}
                    tooltip="Add a blank visual container to the report canvas"
                />

                <RibbonBtn
                    icon={<Type size={22} />}
                    label="Text box"
                    onClick={() => act('text_box')}
                    tooltip="Insert an editable text element into the report"
                />

                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<MoreHorizontal size={22} />}
                        label="More visuals"
                        onClick={() => toggleDropdown('more_visuals')}
                        tooltip="Open the visual library"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'more_visuals' && (
                        <Dropdown options={moreVisualsOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>

            {/* ── Calculations ── */}
            <Group label="Calculations">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Calculator size={22} />}
                        label="New visual calculation"
                        onClick={() => toggleDropdown('new_calc')}
                        tooltip="Create a new visual calculation"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'new_calc' && (
                        <Dropdown options={newCalcOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>

                <RibbonBtn
                    icon={<Calculator size={22} />}
                    label="New measure"
                    onClick={() => act('new_measure')}
                    tooltip="Open the formula editor to create a dynamic measure"
                />

                <RibbonBtn
                    icon={<Zap size={22} />}
                    label="Quick measure"
                    onClick={() => act('quick_measure')}
                    tooltip="Guided calculation templates for common use cases"
                />
            </Group>

            {/* ── Sensitivity ── */}
            <Group label="Sensitivity">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Shield size={22} />}
                        label="Sensitivity"
                        onClick={() => toggleDropdown('sensitivity')}
                        tooltip="Apply a sensitivity classification label to this report"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'sensitivity' && (
                        <Dropdown options={sensitivityOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>

            {/* ── Share ── */}
            <Group label="Share">
                <RibbonBtn
                    icon={<Share2 size={22} />}
                    label="Publish"
                    onClick={() => act('publish')}
                    tooltip="Publish this report to a cloud workspace"
                />
            </Group>
        </>
    );

    const renderInsertToolbar = () => (
        <>
            {/* ── Pages ── */}
            <Group label="Pages">
                <RibbonBtn
                    icon={<FilePlus size={22} />}
                    label="New page"
                    onClick={() => act('new_page')}
                    tooltip="Add a new page to this report"
                />
            </Group>

            {/* ── Visuals ── */}
            <Group label="Visuals">
                <RibbonBtn
                    icon={<Layout size={22} />}
                    label="New visual"
                    onClick={() => act('new_visual')}
                    tooltip="Add a blank visual container to the report canvas"
                />
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<MoreHorizontal size={22} />}
                        label="More visuals"
                        onClick={() => toggleDropdown('more_visuals')}
                        tooltip="Open the visual library or AppSource"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'more_visuals' && (
                        <Dropdown options={moreVisualsOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>

            {/* ── AI Visuals ── */}
            <Group label="AI Visuals">
                <RibbonBtn
                    icon={<MessageSquare size={22} />}
                    label="Q&A"
                    onClick={() => act('ai_qna')}
                    tooltip="Ask a question about your data in natural language"
                />
                <RibbonBtn
                    icon={<Activity size={22} />}
                    label="Key influencers"
                    onClick={() => act('ai_influencers')}
                    tooltip="Identify factors that influence a specific metric"
                />
                <RibbonBtn
                    icon={<GitBranch size={22} />}
                    label="Decomposition tree"
                    onClick={() => act('ai_decomp_tree')}
                    tooltip="Break down a measure to understand contributors"
                />
                <RibbonBtn
                    icon={<FileText size={22} />}
                    label="Smart narrative"
                    onClick={() => act('ai_smart_narrative')}
                    tooltip="Add a summarized text description of your data"
                />
            </Group>

            {/* ── Power Platform ── */}
            <Group label="Power Platform">
                <RibbonBtn
                    icon={<FileText size={22} />}
                    label="Paginated report"
                    onClick={() => act('pp_paginated')}
                    tooltip="Embed a paginated report"
                />
                <RibbonBtn
                    icon={<AppWindow size={22} />}
                    label="Power Apps"
                    onClick={() => act('pp_apps')}
                    tooltip="Embed a Power App"
                />
                <RibbonBtn
                    icon={<Zap size={22} />}
                    label="Power Automate"
                    onClick={() => act('pp_automate')}
                    tooltip="Add a button to trigger an automation flow"
                />
            </Group>

            {/* ── Elements ── */}
            <Group label="Elements">
                <RibbonBtn
                    icon={<Type size={22} />}
                    label="Text box"
                    onClick={() => act('text_box')}
                    tooltip="Insert a text box with static or dynamic text"
                />
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<MousePointer2 size={22} />}
                        label="Buttons"
                        onClick={() => toggleDropdown('buttons')}
                        tooltip="Insert a button for navigation or actions"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'buttons' && (
                        <Dropdown options={buttonsOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Square size={22} />}
                        label="Shapes"
                        onClick={() => toggleDropdown('shapes')}
                        tooltip="Insert a basic geometric shape"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'shapes' && (
                        <Dropdown options={shapesOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
                <RibbonBtn
                    icon={<Image size={22} />}
                    label="Image"
                    onClick={() => act('insert_image')}
                    tooltip="Upload and insert an image"
                />
            </Group>

            {/* ── Sparklines ── */}
            <Group label="Sparklines">
                <RibbonBtn
                    icon={<TrendingUp size={22} />}
                    label="Add sparkline"
                    onClick={() => act('add_sparkline')}
                    tooltip="Insert a small line chart inside table or matrix cells"
                    disabled={true} // Replicating Power BI behavior: only available when table selected
                />
            </Group>
        </>
    );

    const renderModelingToolbar = () => (
        <>
            {/* ── Relationships ── */}
            <Group label="Relationships">
                <RibbonBtn
                    icon={<Database size={22} />}
                    label="Manage relationships"
                    onClick={() => act('manage_relationships')}
                    tooltip="Create, edit, and delete relationships between tables"
                />
            </Group>

            {/* ── Calculations ── */}
            <Group label="Calculations">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Calculator size={22} />}
                        label="New visual calculation"
                        onClick={() => toggleDropdown('new_calc')}
                        tooltip="Create a visual calculation"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'new_calc' && (
                        <Dropdown options={newCalcOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
                <RibbonBtn
                    icon={<Calculator size={22} />}
                    label="New measure"
                    onClick={() => act('new_measure')}
                    tooltip="Open formula bar to create a dynamic measure"
                />
                <RibbonBtn
                    icon={<Zap size={22} />}
                    label="Quick measure"
                    onClick={() => act('quick_measure')}
                    tooltip="Use guided templates for common calculations"
                />
                <RibbonBtn
                    icon={<Plus size={22} />}
                    label="New column"
                    onClick={() => act('new_column')}
                    tooltip="Create a new column that's calculated for each row"
                />
                <RibbonBtn
                    icon={<Table size={22} />}
                    label="New table"
                    onClick={() => act('new_table')}
                    tooltip="Create a new table based on a DAX expression"
                />
            </Group>

            {/* ── Calendars ── */}
            <Group label="Calendars">
                <RibbonBtn
                    icon={<Calendar size={22} />}
                    label="Mark as date table"
                    onClick={() => act('mark_date_table')}
                    tooltip="Enable time-intelligence features for this table"
                />
            </Group>

            {/* ── Page Refresh ── */}
            <Group label="Page refresh">
                <RibbonBtn
                    icon={<RefreshCw size={22} />}
                    label="Change detection"
                    onClick={() => act('change_detection')}
                    tooltip="Configure automatic page refresh based on data changes"
                />
            </Group>

            {/* ── Parameters ── */}
            <Group label="Parameters">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<Settings size={22} />}
                        label="New parameter"
                        onClick={() => toggleDropdown('parameters')}
                        tooltip="Create what-if parameters for users to adjust"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'parameters' && (
                        <Dropdown options={parameterOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>

            {/* ── Security ── */}
            <Group label="Security">
                <RibbonBtn
                    icon={<Lock size={22} />}
                    label="Manage roles"
                    onClick={() => act('manage_roles')}
                    tooltip="Define security roles and filters for row-level security"
                />
                <RibbonBtn
                    icon={<UserCheck size={22} />}
                    label="View as"
                    onClick={() => act('view_as')}
                    tooltip="Test your report as different security roles"
                />
            </Group>

            {/* ── Q&A ── */}
            <Group label="Q&A">
                <div className="bi-dropdown-wrapper">
                    <RibbonBtn
                        icon={<MessageSquare size={22} />}
                        label="Q&A Setup"
                        onClick={() => toggleDropdown('qna')}
                        tooltip="Configure synonyms and question behavior for Q&A"
                    >
                        <ChevronDown size={9} style={{ marginLeft: 2 }} />
                    </RibbonBtn>
                    {openDropdown === 'qna' && (
                        <Dropdown options={qnaOptions} onClose={closeDropdown} onSelect={act} />
                    )}
                </div>
            </Group>
        </>
    );

    const renderViewToolbar = () => {
        const themes = [
            { id: 'theme_default', name: 'Power BI', color: '#f2c811' },
            { id: 'theme_high_contrast', name: 'High Contrast', color: '#000000' },
            { id: 'theme_dark', name: 'Dark Mode', color: '#1a1a1a' },
            { id: 'theme_storm', name: 'Storm', color: '#4a90e2' },
            { id: 'theme_bloom', name: 'Bloom', color: '#50e3c2' },
        ];

        return (
            <>
                {/* ── Themes ── */}
                <Group label="Themes">
                    <div className="bi-theme-gallery">
                        {themes.map(t => (
                            <div
                                key={t.id}
                                className="bi-theme-thumbnail"
                                onClick={() => act(t.id)}
                                title={t.name}
                                style={{ backgroundColor: t.color }}
                            />
                        ))}
                    </div>
                    <div className="bi-dropdown-wrapper">
                        <SmallBtn
                            icon={<ChevronDown size={14} />}
                            label="More themes"
                            onClick={() => toggleDropdown('themes')}
                            tooltip="Browse or import themes"
                        />
                        {openDropdown === 'themes' && (
                            <Dropdown options={themesOptions} onClose={closeDropdown} onSelect={act} />
                        )}
                    </div>
                </Group>

                {/* ── Scale to Fit ── */}
                <Group label="Scale to fit">
                    <div className="bi-dropdown-wrapper" style={{ height: 'auto' }}>
                        <RibbonBtn
                            icon={<Monitor size={22} />}
                            label="Page view"
                            onClick={() => toggleDropdown('page_view')}
                            tooltip="Adjust how the page fits the screen"
                        >
                            <ChevronDown size={9} style={{ marginLeft: 2 }} />
                        </RibbonBtn>
                        {openDropdown === 'page_view' && (
                            <Dropdown options={pageViewOptions} onClose={closeDropdown} onSelect={act} />
                        )}
                    </div>
                </Group>

                {/* ── Mobile ── */}
                <Group label="Mobile">
                    <RibbonBtn
                        icon={<Smartphone size={22} />}
                        label="Mobile layout"
                        onClick={() => act('mobile_layout')}
                        tooltip="Switch to mobile report design mode"
                    />
                </Group>

                {/* ── Page Options ── */}
                <Group label="Page options">
                    <div className="bi-tool-column">
                        <SmallBtn icon={null} label="Gridlines" onClick={() => act('toggle_gridlines')} tooltip="Show or hide alignment gridlines" />
                        <SmallBtn icon={null} label="Snap to grid" onClick={() => act('toggle_snap')} tooltip="Align visuals to grid automatically" />
                        <SmallBtn icon={<Lock size={12} />} label="Lock objects" onClick={() => act('toggle_lock')} tooltip="Prevent visuals from being moved or resized" />
                    </div>
                </Group>

                {/* ── Show Panes ── */}
                <Group label="Show panes">
                    <div className="bi-tool-column">
                        <SmallBtn icon={<Filter size={12} />} label="Filters" onClick={() => act('toggle_filters')} />
                        <SmallBtn icon={<Bookmark size={12} />} label="Bookmarks" onClick={() => act('toggle_bookmarks')} />
                        <SmallBtn icon={<Layers size={12} />} label="Selection" onClick={() => act('toggle_selection')} />
                    </div>
                    <div className="bi-tool-column">
                        <SmallBtn icon={<Timer size={12} />} label="Performance analyzer" onClick={() => act('toggle_perf')} />
                        <SmallBtn icon={<Link2 size={12} />} label="Sync slicers" onClick={() => act('toggle_sync_slicers')} />
                    </div>
                </Group>
            </>
        );
    };

    const renderHelpToolbar = () => (
        <>
            <Group label="Help">
                <RibbonBtn icon={<Info size={22} />} label="About" onClick={() => act('about')} />
                <RibbonBtn icon={<BookOpen size={22} />} label="Documentation" onClick={() => act('help_docs')} />
                <RibbonBtn icon={<Play size={22} />} label="Guided learning" onClick={() => act('guided_learning')} />
                <RibbonBtn icon={<Users size={22} />} label="Community" onClick={() => act('community')} />
            </Group>
            <Group label="Support">
                <RibbonBtn icon={<MessageSquare size={22} />} label="Submit an idea" onClick={() => act('submit_idea')} />
                <RibbonBtn icon={<Settings size={22} />} label="Check for updates" onClick={() => act('check_updates')} />
            </Group>
        </>
    );

    const renderExternalToolsToolbar = () => (
        <>
            <Group label="External Tools">
                <RibbonBtn
                    icon={<Terminal size={22} />}
                    label="DAX Studio"
                    onClick={() => act('ext_dax_studio')}
                    tooltip="External tool for DAX authoring"
                />
                <RibbonBtn
                    icon={<Settings size={22} />}
                    label="Tabular Editor"
                    onClick={() => act('ext_tabular_editor')}
                    tooltip="External tool for model metadata editing"
                />
                <RibbonBtn
                    icon={<Cpu size={22} />}
                    label="ALM Toolkit"
                    onClick={() => act('ext_alm_toolkit')}
                    tooltip="External tool for dataset comparison"
                />
            </Group>
        </>
    );

    const renderMeasureToolsToolbar = () => (
        <>
            <Group label="Structure">
                <div className="bi-tool-column" style={{ width: 180, gap: '4px', paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', minWidth: 60 }}>Name</span>
                        <input type="text" className="bi-dropdown-select" defaultValue="Measure" readOnly style={{ flex: 1, padding: '2px 4px', height: 20 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', minWidth: 60 }}>Home table</span>
                        <select className="bi-dropdown-select" style={{ flex: 1, padding: '2px', height: 20 }} disabled>
                            <option>{fileName || 'Dataset'}</option>
                        </select>
                    </div>
                </div>
            </Group>
            
            <Group label="Formatting">
                <div className="bi-tool-column" style={{ width: 220, gap: '4px', paddingRight: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', minWidth: 40 }}>Format</span>
                        <select className="bi-dropdown-select" style={{ flex: 1, padding: '2px', height: 20 }}>
                            <option>General</option>
                            <option>Currency</option>
                            <option>Decimal number</option>
                            <option>Whole number</option>
                            <option>Percentage</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px', marginLeft: '48px' }}>
                        <button className="bi-icon-btn-small" title="Format as Currency">$</button>
                        <button className="bi-icon-btn-small" title="Format as Percentage">%</button>
                        <button className="bi-icon-btn-small" title="Comma style">,</button>
                        <div style={{ width: 1, height: 14, background: '#cbd5e1', margin: '0 4px' }} />
                        <select className="bi-dropdown-select" style={{ width: 45, padding: '2px', height: 20 }} defaultValue="Auto">
                            <option>Auto</option>
                            <option>0</option>
                            <option>1</option>
                            <option>2</option>
                            <option>3</option>
                            <option>4</option>
                        </select>
                    </div>
                </div>
            </Group>
            
            <Group label="Properties">
                <div className="bi-tool-column" style={{ width: 180, paddingRight: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', minWidth: 80 }}>Data category</span>
                        <select className="bi-dropdown-select" style={{ flex: 1, padding: '2px', height: 20 }} defaultValue="Uncategorized">
                            <option>Uncategorized</option>
                            <option>Address</option>
                            <option>City</option>
                            <option>Continent</option>
                            <option>Country/Region</option>
                            <option>County</option>
                            <option>Postal Code</option>
                            <option>State or Province</option>
                            <option>Web URL</option>
                            <option>Image URL</option>
                        </select>
                    </div>
                </div>
            </Group>

            <Group label="Calculations">
                <RibbonBtn icon={<Calculator size={22} />} label="New measure" onClick={() => act('new_measure')} />
                <RibbonBtn icon={<Zap size={22} color="#f59e0b" />} label="Quick measure" onClick={() => act('quick_measure')} />
            </Group>
        </>
    );

    const renderTableToolsToolbar = () => (
        <>
            <Group label="Structure">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '8px' }}>
                    <Type size={14} color="#64748b" style={{ transform: 'rotate(45deg)' }} />
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Name</span>
                    <input type="text" className="bi-dropdown-select" defaultValue={fileName?.replace('.csv', '') || 'apple_global_sales_...'} readOnly style={{ width: 140, padding: '2px 4px', height: 20 }} />
                </div>
            </Group>
            
            <Group label="Relationships">
                <RibbonBtn
                    icon={<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px', opacity: 0.5 }}><Square size={8} /><Square size={8} /><Square size={8} /><Square size={8} /></div>}
                    label="Manage relationships"
                    onClick={() => {}}
                    disabled={true}
                />
            </Group>

            <Group label="Calculations">
                <RibbonBtn
                    icon={<BarChart2 size={22} color="#cbd5e1" />}
                    label="New visual calculation"
                    onClick={() => act('new_visual_calc')}
                    disabled={true}
                >
                    <ChevronDown size={9} style={{ marginLeft: 2, color: '#cbd5e1' }} />
                </RibbonBtn>
                <RibbonBtn icon={<Calculator size={22} />} label="New measure" onClick={() => act('new_measure')} />
                <RibbonBtn icon={<Zap size={22} color="#f59e0b" />} label="Quick measure" onClick={() => act('quick_measure')} />
                <RibbonBtn icon={<Table size={22} color="#3b82f6" />} label="New column" onClick={() => act('new_column')} />
                <RibbonBtn icon={<Database size={22} />} label="New table" onClick={() => act('new_table')} />
            </Group>
            
            <Group label="Calendars">
                <RibbonBtn
                    icon={<Calendar size={22} color="#64748b" />}
                    label="Mark as date table"
                    onClick={() => act('mark_date_table')}
                />
            </Group>
        </>
    );

    const renderFileToolbar = () => null; // File tab opens overlay, not toolbar

    const renderToolbar = () => {
        switch (activeTab) {
            case 'File': return renderFileToolbar();
            case 'Home': return renderHomeToolbar();
            case 'Insert': return renderInsertToolbar();
            case 'Modeling': return renderModelingToolbar();
            case 'View': return renderViewToolbar();
            case 'Help': return renderHelpToolbar();
            case 'Table tools': return renderTableToolsToolbar();
            case 'External Tools': return renderExternalToolsToolbar();
            case 'Measure tools': return renderMeasureToolsToolbar();
            default: return renderHomeToolbar();
        }
    };

    return (
        <div className="bi-ribbon">
            {/* Title Bar */}
            {/* <div className="bi-title-bar">
                <div className="bi-title-left">
                    <Monitor size={14} className="bi-app-icon" />
                    <span className="bi-app-title">OneStopAnalytics Desktop</span>
                    <span className="bi-file-name">- {fileName || 'Untitled Report'}</span>
                </div>
                <div className="bi-search-wrapper">
                    <div className="bi-search-input-container">
                        <Search size={14} className="bi-search-icon" />
                        <input type="text" placeholder="Search" className="bi-ribbon-search" />
                    </div>
                </div>
                <div className="bi-title-right">
                    <button className="bi-title-btn"><User size={15} /> Sign in</button>
                    <button className="bi-title-btn bi-share-btn"><Share2 size={15} /> Share</button>
                </div>
            </div> */}

            {/* Tabs */}
            <div className="bi-ribbon-tabs">
                {tabs.map(tab => {
                    const isContextTab = tab === 'Measure tools' || tab === 'Table tools';
                    return (
                        <button
                            key={tab}
                            className={`bi-ribbon-tab ${activeTab === tab ? 'active' : ''} ${tab === 'File' ? 'bi-file-tab' : ''} ${isContextTab ? 'bi-context-tab' : ''} ${(isContextTab && activeTab === tab) ? 'bi-context-tab-active' : ''}`}
                            onClick={() => handleTabClick(tab)}
                        >
                            {tab}
                        </button>
                    )
                })}
                <button
                    className="bi-ribbon-collapse-btn"
                    onClick={() => setRibbonCollapsed(prev => !prev)}
                    title={ribbonCollapsed ? 'Expand ribbon (Ctrl+F1)' : 'Collapse ribbon (Ctrl+F1)'}
                >
                    {ribbonCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                </button>
            </div>

            {/* Dynamic Toolbar */}
            {activeTab !== 'File' && (
                <div className={`bi-ribbon-toolbar ${ribbonCollapsed ? 'bi-ribbon-collapsed' : ''}`}>
                    {renderToolbar()}
                </div>
            )}
        </div>
    );
};

export default BIRibbon;
