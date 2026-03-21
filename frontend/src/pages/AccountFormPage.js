import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Gem, TrendingUp, TrendingDown, Save,
  Image as ImageIcon, Upload, Camera, X, ChevronLeft, ChevronRight
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

  const [formData, setFormData] = useState({
    opening_date: today,
    name: '',
    village: '',
    status: 'continue',
    details: '',
    jewellery_items: [{ name: '', weight: '' }],
    landed_entries: [{ date: today, amount: '', interest_rate: '2' }],
    received_entries: []
  });

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
          ? account.landed_entries 
          : [{ date: '', amount: '', interest_rate: '2' }],
        received_entries: account.received_entries || []
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
      landed_entries: [...prev.landed_entries, { date: new Date().toISOString().split('T')[0], amount: '', interest_rate: '2' }]
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
      received_entries: [...prev.received_entries, { date: new Date().toISOString().split('T')[0], amount: '' }]
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
    setSelectedItemIndex(index);
    setSelectedItemImages(item.images || []);
    setSelectedItemName(item.name || `Item ${index + 1}`);
    setCurrentImageIdx(0);
    setShowImageModal(true);
  };

  const getImageUrl = (image) => {
    const token = localStorage.getItem('token');
    return `${process.env.REACT_APP_BACKEND_URL}/api/files/${image.storage_path}?auth=${token}`;
  };

  const uploadFileToServer = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/api/accounts/${id}/jewellery/${selectedItemIndex}/images`, fd, {
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

    const currentImages = formData.jewellery_items[selectedItemIndex]?.images || [];
    const remaining = MAX_IMAGES - currentImages.length;
    if (remaining <= 0) { toast.error('Maximum 5 images per item'); return; }

    const filesToUpload = files.slice(0, remaining);
    setUploading(true);

    for (const file of filesToUpload) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name}: Too large (max 10MB)`); continue; }
      await uploadFileToServer(file);
    }

    setUploading(false);
    toast.success('Images uploaded');
    await refreshImagesAfterUpload();
    if (e.target) e.target.value = '';
  };

  const handleDeleteImage = async (imageId) => {
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
      setUploading(true);
      closeCamera();
      const success = await uploadFileToServer(file);
      setUploading(false);
      if (success) {
        toast.success('Photo captured and uploaded');
        await refreshImagesAfterUpload();
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
    if (!validateForm()) return;

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
          // Preserve existing calculated fields during edit
          remaining_principal: entry.remaining_principal !== undefined ? parseFloat(entry.remaining_principal) : parseFloat(entry.amount),
          last_interest_calc_date: entry.last_interest_calc_date || entry.date,
          accumulated_interest: entry.accumulated_interest !== undefined ? parseFloat(entry.accumulated_interest) : 0
        }));
      
      const received_entries = formData.received_entries
        .filter(entry => entry.date && parseFloat(entry.amount) > 0)
        .map(entry => ({
          date: entry.date,
          amount: parseFloat(entry.amount),
          // Preserve existing calculated fields during edit
          principal_paid: entry.principal_paid !== undefined ? parseFloat(entry.principal_paid) : 0,
          interest_paid: entry.interest_paid !== undefined ? parseFloat(entry.interest_paid) : 0
        }));

      const payload = {
        opening_date: formData.opening_date,
        name: formData.name,
        village: formData.village,
        status: formData.status,
        details: formData.details,
        jewellery_items,
        landed_entries,
        received_entries
      };

      if (isEdit) {
        await api.put(`/api/accounts/${id}`, payload);
        toast.success('Account updated successfully');
      } else {
        const response = await api.post('/api/accounts', payload);
        toast.success('Account created successfully');
        navigate(`/accounts/${response.data.id}`);
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

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900">
            {isEdit ? 'Edit Account' : 'New Account'}
          </h1>
          <p className="text-slate-500 mt-1">
            {isEdit ? 'Update account details' : 'Create a new lending account'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Account Opening Date *
                </label>
                <Input
                  data-testid="opening-date"
                  type="date"
                  name="opening_date"
                  value={formData.opening_date}
                  onChange={handleChange}
                  max={today}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status *
                </label>
                <Select
                  data-testid="status-select"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="continue">Continue</option>
                  <option value="closed">Closed</option>
                  <option value="renewed">Renewed</option>
                  <option value="immediate action needed">Immediate Action Needed</option>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name *
                </label>
                <Input
                  data-testid="name-input"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Customer name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Village *
                </label>
                <Input
                  data-testid="village-input"
                  type="text"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  placeholder="Village name"
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notes / Details
                </label>
                <textarea
                  data-testid="details-input"
                  name="details"
                  value={formData.details}
                  onChange={handleChange}
                  rows={3}
                  className="flex w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jewellery Items */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Gem className="h-5 w-5 text-amber-500" />
                Jewellery Items
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addJewelleryItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formData.jewellery_items.map((item, index) => (
                <div key={index} className="flex gap-4 items-start p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Item Name *
                    </label>
                    <Input
                      data-testid={`jewellery-name-${index}`}
                      type="text"
                      value={item.name}
                      onChange={(e) => updateJewelleryItem(index, 'name', e.target.value)}
                      placeholder="e.g., Gold Ring"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Weight (g) *
                    </label>
                    <Input
                      data-testid={`jewellery-weight-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.weight}
                      onChange={(e) => updateJewelleryItem(index, 'weight', e.target.value)}
                      placeholder="10.5"
                    />
                  </div>
                  {/* Image upload button - only in edit mode */}
                  {isEdit && (
                    <div className="w-24">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Images
                      </label>
                      <button
                        type="button"
                        onClick={() => openImageModal(item, index)}
                        data-testid={`jewellery-images-${index}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors border border-emerald-200 w-full justify-center"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {item.images?.length || 0} / {MAX_IMAGES}
                      </button>
                    </div>
                  )}
                  {formData.jewellery_items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeJewelleryItem(index)}
                      className="mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
              {!isEdit && (
                <p className="text-xs text-slate-400 italic mt-2">
                  Images can be uploaded after saving the account.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Landed Entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Landed Entries (Money Lent)
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addLandedEntry}>
                <Plus className="h-4 w-4 mr-1" />
                Add Entry
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {formData.landed_entries.map((entry, index) => (
                <div key={index} className="flex gap-4 items-start p-4 bg-emerald-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Landed Date *
                    </label>
                    <Input
                      data-testid={`landed-date-${index}`}
                      type="date"
                      value={entry.date}
                      onChange={(e) => updateLandedEntry(index, 'date', e.target.value)}
                      min={formData.opening_date}
                      max={today}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Amount (₹) *
                    </label>
                    <Input
                      data-testid={`landed-amount-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.amount}
                      onChange={(e) => updateLandedEntry(index, 'amount', e.target.value)}
                      placeholder="10000"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      Interest % (Monthly)
                    </label>
                    <Input
                      data-testid={`landed-interest-${index}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={entry.interest_rate}
                      onChange={(e) => updateLandedEntry(index, 'interest_rate', e.target.value)}
                      placeholder="2"
                    />
                  </div>
                  {formData.landed_entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLandedEntry(index)}
                      className="mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Received Entries */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-blue-600" />
                Received Entries (Payments)
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addReceivedEntry}>
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
                  <div key={index} className="flex gap-4 items-start p-4 bg-blue-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Received Date *
                      </label>
                      <Input
                        data-testid={`received-date-${index}`}
                        type="date"
                        value={entry.date}
                        onChange={(e) => updateReceivedEntry(index, 'date', e.target.value)}
                        min={formData.opening_date}
                        max={today}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-500 mb-1">
                        Amount (₹) *
                      </label>
                      <Input
                        data-testid={`received-amount-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.amount}
                        onChange={(e) => updateReceivedEntry(index, 'amount', e.target.value)}
                        placeholder="5000"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeReceivedEntry(index)}
                      className="mt-6 p-2 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
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
    </div>
  );
}
