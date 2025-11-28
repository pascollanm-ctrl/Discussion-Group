import React, { useState, useRef, useEffect } from 'react';
import { db, COLLECTIONS, User } from '../services/firebase';
import { generateStudyGuide, generateTTS } from '../services/gemini';
import { Resource, UNIT_MAP, RESOURCE_TYPE_MAP } from '../types';
import { FileText, Link as LinkIcon, Sparkles, Trash2, ArrowLeft, ChevronRight, GraduationCap, ExternalLink, Box, Search, X, Volume2, StopCircle, Loader2 } from 'lucide-react';

interface ResourceViewProps {
    user: User | null;
    isAdmin: boolean;
}

export const ResourceView: React.FC<ResourceViewProps> = ({ isAdmin }) => {
    const [step, setStep] = useState<'unit' | 'type' | 'list' | 'search'>('unit');
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');

    // AI State
    const [generatingId, setGeneratingId] = useState<string | null>(null);
    const [aiOutput, setAiOutput] = useState<{ id: string, text: string, sources: any[] } | null>(null);

    // TTS State
    const [playingResourceId, setPlayingResourceId] = useState<string | null>(null);
    const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
    const [audioCache, setAudioCache] = useState<Record<string, string>>({});
    const currentAudioRef = useRef<HTMLAudioElement | null>(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause();
                currentAudioRef.current = null;
            }
        };
    }, []);

    const fetchResources = async (unit: string, type: string) => {
        setLoading(true);
        try {
            const snapshot = await db.collection(COLLECTIONS.resources)
                .where("unit", "==", unit)
                .where("type", "==", type)
                .get();
                
            const items: Resource[] = [];
            snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Resource));
            setResources(items.sort((a, b) => a.title.localeCompare(b.title)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const performSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setStep('search');
        setAiOutput(null); // Clear AI output on new search

        try {
            // For this app scale, we'll fetch all and filter. 
            // In a production app with thousands of records, we'd use a dedicated search service (e.g., Algolia) or specific Firestore queries.
            const snapshot = await db.collection(COLLECTIONS.resources).get();
            const items: Resource[] = [];
            snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() } as Resource));
            
            const lowerQ = searchQuery.toLowerCase();
            const results = items.filter(item => 
                item.title.toLowerCase().includes(lowerQ) || 
                item.data.toLowerCase().includes(lowerQ)
            );
            
            setResources(results);
        } catch (error) {
            console.error("Search error", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUnitSelect = (unitKey: string) => {
        setSelectedUnit(unitKey);
        setStep('type');
        setSearchQuery('');
    };

    const handleTypeSelect = (typeKey: string) => {
        setSelectedType(typeKey);
        setStep('list');
        fetchResources(selectedUnit, typeKey);
    };

    const handleBack = () => {
        // Stop audio when navigating back
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
            setPlayingResourceId(null);
        }

        if (step === 'search') {
            setStep('unit');
            setSearchQuery('');
            setResources([]);
        }
        else if (step === 'list') setStep('type');
        else if (step === 'type') setStep('unit');
        setAiOutput(null);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!isAdmin || !window.confirm('Delete resource?')) return;
        try {
            await db.collection(COLLECTIONS.resources).doc(id).delete();
            setResources(prev => prev.filter(r => r.id !== id));
        } catch (err) { console.error(err); }
    };

    const handleGenerateGuide = async (e: React.MouseEvent, resource: Resource) => {
        e.stopPropagation();
        setGeneratingId(resource.id);
        setAiOutput(null);
        
        const content = `Title: ${resource.title}\nContent:\n${resource.data}`;
        const { text, sources } = await generateStudyGuide(content);
        
        setAiOutput({ id: resource.id, text, sources });
        setGeneratingId(null);
    };

    const handleStopTTS = () => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current.currentTime = 0;
            currentAudioRef.current = null;
        }
        setPlayingResourceId(null);
    };

    const handlePlayTTS = async (e: React.MouseEvent, resource: Resource) => {
        e.stopPropagation();

        // If currently playing this resource, stop it.
        if (playingResourceId === resource.id) {
            handleStopTTS();
            return;
        }

        // If playing another resource, stop that first.
        if (currentAudioRef.current) {
            handleStopTTS();
        }

        // Check cache
        if (audioCache[resource.id]) {
            const audio = new Audio(audioCache[resource.id]);
            currentAudioRef.current = audio;
            setPlayingResourceId(resource.id);
            audio.play();
            audio.onended = () => {
                setPlayingResourceId(null);
                currentAudioRef.current = null;
            };
            audio.onerror = () => {
                setPlayingResourceId(null);
                currentAudioRef.current = null;
                alert("Error playing audio.");
            };
            return;
        }

        setGeneratingAudioId(resource.id);
        
        const { audioUrl, error } = await generateTTS(resource.data);
        
        setGeneratingAudioId(null);

        if (audioUrl) {
            setAudioCache(prev => ({ ...prev, [resource.id]: audioUrl }));
            const audio = new Audio(audioUrl);
            currentAudioRef.current = audio;
            setPlayingResourceId(resource.id);
            audio.play();
            audio.onended = () => {
                setPlayingResourceId(null);
                currentAudioRef.current = null;
            };
            audio.onerror = () => {
                setPlayingResourceId(null);
                currentAudioRef.current = null;
                alert("Error playing generated audio.");
            };
        } else {
            alert(`TTS Error: ${error}`);
        }
    };

    const renderMarkdown = (text: string) => {
        const html = text
            .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold text-ai mt-4 mb-2">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-ai mt-5 mb-3">$1</h2>')
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc marker:text-ai">$1</li>')
            .replace(/\n/gim, '<br />');
        return <div dangerouslySetInnerHTML={{ __html: html }} className="text-slate-700 leading-relaxed" />;
    };

    return (
        <div className="max-w-5xl mx-auto min-h-[600px]">
            {/* Top Bar: Search and Breadcrumbs */}
            <div className="flex flex-col-reverse md:flex-row md:items-center justify-between gap-4 mb-8">
                {/* Breadcrumbs */}
                <div className="flex items-center px-1 overflow-x-auto whitespace-nowrap">
                     <button 
                        onClick={() => { setStep('unit'); setSearchQuery(''); }} 
                        className={`text-sm font-medium transition-colors ${step === 'unit' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        Units
                    </button>
                    {step !== 'unit' && step !== 'search' && (
                        <>
                            <ChevronRight size={14} className="mx-2 text-slate-300 flex-shrink-0" />
                            <span className={`text-sm font-medium ${step === 'type' ? 'text-slate-900' : 'text-slate-400'}`}>
                                {UNIT_MAP[selectedUnit]}
                            </span>
                        </>
                    )}
                    {step === 'list' && (
                        <>
                            <ChevronRight size={14} className="mx-2 text-slate-300 flex-shrink-0" />
                            <span className="text-sm font-medium text-slate-900 bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                {RESOURCE_TYPE_MAP[selectedType]}
                            </span>
                        </>
                    )}
                    {step === 'search' && (
                        <>
                            <ChevronRight size={14} className="mx-2 text-slate-300 flex-shrink-0" />
                            <span className="text-sm font-medium text-slate-900 bg-primary/10 text-primary px-2 py-0.5 rounded-md flex items-center">
                                <Search size={12} className="mr-1" /> Search Results
                            </span>
                        </>
                    )}
                </div>

                {/* Search Bar */}
                <form onSubmit={performSearch} className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search title or content..."
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm text-sm"
                    />
                    {searchQuery && (
                        <button 
                            type="button"
                            onClick={() => { setSearchQuery(''); if(step === 'search') handleBack(); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </form>
            </div>

            {/* Step 1: Unit Selection */}
            {step === 'unit' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-3xl font-bold text-slate-800 mb-2">Academic Units</h2>
                    <p className="text-slate-500 mb-8">Select a unit to access materials.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Object.entries(UNIT_MAP).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => handleUnitSelect(key)}
                                className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 hover:border-primary/50 hover:shadow-[0_8px_24px_rgba(16,185,129,0.1)] transition-all group text-left h-full flex flex-col items-start"
                            >
                                <div className="bg-emerald-50 text-primary w-14 h-14 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                    <GraduationCap size={28} />
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-primary transition-colors">{label}</h3>
                                <p className="text-slate-400 text-sm">Access unit resources</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 2: Type Selection */}
            {step === 'type' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <button onClick={handleBack} className="mb-6 flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors group">
                        <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" /> Back
                    </button>
                    <h2 className="text-3xl font-bold text-slate-800 mb-8">
                        {UNIT_MAP[selectedUnit]} <span className="text-slate-300 font-light">/</span> Resources
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {Object.entries(RESOURCE_TYPE_MAP).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => handleTypeSelect(key)}
                                className="bg-white p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 hover:border-accent/50 hover:shadow-[0_8px_24px_rgba(59,130,246,0.1)] transition-all group flex items-center"
                            >
                                <div className="bg-blue-50 text-accent p-4 rounded-xl mr-5 group-hover:bg-accent group-hover:text-white transition-all duration-300">
                                    {key === 'learning-materials' ? <LinkIcon size={24} /> : 
                                     key === 'objectives' ? <Box size={24} /> :
                                     <FileText size={24} />}
                                </div>
                                <div className="text-left">
                                    <span className="text-lg font-bold text-slate-800 block group-hover:text-accent transition-colors">{label}</span>
                                    <span className="text-sm text-slate-400">View materials</span>
                                </div>
                                <ChevronRight className="ml-auto text-slate-300 group-hover:text-accent group-hover:translate-x-1 transition-all" />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Step 3: Resource List OR Search Results */}
            {(step === 'list' || step === 'search') && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <button onClick={handleBack} className="mb-6 flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors group">
                        <ArrowLeft size={16} className="mr-1 group-hover:-translate-x-1 transition-transform" /> Back
                    </button>

                    <div className="flex items-end justify-between mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-800 mb-2">
                                {step === 'search' ? `Search Results: "${searchQuery}"` : RESOURCE_TYPE_MAP[selectedType]}
                            </h2>
                            <p className="text-slate-500">
                                {step === 'search' 
                                    ? `Found ${resources.length} matching resources` 
                                    : `Browsing materials for ${UNIT_MAP[selectedUnit]}`
                                }
                            </p>
                        </div>
                    </div>
                    
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-4"></div>
                            Loading...
                        </div>
                    ) : resources.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200">
                            <div className="text-slate-300 mb-3">
                                {step === 'search' ? <Search size={48} className="mx-auto" /> : <Box size={48} className="mx-auto" />}
                            </div>
                            <h3 className="text-slate-600 font-medium">{step === 'search' ? 'No matches found' : 'No resources found'}</h3>
                            <p className="text-slate-400 text-sm">{step === 'search' ? 'Try different keywords.' : 'Check back later or try another category.'}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {resources.map((res) => {
                                const isLink = res.type === 'learning-materials';
                                return (
                                    <div 
                                        key={res.id} 
                                        onClick={() => isLink ? window.open(res.data, '_blank') : null}
                                        className={`bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all duration-300 relative
                                            ${isLink 
                                                ? 'cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.06)] hover:border-accent/30 hover:-translate-y-1 group' 
                                                : 'shadow-[0_2px_4px_rgba(0,0,0,0.02)]'
                                            }
                                        `}
                                    >
                                        <div className="p-6 sm:p-8">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-3 mb-3">
                                                        <div className={`p-2 rounded-lg flex-shrink-0 ${isLink ? 'bg-blue-50 text-accent group-hover:bg-accent group-hover:text-white transition-colors' : 'bg-slate-100 text-slate-500'}`}>
                                                             {isLink ? <LinkIcon size={20} /> : <FileText size={20} />}
                                                        </div>
                                                        <h4 className={`text-xl font-bold truncate ${isLink ? 'text-slate-800 group-hover:text-accent transition-colors' : 'text-slate-800'}`}>
                                                            {res.title}
                                                        </h4>
                                                        
                                                        {/* Show badges if in search mode */}
                                                        {step === 'search' && (
                                                            <div className="flex gap-2">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                                    {UNIT_MAP[res.unit] || res.unit}
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                                                                    {RESOURCE_TYPE_MAP[res.type] || res.type}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {isLink ? (
                                                        <div className="flex items-center text-sm text-slate-500 mt-2 pl-1">
                                                            <span className="bg-slate-50 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-100 group-hover:bg-accent/5 group-hover:text-accent group-hover:border-accent/20 transition-colors flex items-center">
                                                                Open External Resource <ExternalLink size={12} className="ml-2" />
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                                                            <div className="whitespace-pre-wrap line-clamp-4">{res.data}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {isAdmin && (
                                                    <button 
                                                        onClick={(e) => handleDelete(e, res.id)} 
                                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors z-10"
                                                        title="Delete Resource"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* AI Features for Text Content */}
                                            {!isLink && (
                                                <div className="mt-5 pt-4 border-t border-slate-50 flex flex-wrap gap-3">
                                                    <button
                                                        onClick={(e) => handleGenerateGuide(e, res)}
                                                        disabled={generatingId === res.id}
                                                        className="flex items-center text-sm font-semibold text-ai hover:text-violet-700 bg-ai/5 hover:bg-ai/10 px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        {generatingId === res.id ? (
                                                            <span className="flex items-center"><div className="w-3 h-3 border-2 border-ai border-t-transparent rounded-full animate-spin mr-2"></div>Generating Guide...</span>
                                                        ) : (
                                                            <><Sparkles size={16} className="mr-2" /> Generate Study Guide</>
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={(e) => handlePlayTTS(e, res)}
                                                        disabled={generatingAudioId === res.id}
                                                        className={`flex items-center text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                                                            playingResourceId === res.id 
                                                                ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                                                : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                                                        }`}
                                                    >
                                                        {generatingAudioId === res.id ? (
                                                            <span className="flex items-center"><Loader2 size={16} className="animate-spin mr-2" /> Generating Audio...</span>
                                                        ) : playingResourceId === res.id ? (
                                                            <><StopCircle size={16} className="mr-2" /> Stop Reading</>
                                                        ) : (
                                                            <><Volume2 size={16} className="mr-2" /> Read Aloud</>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* AI Output Area */}
                                        {aiOutput && aiOutput.id === res.id && (
                                            <div className="bg-[#fcfaff] px-8 py-6 border-t border-violet-100 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="flex items-center mb-4 text-ai font-bold text-sm uppercase tracking-wide">
                                                    <Sparkles size={16} className="mr-2" /> AI Generated Guide
                                                </div>
                                                <div className="prose prose-slate prose-headings:text-slate-800 prose-p:text-slate-600 max-w-none mb-6">
                                                    {renderMarkdown(aiOutput.text)}
                                                </div>
                                                {aiOutput.sources && aiOutput.sources.length > 0 && (
                                                    <div className="text-xs text-slate-400 border-t border-violet-100 pt-3">
                                                        <p className="font-semibold mb-1 text-slate-500">Sources:</p>
                                                        <ul className="flex flex-wrap gap-2">
                                                            {aiOutput.sources.map((chunk: any, i: number) => (
                                                                 <li key={i}>
                                                                     {chunk.web && (
                                                                         <a href={chunk.web.uri} target="_blank" className="hover:underline hover:text-ai transition-colors bg-white border border-slate-100 px-2 py-1 rounded-md inline-block">
                                                                            {chunk.web.title}
                                                                         </a>
                                                                     )}
                                                                 </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};