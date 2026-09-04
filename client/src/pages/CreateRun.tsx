import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Rocket, ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { runsApi } from '../services/api';

export const CreateRun: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    partNumber: 'HMC-SPACE-9021',
    manufacturer: 'Semi-Conductor Laboratory (SCL) / ISRO',
    dateCode: '2614-PID-09',
    specReference: 'ISRO-PAS-206 Rev D / MIL-STD-883K Method 1015',
    quantity: 200,
    speedMultiplier: 60,
    anomalyRate: 0.05
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Lot
      const lot = await runsApi.createLot({
        partNumber: formData.partNumber,
        manufacturer: formData.manufacturer,
        dateCode: formData.dateCode,
        specReference: formData.specReference,
        quantity: formData.quantity
      });

      // 2. Create Run with the Lot
      const run = await runsApi.createRun({
        lotId: lot.id,
        speedMultiplier: formData.speedMultiplier,
        anomalyRate: formData.anomalyRate,
        deviceCount: formData.quantity
      });

      // 3. Navigate to live monitor
      navigate(`/runs/${run.id}`);
    } catch (err) {
      console.error('Failed to create run:', err);
      alert('Failed to create burn-in run');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Console
      </button>

      <div className="bg-space-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyber-cyan" />
            <h1 className="text-lg font-bold text-white uppercase tracking-wider">
              Initialize New Burn-In Qualification Run
            </h1>
          </div>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Capture lot traceability metadata and configure synthetic DAQ ingestion bus
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5">PART NUMBER *</label>
              <input
                type="text"
                required
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5">MANUFACTURER *</label>
              <input
                type="text"
                required
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 mb-1.5">DATE CODE / LOT ID</label>
              <input
                type="text"
                value={formData.dateCode}
                onChange={(e) => setFormData({ ...formData, dateCode: e.target.value })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5">SPECIFICATION REFERENCE</label>
              <input
                type="text"
                value={formData.specReference}
                onChange={(e) => setFormData({ ...formData, specReference: e.target.value })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-slate-300 mb-1.5">DUT QUANTITY</label>
              <input
                type="number"
                min="1"
                max="500"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 200 })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5">SPEED MULTIPLIER</label>
              <select
                value={formData.speedMultiplier}
                onChange={(e) => setFormData({ ...formData, speedMultiplier: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              >
                <option value={1}>1x (Real-time)</option>
                <option value={30}>30x (2 min demo)</option>
                <option value={60}>60x (1 min demo)</option>
                <option value={120}>120x (Turbo demo)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 mb-1.5">ANOMALY INJECTION</label>
              <select
                value={formData.anomalyRate}
                onChange={(e) => setFormData({ ...formData, anomalyRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 bg-space-850 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-cyber-cyan font-mono"
              >
                <option value={0.05}>5% (ISRO Standard)</option>
                <option value={0.10}>10% (High Stress)</option>
                <option value={0.0}>0% (Healthy Baseline)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-cyber-cyan to-blue-600 text-space-950 font-bold text-sm shadow-cyan-glow hover:opacity-95 transition-all flex items-center justify-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              {loading ? 'Registering Lot & Initializing DUTs...' : 'Register Lot & Start Monitoring'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
