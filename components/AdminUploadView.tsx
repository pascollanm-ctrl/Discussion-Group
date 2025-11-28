import React, { useState } from 'react';
import { db, COLLECTIONS, auth, serverTimestamp } from '../services/firebase';
import { UNIT_MAP, RESOURCE_TYPE_MAP } from '../types';
import { Upload, CheckCircle, AlertCircle, Trash2, Plus, FileUp, List, Loader2 } from 'lucide-react';

interface QueuedResource {
    id: string;
    unit: string;
    type: string;
    title: string;
    data: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
}

export const AdminUploadView: React.FC = () => {
    // Global Settings for the current batch
    const [unit, setUnit] = useState('');
    const [type, setType] = useState('');

    // Manual Input State
    const [manualTitle, setManualTitle] = useState('');
    const [manualData, setManualData] = useState('');

    // Queue State
    const [queue, setQueue] = useState<QueuedResource[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isGlobalUploading, setIsGlobalUploading] = useState(false);

    const addToQueue = (newItem: Omit<QueuedResource, 'id' | 'status'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        setQueue(prev => [...prev, { ...newItem, id, status: 'pending' }]);
    };

    const handleManualAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!unit || !type || !manualTitle || !manualData) {
            alert("Please fill in all fields (Unit, Type, Title, Content)");
            return;
        }
        addToQueue({ unit, type, title: manualTitle, data: manualData });
        setManualTitle('');
        setManualData('');
    };

    const handleRemove = (id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (!unit || !type) {
            alert("Please select a Unit and Resource Type before dropping files.");
            return;
        }

        const files = Array.from(e.dataTransfer.files) as File[];
        let count = 0;

        for (const file of files) {
            try {
                // Simple text file reading. 
                // In a real app, might want to handle PDFs by uploading to storage and getting a URL.
                // Here we assume text-based resources or we simply use the filename and empty content if binary?
                // Let's try to read as text. If it fails or is binary, we might just put a placeholder.
                
                if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.json') || file.name.endsWith('.js') || file.name.endsWith('.ts')) {
                    const text = await file.text();
                    addToQueue({
                        unit,
                        type,
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        data: text
                    });
                    count++;
                } else {
                    // For non-text files, we can't easily inline the data. 
                    // We'll skip or alert.
                    // For now, let's allow it but warn in the data field.
                    addToQueue({
                        unit,
                        type,
                        title: file.name,
                        data: `[Binary File - Content not extracted automatically. Please replace with URL or Text]`
                    });
                    count++;
                }
            } catch (err) {
                console.error("Error reading file", file.name, err);
            }
        }
    };

    const handleUploadAll = async () => {
        setIsGlobalUploading(true);
        const pendingItems = queue.filter(item => item.status === 'pending' || item.status === 'error');
        
        for (const item of pendingItems) {
            // Update status to uploading
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

            try {
                await db.collection(COLLECTIONS.resources).add({
                    unit: item.unit,
                    type: item.type,
                    title: item.title,
                    data: item.data,
                    uploadedBy: auth.currentUser?.email,
                    timestamp: serverTimestamp()
                });
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
            } catch (err: any) {
                console.error(err);
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message } : q));
            }
        }
        setIsGlobalUploading(false);
    };

    const clearSuccess = () => {
        setQueue(prev => prev.filter(item => item.status !== 'success'));
    };

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Batch Upload Resources</h2>
                <p className="text-slate-500">Add multiple resources to the queue and upload them at once.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* LEFT COLUMN: Input Form */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-accent flex items-center justify-center mr-3">1</span>
                            Configure Batch Defaults
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Academic Unit</label>
                                <select
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                                >
                                    <option value="">Select Unit...</option>
                                    {Object.entries(UNIT_MAP).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Resource Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all"
                                >
                                    <option value="">Select Type...</option>
                                    {Object.entries(RESOURCE_TYPE_MAP).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className={`bg-white p-6 rounded-2xl shadow-sm border-2 transition-all ${isDragging ? 'border-accent bg-blue-50/50 border-dashed' : 'border-slate-100'}`}
                         onDragOver={handleDragOver}
                         onDragLeave={handleDragLeave}
                         onDrop={handleDrop}
                    >
                         <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-accent flex items-center justify-center mr-3">2</span>
                            Add Content
                        </h3>
                        
                        {/* Drag Drop Area Visual */}
                        <div className="mb-6 p-8 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center bg-slate-50/50">
                            <FileUp className={`w-12 h-12 mb-3 ${isDragging ? 'text-accent' : 'text-slate-300'}`} />
                            <p className="text-slate-600 font-medium">Drag & Drop text files here</p>
                            <p className="text-xs text-slate-400 mt-1">Files will be added to queue using selected Unit & Type</p>
                        </div>

                        <div className="relative flex items-center justify-center mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-100"></div>
                            </div>
                            <span className="relative bg-white px-3 text-sm text-slate-400">OR add manually</span>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                value={manualTitle}
                                onChange={(e) => setManualTitle(e.target.value)}
                                placeholder="Resource Title"
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                            />
                            <textarea
                                value={manualData}
                                onChange={(e) => setManualData(e.target.value)}
                                placeholder="Paste content or URL here..."
                                rows={3}
                                className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
                            />
                            <button
                                onClick={handleManualAdd}
                                className="w-full py-3 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors flex items-center justify-center"
                            >
                                <Plus size={18} className="mr-2" /> Add to Queue
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: Queue */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[600px]">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
                        <div className="flex items-center">
                            <List className="text-slate-400 mr-3" />
                            <h3 className="font-bold text-slate-800">Upload Queue ({queue.length})</h3>
                        </div>
                        {queue.some(i => i.status === 'success') && (
                            <button 
                                onClick={clearSuccess} 
                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                                Clear Completed
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {queue.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <List size={48} className="mb-4 opacity-20" />
                                <p>Queue is empty</p>
                                <p className="text-sm">Add items from the left panel</p>
                            </div>
                        ) : (
                            queue.map((item) => (
                                <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center group hover:border-accent/30 transition-colors shadow-sm">
                                    <div className="mr-4">
                                        {item.status === 'pending' && <div className="w-2 h-2 rounded-full bg-slate-300" />}
                                        {item.status === 'uploading' && <Loader2 size={16} className="animate-spin text-accent" />}
                                        {item.status === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
                                        {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 truncate">{item.title}</h4>
                                        <div className="flex items-center text-xs text-slate-500 mt-1 space-x-2">
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 truncate max-w-[100px]">{UNIT_MAP[item.unit]}</span>
                                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 truncate max-w-[100px]">{RESOURCE_TYPE_MAP[item.type]}</span>
                                        </div>
                                        {item.error && <p className="text-xs text-red-500 mt-1">{item.error}</p>}
                                    </div>
                                    <button 
                                        onClick={() => handleRemove(item.id)}
                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-2"
                                        disabled={item.status === 'uploading' || item.status === 'success'}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                        <button
                            onClick={handleUploadAll}
                            disabled={queue.length === 0 || isGlobalUploading}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center ${
                                queue.length === 0 
                                    ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                                    : isGlobalUploading 
                                        ? 'bg-accent cursor-wait'
                                        : 'bg-accent hover:bg-blue-600 shadow-blue-500/20 active:scale-[0.99]'
                            }`}
                        >
                            {isGlobalUploading ? (
                                <><Loader2 size={20} className="animate-spin mr-2" /> Uploading...</>
                            ) : (
                                <><Upload size={20} className="mr-2" /> Upload {queue.filter(i => i.status === 'pending').length} Items</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};