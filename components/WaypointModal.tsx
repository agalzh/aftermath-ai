import React, { useEffect, useState } from 'react';
import { WaypointType } from '../types';
import GlassSurface from './GlassSurface';

interface WaypointModalProps {
  isOpen: boolean;
  isEditMode: boolean;
  initialData?: {
    name: string;
    type: WaypointType;
    assignedEmails?: string[];
  };
  onClose: () => void;
  onSave: (data: {
    name: string;
    type: WaypointType;
    assignedEmails: string[];
  }) => void;


  onDelete?: () => void;
}

const WaypointModal: React.FC<WaypointModalProps> = ({
  isOpen,
  isEditMode,
  initialData,
  onClose,
  onSave,
  onDelete
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<WaypointType>(WaypointType.POI);
  const [assignedEmailsInput, setAssignedEmailsInput] = useState('');

  // Populate fields when editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setAssignedEmailsInput(
        initialData.assignedEmails?.join(', ') || ''
      );
    } else {
      setName('');
      setType(WaypointType.POI);
      setAssignedEmailsInput('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const emails = assignedEmailsInput
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
      if(name==""){
        alert("Please input a name")
        return
      }
    console.log('🟢 WaypointModal: Save clicked');
    console.log('🟡 WaypointModal: calling onSave', {
      name,
      type,
      assignedEmails: emails
    });

    onSave({
      name,
      type,
      assignedEmails: emails
    });

  };

return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    
    {/* MODAL CONTAINER */}
    <div className="w-full max-w-md">
      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={24}
        displace={20}
        distortionScale={-120}
        redOffset={2}
        greenOffset={4}
        blueOffset={8}
        brightness={50}
        opacity={0.4}
        mixBlendMode="normal"
        className="shadow-2xl border border-white/5"
      >
        <div className="p-8 w-full">
          
          {/* --- HEADER --- */}
          <div className="mb-2 border-b border-white/5 pb-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {isEditMode ? 'Edit Waypoint' : 'Create Waypoint'}
            </h2>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em] mt-2">
              Configuration
            </p>
          </div>

          {/* --- FORM FIELDS --- */}
          <div className="space-y-2">
            
            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                Designation
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Gate"
                className="w-full bg-black/20 border border-white/10 text-zinc-100 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-white/30 transition-colors placeholder-zinc-700 font-light"
              />
            </div>

            {/* Type Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                Category
              </label>
              <div className="relative group">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as WaypointType)}
                  className="w-full bg-black/20 border border-white/10 text-zinc-100 text-sm px-4 py-3 rounded-xl appearance-none focus:outline-none focus:border-white/30 transition-colors cursor-pointer"
                >
                  {Object.values(WaypointType).map((t) => (
                    <option key={t} value={t} className="bg-[#09090b] text-zinc-300">
                      {t}
                    </option>
                  ))}
                </select>
                {/* Custom Arrow */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-600 group-hover:text-zinc-400 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            {/* Assigned Volunteers */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] ml-1">
                Assignments
              </label>
              <input
                type="text"
                value={assignedEmailsInput}
                onChange={(e) => setAssignedEmailsInput(e.target.value)}
                placeholder="email@domain.com, ..."
                className="w-full bg-black/20 border border-white/10 text-zinc-100 text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-white/30 transition-colors placeholder-zinc-700 font-light"
              />
              <p className="text-[13px] text-gray-500 ml-1">
                Separate multiple IDs with commas
              </p>
            </div>

          </div>

          {/* --- ACTIONS --- */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
            <div>
              {isEditMode && onDelete && (
                <button
                  onClick={onDelete}
                  className="text-[10px] font-bold text-red-900 hover:text-red-500 transition-colors uppercase tracking-widest px-2 py-2"
                >
                  Delete
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="bg-zinc-100 hover:bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all"
              >
                Save
              </button>
            </div>
          </div>

        </div>
      </GlassSurface>
    </div>
  </div>
);
};

export default WaypointModal;
