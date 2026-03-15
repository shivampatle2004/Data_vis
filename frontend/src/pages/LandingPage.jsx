import React, { useState, useRef, useEffect, useCallback } from 'react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DynamicChart from '../components/DynamicChart'
import SignInModal from '../components/SignInModal'
import CreateAccountModal from '../components/CreateAccountModal'
import AddFileModal from '../components/AddFileModal'
import SQLForm from '../components/SQLForm'
import DataPreviewPanel from '../components/DataPreviewPanel'
import DataTransformationPanel from '../components/DataTransformationPanel'
import ChartCustomizer from '../components/ChartCustomizer'
import DataService from '../services/dataService'
import * as XLSX from 'xlsx'
import BIRibbon from '../components/BIRibbon'
import BIInsightsPanel from '../components/BIInsightsPanel'
import BIDashboardCanvas from '../components/BIDashboardCanvas'
import BIVisualizationsFieldsPanel from '../components/BIVisualizationsFieldsPanel'
import BIModelView from '../components/BIModelView'
import BIFileMenu from '../components/BIFileMenu'
import BIRightPanes from '../components/BIRightPanes'
import {
  Table,
  Zap,
  Layout,
  LayoutGrid,
  FileText,
  BarChart3,
  Search,
  Maximize2,
  Database,
  Home,
  ChevronRight,
  ChevronLeft,
  Settings,
  HelpCircle,
  Share2,
  Download,
  Menu
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import './LandingPage.css'

/**
 * Landing Page Component
 */
function LandingPage({ userId, isDarkMode, toggleTheme, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialFileId = params.get('fileId');
  const initialFileName = params.get('fileName');

  const [query, setQuery] = useState('')
  const [fileName, setFileName] = useState(initialFileName || '')
  const [fileId, setFileId] = useState(initialFileId)
  const [isFileUploaded, setIsFileUploaded] = useState(!!initialFileId)
  const [processingStatus, setProcessingStatus] = useState(initialFileId ? 'processing' : 'idle') // idle, uploading, processing, completed, failed
  // Multi-page state: each page has its own graph/visual list (share the same fileId/dataset)
  const [pages, setPages] = useState([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
  const [activePageId, setActivePageId] = useState('page-1');

  // Derived helpers — all existing code that reads `graphs` or calls `setGraphs` continues to work
  const graphs = pages.find(p => p.id === activePageId)?.graphs ?? [];
  const setGraphs = (updater) => {
    setPages(prev => prev.map(p =>
      p.id !== activePageId ? p : {
        ...p,
        graphs: typeof updater === 'function' ? updater(p.graphs) : updater
      }
    ));
  };

  // Page management
  const handleAddPage = () => {
    const id = `page-${Date.now()}`;
    setPages(prev => [...prev, { id, name: `Page ${prev.length + 1}`, graphs: [] }]);
    setActivePageId(id);
    setActiveVisualId(null);
  };

  const handleDeletePage = (id) => {
    setPages(prev => {
      const remaining = prev.filter(p => p.id !== id);
      if (remaining.length === 0) return [{ id: 'page-1', name: 'Page 1', graphs: [] }];
      return remaining;
    });
    setActivePageId(prev => {
      if (prev !== id) return prev;
      const remaining = pages.filter(p => p.id !== id);
      return remaining[0]?.id ?? 'page-1';
    });
    setActiveVisualId(null);
  };

  const handleRenamePage = (id) => {
    const current = pages.find(p => p.id === id);
    const name = window.prompt('Rename page:', current?.name ?? 'Page');
    if (name && name.trim()) {
      setPages(prev => prev.map(p => p.id === id ? { ...p, name: name.trim() } : p));
    }
  };
  const [stats, setStats] = useState(null)
  const [fileMetadata, setFileMetadata] = useState(null)
  const [reportQuery, setReportQuery] = useState('')
  const [isQuerying, setIsQuerying] = useState(false)
  const [schema, setSchema] = useState([])
  const [customChart, setCustomChart] = useState({
    graph_type: 'bar',
    x_axis: '',
    y_axis: '',
    aggregation: 'count',
    selected_columns: []
  });
  const [isAddingChart, setIsAddingChart] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(!!initialFileId)
  const [activeFormat, setActiveFormat] = useState('CSV') // CSV, Excel, JSON, SQL
  const [sqlMode, setSqlMode] = useState('idle') // idle, active, querying
  const [sqlResults, setSqlResults] = useState(null)
  const [connectionId, setConnectionId] = useState(null)
  const [lastSqlQuery, setLastSqlQuery] = useState('')

  // Sidebar State
  const [selectedData, setSelectedData] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Phase 1 Features State
  const [dataService] = useState(() => new DataService())
  const [dataset, setDataset] = useState(null)
  const [transformations, setTransformations] = useState([])
  const [draggedItemIndex, setDraggedItemIndex] = useState(null)
  const [dragOverItemIndex, setDragOverItemIndex] = useState(null)

  // Modals & Panels
  const [reportDetailTab, setReportDetailTab] = useState('visualizations') // visualizations, transform modal
  const [renderDataPreview, setRenderDataPreview] = useState(false) // Toggle data preview display

  // Customization & Layout Builder
  const [activeCustomizerId, setActiveCustomizerId] = useState(null)
  const [success, setSuccess] = useState(null)

  // Sidebar Modals State
  const [isOpenModalOpen, setIsOpenModalOpen] = useState(false)
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [userFiles, setUserFiles] = useState([])
  const [isFetchingFiles, setIsFetchingFiles] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')
  const [shareEmail, setShareEmail] = useState('')

  const fileInputRef = useRef(null)
  const reportRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false)
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false)
  const [shouldAuthNavigate, setShouldAuthNavigate] = useState(true)
  const [pendingFormat, setPendingFormat] = useState(null)
  const [ribbonTab, setRibbonTab] = useState('Home')
  const [isAddFileModalOpen, setIsAddFileModalOpen] = useState(false)
  const [activeView, setActiveView] = useState('report') // 'report' | 'data' | 'model'
  const [activeVisualId, setActiveVisualId] = useState(null)
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isDataverseModalOpen, setIsDataverseModalOpen] = useState(false);
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
  })
  const [isSqlSubmitting, setIsSqlSubmitting] = useState(false)
  const [sqlError, setSqlError] = useState('')
  const [sqlSuccess, setSqlSuccess] = useState('')

  // Multi-step SQL connection state
  const [sqlModalStep, setSqlModalStep] = useState(1);
  const [sqlActiveTab, setSqlActiveTab] = useState('upload'); // 'upload' or 'connect'
  const [sqlConnections, setSqlConnections] = useState([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [selectedConnectionName, setSelectedConnectionName] = useState('');

  // Dataverse state
  const [dataverseForm, setDataverseForm] = useState({
    environmentUrl: '',
    tenantId: '',
    clientId: '',
    clientSecret: '',
    tableName: ''
  });
  const [isDataverseSubmitting, setIsDataverseSubmitting] = useState(false);

  // Sidebar State for Expansion Coordination
  const [isInsightsCollapsed, setIsInsightsCollapsed] = useState(false);
  const [isRightPanesCollapsed, setIsRightPanesCollapsed] = useState(false);

  // New Measure State
  const [showMeasureBar, setShowMeasureBar] = useState(false);
  const [measureFormula, setMeasureFormula] = useState("Measure = ");
  const [measures, setMeasures] = useState([]);
  const [activeMeasure, setActiveMeasure] = useState(null);

  // Panel Refs for Programmatic Control
  const insightsPanelRef = useRef(null);
  const rightPanesPanelRef = useRef(null);

  const handleGoHome = () => {
    setActiveView('landing');
    setIsFileUploaded(false);
    setFileName('');
    setPages([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
    setActivePageId('page-1');
    setActiveVisualId(null);
    setSchema([]);
    setStats({});
    setFileId(null);
    setQuery('');
    setReportQuery('');
    setProcessingStatus('idle');
    setDataset(null);
    setTransformations([]);
    navigate('/', { replace: true });
  };

  const handleNewUploadReset = () => {
    // Keep in report view but clear all data
    setPages([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
    setActivePageId('page-1');
    setActiveVisualId(null);
    setSchema([]);
    setStats({});
    setDataset(null);
    setTransformations([]);
    dataService.clear(); // Ensure DataService internal state is wiped
  };

  useEffect(() => {
    if (isFileUploaded) {
      document.body.classList.add('report-active');
    } else {
      document.body.classList.remove('report-active');
    }
    return () => document.body.classList.remove('report-active');
  }, [isFileUploaded]);

  // Handle pending format after login
  useEffect(() => {
    if (userId && pendingFormat === 'SQL') {
      setActiveFormat('SQL');
      setSqlMode('active');
      setPendingFormat(null);
    }
  }, [userId, pendingFormat]);

  // Reset page when navigating or loading a specific file
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const idFromQuery = params.get('fileId');
    const nameFromQuery = params.get('fileName');

    if (idFromQuery) {
      setFileId(idFromQuery);
      if (nameFromQuery) setFileName(decodeURIComponent(nameFromQuery));
      setIsInitialLoading(true);
      // Never block the UI longer than 2s on initial hydration.
      // Data can continue loading progressively in the background.
      const maxHydrationTimer = setTimeout(() => setIsInitialLoading(false), 2000);

      // Verify status with backend instead of assuming 'completed'
      fetch(`/api/files/${idFromQuery}/status`)
        .then(res => res.json())
        .then(data => {
          if (data.fileName) setFileName(data.fileName);

          if (data.status === 'completed') {
            setProcessingStatus('completed');
            fetchInitialData(idFromQuery);
            loadDatasetForFeatures(idFromQuery);
          } else {
            // Let the polling effect handle it
            setProcessingStatus(data.status || 'processing');
          }
        })
        .catch(() => {
          setProcessingStatus('failed');
          setIsInitialLoading(false);
        });

      return () => clearTimeout(maxHydrationTimer);
    }
    else if (params.get('mode') === 'sql') {
      setIsFileUploaded(false);
      setActiveFormat('SQL');
      setSqlMode('active');
      setFileId(null);
    }
    else {
      setIsFileUploaded(false)
      setFileName('')
      setQuery('')
      setReportQuery('')
      setFileId(null)
      setProcessingStatus('idle')
      // Reset all pages to a single blank page
      setPages([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
      setActivePageId('page-1');
      setActiveVisualId(null);
      setStats(null)
      setSchema([])
      setCustomChart({
        graph_type: 'bar',
        x_axis: '',
        y_axis: '',
        aggregation: 'count',
        selected_columns: []
      })
      setIsSidebarOpen(false)
      setSelectedData(null)
    }
  }, [location.search])
  useEffect(() => {
    let interval;
    if (fileId && processingStatus !== 'completed') {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/files/${fileId}/status`);
          const data = await response.json();

          if (data.status === 'completed') {
            setProcessingStatus('completed');
            setFileMetadata(data);
            fetchInitialData(fileId);
            loadDatasetForFeatures(fileId);
            clearInterval(interval);
          } else if (data.status === 'failed') {
            setProcessingStatus('failed');
          } else {
            setProcessingStatus(data.status || 'processing');
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [processingStatus, fileId]);

  const fetchInitialData = async (id) => {
    if (!id || id === 'undefined' || id === 'null') return;
    try {
      // Fetch graphs/stats/schema in parallel to minimize time-to-interactive.
      const [graphsResponse, statsResponse, schemaResponse] = await Promise.all([
        fetch(`/api/files/${id}/graphs`),
        fetch(`/api/files/${id}/statistics`),
        fetch(`/api/files/${id}/schema`)
      ]);

      const [graphsDataRaw, statsData, schemaData] = await Promise.all([
        graphsResponse.ok ? graphsResponse.json() : Promise.resolve([]),
        statsResponse.ok ? statsResponse.json() : Promise.resolve(null),
        schemaResponse.ok ? schemaResponse.json() : Promise.resolve([])
      ]);

      // Graphs
      let graphsData = graphsDataRaw;
      if (Array.isArray(graphsData)) {
        graphsData = graphsData.map((g, i) => ({
          ...g,
          id: g.id || `graph-${i}-${Date.now()}`
        }));
        setPages([{ id: 'page-1', name: 'Page 1', graphs: graphsData }]);
        setActivePageId('page-1');
      } else {
        setPages([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
        setActivePageId('page-1');
      }

      // Stats + schema
      setStats(statsData);
      setSchema(Array.isArray(schemaData) ? schemaData : []);

      // Pre-select first columns if available
      if (Array.isArray(schemaData) && schemaData.length > 0) {
        const numericCol = schemaData.find(c => c.data_type === 'numeric')?.column_name;
        setCustomChart(prev => ({
          ...prev,
          x_axis: schemaData[0].column_name,
          y_axis: (numericCol || schemaData[0].column_name) === schemaData[0].column_name ? '' : (numericCol || schemaData[0].column_name)
        }));
      }
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsInitialLoading(false);
    }
  };

  // Phase 1: Load dataset for preview/transform features
  const loadDatasetForFeatures = async (id) => {
    try {
      const res = await fetch(`/api/files/${id}/download`);
      if (!res.ok) throw new Error("Failed to fetch file");

      const response = await res.json();
      let fileContent = response.content;
      let data = [];

      // Parse based on file type
      if (fileName.endsWith('.csv')) {
        data = parseCSVForLanding(fileContent);
      } else if (fileName.endsWith('.json')) {
        data = JSON.parse(fileContent);
        if (!Array.isArray(data)) data = [data];
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Handle base64-encoded Excel files
        if (response.isBase64) {
          try {
            // Decode base64 to binary string
            const binaryString = atob(fileContent);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Parse with XLSX
            const workbook = XLSX.read(bytes, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            data = XLSX.utils.sheet_to_json(firstSheet);
          } catch (xlsxErr) {
            console.error('Error parsing Excel file:', xlsxErr);
            return;
          }
        }
      }

      if (data && data.length > 0) {
        dataService.loadDataset(data);
        const computedData = dataService.getComputedDataset();
        setDataset(computedData);
        setTransformations([]);
      }
    } catch (err) {
      console.error('Error loading dataset:', err);
    }
  }

  // CSV parsing helper
  const parseCSVForLanding = (csvContent) => {
    const lines = csvContent.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const headers = parseCSVLineHelper(headerLine);

    const data = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = parseCSVLineHelper(lines[i]);
      const row = {};

      headers.forEach((header, idx) => {
        let value = values[idx] || '';
        value = value.trim();

        if (value === '' || value === 'null' || value === 'NULL' || value === 'N/A') {
          row[header] = null;
        } else if (value === 'true' || value === 'TRUE') {
          row[header] = true;
        } else if (value === 'false' || value === 'FALSE') {
          row[header] = false;
        } else {
          const num = parseFloat(value);
          row[header] = !isNaN(num) && value.trim() !== '' ? num : value;
        }
      });

      data.push(row);
    }

    return data;
  }

  const parseCSVLineHelper = (line) => {
    const result = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result.map(v => v.trim());
  }

  // Transform handlers for Phase 1 features
  const handleApplyTransform = (operation) => {
    const metadata = dataService.applyTransformation(operation);
    setDataset(dataService.getComputedDataset());
    setTransformations(dataService.getTransformations());
    if (metadata && metadata.message) {
      setSuccess(metadata.message);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    }
  }

  const handleUndoTransform = () => {
    dataService.undoLastTransformation();
    setDataset(dataService.getComputedDataset());
    setTransformations(dataService.getTransformations());
    setSuccess('↶ Undo successful');
    setTimeout(() => setSuccess(null), 2000);
  }

  const handleResetTransforms = () => {
    if (window.confirm('Reset all transformations? This will restore original data.')) {
      dataService.resetTransformations();
      setDataset(dataService.getComputedDataset());
      setTransformations([]);
      setSuccess('✓ All transformations cleared');
      setTimeout(() => setSuccess(null), 2000);
    }
  }

  const handleRemoveTransform = (transformId) => {
    dataService.removeTransformation(transformId);
    setDataset(dataService.getComputedDataset());
    setTransformations(dataService.getTransformations());
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (file) {
      setFileName(file.name)
      // If we are already in the Workspace (Report View), trigger upload automatically.
      // If we are on the Landing Page, wait for manual click on "Visualize".
      if (isFileUploaded) {
        await handleUpload(file)
      }
    }
  }

  const handleDataverseConnect = async (e) => {
    e.preventDefault();
    setIsDataverseSubmitting(true);
    setSqlError('');
    setSqlSuccess('');

    try {
      const payload = {
        user_id: userId || 1, // Fallback for demo
        environment_url: dataverseForm.environmentUrl,
        tenant_id: dataverseForm.tenantId,
        client_id: dataverseForm.clientId,
        client_secret: dataverseForm.clientSecret,
        table_name: dataverseForm.tableName
      };

      const res = await fetch('/api/sql/dataverse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Dataverse connection failed');
      }

      const data = await res.json();
      
      setSqlSuccess(`Starting import of ${dataverseForm.tableName}...`);
      
      // Simulate close after success message
      setTimeout(() => {
        setIsDataverseModalOpen(false);
        setIsSqlModalOpen(false);
        setSqlSuccess('');
        
        // Push file to UI flow
        if (data.file_id) {
          navigate(`/?fileId=${data.file_id}&fileName=${encodeURIComponent("Dataverse: " + dataverseForm.tableName)}`);
        }
      }, 1500);

    } catch (err) {
      setSqlError(err.message);
    } finally {
      setIsDataverseSubmitting(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    setProcessingStatus('uploading');
    setIsFileUploaded(true); // Switch to report view (which will show loading)
    handleNewUploadReset();  // [CRITICAL] Reset state for the new file

    const formData = new FormData();
    formData.append('file', file);
    // Add user_id only if user is authenticated
    if (userId) {
      formData.append('user_id', userId);
    }

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const data = await response.json();
      setFileId(data.file_id);

      // Update URL with new fileId and fileName
      navigate(`/?fileId=${data.file_id}&fileName=${encodeURIComponent(file.name)}`, { replace: true });

      setProcessingStatus('processing');
    } catch (error) {
      console.error('Upload error:', error);
      setProcessingStatus('failed');
      alert(`Upload error: ${error.message}`);
      setIsFileUploaded(false);
    }
  };

  const removeFile = () => {
    setFileName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fileName && !query.trim()) return;

    const file = fileInputRef.current?.files[0];
    if (file) {
      // If we already handled it via handleFileChange, this might be redundant 
      // but it handles cases where the user clicks Visualize after picking a file
      await handleUpload(file);
    } else if (query.trim()) {
      // Small dummy logic for query-only (NLP placeholder)
      setIsFileUploaded(true);
      setProcessingStatus('completed');
    }
  };

  const [authMessage, setAuthMessage] = useState(null)

  const handleExportPDF = async () => {
    if (!userId) {
      setAuthMessage('Sign in or Sign up to unlock PDF Export – a premium feature.');
      setIsSignInModalOpen(true);
      setShouldAuthNavigate(false); // Don't navigate to dashboard, stay on report
      return;
    }

    if (!reportRef.current) return;
    setIsExporting(true);

    // Smooth scroll to top to ensure everything is in viewport (some browsers need this)
    window.scrollTo(0, 0);

    try {
      const element = reportRef.current;

      // Delay to ensure any state changes (like isExporting) have propagated to charts
      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200, // Stabilize layout width
        onclone: (clonedDoc) => {
          // 1. Force white background on the clone's body
          clonedDoc.body.style.backgroundColor = '#ffffff';
          clonedDoc.body.style.backgroundImage = 'none';

          // 2. Hide unwanted elements
          const elementsToHide = clonedDoc.querySelectorAll(
            '.header-actions, .report-controls-grid, .btn-icon, .btn-premium, .side-panel, .side-panel-overlay, .landing-page-minimal-stars, .recharts-tooltip-wrapper, .recharts-tooltip-cursor'
          );
          elementsToHide.forEach(el => el.style.display = 'none');

          // 3. Inject a CLEAN, PROFESSIONAL STYLE TAG
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            * {
              font-family: 'Inter', system-ui, -apple-system, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              transition: none !important;
              animation: none !important;
            }
            .viz-report-container {
              background-color: #ffffff !important;
              color: #1a1a1a !important;
              padding: 40px !important;
              width: 1100px !important;
              margin: 0 auto !important;
              border-radius: 0 !important;
              box-shadow: none !important;
            }
            .report-card {
              background-color: #f8fafc !important;
              color: #1a1a1a !important;
              box-shadow: none !important;
              border: 1px solid #e2e8f0 !important;
              margin-bottom: 24px !important;
              padding: 24px !important;
              border-radius: 12px !important;
              break-inside: avoid !important;
            }
            h1 {
              color: #0f172a !important;
              font-size: 32px !important;
              font-weight: 700 !important;
              margin-bottom: 8px !important;
            }
            .report-tag {
              color: #64748b !important;
              font-weight: 600 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.05em !important;
            }
            p {
              color: #475569 !important;
              font-size: 16px !important;
            }
            h3 {
              color: #334155 !important;
              font-size: 14px !important;
              font-weight: 600 !important;
              text-transform: uppercase !important;
              margin-bottom: 16px !important;
              border-bottom: 1px solid #e2e8f0 !important;
              padding-bottom: 8px !important;
            }
            .gradient-text {
              background: none !important;
              -webkit-text-fill-color: #78176b !important;
              color: #78176b !important;
            }
            /* Recharts specific styling for PDF */
            .recharts-cartesian-axis-line,
            .recharts-cartesian-axis-tick-line {
              stroke: #cbd5e1 !important;
            }
            .recharts-cartesian-grid-horizontal line,
            .recharts-cartesian-grid-vertical line {
              stroke: #f1f5f9 !important;
            }
            .recharts-text {
              fill: #64748b !important;
              font-size: 12px !important;
              font-weight: 500 !important;
            }
            .recharts-legend-item-text {
              color: #475569 !important;
              font-size: 13px !important;
            }
            .landing-page-minimal::before, .landing-page-minimal::after {
              display: none !important;
            }
            .viz-graphic {
              display: none !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'pt', 'a4');

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // Calculate how much content fits on one page
      const ratio = contentWidth / imgWidth;
      const canvasPageHeight = pageHeight / ratio;

      let heightLeft = imgHeight;
      let position = 0;

      // Add the first page
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, imgHeight * ratio);
      heightLeft -= canvasPageHeight;

      // Add subsequent pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position * ratio + margin, contentWidth, imgHeight * ratio);
        heightLeft -= canvasPageHeight;
      }

      pdf.save(`${fileName || 'analysis'}.pdf`);

    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  const handleReportQuery = async (e) => {
    e.preventDefault();
    if (!reportQuery.trim() || !fileId) return;

    setIsQuerying(true);
    try {
      const response = await fetch(`/api/files/${fileId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: reportQuery })
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Query failed');
        return;
      }

      const newGraph = await response.json();
      const newChartWithConfig = {
        ...newGraph,
        options: {
          showLegend: true,
          showGrid: true,
          numberFormat: 'none',
          sort: 'none'
        }
      };
      // Prepend the new custom graph to the top of the grid
      setGraphs(prev => [newChartWithConfig, ...prev]);
      setReportQuery(''); // Clear input
    } catch (error) {
      console.error('Report query error:', error);
      alert('Failed to process your request. Please mention column names clearly.');
    } finally {
      setIsQuerying(false);
    }
  };

  const handleAddCustomChart = async (e) => {
    e.preventDefault();
    if (!customChart.x_axis || (!fileId && !connectionId)) return;

    setIsAddingChart(true);
    try {
      let response = null;
      let aggData = null;

      if (customChart.graph_type === 'table') {
        // Table chart bypasses backend aggregation completely. We just use the dataset locally.
        if (!dataset || !dataset.rows) throw new Error("Dataset is not loaded for table creation");

        // Grab the first 100 rows to match performance safeguards
        const previewRows = dataset.rows.slice(0, 100);

        // Map explicitly requested columns
        const filteredRows = previewRows.map(row => {
          const newRow = {};
          customChart.selected_columns.forEach(col => {
            newRow[col] = row[col];
          });
          return newRow;
        });

        aggData = {
          is_table: true,
          columns: customChart.selected_columns,
          rows: filteredRows
        };
      } else {
        if (sqlMode === 'querying' && lastSqlQuery) {
          // Use SQL aggregation endpoint
          const formData = new FormData();
          formData.append('query', lastSqlQuery);
          formData.append('x_axis', customChart.x_axis);
          if (customChart.y_axis) formData.append('y_axis', customChart.y_axis);
          formData.append('aggregation', customChart.aggregation);
          if (connectionId) formData.append('connection_id', connectionId);

          response = await fetch('/api/sql/aggregate', {
            method: 'POST',
            body: formData
          });
        } else {
          // Standard file-based aggregation
          response = await fetch(`/api/files/${fileId}/graph-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(customChart)
          });
        }

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.detail || 'Failed to fetch data for custom chart');
        }

        aggData = await response.json();
      }

      // PERSISTENCE: Save the graph definition to the database
      if (fileId && fileId !== 'undefined') {
        try {
          await fetch(`/api/files/${fileId}/save-graph`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              graph_type: customChart.graph_type,
              x_axis: customChart.graph_type === 'table' ? 'Table' : customChart.x_axis,
              y_axis: customChart.graph_type === 'table' ? customChart.selected_columns.join(',') : customChart.y_axis,
              aggregation: customChart.graph_type === 'table' ? 'none' : customChart.aggregation
            })
          });
          console.log('DEBUG: Custom graph persisted to DB');
        } catch (persistErr) {
          console.error('Error persisting custom graph:', persistErr);
          // We don't block the UI if persistence fails, but it's good to log
        }
      }

      // We create a graph definition object to add to the list
      const newGraph = {
        id: `custom-${Date.now()}`,
        ...customChart,
        cached_data: aggData, // Store aggregated data so DynamicChart can render it immediately
        options: {
          showLegend: true,
          showGrid: true,
          numberFormat: 'none',
          sort: 'none',
          size: 'medium'
        }
      };

      setGraphs(prev => [newGraph, ...prev]);

      // Smooth scroll to the top of the grid to show new chart
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (error) {
      console.error('Error adding custom chart:', error);
      alert(error.message || 'Failed to generate chart. Please check your selections.');
    } finally {
      setIsAddingChart(false);
    }
  };

  const handleDataClick = React.useCallback((data) => {
    console.log("Chart Data Clicked:", data);
    setSelectedData(data);
    setIsSidebarOpen(true);
  }, []);

  const handleDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
    e.dataTransfer.setData('text/html', e.target.parentNode);
    e.target.classList.add('dragging');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (index === null || draggedItemIndex === index) {
      if (dragOverItemIndex !== null) setDragOverItemIndex(null);
      return;
    }
    setDragOverItemIndex(index);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging');
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const fetchUserFiles = async () => {
    if (!userId) {
      setAuthMessage('Sign in to browse your previously uploaded files.')
      setIsSignInModalOpen(true)
      return
    }
    setIsFetchingFiles(true)
    try {
      const response = await fetch(`/api/files/user/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setUserFiles(data)
        setIsOpenModalOpen(true)
      } else {
        throw new Error('Failed to fetch files')
      }
    } catch (e) {
      console.error(e)
      alert('Could not fetch your recently opened files.')
    } finally {
      setIsFetchingFiles(false)
    }
  }

  const addToRecent = (id, name) => {
    try {
      if (!id || !name) return;
      const recent = JSON.parse(localStorage.getItem('osa_recent_files') || '[]');
      const dateStr = new Date().toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const newRecent = [
        { id, fileName: name, uploadDate: dateStr },
        ...recent.filter(f => f.id !== id)
      ].slice(0, 10);
      localStorage.setItem('osa_recent_files', JSON.stringify(newRecent));
      // Dispatch an event so components listening to this know when to update
      window.dispatchEvent(new Event('osa_recent_files_updated'));
    } catch (e) {
      console.error('Failed to update recent files', e);
    }
  };

  const handleExportDataFn = () => {
    if (!dataset || !dataset.rows || dataset.rows.length === 0) {
      alert("No data available to export.");
      return;
    }
    try {
      const headers = Object.keys(dataset.rows[0]);
      const csvLines = [
        headers.join(','),
        ...dataset.rows.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
      ];
      const csvStr = csvLines.join('\n');

      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${fileName || 'export'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccess('Data exported successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to export data.');
    }
  }

  const handleSqlConnectFromModal = async (e) => {
    e.preventDefault();
    if (isSqlSubmitting) return;

    setIsSqlSubmitting(true);
    setSqlError('');

    try {
      if (!userId) {
        setPendingFormat('SQL');
        setShouldAuthNavigate(false);
        setIsSignInModalOpen(true);
        setIsSqlSubmitting(false);
        return;
      }

      const formData = new FormData();
      formData.append('user_id', userId);

      const connectionName = sqlForm.connectionName || (sqlForm.databaseName
        ? `${sqlForm.host || sqlForm.serverName || 'PostgreSQL'} — ${sqlForm.databaseName}`
        : (sqlForm.host || sqlForm.serverName || 'PostgreSQL Connection'));

      formData.append('connection_name', connectionName);
      formData.append('db_type', sqlForm.dbType || 'postgresql');
      formData.append('host', sqlForm.host || sqlForm.serverName || 'localhost');
      formData.append('port', sqlForm.port || '5432');
      formData.append('database', sqlForm.databaseName);
      formData.append('username', sqlForm.username);
      formData.append('password', sqlForm.password);

      const res = await fetch('/api/sql/connect', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'SQL Server connection failed');
      }

      const data = await res.json().catch(() => ({}));
      if (data?.connection_id) {
        setConnectionId(data.connection_id);
      }

      // If we reach here, connection was successful
      setSqlSuccess("Connection successful!");

      // Advance logic only on success
      setTimeout(() => {
        if (sqlModalStep === 1) {
          setSqlModalStep(2); // Advance step 1 to step 2
        } else if (sqlModalStep === 2) {
          const connName = sqlForm.connectionName || (sqlForm.databaseName
            ? `${sqlForm.host || sqlForm.serverName || 'PostgreSQL'} — ${sqlForm.databaseName}`
            : (sqlForm.host || sqlForm.serverName || 'PostgreSQL Connection'));
          setSelectedConnectionName(connName);
          setSqlModalStep(3); // Advance step 2 to step 3
        }
        setSqlSuccess(''); // Clear for next potential attempt
      }, 1000);

    } catch (err) {
      console.error("SQL Connection Error caught in handleSqlConnectFromModal:", err);
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

  const handleExecuteSqlFromModal = async () => {
    if (!sqlQuery.trim()) return;
    if (isSqlSubmitting) return;

    setIsSqlSubmitting(true);
    setSqlError('');

    try {
      const uId = localStorage.getItem('userId');
      const formData = new FormData();
      formData.append('query', sqlQuery);
      if (uId) formData.append('user_id', uId);
      if (connectionId) formData.append('connection_id', connectionId);

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
        // Refresh to load the new context
        window.location.reload();
      }
    } catch (err) {
      console.error("SQL Execution Error:", err);
      setSqlError(err.message);
    } finally {
      setIsSqlSubmitting(false);
    }
  };

  const handleMeasureConfirm = () => {
    const parts = measureFormula.split('=');
    const name = parts[0].trim() || `Measure ${measures.length + 1}`;
    const value = parts.slice(1).join('=').trim();
    if (value) {
      setMeasures(prev => [...prev, { name, formula: measureFormula }]);
    }
    setShowMeasureBar(false);
    setActiveMeasure(null);
  };

  const handleMeasureCancel = () => {
    setShowMeasureBar(false);
    setActiveMeasure(null);
    setRibbonTab('Table tools'); // Switch to Table tools on cancel
  };

  const handleRibbonAction = (actionId, ...args) => {
    switch (actionId) {
      case 'new_measure':
        setShowMeasureBar(true);
        setActiveMeasure("Measure"); // Indicates we are creating a new measure
        setMeasureFormula("Measure = ");
        setRibbonTab('Measure tools'); // Auto-switch tab to 'Measure tools'
        break;
      case 'quick_measure':
        setShowMeasureBar(true);
        setActiveMeasure("QuickMeasure"); 
        setMeasureFormula('QuickMeasure = CALCULATE(SUM([Column]), FILTER(Table, Table[Status] = "Active"))');
        setRibbonTab('Measure tools'); 
        break;
      case 'open_recent':
        if (args[0]) {
          navigate(`/?fileId=${args[0].id}&fileName=${encodeURIComponent(args[0].fileName)}`);
        }
        break;
      case 'file_new':
        setIsAddFileModalOpen(true);
        break;
      case 'home':
        handleGoHome();
        break;
      case 'open_local':
      case 'open_cloud':
        fetchUserFiles();
        break;
      case 'file_save':
        if (!fileId && !connectionId) {
          alert("Please upload or select a file first.");
          return;
        }
        handleSaveDashboardLayout();
        addToRecent(fileId || connectionId, fileName || 'Untitled Report');
        break;
      case 'file_save_as':
        if (!fileId && !connectionId) {
          alert("Please upload or select a file first.");
          return;
        }
        setIsSaveAsModalOpen(true);
        break;
      case 'file_share':
        if (!fileId && !connectionId) {
          alert("Please upload or select a file first.");
          return;
        }
        setIsShareModalOpen(true);
        break;
      case 'export_data':
        handleExportDataFn();
        break;
      case 'route_signin':
        setIsSignInModalOpen(true);
        setShouldAuthNavigate(false);
        break;
      case 'route_options':
        window.location.href = '/settings';
        break;
      case 'route_about':
        window.location.href = '/about';
        break;
      case 'new_analysis':
        setIsFileUploaded(false);
        break;
      case 'export_pdf':
        handleExportPDF();
        break;
      case 'refresh':
        if (fileId) {
          fetchInitialData(fileId);
          loadDatasetForFeatures(fileId);
          setSuccess('Data refreshed successfully');
          setTimeout(() => setSuccess(''), 3000);
        }
        break;
      case 'sql':
        if (!userId) {
          setPendingFormat('SQL');
          setShouldAuthNavigate(false);
          setIsSignInModalOpen(true);
          return;
        }
        // Open inline SQL Server connection modal on top of the current dashboard
        setIsSqlModalOpen(true);
        setSqlModalStep(2); // Start at connection selection (Step 2 supports PostgreSQL)
        setSqlActiveTab('connect');
        setSqlQuery('');
        setConnectionId(null);
        setSelectedConnectionName('');
        break;
      case 'dataverse':
        // Reuse sql styling wrapper for simplicity, set flag internally
        setIsDataverseModalOpen(true);
        setIsSqlModalOpen(true); 
        setSqlModalStep(0); // Secret Step 0 = Dataverse
        setSqlError('');
        setSqlSuccess('');
        break;
      case 'publish':
        const shareUrl = `${window.location.origin}/?fileId=${fileId || 'demo'}&fileName=${fileName || 'Report'}`;
        setSuccess(
          <div className="publish-success">
            <p>Report published successfully!</p>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline', fontSize: '12px' }}>
              {shareUrl}
            </a>
          </div>
        );
        setTimeout(() => setSuccess(''), 10000);
        break;
      case 'transform_data':
        setReportDetailTab('transform');
        break;
      case 'new_visual':
        const newId = `graph-${Date.now()}`;
        const defaultX = schema[0]?.column_name || '';
        const defaultY = schema.find(s => s.data_type === 'numeric')?.column_name || '';
        setGraphs(prev => [{
          id: newId,
          graph_type: 'bar',
          x_axis: defaultX,
          y_axis: defaultY,
          options: { title: 'New Visualization', size: 'medium' }
        }, ...prev]);
        setActiveVisualId(newId);
        break;
      case 'import':
      case 'excel':
      case 'get_data':
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
        break;
      case 'text_box':
        const textId = `text-${Date.now()}`;
        setGraphs(prev => [{
          id: textId,
          graph_type: 'text',
          content: 'Double-click to edit text box',
          options: {
            title: '',
            size: 'custom',
            width: 300,
            height: 100,
            isText: true,
            noHeader: true
          }
        }, ...prev]);
        setActiveVisualId(textId);
        break;
      default:
        console.log('Ribbon action:', actionId);
    }
  };

  const handleDrop = (e, targetIndex, initialDragLayout) => {
    if (e && e.preventDefault) e.preventDefault();

    const sourceIndex = draggedItemIndex;
    if (sourceIndex === null || sourceIndex === targetIndex) {
      setDraggedItemIndex(null);
      setDragOverItemIndex(null);
      return;
    }

    const updatedGraphs = [...graphs];
    const sourceItem = { ...updatedGraphs[sourceIndex] };
    const targetItem = { ...updatedGraphs[targetIndex] };

    // Swap Visual Layout Properties if they exist
    // If target has coordinates, source takes them.
    // Target takes source's STARTING coordinates.
    if (sourceItem.options?.x !== undefined || targetItem.options?.x !== undefined) {
      const layoutProps = ['x', 'y', 'width', 'height', 'size'];
      sourceItem.options = { ...sourceItem.options };
      targetItem.options = { ...targetItem.options };

      // Give source the target's current position
      if (targetItem.options.x !== undefined) {
        layoutProps.forEach(p => {
          if (targetItem.options[p] !== undefined) sourceItem.options[p] = targetItem.options[p];
        });
      } else {
        // Target was 'auto', so source becomes 'auto' to take that slot
        layoutProps.forEach(p => delete sourceItem.options[p]);
      }

      // Give target the source's STARTING position
      if (initialDragLayout && initialDragLayout.x !== undefined) {
        layoutProps.forEach(p => {
          if (initialDragLayout[p] !== undefined) targetItem.options[p] = initialDragLayout[p];
        });
      } else {
        // Source was 'auto', so target becomes 'auto'
        layoutProps.forEach(p => delete targetItem.options[p]);
      }
    }

    // Array-based swap
    updatedGraphs[sourceIndex] = targetItem;
    updatedGraphs[targetIndex] = sourceItem;

    setGraphs(updatedGraphs);
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleUpdateChartConfig = (id, newConfig) => {
    setGraphs(prevGraphs =>
      prevGraphs.map(g => g.id === id ? { ...g, options: { ...(g.options || {}), ...newConfig } } : g)
    );
  };

  const handleDeleteChart = (id) => {
    setGraphs(prev => prev.filter(g => g.id !== id));
  };

  const handleDuplicateChart = (graph) => {
    const duplicatedGraph = {
      ...graph,
      id: `copy-${Date.now()}`
    };
    setGraphs(prev => [duplicatedGraph, ...prev]);
  };

  const handleToggleWide = (id) => {
    setGraphs(prevGraphs =>
      prevGraphs.map(g => g.id === id ? { ...g, options: { ...(g.options || {}), isWide: !(g.options?.isWide) } } : g)
    );
  };

  const handleSaveDashboardLayout = async () => {
    if (!fileId && !connectionId) return;
    try {
      // Persist the FULL current canvas state (all graphs + their options including x/y/width/height).
      // This must capture the latest edits, not initial state.
      const targetId = fileId || connectionId;
      const payload = Array.isArray(graphs) ? graphs.map(g => ({
        id: g.id, // critical: allows backend to update instead of creating duplicates
        graph_type: g.graph_type,
        x_axis: g.x_axis,
        y_axis: g.y_axis ?? null,
        aggregation: g.aggregation ?? 'sum',
        options: g.options ?? {}
      })) : [];

      // Save each graph (upsert) to the backend.
      await Promise.all(payload.map((graph) =>
        fetch(`/api/files/${targetId}/save-graph`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(graph)
        }).then((res) => {
          if (!res.ok) throw new Error(`Save failed (${res.status})`);
          return res.json();
        })
      ));

      setSuccess('Dashboard layout saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      console.error(e);
      alert('Failed to save layout');
    }
  };

  const handleRetryProcessing = async () => {
    if (!fileId) return;
    try {
      setProcessingStatus('processing');
      setIsInitialLoading(true);
      // Let the UI render quickly even while processing continues.
      setTimeout(() => setIsInitialLoading(false), 2000);

      const res = await fetch(`/api/files/${fileId}/retry-processing`, { method: 'POST' });
      if (!res.ok) throw new Error(`Retry failed (${res.status})`);
    } catch (e) {
      console.error(e);
      setProcessingStatus('failed');
    }
  };

  const renderReportContent = () => {
    if (isInitialLoading) {
      return (
        <div className="processing-state hydrator">
          <div className="loader"></div>
          <h2>Preparing Workspace...</h2>
          <p>Connecting to analytics engine and syncing data.</p>
        </div>
      );
    }

    if (processingStatus === 'uploading' || processingStatus === 'processing') {
      return (
        <div className="processing-state">
          <div className="loader"></div>
          <h2>Processing your data...</h2>
          <p>We are analyzing <strong title={fileName}>"{fileName}"</strong> to generate insights.</p>
        </div>
      );
    }

    return (
      <div className="bi-dashboard-root" ref={reportRef}>
        {processingStatus === 'failed' && (
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 20000,
            background: '#fff7ed',
            borderBottom: '1px solid #fed7aa',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}>
            <div style={{ color: '#9a3412', fontWeight: 600 }}>
              Analysis failed for this file. You can retry processing and keep working on the report.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={handleRetryProcessing}>Retry</button>
              <button className="btn-secondary" onClick={() => setIsFileUploaded(false)}>Go Back</button>
            </div>
          </div>
        )}

        {/* File Menu Overlay - slides in when File tab is clicked */}
        {ribbonTab === 'File' && (
          <BIFileMenu
            onClose={() => setRibbonTab('Home')}
            onAction={handleRibbonAction}
            fileName={fileName}
          />
        )}

        <BIRibbon
          activeTab={ribbonTab}
          setActiveTab={setRibbonTab}
          onAction={handleRibbonAction}
          fileName={fileName}
          activeMeasure={activeMeasure}
          setActiveMeasure={setActiveMeasure}
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

        <div className="bi-main-layout">
          {/* Left View Switcher */}
          <div className="bi-view-switcher">
            <div className={`bi-view-icon ${activeView === 'report' ? 'active' : ''}`} onClick={() => setActiveView('report')} title="Report View">
              <Layout size={20} />
            </div>
            <div className={`bi-view-icon ${activeView === 'data' ? 'active' : ''}`} onClick={() => setActiveView('data')} title="Data View">
              <Table size={20} />
            </div>
            <div className={`bi-view-icon ${activeView === 'model' ? 'active' : ''}`} onClick={() => setActiveView('model')} title="Model View">
              <Database size={20} />
            </div>
            <div className="bi-view-divider" style={{ width: '1px', height: '20px', background: '#e2e8f0', margin: '8px 0' }} />
            <div className="bi-view-icon bi-home-icon" onClick={handleGoHome} title="Return to Home">
              <Home size={20} />
            </div>
          </div>

          {/* Model View (full width, no panels) */}
          {activeView === 'model' && (
            <div className="bi-fullview-container">
              <BIModelView schema={schema} fileName={fileName} />
            </div>
          )}

          {/* Data View (full width) */}
          {activeView === 'data' && dataset && (
            <div className="bi-fullview-container bi-data-view-active">
              <DataPreviewPanel
                dataset={dataset}
                schema={schema}
                fileName={fileName}
                onClose={() => setActiveView('report')}
              />
            </div>
          )}
          {activeView === 'data' && !dataset && (
            <div className="bi-fullview-container bi-empty-view">
              <p>No dataset loaded yet. Upload a file to preview data.</p>
            </div>
          )}

          {/* Report View (3-panel layout) */}
          {activeView === 'report' && (
            <div style={{ display: 'flex', height: '100%', position: 'relative', width: '100%', overflow: 'hidden' }}>
              {/* Floating Ribbon Triggers for Collapsed States */}
              {isInsightsCollapsed && (
                <div
                  className="bi-ribbon-left"
                  onClick={() => insightsPanelRef.current?.expand()}
                  title="Expand Insights"
                >
                  <ChevronRight size={14} />
                  <Database size={14} />
                </div>
              )}

              {isRightPanesCollapsed && (
                <div
                  className="bi-ribbon-right"
                  onClick={() => rightPanesPanelRef.current?.expand()}
                  title="Expand Tools"
                >
                  <ChevronLeft size={14} />
                  <Layout size={14} />
                </div>
              )}

              <PanelGroup direction="horizontal">
                {/* Left Panel: Insights */}
                <Panel
                  ref={insightsPanelRef}
                  defaultSize={20}
                  minSize={0}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => setIsInsightsCollapsed(true)}
                  onExpand={() => setIsInsightsCollapsed(false)}
                >
                  <BIInsightsPanel
                    stats={stats}
                    fileName={fileName}
                    selection={selectedData}
                    isCollapsed={isInsightsCollapsed}
                    onToggleCollapse={() => {
                      const panel = insightsPanelRef.current;
                      if (panel) {
                        if (isInsightsCollapsed) panel.expand();
                        else panel.collapse();
                      }
                    }}
                  />
                </Panel>

                <PanelResizeHandle className="bi-resizer" />

                {/* Center Panel: Dashboard Canvas */}
                <Panel defaultSize={60}>
                  <div className="bi-center-column">
                    <BIDashboardCanvas
                      graphs={graphs}
                      stats={stats}
                      schema={schema}
                      fileId={fileId}
                      onDataClick={handleDataClick}
                      isExporting={isExporting}
                      activeVisualId={activeVisualId}
                      onSelectVisual={setActiveVisualId}
                      onUpdateVisual={(id, updates) => {
                        setGraphs(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
                      }}
                      onAddVisual={(type) => {
                        const newId = `graph-${Date.now()}`;
                        setGraphs(prev => [{
                          id: newId,
                          graph_type: type,
                          x_axis: schema[0]?.column_name || '',
                          y_axis: schema.find(s => s.data_type === 'numeric')?.column_name || '',
                          options: {
                            title: `New ${type.toUpperCase()} View`,
                            size: 'medium'
                          }
                        }, ...prev]);
                        setActiveVisualId(newId);
                      }}
                      onDragStart={handleDragStart}
                      onDragOverCard={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDropCard={handleDrop}
                      draggedItemIndex={draggedItemIndex}
                      dragOverItemIndex={dragOverItemIndex}
                      onResizeChart={(id, width, height) => {
                        setGraphs(prev => prev.map(g =>
                          g.id === id ? {
                            ...g,
                            options: {
                              ...(g.options || {}),
                              width,
                              height,
                              size: 'custom' // Custom size to bypass grid CSS defaults
                            }
                          } : g
                        ));
                      }}
                      onDeleteVisual={handleDeleteChart}
                    />

                    {/* Power BI-style Page Tab Bar */}
                    <div className="bi-page-tabs-bar">
                      <div className="bi-page-tabs-list">
                        {pages.map((page, idx) => (
                          <div
                            key={page.id}
                            className={`bi-page-tab ${activePageId === page.id ? 'active' : ''}`}
                            onClick={() => { setActivePageId(page.id); setActiveVisualId(null); }}
                            onDoubleClick={() => handleRenamePage(page.id)}
                            title={`${page.name}\u2014Double-click to rename`}
                          >
                            <span className="bi-page-tab-name">{page.name}</span>
                            {pages.length > 1 && (
                              <button
                                className="bi-page-tab-close"
                                onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                                title="Delete page"
                              >&#x2715;</button>
                            )}
                          </div>
                        ))}
                        <button className="bi-page-add-btn" onClick={handleAddPage} title="Add new page">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                      </div>
                      <div className="bi-status-right">
                        <span className="bi-status-item">{pages.length} page{pages.length > 1 ? 's' : ''}</span>
                        <span className="bi-status-item">Refreshed: {new Date().toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                </Panel>

                <PanelResizeHandle className="bi-resizer" />

                {/* Right Panel: Advanced BI Panes (Filters, Visualizations, Fields) */}
                <Panel
                  ref={rightPanesPanelRef}
                  defaultSize={25}
                  minSize={0}
                  collapsible={true}
                  collapsedSize={0}
                  onCollapse={() => setIsRightPanesCollapsed(true)}
                  onExpand={() => setIsRightPanesCollapsed(false)}
                >
                  <BIRightPanes
                    schema={schema}
                    measures={measures}
                    fileName={fileName}
                    selectedVisual={graphs.find(g => g.id === activeVisualId)}
                    isCollapsed={isRightPanesCollapsed}
                    onToggleCollapse={() => {
                      const panel = rightPanesPanelRef.current;
                      if (panel) {
                        if (isRightPanesCollapsed) panel.expand();
                        else panel.collapse();
                      }
                    }}
                    onUpdateVisual={(id, updates) => {
                      setGraphs(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
                    }}
                    onAddVisual={(type) => {
                      const newId = `graph-${Date.now()}`;
                      setGraphs(prev => [...prev, {
                        id: newId,
                        graph_type: type,
                        x_axis: schema[0]?.column_name || '',
                        y_axis: schema.find(s => s.data_type === 'numeric')?.column_name || '',
                        options: { title: `New ${type} Chart` }
                      }]);
                      setActiveVisualId(newId);
                    }}
                  />
                </Panel>
              </PanelGroup>
            </div>
          )}
        </div>

        {/* Data Preview Modal Overlay */}
        {
          renderDataPreview && dataset && (
            <div className="data-preview-modal-wrapper" style={{
              position: 'fixed',
              top: '10%',
              left: '10%',
              right: '10%',
              bottom: '10%',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e5e7eb',
              overflow: 'hidden',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <h4 style={{ margin: 0, fontWeight: 600, color: '#111' }}>Dataset Preview</h4>
                <button onClick={() => setRenderDataPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
                <DataPreviewPanel dataset={dataset} />
              </div>
            </div>
          )
        }

        {/* Transformation Modal Overlay */}
        {
          reportDetailTab === 'transform' && dataset && (
            <div className="transform-data-modal-wrapper" style={{
              position: 'fixed',
              top: '15%',
              right: '5%',
              width: '400px',
              maxHeight: '70%',
              backgroundColor: 'white',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              zIndex: 1005,
              display: 'flex',
              flexDirection: 'column',
              border: '1px solid #e5e7eb',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <h4 style={{ margin: 0, fontWeight: 600, color: '#111' }}>Transformations</h4>
                <button onClick={() => setReportDetailTab('visualizations')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>✕</button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
                <DataTransformationPanel
                  dataset={dataset}
                  transformations={transformations}
                  onApplyTransform={handleApplyTransform}
                  onUndoTransform={handleUndoTransform}
                  onResetTransforms={handleResetTransforms}
                  onRemoveTransform={handleRemoveTransform}
                />
              </div>
            </div>
          )
        }
      </div >
    );
  }

  return (
    <main className={`landing-page-minimal ${isFileUploaded ? 'report-active' : ''} ${initialFileId ? 'viz-no-fade' : ''}`}>
      <div className="landing-page-minimal-stars"></div>

      {/* Success Notification */}
      {success && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: '#10b981',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxWidth: '400px',
          animation: 'slideIn 0.3s ease-out'
        }}>
          {success}
        </div>
      )}

      {!isFileUploaded && (
        <>
          {/* Top Center-Left - Combination Bar & Line */}
          {/*
          <div className="viz-graphic pastel-blue" style={{ top: '15%', left: '30%', opacity: 0.4 }}>
            <svg width="90" height="70" viewBox="0 0 40 30">
              <rect x="5" y="15" width="4" height="10" fill="currentColor" opacity="0.5" />
              <rect x="12" y="10" width="4" height="15" fill="currentColor" opacity="0.5" />
              <rect x="19" y="18" width="4" height="7" fill="currentColor" opacity="0.5" />
              <rect x="26" y="5" width="4" height="20" fill="currentColor" opacity="0.5" />
              <path d="M 5 15 L 12 10 L 19 18 L 26 5 L 35 12" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          */}

          {/* Lower Center-Left - Heatmap Grid */}
          {/*
          <div className="viz-graphic pastel-pink" style={{ bottom: '15%', left: '30%', opacity: 0.3 }}>
            <svg width="60" height="60" viewBox="0 0 30 30">
              <rect x="0" y="0" width="8" height="8" fill="currentColor" opacity="0.8" />
              <rect x="10" y="0" width="8" height="8" fill="currentColor" opacity="0.4" />
              <rect x="20" y="0" width="8" height="8" fill="currentColor" opacity="0.6" />
              <rect x="0" y="10" width="8" height="8" fill="currentColor" opacity="0.2" />
              <rect x="10" y="10" width="8" height="8" fill="currentColor" opacity="1" />
              <rect x="20" y="10" width="8" height="8" fill="currentColor" opacity="0.5" />
              <rect x="0" y="20" width="8" height="8" fill="currentColor" opacity="0.7" />
              <rect x="10" y="20" width="8" height="8" fill="currentColor" opacity="0.3" />
              <rect x="20" y="20" width="8" height="8" fill="currentColor" opacity="0.9" />
            </svg>
          </div>
          */}

          {/* Bottom Right - Funnel Chart */}
          {/*
          <div className="viz-graphic pastel-lavender" style={{ bottom: '5%', right: '20%', opacity: 0.5 }}>
            <svg width="70" height="80" viewBox="0 0 40 40">
              <path d="M 5 5 L 35 5 L 30 15 L 10 15 Z" fill="currentColor" opacity="0.9" />
              <path d="M 10 17 L 30 17 L 26 27 L 14 27 Z" fill="currentColor" opacity="0.6" />
              <path d="M 14 29 L 26 29 L 23 37 L 17 37 Z" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          */}

          {/* Top Left - Bar Chart */}
          {/*
          <div className="viz-graphic pastel-purple" style={{ top: '10%', left: '5%' }}>
            <svg width="70" height="70" viewBox="0 0 40 40" fill="none">
              <rect x="5" y="22" width="6" height="13" rx="1" fill="currentColor" />
              <rect x="15" y="12" width="6" height="23" rx="1" fill="currentColor" />
              <rect x="25" y="17" width="6" height="18" rx="1" fill="currentColor" />
            </svg>
          </div>
          */}

          {/* Top Center-Right - Radar/Spider Chart */}
          {/*
          <div className="viz-graphic pastel-yellow" style={{ top: '8%', left: '45%', opacity: 0.4 }}>
            <svg width="80" height="80" viewBox="0 0 40 40">
              <path d="M 20 5 L 35 15 L 30 35 L 10 35 L 5 15 Z" stroke="currentColor" strokeWidth="1" fill="none" />
              <path d="M 20 12 L 28 18 L 25 30 L 15 30 L 12 18 Z" fill="currentColor" opacity="0.3" />
              <line x1="20" y1="5" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" />
              <line x1="35" y1="15" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" />
              <line x1="30" y1="35" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" />
              <line x1="10" y1="35" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" />
              <line x1="5" y1="15" x2="20" y2="20" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </div>
          */}

          {/* Top Right - Pie Chart */}
          {/*
          <div className="viz-graphic pastel-pink" style={{ top: '15%', right: '10%' }}>
            <svg width="80" height="80" viewBox="0 0 40 40">
              <path d="M 20 20 L 20 5 A 15 15 0 0 1 35 20 Z" fill="currentColor" opacity="0.8" />
              <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </div>
          */}

          {/* Middle Left - Line Chart */}
          {/*
          <div className="viz-graphic pastel-blue" style={{ top: '45%', left: '8%' }}>
            <svg width="75" height="75" viewBox="0 0 40 40">
              <path d="M 5 30 L 12 15 L 22 25 L 35 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          */}

          {/* Middle Right - Histogram */}
          {/*
          <div className="viz-graphic pastel-lavender" style={{ top: '60%', right: '15%' }}>
            <svg width="80" height="60" viewBox="0 0 40 30">
              <rect x="2" y="20" width="4" height="8" rx="0.5" fill="currentColor" opacity="0.4" />
              <rect x="8" y="10" width="4" height="18" rx="0.5" fill="currentColor" opacity="0.6" />
              <rect x="14" y="5" width="4" height="23" rx="0.5" fill="currentColor" />
              <rect x="20" y="8" width="4" height="20" rx="0.5" fill="currentColor" opacity="0.8" />
              <rect x="26" y="15" width="4" height="13" rx="0.5" fill="currentColor" opacity="0.5" />
              <rect x="32" y="22" width="4" height="6" rx="0.5" fill="currentColor" opacity="0.3" />
            </svg>
          </div>
          */}

          {/* Middle Left - Bubble Chart */}
          {/*
          <div className="viz-graphic pastel-blue" style={{ top: '35%', left: '15%', opacity: 0.5 }}>
            <svg width="60" height="60" viewBox="0 0 40 40">
              <circle cx="15" cy="15" r="8" fill="currentColor" opacity="0.6" />
              <circle cx="25" cy="25" r="5" fill="currentColor" opacity="0.4" />
              <circle cx="30" cy="10" r="4" fill="currentColor" opacity="0.5" />
            </svg>
          </div>
          */}

          {/* Middle Right-ish - Area Wave */}
          {/*
          <div className="viz-graphic pastel-lavender" style={{ top: '25%', right: '25%', opacity: 0.3 }}>
            <svg width="100" height="40" viewBox="0 0 100 40">
              <path d="M0,20 Q25,5 50,20 T100,20 L100,40 L0,40 Z" fill="currentColor" />
            </svg>
          </div>
          */}

          {/* Bottom Right - Donut Chart */}
          {/*
          <div className="viz-graphic pastel-purple" style={{ bottom: '15%', right: '5%' }}>
            <svg width="85" height="85" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="6" fill="none" opacity="0.2" />
              <path d="M 20 5 A 15 15 0 0 1 35 20" stroke="currentColor" strokeWidth="6" fill="none" />
            </svg>
          </div>
          */}

          {/* Bottom Center - Scatter Plot with Trendline */}
          {/*
          <div className="viz-graphic pastel-blue" style={{ bottom: '10%', left: '53%' }}>
            <svg width="90" height="70" viewBox="0 0 40 30">
              <circle cx="5" cy="25" r="1.5" fill="currentColor" />
              <circle cx="12" cy="20" r="1.5" fill="currentColor" />
              <circle cx="18" cy="22" r="1.5" fill="currentColor" />
              <circle cx="25" cy="12" r="1.5" fill="currentColor" />
              <circle cx="32" cy="8" r="1.5" fill="currentColor" />
              <line x1="2" y1="28" x2="38" y2="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
            </svg>
          </div>
          */}

          {/* Bottom Left-ish - Horizontal Bar Chart */}
          {/*
          <div className="viz-graphic pastel-yellow" style={{ bottom: '25%', left: '5%' }}>
            <svg width="70" height="50" viewBox="0 0 40 30">
              <rect x="5" y="5" width="25" height="4" rx="1" fill="currentColor" />
              <rect x="5" y="13" width="32" height="4" rx="1" fill="currentColor" opacity="0.7" />
              <rect x="5" y="21" width="18" height="4" rx="1" fill="currentColor" opacity="0.4" />
            </svg>
          </div>
          */}

          {/* Extra Scatter Grid */}
          {/*
          <div className="viz-graphic pastel-pink" style={{ top: '40%', right: '5%', opacity: 0.3 }}>
            <svg width="100" height="100" viewBox="0 0 40 40">
              <circle cx="5" cy="5" r="1.5" fill="currentColor" />
              <circle cx="15" cy="10" r="1.5" fill="currentColor" />
              <circle cx="25" cy="5" r="1.5" fill="currentColor" />
              <circle cx="35" cy="15" r="1.5" fill="currentColor" />
              <circle cx="10" cy="25" r="1.5" fill="currentColor" />
              <circle cx="20" cy="35" r="1.5" fill="currentColor" />
              <circle cx="30" cy="25" r="1.5" fill="currentColor" />
            </svg>
          </div>
          */}
        </>
      )}

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".csv,.xlsx,.xls,.json,.txt"
      />


      <div className="main-content-minimal">
        {isFileUploaded ? (
          renderReportContent()
        ) : (
          <div className={`center-section ${sqlMode === 'active' ? 'sql-active' : ''}`}>
            <h1 className="main-heading">What do you want to <span className="gradient-text">Visualize?</span></h1>
            <div className="sub-text">
              {['Excel', 'CSV', 'JSON', 'SQL'].map((format, index) => (
                <span
                  key={format}
                  className={`format-container ${activeFormat === format ? 'active' : ''}`}
                  onClick={() => {
                    if (format === 'SQL' && !userId) {
                      setPendingFormat('SQL');
                      setShouldAuthNavigate(false);
                      setIsSignInModalOpen(true);
                      return;
                    }
                    setActiveFormat(format);
                    if (format === 'SQL') {
                      setSqlMode('active');
                      setFileId(null);
                      setIsFileUploaded(false);
                    } else {
                      setSqlMode('idle');
                    }
                  }}
                >
                  <span className="format-item">{format}</span>
                  {index < 3 && <span className="format-divider">•</span>}
                </span>
              ))}
            </div>

            {sqlMode === 'active' ? (
              <SQLForm
                userId={userId}
                onUploadSuccess={(id, name) => {
                  setFileId(id);
                  setFileName(name);
                  setProcessingStatus('completed');
                  setSqlMode('querying');
                  // Don't set isFileUploaded yet, let user query first
                }}
                onConnectionSuccess={(id, name) => {
                  setConnectionId(id);
                  setFileName(name);
                  setSqlMode('querying');
                }}
              />
            ) : sqlMode === 'querying' ? (
              <div className="sql-query-view">
                <div className="query-header">
                  <h3>Query Database: <span className="gradient-text" title={fileName}>"{fileName}"</span></h3>
                  <button className="btn-secondary-small" onClick={() => setSqlMode('active')}>Switch Connection</button>
                </div>
                <form className="sql-direct-query" onSubmit={async (e) => {
                  e.preventDefault();
                  const q = e.target.query.value;
                  if (!q) return;
                  setIsQuerying(true);
                  try {
                    const formData = new FormData();
                    formData.append('query', q);
                    if (connectionId) formData.append('connection_id', connectionId);

                    const response = await fetch('/api/sql/query', {
                      method: 'POST',
                      body: formData
                    });

                    if (!response.ok) {
                      const errData = await response.json();
                      throw new Error(errData.detail || 'Query execution failed');
                    }
                    const data = await response.json();

                    // Track this query for subsequent aggregations
                    setLastSqlQuery(q);

                    // Transform SQL results into our graph format for visualization
                    const mockGraph = {
                      id: `sql-${Date.now()}`,
                      graph_type: 'bar',
                      x_axis: data.suggested_axes.x,
                      y_axis: data.suggested_axes.y,
                      cached_data: data.data
                    };

                    setSqlResults(data);
                    setGraphs([mockGraph]);

                    // Update schema for dropdowns
                    if (data && Array.isArray(data.columns)) {
                      const newSchema = data.columns.map(c => ({
                        column_name: c.name,
                        data_type: c.type
                      }));
                      setSchema(newSchema);
                    }

                    // Update current chart selection
                    if (data && data.suggested_axes) {
                      setCustomChart(prev => ({
                        ...prev,
                        x_axis: data.suggested_axes.x,
                        y_axis: data.suggested_axes.y
                      }));
                    }

                    setIsFileUploaded(true);
                    setProcessingStatus('completed');
                  } catch (err) {
                    alert(err.message);
                  } finally {
                    setIsQuerying(false);
                  }
                }}>
                  <textarea
                    name="query"
                    placeholder="SELECT * FROM table_name WHERE ..."
                    className="sql-textarea"
                    rows="5"
                  ></textarea>
                  <button type="submit" className="btn-primary" disabled={isQuerying}>
                    {isQuerying ? 'Running Query...' : 'Execute & Visualize'}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <form className="query-form" onSubmit={handleSubmit}>
                  <div className="input-wrapper">
                    <button type="button" className="btn-plus" onClick={triggerFileInput}>+</button>
                    <div className="input-field-container">
                      {fileName && (
                        <div className="file-chip">
                          <span className="file-chip-name" title={fileName}>{fileName}</span>
                          <button type="button" className="btn-remove-file" onClick={removeFile}>×</button>
                        </div>
                      )}
                      <input
                        type="text"
                        className="query-input"
                        placeholder={fileName ? "Ask a question about this file..." : "Upload your file..."}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-submit" disabled={!query.trim() && !fileName}>Visualize</button>
                  </div>
                </form>

                <div className="quick-actions">
                  <button
                    className="action-link"
                    onClick={() => {
                      setShouldAuthNavigate(true);
                      setIsSignInModalOpen(true);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    Sign In
                  </button>
                  <span className="divider">•</span>
                  <button
                    className="action-link"
                    onClick={() => {
                      setShouldAuthNavigate(true);
                      setIsCreateAccountModalOpen(true);
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
                  >
                    Create Account
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {isSqlModalOpen && (
        <div className="sql-modal-overlay" onClick={() => { setIsSqlModalOpen(false); setIsDataverseModalOpen(false); }}>
          
          {isDataverseModalOpen && (
            <div className="sql-modal" onClick={e => e.stopPropagation()}>
              <div className="sql-modal-header">
                <h2 className="sql-modal-title">Connect to Microsoft Dataverse</h2>
                <button
                  type="button"
                  className="sql-modal-close"
                  onClick={() => {
                    setIsDataverseModalOpen(false);
                    setIsSqlModalOpen(false);
                    setSqlError('');
                    setSqlSuccess('');
                  }}
                  aria-label="Close dialog"
                >
                  ×
                </button>
              </div>
              <form className="sql-modal-body" onSubmit={handleDataverseConnect}>
                <p className="upload-sub-text" style={{marginBottom: "16px"}}>Requires Server-to-Server (S2S) Application Credentials</p>
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
                  <label className="sql-label">Environment URL</label>
                  <input
                    className="sql-input"
                    value={dataverseForm.environmentUrl}
                    onChange={e => setDataverseForm(f => ({ ...f, environmentUrl: e.target.value }))}
                    placeholder="https://org.crm.dynamics.com"
                    required
                  />
                </div>
                <div className="sql-form-group">
                  <label className="sql-label">Tenant ID (Directory ID)</label>
                  <input
                    className="sql-input"
                    value={dataverseForm.tenantId}
                    onChange={e => setDataverseForm(f => ({ ...f, tenantId: e.target.value }))}
                    placeholder="e.g. 1a2b3c4d-..."
                    required
                  />
                </div>
                <div className="sql-form-row">
                  <div className="sql-form-group">
                    <label className="sql-label">Application Client ID</label>
                    <input
                      className="sql-input"
                      value={dataverseForm.clientId}
                      onChange={e => setDataverseForm(f => ({ ...f, clientId: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="sql-form-group">
                    <label className="sql-label">Client Secret</label>
                    <input
                      className="sql-input"
                      type="password"
                      value={dataverseForm.clientSecret}
                      onChange={e => setDataverseForm(f => ({ ...f, clientSecret: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="sql-form-group" style={{marginTop: '8px'}}>
                  <label className="sql-label">Dataverse Table Definition Name</label>
                  <input
                    className="sql-input"
                    value={dataverseForm.tableName}
                    onChange={e => setDataverseForm(f => ({ ...f, tableName: e.target.value }))}
                    placeholder="e.g. accounts, contacts, crfc9_customtables"
                    required
                  />
                </div>
                <div className="sql-modal-footer" style={{ margin: 0, paddingBottom: 0, marginTop: '20px' }}>
                  <button
                    type="button"
                    className="sql-btn sql-btn-secondary"
                    onClick={() => { setIsDataverseModalOpen(false); setIsSqlModalOpen(false); }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sql-btn sql-btn-primary"
                    disabled={isDataverseSubmitting}
                  >
                    {isDataverseSubmitting ? 'Authenticating…' : 'Load Data'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!isDataverseModalOpen && sqlModalStep === 1 && (
            <div className="sql-modal" onClick={e => e.stopPropagation()}>
              <div className="sql-modal-header">
                <h2 className="sql-modal-title">Connect to SQL Server</h2>
                <button
                  type="button"
                  className="sql-modal-close"
                  onClick={() => {
                    setIsSqlModalOpen(false)
                    setSqlError('')
                    setSqlSuccess('')
                  }}
                  aria-label="Close dialog"
                >
                  ×
                </button>
              </div>
              <form className="sql-modal-body" onSubmit={handleSqlConnectFromModal}>
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
                onClick={() => {
                  setIsSqlModalOpen(false)
                  setSqlError('')
                  setSqlSuccess('')
                }}
                aria-label="Close dialog"
                style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10 }}
              >
                ×
              </button>
              <div className="sql-step2-layout">
                <div className="sql-step2-main">
                  <div className="sql-form-tabs">
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
                      <form className="sql-step2-form" onSubmit={handleSqlConnectFromModal} style={{ display: 'flex', flexDirection: 'column', height: '100%', textAlign: 'left' }}>
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
                          className={`connection-item ${connectionId === conn.id ? 'selected' : ''}`}
                          onClick={() => {
                            setConnectionId(conn.id);
                            setSelectedConnectionName(conn.connection_name);
                            setSqlModalStep(3); // Auto advance to next step for demo flow as requested
                          }}
                        >
                          <div className="connection-radio">
                            <div className="radio-inner"></div>
                          </div>
                          <div className="connection-info">
                            <div className="connection-name" title={conn.connection_name}>
                              {conn.connection_name}
                            </div>
                            <div className="connection-details">
                              {conn.host}:{conn.port}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="sql-btn sql-btn-primary"
                            style={{ padding: '4px 12px', fontSize: '12px', marginLeft: 'auto', zIndex: 2 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnectionId(conn.id);
                              setSelectedConnectionName(conn.connection_name);
                              setSqlModalStep(3); // Auto advance to next step
                            }}
                          >Connect</button>
                        </div>
                      ))
                    ) : (
                      <p style={{ padding: '0 24px', color: '#9ca3af', fontSize: '13px' }}>No saved connections.</p>
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
                <div>
                  <h2 className="sql-modal-title" style={{ fontSize: '16px' }}>Query Database</h2>
                  <p className="sql-modal-subtitle">Connection: {selectedConnectionName}</p>
                </div>
                <button
                  className="sql-btn sql-btn-secondary"
                  onClick={() => setSqlModalStep(2)}
                  style={{ padding: '6px 14px', fontSize: '13px' }}
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
                  onChange={e => setSqlQuery(e.target.value)}
                  disabled={isSqlSubmitting}
                ></textarea>
              </div>

              <div className="sql-modal-footer sql-step3-footer">
                <button
                  type="button"
                  className="sql-btn sql-btn-secondary"
                  onClick={() => setIsSqlModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sql-btn sql-btn-primary"
                  onClick={handleExecuteSqlFromModal}
                  disabled={isSqlSubmitting || !sqlQuery.trim()}
                >
                  {isSqlSubmitting ? 'Processing...' : 'Execute & Visualize'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => {
          setIsSignInModalOpen(false);
          setAuthMessage(null); // Clear message on close
        }}
        onLogin={onLogin}
        shouldNavigate={shouldAuthNavigate}
        message={authMessage}
        onSwitchToSignUp={() => {
          setIsSignInModalOpen(false)
          setIsCreateAccountModalOpen(true)
        }}
      />

      <CreateAccountModal
        isOpen={isCreateAccountModalOpen}
        onClose={() => {
          setIsCreateAccountModalOpen(false);
          setAuthMessage(null); // Clear message on close
        }}
        onLogin={onLogin}
        shouldNavigate={shouldAuthNavigate}
        message={authMessage}
        onSwitchToSignIn={() => {
          setIsCreateAccountModalOpen(false)
          setIsSignInModalOpen(true)
        }}
      />

      <AddFileModal
        isOpen={isAddFileModalOpen}
        onClose={() => setIsAddFileModalOpen(false)}
        onUpload={triggerFileInput}
        onBrowse={fetchUserFiles}
        onCreateEmpty={() => {
          setIsFileUploaded(true);
          setProcessingStatus('completed');
          setPages([{ id: 'page-1', name: 'Page 1', graphs: [] }]);
          setActivePageId('page-1');
          setActiveVisualId(null);
          setFileName('Untitled Report');
          setFileId(null);
        }}
      />

      {/* --- INLINE MINIMAL MODALS FOR SIDEBAR ACTIONS --- */}

      {/* File Open Modal */}
      {isOpenModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Open File</h3>
            {isFetchingFiles ? (
              <p>Loading your files...</p>
            ) : userFiles.length === 0 ? (
              <p>No recently uploaded files found.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
                {userFiles.map(f => (
                  <li key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpenModalOpen(false);
                        addToRecent(f.id, f.fileName);
                        navigate(`/?fileId=${f.id}&fileName=${encodeURIComponent(f.fileName)}`);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        color: '#2563eb',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      {f.fileName}
                    </button>
                    <div style={{ fontSize: '12px', color: '#666' }}>{f.uploadDate} • {f.recordCount} rows</div>
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => setIsOpenModalOpen(false)} style={{ marginTop: '16px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', background: '#f9fafb', cursor: 'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* Save As Modal */}
      {isSaveAsModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '350px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Save As</h3>
            <input
              type="text"
              placeholder="New file name"
              value={saveAsName}
              onChange={e => setSaveAsName(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsSaveAsModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={async () => {
                  const name = (saveAsName || '').trim();
                  if (!name) return;

                  if (!fileId) {
                    alert('Save As is only supported for uploaded files right now.');
                    return;
                  }

                  try {
                    const res = await fetch(`/api/files/${fileId}/save-as`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ fileName: name })
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err?.detail || 'Save As failed');
                    }

                    const data = await res.json();
                    const newFileId = data?.file_id;
                    const newFileName = data?.fileName || name;
                    if (!newFileId) throw new Error('Save As did not return a file id');

                    addToRecent(newFileId, newFileName);
                    setSuccess(`File saved as "${newFileName}" successfully!`);
                    setTimeout(() => setSuccess(''), 3000);
                    setIsSaveAsModalOpen(false);
                    setSaveAsName('');
                    navigate(`/?fileId=${newFileId}&fileName=${encodeURIComponent(newFileName)}`);
                  } catch (e) {
                    console.error(e);
                    alert(e.message || 'Save As failed');
                  }
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {isShareModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '400px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Share "{fileName}"</h3>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Invite people</p>
            <input
              type="email"
              placeholder="Enter email addresses"
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
            />
            <button
              onClick={() => {
                const link = `${window.location.origin}/?fileId=${fileId || 'demo'}&fileName=${fileName}`;
                navigator.clipboard.writeText(link);
                setSuccess('Share link copied to clipboard!');
                setTimeout(() => setSuccess(''), 3000);
              }}
              style={{ width: '100%', padding: '8px', marginBottom: '16px', border: '1px solid #2563eb', color: '#2563eb', borderRadius: '4px', background: '#eff6ff', cursor: 'pointer', textAlign: 'center' }}
            >
              Copy Share Link
            </button>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsShareModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => {
                  if (!shareEmail) return;
                  setSuccess(`Invitation sent to ${shareEmail}`);
                  setTimeout(() => setSuccess(''), 3000);
                  setIsShareModalOpen(false);
                  setShareEmail('');
                }}
                style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#2563eb', color: '#fff', cursor: 'pointer' }}
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

    </main >
  )
}

export default LandingPage
