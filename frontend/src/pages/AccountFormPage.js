import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Gem, TrendingUp, TrendingDown, Save } from 'lucide-react';

export default function AccountFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    opening_date: new Date().toISOString().split('T')[0],
    name: '',
    village: '',
    status: 'continue',
    details: '',
    jewellery_items: [{ name: '', weight: '' }],
    landed_entries: [{ date: new Date().toISOString().split('T')[0], amount: '', interest_rate: '2' }],
    received_entries: []
  });

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
          ? account.jewellery_items 
          : [{ name: '', weight: '' }],
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

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (!formData.village.trim()) {
      toast.error('Village is required');
      return false;
    }
    if (!formData.opening_date) {
      toast.error('Opening date is required');
      return false;
    }

    // Validate jewellery items
    const validJewellery = formData.jewellery_items.filter(
      item => item.name.trim() && parseFloat(item.weight) > 0
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
      // Filter out empty entries
      const payload = {
        ...formData,
        jewellery_items: formData.jewellery_items
          .filter(item => item.name.trim() && parseFloat(item.weight) > 0)
          .map(item => ({ name: item.name, weight: parseFloat(item.weight) })),
        landed_entries: formData.landed_entries
          .filter(entry => entry.date && parseFloat(entry.amount) > 0)
          .map(entry => ({
            date: entry.date,
            amount: parseFloat(entry.amount),
            interest_rate: parseFloat(entry.interest_rate) || 2
          })),
        received_entries: formData.received_entries
          .filter(entry => entry.date && parseFloat(entry.amount) > 0)
          .map(entry => ({
            date: entry.date,
            amount: parseFloat(entry.amount)
          }))
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
    </div>
  );
}
