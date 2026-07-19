'use client';

import { useState, useEffect, useRef } from 'react';
import {
  startSession,
  uploadRequirements,
  uploadPlatform,
  uploadRegulatory,
  classify,
  exportExcel,
} from '@/lib/api';
import { SOURCE_LABEL_MAP } from '@/lib/constants';

function flattenRows(rows: any[]): any[] {
  const flatRows: any[] = [];
  if (!rows) return flatRows;
  rows.forEach((r: any) => {
    if (r.classification && typeof r.classification === 'object' && Object.keys(r.classification).length > 0) {
      Object.entries(r.classification).forEach(([category, details]: [string, any]) => {
        flatRows.push({
          category,
          text: r.text || '',
          source_doc: r.source_doc || '',
          line_number: r.line_number || 0,
          matched_rules: details.matched || [],
          score: details.score || 0,
        });
      });
    } else if (r.category) {
      flatRows.push({
        category: r.category,
        text: r.text || r.statement || '',
        source_doc: r.source_doc || '',
        line_number: r.line_number || 0,
        matched_rules: r.matched_rules || [],
        score: r.score || 0,
      });
    }
  });
  return flatRows;
}

export default function Home() {
  // Session states
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [connError, setConnError] = useState<string | null>(null);

  // Requirements file states
  const [requirementsFile, setRequirementsFile] = useState<File | null>(null);
  const [requirementsStatus, setRequirementsStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [requirementsPreview, setRequirementsPreview] = useState<string>('');
  const [isReqDragOver, setIsReqDragOver] = useState<boolean>(false);

  // Platform/Existing Product states
  const [platformInputType, setPlatformInputType] = useState<'text' | 'file'>('text');
  const [platformText, setPlatformText] = useState<string>('');
  const [platformFile, setPlatformFile] = useState<File | null>(null);
  const [platformStatus, setPlatformStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [platformPreview, setPlatformPreview] = useState<string>('');
  const platformLastUploadedText = useRef<string>('');
  const platformDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Regulatory Standard states
  const [regulatoryInputType, setRegulatoryInputType] = useState<'text' | 'file'>('text');
  const [regulatoryText, setRegulatoryText] = useState<string>('');
  const [regulatoryFile, setRegulatoryFile] = useState<File | null>(null);
  const [regulatoryStatus, setRegulatoryStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [regulatoryPreview, setRegulatoryPreview] = useState<string>('');
  const regulatoryLastUploadedText = useRef<string>('');
  const regulatoryDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Rules text state
  const [rulesText, setRulesText] = useState<string>('');

  // Classification button states
  const [isClassifying, setIsClassifying] = useState<boolean>(false);
  const [classifyResultSummary, setClassifyResultSummary] = useState<{ rowsCount: number; totalStatements: number } | null>(null);

  // Classification result states (Phase 8)
  const [classifiedRows, setClassifiedRows] = useState<any[]>([]);
  const [totalStatements, setTotalStatements] = useState<number>(0);
  const [hasClassified, setHasClassified] = useState<boolean>(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('Functionality');

  // Download states
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Errors state
  const [uploadErrors, setUploadErrors] = useState<{
    requirements?: string;
    platform?: string;
    regulatory?: string;
    classify?: string;
  }>({});

  // Global indicator for any ongoing uploads
  const isUploading =
    requirementsStatus === 'uploading' ||
    platformStatus === 'uploading' ||
    regulatoryStatus === 'uploading';

  // Initialize Session
  const initSession = async () => {
    try {
      setIsInitializing(true);
      setConnError(null);
      const res = await startSession();
      setSessionId(res.session_id);
      console.log('Session initialized:', res.session_id);
    } catch (err: any) {
      console.error('Session initialization failed:', err);
      setConnError('Cannot connect to backend — is the server running?');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (platformDebounceRef.current) clearTimeout(platformDebounceRef.current);
      if (regulatoryDebounceRef.current) clearTimeout(regulatoryDebounceRef.current);
    };
  }, []);

  // File size & type validation
  const validateFile = (file: File, fieldName: 'requirements' | 'platform' | 'regulatory'): boolean => {
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    const fileName = file.name.toLowerCase();

    const hasValidExt = allowedExtensions.some((ext) => fileName.endsWith(ext));
    if (!hasValidExt) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: 'Unsupported file type. Please upload PDF, DOC, DOCX, or TXT.',
      }));
      return false;
    }

    if (file.size > maxSizeBytes) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldName]: 'File size exceeds the 10MB limit.',
      }));
      return false;
    }

    setUploadErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    return true;
  };

  // Requirements Upload Handler
  const handleRequirementsUpload = async (file: File) => {
    if (!sessionId) return;
    if (!validateFile(file, 'requirements')) {
      setRequirementsStatus('error');
      return;
    }

    setRequirementsFile(file);
    setRequirementsStatus('uploading');
    setUploadErrors((prev) => ({ ...prev, requirements: undefined }));

    try {
      const res = await uploadRequirements(sessionId, file);
      setRequirementsStatus('success');
      setRequirementsPreview(res.preview);
      console.log('Requirements uploaded:', res);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to upload requirements';
      setRequirementsStatus('error');
      setUploadErrors((prev) => ({ ...prev, requirements: msg }));
      setRequirementsFile(null);
    }
  };

  const onReqDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsReqDragOver(true);
  };

  const onReqDragLeave = () => {
    setIsReqDragOver(false);
  };

  const onReqDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsReqDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleRequirementsUpload(e.dataTransfer.files[0]);
    }
  };

  // Platform Text/URL Upload Handler
  const triggerPlatformUploadText = async (text: string) => {
    if (!sessionId) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setPlatformStatus('idle');
      platformLastUploadedText.current = '';
      return;
    }
    if (trimmed === platformLastUploadedText.current) return;

    setPlatformStatus('uploading');
    setUploadErrors((prev) => ({ ...prev, platform: undefined }));

    try {
      const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
      const type = isUrl ? 'url' : 'text';
      const res = await uploadPlatform(sessionId, type, trimmed);
      platformLastUploadedText.current = trimmed;
      setPlatformStatus('success');
      setPlatformPreview(res.preview);
      console.log('Platform text/url uploaded:', res);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to upload platform content';
      setPlatformStatus('error');
      setUploadErrors((prev) => ({ ...prev, platform: msg }));
    }
  };

  const handlePlatformTextChange = (val: string) => {
    setPlatformText(val);
    if (platformDebounceRef.current) clearTimeout(platformDebounceRef.current);
    platformDebounceRef.current = setTimeout(() => {
      triggerPlatformUploadText(val);
    }, 1000);
  };

  const handlePlatformTextBlur = () => {
    if (platformDebounceRef.current) clearTimeout(platformDebounceRef.current);
    triggerPlatformUploadText(platformText);
  };

  // Platform File Upload Handler
  const handlePlatformFileUpload = async (file: File) => {
    if (!sessionId) return;
    if (!validateFile(file, 'platform')) {
      setPlatformStatus('error');
      return;
    }

    setPlatformFile(file);
    setPlatformStatus('uploading');
    setUploadErrors((prev) => ({ ...prev, platform: undefined }));

    try {
      const res = await uploadPlatform(sessionId, 'file', file);
      setPlatformStatus('success');
      setPlatformPreview(res.preview);
      console.log('Platform file uploaded:', res);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to upload platform file';
      setPlatformStatus('error');
      setUploadErrors((prev) => ({ ...prev, platform: msg }));
      setPlatformFile(null);
    }
  };

  // Regulatory Text/URL Upload Handler
  const triggerRegulatoryUploadText = async (text: string) => {
    if (!sessionId) return;
    const trimmed = text.trim();
    if (!trimmed) {
      setRegulatoryStatus('idle');
      regulatoryLastUploadedText.current = '';
      return;
    }
    if (trimmed === regulatoryLastUploadedText.current) return;

    setRegulatoryStatus('uploading');
    setUploadErrors((prev) => ({ ...prev, regulatory: undefined }));

    try {
      const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://');
      const type = isUrl ? 'url' : 'text';
      const res = await uploadRegulatory(sessionId, type, trimmed);
      regulatoryLastUploadedText.current = trimmed;
      setRegulatoryStatus('success');
      setRegulatoryPreview(res.preview);
      console.log('Regulatory text/url uploaded:', res);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to upload regulatory content';
      setRegulatoryStatus('error');
      setUploadErrors((prev) => ({ ...prev, regulatory: msg }));
    }
  };

  const handleRegulatoryTextChange = (val: string) => {
    setRegulatoryText(val);
    if (regulatoryDebounceRef.current) clearTimeout(regulatoryDebounceRef.current);
    regulatoryDebounceRef.current = setTimeout(() => {
      triggerRegulatoryUploadText(val);
    }, 1000);
  };

  const handleRegulatoryTextBlur = () => {
    if (regulatoryDebounceRef.current) clearTimeout(regulatoryDebounceRef.current);
    triggerRegulatoryUploadText(regulatoryText);
  };

  // Regulatory File Upload Handler
  const handleRegulatoryFileUpload = async (file: File) => {
    if (!sessionId) return;
    if (!validateFile(file, 'regulatory')) {
      setRegulatoryStatus('error');
      return;
    }

    setRegulatoryFile(file);
    setRegulatoryStatus('uploading');
    setUploadErrors((prev) => ({ ...prev, regulatory: undefined }));

    try {
      const res = await uploadRegulatory(sessionId, 'file', file);
      setRegulatoryStatus('success');
      setRegulatoryPreview(res.preview);
      console.log('Regulatory file uploaded:', res);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to upload regulatory file';
      setRegulatoryStatus('error');
      setUploadErrors((prev) => ({ ...prev, regulatory: msg }));
      setRegulatoryFile(null);
    }
  };

  // Classify Handler
  const handleClassify = async () => {
    if (!sessionId) return;
    setIsClassifying(true);
    setClassifyResultSummary(null);
    setUploadErrors((prev) => ({ ...prev, classify: undefined }));

    try {
      const res = await classify(sessionId, rulesText);

      const flattened = flattenRows(res.rows);

      setClassifyResultSummary({
        rowsCount: flattened.length,
        totalStatements: res.total_statements,
      });

      setClassifiedRows(flattened);
      setTotalStatements(res.total_statements);
      setHasClassified(true);
      setExpandedRowIds(new Set());

      // Set active tab to the first category that has matches (or default to 'Functionality')
      const categories = ['Functionality', 'Mechanism', 'Performance', 'Fault Management'];
      const counts = categories.reduce((acc, cat) => {
        acc[cat] = flattened.filter((r: any) => r.category === cat).length;
        return acc;
      }, {} as Record<string, number>);

      const firstTabWithData = categories.find((cat) => counts[cat] > 0) || 'Functionality';
      setActiveTab(firstTabWithData);

    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.detail || err.message || 'Failed to run classification pipeline';
      setUploadErrors((prev) => ({ ...prev, classify: msg }));
    } finally {
      setIsClassifying(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!sessionId) return;
    setIsDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const blob = await exportExcel(sessionId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'requirements_analysis.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      console.error('Download failed:', err);
      let errorMsg = 'Export failed — please try again';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.detail) {
            errorMsg = parsed.detail;
          }
        } catch (e) {
          // ignore parsing error, fallback to generic message
        }
      } else if (err.response?.data?.detail) {
        errorMsg = err.response.data.detail;
      } else if (err.message) {
        errorMsg = err.message;
      }
      setDownloadError(errorMsg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePlatformInputToggle = (type: 'text' | 'file') => {
    setPlatformInputType(type);
    setPlatformStatus('idle');
    setPlatformPreview('');
    setUploadErrors((prev) => ({ ...prev, platform: undefined }));
    if (type === 'text') {
      setPlatformFile(null);
      platformLastUploadedText.current = '';
      setPlatformText('');
    } else {
      setPlatformText('');
    }
  };

  const handleRegulatoryInputToggle = (type: 'text' | 'file') => {
    setRegulatoryInputType(type);
    setRegulatoryStatus('idle');
    setRegulatoryPreview('');
    setUploadErrors((prev) => ({ ...prev, regulatory: undefined }));
    if (type === 'text') {
      setRegulatoryFile(null);
      regulatoryLastUploadedText.current = '';
      setRegulatoryText('');
    } else {
      setRegulatoryText('');
    }
  };

  const runSimulatedTestSuite = async () => {
    try {
      console.log('=== STARTING SIMULATED TEST SUITE ===');
      
      // 1. Create and upload requirements file
      console.log('Step 1: Uploading requirements file...');
      const reqFile = new File([
        "This is a sample requirements text file.\n" +
        "REQ-001: The system shall run offline.\n" +
        "REQ-002: Latency must be low.\n" +
        "REQ-003: In the event of thermal runaway, the system shall isolate the battery module."
      ], "sample.txt", { type: "text/plain" });
      await handleRequirementsUpload(reqFile);
      
      // Wait for upload to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 2. Input platform text
      console.log('Step 2: Inputting platform text...');
      const platText = "REQ-002: System must respond in 50ms.";
      setPlatformText(platText);
      await triggerPlatformUploadText(platText);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. Switch to platform file upload and upload mock PDF
      console.log('Step 3: Uploading platform PDF file...');
      handlePlatformInputToggle('file');
      const platFile = new File(["%PDF-1.4 mock pdf content"], "sample.pdf", { type: "application/pdf" });
      await handlePlatformFileUpload(platFile);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 4. Input rules/instructions
      console.log('Step 4: Setting custom classification rules...');
      setRulesText("Category: PERFORMANCE matches keywords: latency, respond");
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 5. Run classification
      console.log('Step 5: Running classification...');
      setIsClassifying(true);
      setClassifyResultSummary(null);
      setUploadErrors((prev) => ({ ...prev, classify: undefined }));
      
      console.log(`Running classification with custom instructions...`);
      const res = await classify(sessionId!, "Category: PERFORMANCE matches keywords: latency, respond");

      const flattened = flattenRows(res.rows);

      setClassifyResultSummary({
        rowsCount: flattened.length,
        totalStatements: res.total_statements,
      });

      setClassifiedRows(flattened);
      setTotalStatements(res.total_statements);
      setHasClassified(true);
      setExpandedRowIds(new Set());

      // Set active tab to the first category that has matches (or default to 'Functionality')
      const categories = ['Functionality', 'Mechanism', 'Performance', 'Fault Management'];
      const counts = categories.reduce((acc, cat) => {
        acc[cat] = flattened.filter((r: any) => r.category === cat).length;
        return acc;
      }, {} as Record<string, number>);

      const firstTabWithData = categories.find((cat) => counts[cat] > 0) || 'Functionality';
      setActiveTab(firstTabWithData);
      setIsClassifying(false);
      
      console.log('=== TEST SUITE COMPLETED SUCCESSFULLY ===');
    } catch (err: any) {
      console.error('Test suite failed:', err);
      setIsClassifying(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-indigo-500/30 selection:text-white">
      <div className="w-full max-w-4xl space-y-8 relative">
        
        {/* Header */}
        <div className="text-center space-y-3 py-6 border-b border-slate-900">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm select-none">
            Requirements Generator
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-light">
            An offline, rule-based systems engineering pipeline to ingest, clean, and classify compliance requirements against your product definition.
          </p>
        </div>

        {/* Global connection error */}
        {connError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-200 flex items-start gap-3 shadow-lg shadow-rose-950/20 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
            <svg className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="space-y-1">
              <h3 className="font-semibold text-rose-300">Backend Connection Refused</h3>
              <p className="text-sm text-rose-400/90">{connError}</p>
              <button 
                onClick={initSession}
                className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900/70 border border-rose-700/50 text-rose-100 transition duration-150"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Form area */}
        <div className="relative bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-8 overflow-hidden">
          
          {/* Overlay loading indicator if initializing session */}
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-4">
              <svg className="animate-spin h-10 w-10 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-slate-400 text-sm font-medium tracking-wide">Initializing secure session...</p>
            </div>
          )}

          {/* Locked status if no sessionId (e.g. backend failed) */}
          {!sessionId && !isInitializing && (
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 flex items-center justify-center">
              <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-xl text-center max-w-sm shadow-xl">
                <p className="text-slate-400 text-sm">Please start the backend server and click "Retry Connection" to unlock the form.</p>
              </div>
            </div>
          )}

          {/* Section 1: Customer Requirements Document */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                1. Customer Requirements Document <span className="text-indigo-400 font-bold">*</span>
              </label>
              <span className="text-xs text-slate-500 font-medium">PDF, DOC, DOCX, TXT (Max 10MB)</span>
            </div>
            
            <div
              onDragOver={onReqDragOver}
              onDragLeave={onReqDragLeave}
              onDrop={onReqDrop}
              className={`relative border-2 border-dashed rounded-xl p-6 md:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
                isReqDragOver
                  ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
              }`}
            >
              <input
                id="req-upload"
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.doc,.docx,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleRequirementsUpload(e.target.files[0]);
                  }
                }}
              />
              
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg shadow-inner mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-200">
                  {requirementsFile ? (
                    <span className="text-indigo-400 font-semibold">{requirementsFile.name}</span>
                  ) : (
                    <span>Drag and drop file here, or click to browse</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {requirementsFile 
                    ? `Size: ${(requirementsFile.size / (1024 * 1024)).toFixed(2)} MB` 
                    : 'System parses text and splits into requirement statements'
                  }
                </p>
              </div>

              {/* Status indicator on overlay */}
              {requirementsStatus !== 'idle' && (
                <div className="mt-4 flex items-center justify-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-900 border border-slate-800">
                  {requirementsStatus === 'uploading' && (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-slate-400">Uploading...</span>
                    </>
                  )}
                  {requirementsStatus === 'success' && (
                    <>
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-emerald-400">Document Uploaded Successfully</span>
                    </>
                  )}
                  {requirementsStatus === 'error' && (
                    <>
                      <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="text-rose-400 font-semibold">Upload Failed</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Custom per-field error details */}
            {uploadErrors.requirements && (
              <p className="text-xs font-medium text-rose-400 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30 transition-all duration-200">
                {uploadErrors.requirements}
              </p>
            )}

            {/* Text Preview */}
            {requirementsStatus === 'success' && requirementsPreview && (
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg text-slate-400 text-xs">
                <span className="text-slate-500 font-semibold uppercase tracking-wider block mb-1">Extracted Text Preview:</span>
                <p className="line-clamp-2 italic">"{requirementsPreview}"</p>
              </div>
            )}
          </div>

          {/* Grid Layout for Platform & Regulatory (Side-by-Side) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Section 2: Platform/Existing Product */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                    2. Platform / Existing Product
                  </label>
                  <span className="text-xs text-slate-500 font-light">(Optional)</span>
                </div>

                {/* Toggle Group */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handlePlatformInputToggle('text')}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                      platformInputType === 'text'
                        ? 'bg-slate-900 text-teal-400 shadow border border-slate-800/60'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Text / Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePlatformInputToggle('file')}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                      platformInputType === 'file'
                        ? 'bg-slate-900 text-teal-400 shadow border border-slate-800/60'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    File Upload
                  </button>
                </div>

                {/* Dynamic Input field */}
                {platformInputType === 'text' ? (
                  <div className="relative">
                    <textarea
                      placeholder="Paste product context or documentation link (http://...)"
                      rows={3}
                      value={platformText}
                      onChange={(e) => handlePlatformTextChange(e.target.value)}
                      onBlur={handlePlatformTextBlur}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-teal-500 rounded-xl p-3 text-xs md:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition duration-150 resize-none font-mono"
                    />
                  </div>
                ) : (
                  <div className="relative border border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 bg-slate-950/40 flex flex-col items-center justify-center text-center cursor-pointer min-h-[92px] transition duration-150">
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handlePlatformFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <svg className="w-5 h-5 text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-300">
                      {platformFile ? (
                        <span className="text-teal-400">{platformFile.name}</span>
                      ) : (
                        'Choose product file to upload'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-600 mt-0.5">PDF, DOC, DOCX, TXT</span>
                  </div>
                )}
              </div>

              {/* Status and Error indicators */}
              <div className="space-y-2">
                {platformStatus !== 'idle' && (
                  <div className="flex items-center gap-1.5 text-xs mt-1">
                    {platformStatus === 'uploading' && (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-slate-500">Syncing product context...</span>
                      </>
                    )}
                    {platformStatus === 'success' && (
                      <>
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-400 font-medium">Product Context Synced</span>
                      </>
                    )}
                    {platformStatus === 'error' && (
                      <>
                        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-rose-400 font-semibold">Sync Failed</span>
                      </>
                    )}
                  </div>
                )}

                {uploadErrors.platform && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900/30">
                    {uploadErrors.platform}
                  </p>
                )}

                {platformStatus === 'success' && platformPreview && (
                  <div className="p-2 bg-slate-950 border border-slate-900 rounded text-slate-400 text-[11px] line-clamp-1 italic">
                    Preview: "{platformPreview}"
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Regulatory Standard */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                    3. Regulatory Standard
                  </label>
                  <span className="text-xs text-slate-500 font-light">(Optional)</span>
                </div>

                {/* Toggle Group */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleRegulatoryInputToggle('text')}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                      regulatoryInputType === 'text'
                        ? 'bg-slate-900 text-teal-400 shadow border border-slate-800/60'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Text / Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRegulatoryInputToggle('file')}
                    className={`flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition duration-150 ${
                      regulatoryInputType === 'file'
                        ? 'bg-slate-900 text-teal-400 shadow border border-slate-800/60'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    File Upload
                  </button>
                </div>

                {/* Dynamic Input field */}
                {regulatoryInputType === 'text' ? (
                  <div className="relative">
                    <textarea
                      placeholder="Paste regulatory clauses or standard link (http://...)"
                      rows={3}
                      value={regulatoryText}
                      onChange={(e) => handleRegulatoryTextChange(e.target.value)}
                      onBlur={handleRegulatoryTextBlur}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-teal-500 rounded-xl p-3 text-xs md:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition duration-150 resize-none font-mono"
                    />
                  </div>
                ) : (
                  <div className="relative border border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-4 bg-slate-950/40 flex flex-col items-center justify-center text-center cursor-pointer min-h-[92px] transition duration-150">
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.txt"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleRegulatoryFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <svg className="w-5 h-5 text-slate-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-xs font-semibold text-slate-300">
                      {regulatoryFile ? (
                        <span className="text-teal-400">{regulatoryFile.name}</span>
                      ) : (
                        'Choose regulatory file to upload'
                      )}
                    </span>
                    <span className="text-[10px] text-slate-600 mt-0.5">PDF, DOC, DOCX, TXT</span>
                  </div>
                )}
              </div>

              {/* Status and Error indicators */}
              <div className="space-y-2">
                {regulatoryStatus !== 'idle' && (
                  <div className="flex items-center gap-1.5 text-xs mt-1">
                    {regulatoryStatus === 'uploading' && (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-slate-500">Syncing standard...</span>
                      </>
                    )}
                    {regulatoryStatus === 'success' && (
                      <>
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-emerald-400 font-medium">Regulatory Synced</span>
                      </>
                    )}
                    {regulatoryStatus === 'error' && (
                      <>
                        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="text-rose-400 font-semibold">Sync Failed</span>
                      </>
                    )}
                  </div>
                )}

                {uploadErrors.regulatory && (
                  <p className="text-[11px] text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-900/30">
                    {uploadErrors.regulatory}
                  </p>
                )}

                {regulatoryStatus === 'success' && regulatoryPreview && (
                  <div className="p-2 bg-slate-950 border border-slate-900 rounded text-slate-400 text-[11px] line-clamp-1 italic">
                    Preview: "{regulatoryPreview}"
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Rules / Instructions */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold tracking-wide uppercase text-slate-300">
                4. Custom Classification Instructions
              </label>
              <span className="text-xs text-slate-500 font-light">(Optional)</span>
            </div>
            
            <textarea
              placeholder="Add key instruction overrides or custom category mapping rules. E.g.
• Category: THERMAL_MANAGEMENT matches keywords: battery temperature, cooling loop, coolant
• Category: ELECTRICAL_SAFETY matches keywords: isolation monitoring, high voltage interlock"
              rows={4}
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700/80 focus:border-indigo-500 rounded-xl p-4 text-xs md:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition duration-150 font-mono"
            />
          </div>

          {/* Actions & Global Execution Errors */}
          <div className="pt-6 border-t border-slate-800/80 space-y-4">
            
            {uploadErrors.classify && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-200 flex items-start gap-3 shadow-lg transition-all duration-300">
                <svg className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-1">
                  <h4 className="font-semibold text-rose-300 text-sm">Classification Request Failed</h4>
                  <p className="text-xs text-rose-400/90">{uploadErrors.classify}</p>
                </div>
              </div>
            )}

            {classifyResultSummary && (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-emerald-300 flex items-start gap-3 shadow-md transition-all duration-300">
                <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-0.5">
                  <h4 className="font-semibold text-emerald-200 text-sm">Classification Completed</h4>
                  <p className="text-xs text-emerald-300/85">
                    Extracted and classified <span className="font-bold text-white">{classifyResultSummary.rowsCount}</span> mapped entries out of <span className="font-bold text-white">{classifyResultSummary.totalStatements}</span> parsed statements.
                  </p>
                  <p className="text-[10px] text-emerald-400/75 mt-1 font-mono">
                    Check developer tools console to inspect detailed statement rows.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500 font-light flex items-center gap-1.5">
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {!requirementsFile ? 'Requirements document must be uploaded to preview.' : 'Ready to analyze system requirements.'}
              </span>

              <button
                type="button"
                onClick={handleClassify}
                disabled={requirementsStatus !== 'success' || isClassifying || isUploading}
                className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm transition duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-center gap-2 ${
                  requirementsStatus === 'success' && !isClassifying && !isUploading
                    ? 'bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {isClassifying ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Classifying Requirements...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>Preview Requirements</span>
                  </>
                )}
              </button>
            </div>

          </div>

        </div>

        {/* Results Section (Phase 8) */}
        {isClassifying && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 shadow-2xl animate-pulse">
            <svg className="animate-spin h-10 w-10 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-400 text-sm font-medium tracking-wide">Classifying requirement statements...</p>
          </div>
        )}

        {hasClassified && !isClassifying && (
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 md:p-8 shadow-2xl space-y-6 overflow-hidden transition-all duration-300">
            {/* Header / Title */}
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Classified Requirements Preview
              </h2>
            </div>

            {totalStatements === 0 ? (
              <div className="p-8 text-center bg-slate-950/40 border border-slate-900 rounded-xl space-y-2">
                <svg className="w-8 h-8 text-slate-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-slate-400">No requirement statements were found in the uploaded documents</p>
                <p className="text-xs text-slate-600">Please make sure your uploaded files contain non-empty text content.</p>
              </div>
            ) : (
              <>
                {/* Summary Strip */}
                {(() => {
                  const categories = ['Functionality', 'Mechanism', 'Performance', 'Fault Management'] as const;
                  const counts = categories.reduce((acc, cat) => {
                    acc[cat] = classifiedRows.filter(r => r.category === cat).length;
                    return acc;
                  }, {} as Record<string, number>);

                  return (
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Total Statements Parsed</span>
                          <div className="text-lg font-bold text-slate-200">{totalStatements} statements</div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            id="download-excel-btn"
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={!hasClassified || isDownloading || totalStatements === 0}
                            className={`px-4 py-2 rounded-xl font-semibold text-xs transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex items-center justify-center gap-2 ${
                              hasClassified && !isDownloading && totalStatements > 0
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/20 active:scale-[0.98]'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                            }`}
                          >
                            {isDownloading ? (
                              <>
                                <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Preparing file...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Download Excel</span>
                              </>
                            )}
                          </button>
                          {downloadError && (
                            <p className="text-xs font-medium text-rose-400 bg-rose-950/20 p-2.5 rounded-lg border border-rose-900/30 transition-all duration-200 max-w-xs leading-tight">
                              {downloadError}
                            </p>
                          )}
                          {downloadSuccess && (
                            <p className="text-xs font-medium text-emerald-400 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30 transition-all duration-200 flex items-center gap-1.5 max-w-xs leading-tight">
                              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Downloaded successfully</span>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                        {categories.map((cat) => {
                          const count = counts[cat];
                          let borderClass = 'border-slate-800 text-slate-400';
                          let bgClass = 'bg-slate-900/40';
                          if (count > 0) {
                            if (cat === 'Functionality') {
                              borderClass = 'border-teal-500/20 text-teal-300';
                              bgClass = 'bg-teal-500/5';
                            } else if (cat === 'Mechanism') {
                              borderClass = 'border-sky-500/20 text-sky-300';
                              bgClass = 'bg-sky-500/5';
                            } else if (cat === 'Performance') {
                              borderClass = 'border-amber-500/20 text-amber-300';
                              bgClass = 'bg-amber-500/5';
                            } else if (cat === 'Fault Management') {
                              borderClass = 'border-rose-500/20 text-rose-300';
                              bgClass = 'bg-rose-500/5';
                            }
                          }
                          return (
                            <div key={cat} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${bgClass} ${borderClass}`}>
                              <span>{cat}:</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-200">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Tabs */}
                {(() => {
                  const categories = ['Functionality', 'Mechanism', 'Performance', 'Fault Management'] as const;
                  const counts = categories.reduce((acc, cat) => {
                    acc[cat] = classifiedRows.filter(r => r.category === cat).length;
                    return acc;
                  }, {} as Record<string, number>);

                  return (
                    <div className="space-y-4">
                      {/* Tab Buttons */}
                      <div className="flex flex-wrap border-b border-slate-800 gap-1">
                        {categories.map((cat) => {
                          const isActive = activeTab === cat;
                          const count = counts[cat];
                          
                          let accentColorClass = 'text-teal-400 border-teal-400';
                          
                          if (cat === 'Functionality') {
                            accentColorClass = 'text-teal-400 border-teal-400 bg-teal-500/5';
                          } else if (cat === 'Mechanism') {
                            accentColorClass = 'text-sky-400 border-sky-400 bg-sky-500/5';
                          } else if (cat === 'Performance') {
                            accentColorClass = 'text-amber-400 border-amber-400 bg-amber-500/5';
                          } else if (cat === 'Fault Management') {
                            accentColorClass = 'text-rose-400 border-rose-400 bg-rose-500/5';
                          }

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setActiveTab(cat)}
                              className={`px-4 py-3 text-xs md:text-sm font-semibold border-b-2 transition-all duration-150 flex items-center gap-2 ${
                                isActive
                                  ? `${accentColorClass} font-bold`
                                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                              }`}
                            >
                              <span>{cat}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                isActive 
                                  ? 'bg-slate-900 border border-slate-800 text-slate-100 font-bold' 
                                  : 'bg-slate-950 text-slate-500'
                              }`}>
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Tab Content */}
                      {(() => {
                        const filteredAndSortedRows = classifiedRows
                          .filter(r => r.category === activeTab)
                          .sort((a, b) => a.line_number - b.line_number);

                        if (filteredAndSortedRows.length === 0) {
                          return (
                            <div className="p-12 text-center border border-dashed border-slate-800 rounded-xl bg-slate-950/20 animate-in fade-in duration-200">
                              <svg className="w-6 h-6 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-sm text-slate-500 font-semibold block">No statements matched this category</span>
                              <span className="text-xs text-slate-600">Adjust custom instructions or add more rules to classify statements here.</span>
                            </div>
                          );
                        }

                        return (
                          <div className="overflow-x-auto border border-slate-800/80 rounded-xl bg-slate-950/20 shadow-inner animate-in fade-in duration-200">
                            <table className="w-full text-left border-collapse text-xs md:text-sm">
                              <thead>
                                <tr className="border-b border-slate-850 bg-slate-900/60 text-slate-400 font-semibold select-none">
                                  <th className="py-3 px-4 font-semibold w-7/12">Statement</th>
                                  <th className="py-3 px-4 font-semibold w-2/12">Source</th>
                                  <th className="py-3 px-4 font-semibold w-2/12">Matched Rules</th>
                                  <th className="py-3 px-4 font-semibold w-1/12 text-right">Score</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900/60">
                                {filteredAndSortedRows.map((row) => {
                                  const compositeKey = `${row.category}-${row.line_number}-${row.source_doc}`;
                                  const isExpanded = expandedRowIds.has(compositeKey);
                                  const sourceLabel = SOURCE_LABEL_MAP[row.source_doc as keyof typeof SOURCE_LABEL_MAP] || row.source_doc;
                                  
                                  const toggleExpand = () => {
                                    setExpandedRowIds(prev => {
                                      const next = new Set(prev);
                                      if (next.has(compositeKey)) {
                                        next.delete(compositeKey);
                                      } else {
                                        next.add(compositeKey);
                                      }
                                      return next;
                                    });
                                  };

                                  return (
                                    <tr key={compositeKey} className="hover:bg-slate-900/20 transition-colors duration-150">
                                      {/* Statement */}
                                      <td className="py-4 px-4 align-top text-slate-200 font-normal leading-relaxed whitespace-pre-wrap">
                                        <div className="flex flex-col gap-1">
                                          <span>{row.text}</span>
                                          <span className="text-[10px] font-mono text-slate-650 select-none">Line {row.line_number}</span>
                                        </div>
                                      </td>

                                      {/* Source */}
                                      <td className="py-4 px-4 align-top text-slate-400 text-xs font-medium">
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                          <span className="line-clamp-2">{sourceLabel}</span>
                                        </div>
                                      </td>

                                      {/* Matched Rules */}
                                      <td className="py-4 px-4 align-top">
                                        <div className="flex flex-col items-start gap-2">
                                          <button
                                            type="button"
                                            onClick={toggleExpand}
                                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-slate-850 hover:text-slate-200 border border-slate-800 text-slate-300 flex items-center gap-1.5 transition active:scale-[0.98] select-none"
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                            <span>{row.matched_rules?.length || 0} {row.matched_rules?.length === 1 ? 'rule' : 'rules'}</span>
                                            <svg 
                                              className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                                              fill="none" 
                                              stroke="currentColor" 
                                              viewBox="0 0 24 24"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </button>

                                          {isExpanded && row.matched_rules && row.matched_rules.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1 max-w-xs animate-in fade-in slide-in-from-top-1 duration-150">
                                              {row.matched_rules.map((rule: string, rIdx: number) => (
                                                <span 
                                                  key={rIdx} 
                                                  className="px-2 py-0.5 text-[9px] font-semibold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono"
                                                >
                                                  {rule}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>

                                      {/* Score */}
                                      <td className="py-4 px-4 align-top text-right">
                                        <span className="inline-block px-2 py-0.5 text-xs font-bold rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono">
                                          {row.score}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* Developer Test Tools */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-300">Integration Testing Tool</h4>
            <p className="text-xs text-slate-500">Automatically executes the 7-step integration test flow by simulating uploads and triggers.</p>
          </div>
          <button
            id="run-simulation-btn"
            type="button"
            onClick={runSimulatedTestSuite}
            disabled={!sessionId || isUploading || isClassifying}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 disabled:text-slate-600 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed"
          >
            Run Simulated Test Suite
          </button>
        </div>

      </div>
    </main>
  );
}
