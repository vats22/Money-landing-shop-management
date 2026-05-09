import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Modal, ConfirmDialog } from '../components/ui/Modal';
import { toast } from 'sonner';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import NoteEditor from '../components/ui/NoteEditor';
import {
  ArrowLeft, Plus, Trash2, Gem, TrendingUp, TrendingDown, Save,
  Image as ImageIcon, Upload, Camera, X, ChevronLeft, ChevronRight, FileText,
  StickyNote
} from 'lucide-react';

// Get today's date for max date
const getToday = () => new Date().toISOString().split('T')[0];

export default function AccountFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = getToday();

  // Rich text editor config
  const quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ align: '' }, { align: 'center' }, { align: 'right' }],
      [{ color: [] }, { background: [] }],
      ['clean']
    ],
    history: { delay: 500, maxStack: 100, userOnly: true }
  };
  const quillFormats = ['bold', 'italic', 'underline', 'list', 'align', 'color', 'background'];

  // Numeric-only input handler (digits + single dot)
  const handleNumericInput = useCallback((setter, field, index) => (e) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setter(index, field, val);
    }
  }, []);

  // Confirmation dialog state
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState(null);

  // Account info for edit page header
  const [accountInfo, setAccountInfo] = useState(null);

  // Delete entry confirmation
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState(null);

  const [formData, setFormData] = useState({
    opening_date: today,
    name: '',
    village: '',
    status: 'continue',
    details: '',
    jewellery_items: [{ name: '', weight: '' }],
    landed_entries: [{ date: today, amount: '', interest_rate: '2', note: '' }],
    received_entries: []
  });

  // UI state for "+ Add note" expand on each entry row
  const [openLandedNote, setOpenLandedNote] = useState({});
  const [openReceivedNote, setOpenReceivedNote] = useState({});
  // Mobile stepper (Account → Jewellery → Landed → Received)
  const [mobileStep, setMobileStep] = useState(0);
  // Confirm dialog for removing a note from an entry
  const [removeNoteConfirm, setRemoveNoteConfirm] = useState(null); // { type: 'landed'|'received', index }

  // Image modal state
  const MAX_IMAGES = 5;
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(-1);
  const [selectedItemImages, setSelectedItemImages] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isEdit) {
      fetchAccount();
    }
  }, [id]);

  const fetchAccount = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/accounts/${id}`);
      const account = response.data;
      setAccountInfo({ account_number: account.account_number, name: account.name });
      setFormData({
        opening_date: account.opening_date,
        name: account.name,
        village: account.village,
        status: account.status,
        details: account.details || '',
        jewellery_items: account.jewellery_items?.length > 0 
          ? account.jewellery_items.map(item => ({ ...item, images: item.images || [] }))
          : [{ name: '', weight: '', images: [] }],
        landed_entries: account.landed_entries?.length > 0 
          ? account.landed_entries.map(e => ({ ...e, note: e.note || '' }))
          : [{ date: '', amount: '', interest_rate: '2', note: '' }],
        received_entries: (account.received_entries || []).map(e => ({ ...e, note: e.note || '' }))
      });
    } catch (error) {
      toast.error('Failed to fetch account');
      navigate('/accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Jewellery handlers
  const addJewelleryItem = () => {
    setFormData(prev => ({
      ...prev,
      jewellery_items: [...prev.jewellery_items, { name: '', weight: '' }]
    }));
  };

  const removeJewelleryItem = (index) => {
    setFormData(prev => ({
      ...prev,
      jewellery_items: prev.jewellery_items.filter((_, i) => i !== index)
    }));
  };

  const updateJewelleryItem = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      jewellery_items: prev.jewellery_items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  // Landed entry handlers
  const addLandedEntry = () => {
    setFormData(prev => ({
      ...prev,
      landed_entries: [...prev.landed_entries, { date: new Date().toISOString().split('T')[0], amount: '', interest_rate: '2', note: '' }]
    }));
  };

  const removeLandedEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      landed_entries: prev.landed_entries.filter((_, i) => i !== index)
    }));
  };

  const updateLandedEntry = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      landed_entries: prev.landed_entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Received entry handlers
  const addReceivedEntry = () => {
    setFormData(prev => ({
      ...prev,
      received_entries: [...prev.received_entries, { date: new Date().toISOString().split('T')[0], amount: '', note: '' }]
    }));
  };

  const removeReceivedEntry = (index) => {
    setFormData(prev => ({
      ...prev,
      received_entries: prev.received_entries.filter((_, i) => i !== index)
    }));
  };

  const updateReceivedEntry = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      received_entries: prev.received_entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  // Image handling functions
  const openImageModal = (item, index) => {
    if (!item.name?.trim()) {
      toast.error('Add the item name first, then attach images.');
      return;
    }
    setSelectedItemIndex(index);
    const combined = [...(item.images || []), ...(item.pendingImages || [])];
    setSelectedItemImages(combined);
    setSelectedItemName(item.name || `Item ${index + 1}`);
    setCurrentImageIdx(0);
    setShowImageModal(true);
  };

  const getImageUrl = (image) => {
    // Pending (not-yet-uploaded) image — show local object URL
    if (image && image.__pending && image.__objectUrl) return image.__objectUrl;
    const token = localStorage.getItem('token');
    return `${process.env.REACT_APP_BACKEND_URL}/api/files/${image.storage_path}?auth=${token}`;
  };

  const uploadFileToServer = async (file, accountIdOverride = null, itemIdxOverride = null) => {
    const accId = accountIdOverride || id;
    const itemIdx = itemIdxOverride !== null ? itemIdxOverride : selectedItemIndex;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/api/accounts/${accId}/jewellery/${itemIdx}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return true;
    } catch (error) {
      toast.error(`Failed to upload ${file.name || 'image'}`);
      return false;
    }
  };

  const refreshImagesAfterUpload = async () => {
    const refreshed = await api.get(`/api/accounts/${id}`);
    const updatedItems = refreshed.data.jewellery_items || [];
    setFormData(prev => ({
      ...prev,
      jewellery_items: prev.jewellery_items.map((item, i) => ({
        ...item,
        images: updatedItems[i]?.images || item.images || []
      }))
    }));
    const updatedItem = updatedItems[selectedItemIndex];
    setSelectedItemImages(updatedItem?.images || []);
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const item = formData.jewellery_items[selectedItemIndex] || {};
    const currentImages = item.images || [];
    const pendingImages = item.pendingImages || [];
    const remaining = MAX_IMAGES - (currentImages.length + pendingImages.length);
    if (remaining <= 0) { toast.error('Maximum 5 images per item'); if (e.target) e.target.value = ''; return; }

    const filesToUpload = files.slice(0, remaining).filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name}: Too large (max 10MB)`); return false; }
      return true;
    });
    if (!filesToUpload.length) { if (e.target) e.target.value = ''; return; }

    if (isEdit) {
      // Edit mode → upload immediately to existing account
      setUploading(true);
      for (const file of filesToUpload) {
        await uploadFileToServer(file);
      }
      setUploading(false);
      toast.success('Images uploaded');
      await refreshImagesAfterUpload();
    } else {
      // Add mode → stage locally; will upload after the account is created
      const stagedImages = filesToUpload.map(file => ({
        __pending: true,
        __file: file,
        __objectUrl: URL.createObjectURL(file),
        id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename: file.name,
      }));
      setFormData(prev => ({
        ...prev,
        jewellery_items: prev.jewellery_items.map((it, i) =>
          i === selectedItemIndex
            ? { ...it, pendingImages: [...(it.pendingImages || []), ...stagedImages] }
            : it
        )
      }));
      // Reflect in the modal's currently-shown list (server images + pending)
      setSelectedItemImages([...(item.images || []), ...((item.pendingImages || [])), ...stagedImages]);
      toast.success(`${stagedImages.length} image(s) staged. They will upload when you save.`);
    }

    if (e.target) e.target.value = '';
  };

  const handleDeleteImage = async (imageId) => {
    // Pending (not-yet-uploaded) image — remove locally only
    if (typeof imageId === 'string' && imageId.startsWith('pending-')) {
      setFormData(prev => ({
        ...prev,
        jewellery_items: prev.jewellery_items.map((it, i) =>
          i === selectedItemIndex
            ? { ...it, pendingImages: (it.pendingImages || []).filter(p => p.id !== imageId) }
            : it
        )
      }));
      const item = formData.jewellery_items[selectedItemIndex] || {};
      const newPending = (item.pendingImages || []).filter(p => p.id !== imageId);
      const updated = [...(item.images || []), ...newPending];
      setSelectedItemImages(updated);
      if (currentImageIdx >= updated.length) setCurrentImageIdx(Math.max(0, updated.length - 1));
      toast.success('Image removed');
      return;
    }
    if (!isEdit) return;
    try {
      await api.delete(`/api/accounts/${id}/jewellery/${selectedItemIndex}/images/${imageId}`);
      toast.success('Image deleted');
      const refreshed = await api.get(`/api/accounts/${id}`);
      const updatedItems = refreshed.data.jewellery_items || [];
      setFormData(prev => ({
        ...prev,
        jewellery_items: prev.jewellery_items.map((item, i) => ({
          ...item,
          images: updatedItems[i]?.images || item.images || []
        }))
      }));
      const newImages = updatedItems[selectedItemIndex]?.images || [];
      setSelectedItemImages(newImages);
      if (currentImageIdx >= newImages.length) setCurrentImageIdx(Math.max(0, newImages.length - 1));
    } catch { toast.error('Failed to delete image'); }
  };

  // Camera functions
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setShowCamera(true);
      // Wait for DOM to render, then attach stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      toast.error('Unable to access camera. Please check permissions or use "Choose from Device" instead.');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `camera_${Date.now()}.jpg`, { type: 'image/jpeg' });
      closeCamera();
      if (isEdit) {
        setUploading(true);
        const success = await uploadFileToServer(file);
        setUploading(false);
        if (success) {
          toast.success('Photo captured and uploaded');
          await refreshImagesAfterUpload();
        }
      } else {
        // Add mode: stage locally
        const staged = {
          __pending: true, __file: file,
          __objectUrl: URL.createObjectURL(file),
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          filename: file.name,
        };
        setFormData(prev => ({
          ...prev,
          jewellery_items: prev.jewellery_items.map((it, i) =>
            i === selectedItemIndex
              ? { ...it, pendingImages: [...(it.pendingImages || []), staged] }
              : it
          )
        }));
        const item = formData.jewellery_items[selectedItemIndex] || {};
        setSelectedItemImages([...(item.images || []), ...(item.pendingImages || []), staged]);
        toast.success('Photo captured. It will upload when you save.');
      }
    }, 'image/jpeg', 0.85);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const validateForm = () => {
    if (!formData.name || !formData.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (!formData.village || !formData.village.trim()) {
      toast.error('Village is required');
      return false;
    }
    if (!formData.opening_date) {
      toast.error('Opening date is required');
      return false;
    }

    // Validate jewellery items
    const validJewellery = formData.jewellery_items.filter(
      item => item.name && item.name.trim() && parseFloat(item.weight) > 0
    );
    if (validJewellery.length === 0) {
      toast.error('At least one jewellery item is required');
      return false;
    }

    // Validate landed entries
    const validLanded = formData.landed_entries.filter(
      entry => entry.date && parseFloat(entry.amount) > 0 && parseFloat(entry.interest_rate) >= 0
    );
    if (validLanded.length === 0) {
      toast.error('At least one landed entry is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Defensive: never trigger a save while mobile user is mid-stepper.
    // The visible "Update/Create" button only renders on the final step,
    // but a stray Enter key in a mobile field can still bubble up here.
    if (window.innerWidth < 1024 && mobileStep < 3) return;
    if (!validateForm()) return;
    setPendingSubmitEvent(true);
    setShowSaveConfirm(true);
  };

  const handleConfirmedSave = async () => {
    setShowSaveConfirm(false);
    setPendingSubmitEvent(null);
    setSaving(true);
    try {
      // Filter out empty entries and prepare payload
      const jewellery_items = formData.jewellery_items
        .filter(item => item.name && item.name.trim() && parseFloat(item.weight) > 0)
        .map(item => ({ name: item.name, weight: parseFloat(item.weight), images: item.images || [] }));
      
      const landed_entries = formData.landed_entries
        .filter(entry => entry.date && parseFloat(entry.amount) > 0)
        .map(entry => ({
          date: entry.date,
          amount: parseFloat(entry.amount),
          interest_rate: parseFloat(entry.interest_rate) || 2,
          note: DOMPurify.sanitize(entry.note || ''),
          remaining_principal: entry.remaining_principal !== undefined ? parseFloat(entry.remaining_principal) : parseFloat(entry.amount),
          last_interest_calc_date: entry.last_interest_calc_date || entry.date,
          accumulated_interest: entry.accumulated_interest !== undefined ? parseFloat(entry.accumulated_interest) : 0
        }));
      
      const received_entries = formData.received_entries
        .filter(entry => entry.date && parseFloat(entry.amount) > 0)
        .map(entry => ({
          date: entry.date,
          amount: parseFloat(entry.amount),
          note: DOMPurify.sanitize(entry.note || ''),
          principal_paid: entry.principal_paid !== undefined ? parseFloat(entry.principal_paid) : 0,
          interest_paid: entry.interest_paid !== undefined ? parseFloat(entry.interest_paid) : 0
        }));

      // Sanitize HTML details
      const sanitizedDetails = DOMPurify.sanitize(formData.details);

      const payload = {
        opening_date: formData.opening_date,
        name: formData.name,
        village: formData.village,
        status: formData.status,
        details: sanitizedDetails,
        jewellery_items,
        landed_entries,
        received_entries
      };

      if (isEdit) {
        await api.put(`/api/accounts/${id}`, payload);
        toast.success('Account updated successfully');
      } else {
        const response = await api.post('/api/accounts', payload);
        const newId = response.data.id;
        // Upload any pending (staged) jewellery images
        const pendingUploads = [];
        formData.jewellery_items.forEach((item, idx) => {
          (item.pendingImages || []).forEach(p => {
            if (p.__file) pendingUploads.push({ file: p.__file, idx });
          });
        });
        if (pendingUploads.length > 0) {
          toast.message(`Uploading ${pendingUploads.length} image(s)…`);
          for (const u of pendingUploads) {
            await uploadFileToServer(u.file, newId, u.idx);
          }
          // Revoke local object URLs to free memory
          formData.jewellery_items.forEach(item => (item.pendingImages || []).forEach(p => p.__objectUrl && URL.revokeObjectURL(p.__objectUrl)));
        }
        toast.success('Account created successfully');
        navigate(`/accounts/${newId}`);
        return;
      }
      navigate(`/accounts/${id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  // Mobile stepper config
  const mobileSteps = [
    { id: 0, label: 'Account', short: 'Account' },
    { id: 1, label: 'Jewellery', short: 'Items' },
    { id: 2, label: 'Lent', short: 'Lent' },
    { id: 3, label: 'Received', short: 'Recd' },
  ];
  const stepCls = (i) => `block lg:block ${mobileStep === i ? '' : 'hidden lg:block'}`;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn max-w-5xl mx-auto pb-24 lg:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors tap-target"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-ink" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold font-display text-primary-ink truncate">
            {isEdit ? 'Edit Account' : 'New Account'}
          </h1>
          {isEdit && accountInfo ? (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200" data-testid="edit-account-number">
                <FileText className="h-3 w-3" />
                {accountInfo.account_number}
              </span>
              <span className="text-xs sm:text-sm text-secondary-ink truncate" data-testid="edit-account-name">{accountInfo.name}</span>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-secondary-ink mt-1">
              {isEdit ? 'Update account details' : 'Create a new lending account'}
            </p>
          )}
        </div>
      </div>

      {/* Mobile stepper */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 p-2">
          {mobileSteps.map((s, idx) => (
            <React.Fragment key={s.id}>
              <button
                type="button"
                onClick={() => setMobileStep(s.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1.5 rounded-lg transition-colors tap-target ${
                  mobileStep === s.id ? 'bg-emerald-600 text-white' : 'text-secondary-ink hover:bg-slate-50'
                }`}
                data-testid={`step-${s.id}`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                  mobileStep === s.id ? 'bg-white/20 text-white' :
                  mobileStep > s.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{s.id + 1}</span>
                <span className="text-[10px] mt-0.5 font-medium">{s.short}</span>
              </button>
              {idx < mobileSteps.length - 1 && <div className={`h-0.5 w-2 ${mobileStep > idx ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Basic Details */}
        <div className={stepCls(0)}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600" />
              Basic Details
            </CardTitle>
            <p className="text-xs text-secondary-ink mt-1">Customer & account essentials</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                  Opening Date <span className="text-danger-ink">*</span>
                </label>
                <Input
                  data-testid="opening-date"
                  type="date"
                  name="opening_date"
                  value={formData.opening_date}
                  onChange={handleChange}
                  max={today}
                  required
                  className="tap-target"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                  Status <span className="text-danger-ink">*</span>
                </label>
                <Select
                  data-testid="status-select"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="tap-target"
                >
                  <option value="continue">Continue</option>
                  <option value="closed">Closed</option>
                  <option value="renewed">Renewed</option>
                  <option value="immediate action needed">Immediate Action Needed</option>
                </Select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                  Customer Name <span className="text-danger-ink">*</span>
                </label>
                <Input
                  data-testid="name-input"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Ramesh Patel"
                  required
                  className="tap-target"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                  Village <span className="text-danger-ink">*</span>
                </label>
                <Input
                  data-testid="village-input"
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  placeholder="e.g., Surat"
                  required
                  className="tap-target"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                  Notes / Details <span className="text-muted-ink font-normal normal-case">(optional)</span>
                </label>
                <div className="quill-wrapper" data-testid="details-editor">
                  <ReactQuill
                    theme="snow"
                    value={formData.details}
                    onChange={(val) => setFormData(prev => ({ ...prev, details: val }))}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Any contextual notes about this account…"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Jewellery Items */}
        <div className={stepCls(1)}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <CardTitle className="flex items-center gap-2">
                <Gem className="h-5 w-5 text-amber-500" />
                Jewellery Items
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addJewelleryItem} className="self-start sm:self-auto tap-target" data-testid="add-jewellery-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formData.jewellery_items.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-start p-3 sm:p-4 bg-amber-50/40 border border-amber-200/50 rounded-xl">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                      Item Name <span className="text-danger-ink">*</span>
                    </label>
                    <Input
                      data-testid={`jewellery-name-${index}`}
                      type="text"
                      value={item.name}
                      onChange={(e) => updateJewelleryItem(index, 'name', e.target.value)}
                      placeholder="e.g., Gold Ring"
                      className="tap-target"
                    />
                  </div>
                  <div className="sm:w-32">
                    <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                      Weight (g) <span className="text-danger-ink">*</span>
                    </label>
                    <Input
                      data-testid={`jewellery-weight-${index}`}
                      type="text"
                      inputMode="decimal"
                      value={item.weight}
                      onChange={handleNumericInput(updateJewelleryItem, 'weight', index)}
                      placeholder="10.5"
                      className="tap-target"
                    />
                  </div>
                  {/* Image upload — available in both Add and Edit modes */}
                  <div className="sm:w-24">
                    <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                      Images
                    </label>
                    <button
                      type="button"
                      onClick={() => openImageModal(item, index)}
                      data-testid={`jewellery-images-${index}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 w-full justify-center tap-target"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {((item.images?.length || 0) + (item.pendingImages?.length || 0))} / {MAX_IMAGES}
                    </button>
                  </div>
                  {formData.jewellery_items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDeleteEntryConfirm({ type: 'jewellery', index })}
                      className="mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
              {!isEdit && (
                <p className="text-xs text-muted-ink italic mt-2 flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Add images now — they'll auto-upload after the account is saved.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Landed Entries */}
        <div className={stepCls(2)}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Landed Entries (Money Lent)
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLandedEntry} className="self-start sm:self-auto tap-target" data-testid="add-landed-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formData.landed_entries.map((entry, index) => (
                <div key={index} className="p-3 sm:p-4 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                        Landed Date <span className="text-danger-ink">*</span>
                      </label>
                      <Input
                        data-testid={`landed-date-${index}`}
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateLandedEntry(index, 'date', e.target.value)}
                        min={formData.opening_date}
                        max={today}
                        className="tap-target"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                        Amount (₹) <span className="text-danger-ink">*</span>
                      </label>
                      <Input
                        data-testid={`landed-amount-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={entry.amount}
                        onChange={handleNumericInput(updateLandedEntry, 'amount', index)}
                        placeholder="10000"
                        className="tap-target"
                      />
                    </div>
                    <div className="sm:w-32">
                      <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                        Rate %/mo
                      </label>
                      <Input
                        data-testid={`landed-interest-${index}`}
                        type="text"
                        inputMode="decimal"
                        value={entry.interest_rate}
                        onChange={handleNumericInput(updateLandedEntry, 'interest_rate', index)}
                        placeholder="2"
                        className="tap-target"
                      />
                    </div>
                    {formData.landed_entries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeleteEntryConfirm({ type: 'landed', index })}
                        className="self-end sm:mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors tap-target"
                        aria-label="Remove entry"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                  {/* Note toggle / editor */}
                  <div className="mt-2">
                    {!openLandedNote[index] && !((entry.note || '').trim()) ? (
                      <button
                        type="button"
                        data-testid={`landed-note-toggle-${index}`}
                        onClick={() => setOpenLandedNote(o => ({ ...o, [index]: true }))}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                        + Add note
                      </button>
                    ) : (
                      <div className="rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-secondary-ink">Note</label>
                          <button
                            type="button"
                            onClick={() => setRemoveNoteConfirm({ type: 'landed', index })}
                            className="text-[11px] text-muted-ink hover:text-red-600"
                            data-testid={`landed-note-remove-${index}`}
                          >Remove</button>
                        </div>
                        <NoteEditor
                          testId={`landed-note-editor-${index}`}
                          value={entry.note || ''}
                          onChange={(html) => updateLandedEntry(index, 'note', html)}
                          placeholder="e.g. Cash given against gold chain…"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Received Entries */}
        <div className={stepCls(3)}>
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-600" />
                Received Entries (Payments)
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addReceivedEntry} className="self-start sm:self-auto tap-target" data-testid="add-received-btn">
                <Plus className="h-4 w-4 mr-1" />
                Add Payment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {formData.received_entries.length === 0 ? (
              <p className="text-slate-500 text-center py-6">
                No payments added yet. Click "Add Payment" to record received payments.
              </p>
            ) : (
              <div className="space-y-3">
                {formData.received_entries.map((entry, index) => (
                  <div key={index} className="p-3 sm:p-4 bg-blue-50/60 border border-blue-200/60 rounded-xl">
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-start">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                          Received Date <span className="text-danger-ink">*</span>
                        </label>
                        <Input
                          data-testid={`received-date-${index}`}
                          type="date"
                          value={entry.date}
                          onChange={(e) => updateReceivedEntry(index, 'date', e.target.value)}
                          min={formData.opening_date}
                          max={today}
                          className="tap-target"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-secondary-ink uppercase tracking-wider mb-1.5">
                          Amount (₹) <span className="text-danger-ink">*</span>
                        </label>
                        <Input
                          data-testid={`received-amount-${index}`}
                          type="text"
                          inputMode="decimal"
                          value={entry.amount}
                          onChange={handleNumericInput(updateReceivedEntry, 'amount', index)}
                          placeholder="5000"
                          className="tap-target"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteEntryConfirm({ type: 'received', index })}
                        className="self-end sm:mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors tap-target"
                        aria-label="Remove payment"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                    {/* Note toggle / editor */}
                    <div className="mt-2">
                      {!openReceivedNote[index] && !((entry.note || '').trim()) ? (
                        <button
                          type="button"
                          data-testid={`received-note-toggle-${index}`}
                          onClick={() => setOpenReceivedNote(o => ({ ...o, [index]: true }))}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                          + Add note
                        </button>
                      ) : (
                        <div className="rounded-lg">
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-secondary-ink">Note</label>
                            <button
                              type="button"
                              onClick={() => setRemoveNoteConfirm({ type: 'received', index })}
                              className="text-[11px] text-muted-ink hover:text-red-600"
                              data-testid={`received-note-remove-${index}`}
                            >Remove</button>
                          </div>
                          <NoteEditor
                            testId={`received-note-editor-${index}`}
                            value={entry.note || ''}
                            onChange={(html) => updateReceivedEntry(index, 'note', html)}
                            placeholder="e.g. Cash · UPI · partial gold returned…"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Mobile stepper navigation (Prev/Next) */}
        <div className="lg:hidden flex items-center gap-2">
          {mobileStep > 0 ? (
            <Button type="button" variant="outline" onClick={() => setMobileStep(s => s - 1)} className="flex-1 tap-target" data-testid="step-prev">
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Previous
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1 tap-target">
              Cancel
            </Button>
          )}
          {mobileStep < 3 ? (
            <Button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileStep(s => s + 1); }}
              className="flex-1 tap-target"
              data-testid="step-next"
            >
              Next →
            </Button>
          ) : (
            <Button type="submit" disabled={saving} data-testid="save-account-btn-mobile" className="flex-1 tap-target">
              {saving ? <Spinner size="sm" className="text-white" /> : (isEdit ? 'Update' : 'Create')}
            </Button>
          )}
        </div>

        {/* Desktop submit row */}
        <div className="hidden lg:flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} data-testid="save-account-btn">
            {saving ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" className="text-white" />
                Saving...
              </span>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {isEdit ? 'Update Account' : 'Create Account'}
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Image Viewer/Upload Modal */}
      {isEdit && (
        <Modal isOpen={showImageModal} onClose={() => { setShowImageModal(false); closeCamera(); }} title={`Images - ${selectedItemName}`} size="lg">
          <div className="space-y-4">
            {selectedItemImages.length === 0 && !showCamera ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <ImageIcon className="h-12 w-12 mb-3" />
                <p className="text-sm font-medium">No images uploaded yet</p>
                <p className="text-xs mt-1">Upload up to {MAX_IMAGES} images per jewellery item</p>
              </div>
            ) : !showCamera && (
              <div>
                {/* Main image display */}
                <div className="relative bg-slate-100 rounded-xl overflow-hidden" style={{ minHeight: '350px' }}>
                  <img
                    src={getImageUrl(selectedItemImages[currentImageIdx])}
                    alt={`${selectedItemName} - ${currentImageIdx + 1}`}
                    className="w-full h-[350px] object-contain"
                    data-testid="form-main-image"
                  />
                  {selectedItemImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCurrentImageIdx(i => (i - 1 + selectedItemImages.length) % selectedItemImages.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentImageIdx(i => (i + 1) % selectedItemImages.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-black/60 rounded-full text-white text-xs font-medium">
                    {currentImageIdx + 1} / {selectedItemImages.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(selectedItemImages[currentImageIdx].id)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors"
                    title="Delete image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Thumbnails */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                  {selectedItemImages.map((img, i) => (
                    <button key={img.id} type="button" onClick={() => setCurrentImageIdx(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === currentImageIdx ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'
                      }`}
                    >
                      <img src={getImageUrl(img)} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Camera View */}
            {showCamera && (
              <div className="space-y-3">
                <div className="relative bg-black rounded-xl overflow-hidden" style={{ minHeight: '350px' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-[350px] object-contain"
                    data-testid="camera-preview"
                  />
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                    data-testid="cancel-camera-btn"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={uploading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    data-testid="capture-photo-btn"
                  >
                    <Camera className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Capture Photo'}
                  </button>
                </div>
              </div>
            )}

            {/* Upload Section */}
            {!showCamera && selectedItemImages.length < MAX_IMAGES && (
              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-500 mb-3">
                  {MAX_IMAGES - selectedItemImages.length} more image(s) can be added
                </p>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    data-testid="form-upload-device-btn"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Choose from Device'}
                  </button>
                  <button
                    type="button"
                    onClick={openCamera}
                    disabled={uploading}
                    data-testid="form-open-camera-btn"
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Camera className="h-4 w-4" />
                    Open Camera
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Entry Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteEntryConfirm}
        onClose={() => setDeleteEntryConfirm(null)}
        onConfirm={() => {
          if (deleteEntryConfirm) {
            const { type, index } = deleteEntryConfirm;
            if (type === 'jewellery') removeJewelleryItem(index);
            else if (type === 'landed') removeLandedEntry(index);
            else if (type === 'received') removeReceivedEntry(index);
          }
          setDeleteEntryConfirm(null);
        }}
        title="Delete Entry"
        message="Are you sure you want to delete this entry?"
        confirmText="Yes, Delete"
        variant="danger"
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSaveConfirm}
        onClose={() => { setShowSaveConfirm(false); setPendingSubmitEvent(null); }}
        onConfirm={handleConfirmedSave}
        title={isEdit ? 'Confirm Update' : 'Confirm Create'}
        message={isEdit ? 'Are you sure you want to update this entry?' : 'Are you sure you want to create this entry?'}
        confirmText={isEdit ? 'Yes, Update' : 'Yes, Create'}
        variant="warning"
      />

      {/* Confirm note removal */}
      <ConfirmDialog
        isOpen={!!removeNoteConfirm}
        onClose={() => setRemoveNoteConfirm(null)}
        onConfirm={() => {
          if (removeNoteConfirm) {
            const { type, index } = removeNoteConfirm;
            if (type === 'landed') {
              updateLandedEntry(index, 'note', '');
              setOpenLandedNote(o => ({ ...o, [index]: false }));
            } else if (type === 'received') {
              updateReceivedEntry(index, 'note', '');
              setOpenReceivedNote(o => ({ ...o, [index]: false }));
            }
          }
          setRemoveNoteConfirm(null);
        }}
        title="Remove Note"
        message="Are you sure you want to remove this note? This cannot be undone."
        confirmText="Yes, Remove"
        variant="danger"
      />

      {/* Quill Editor Styles */}
      <style>{`
        .quill-wrapper .ql-container { min-height: 100px; border-radius: 0 0 0.5rem 0.5rem; border-color: #cbd5e1; font-size: 0.875rem; }
        .quill-wrapper .ql-toolbar { border-radius: 0.5rem 0.5rem 0 0; border-color: #cbd5e1; background: #f8fafc; }
        .quill-wrapper .ql-editor { min-height: 100px; }
        .quill-wrapper .ql-container:focus-within { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.2); }
      `}</style>
    </div>
  );
}
