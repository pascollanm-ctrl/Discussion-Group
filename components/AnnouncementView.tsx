import React, { useState, useEffect } from 'react';
import { db, COLLECTIONS, User, serverTimestamp } from '../services/firebase';
import { generateTTS } from '../services/gemini';
import { Announcement } from '../types';
import { Trash2, Megaphone, Play, Loader2, Calendar, Bell } from 'lucide-react';

interface AnnouncementViewProps {
    user: User | null;
    isAdmin: boolean;
}

export const AnnouncementView: React.FC<AnnouncementViewProps> = ({ isAdmin }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [audioMap, setAudioMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const unsubscribe = db.collection(COLLECTIONS.announcements)
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                const items: Announcement[] = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as Announcement);
                });
                setAnnouncements(items);
            }, (error) => {
                console.error("Access denied or error fetching announcements:", error);
            });
        return () => unsubscribe();
    }, []);

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;
        try {
            await db.collection(COLLECTIONS.announcements).add({
                title,
                content,
                timestamp: serverTimestamp()
            });
            setTitle('');
            setContent('');
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!isAdmin || !window.confirm('Delete this announcement?')) return;
        try {
            await db.collection(COLLECTIONS.announcements).doc(id).delete();
        } catch (err) { console.error(err); }
    };

    const handlePlayTTS = async (item: Announcement) => {
        if (playingId === item.id) return;
        
        if (audioMap[item.id]) {
            const audio = new Audio(audioMap[item.id]);
            setPlayingId(item.id);
            audio.play();
            audio.onended = () => setPlayingId(null);
            audio.onerror = () => setPlayingId(null);
            return;
        }

        setPlayingId(item.id);
        const text = `${item.title}. ${item.content}`;
        const { audioUrl, error } = await generateTTS(text);

        if (audioUrl) {
            setAudioMap(prev => ({ ...prev, [item.id]: audioUrl }));
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => setPlayingId(null);
            audio.onerror = () => setPlayingId(null);
        } else {
            alert(`TTS Error: ${error}`);
            setPlayingId(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Announcements</h2>
                <p className="text-slate-500">Official updates from the faculty.</p>
            </div>

            {isAdmin && (
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100 mb-10 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg mr-3"><Megaphone size={18} /></span>
                        Post New Announcement
                    </h3>
                    <form onSubmit={handlePost} className="space-y-4">
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Announcement Title"
                            className="w-full p-4 rounded-xl bg-white border border-blue-100 focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium"
                            required
                        />
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Write your announcement here..."
                            rows={3}
                            className="w-full p-4 rounded-xl bg-white border border-blue-100 focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none"
                            required
                        />
                        <div className="flex justify-end">
                            <button type="submit" className="bg-accent hover:bg-blue-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm">
                                Publish Announcement
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-6">
                {announcements.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                         <div className="text-slate-300 mb-3 mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-slate-50">
                            <Bell size={24} />
                        </div>
                        <p className="text-slate-500 font-medium">No announcements available.</p>
                    </div>
                ) : (
                    announcements.map((item) => (
                        <div key={item.id} className="bg-white p-6 sm:p-8 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-100 relative overflow-hidden group">
                            {/* Decorative accent bar */}
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-accent/20 group-hover:bg-accent transition-colors"></div>
                            
                            <div className="flex justify-between items-start pl-4">
                                <div className="flex-1">
                                    <h4 className="text-xl font-bold text-slate-800 mb-3">{item.title}</h4>
                                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed mb-6">{item.content}</p>
                                    
                                    <div className="flex items-center gap-4 border-t border-slate-50 pt-4">
                                        <div className="flex items-center text-xs font-semibold text-slate-400">
                                            <Calendar size={14} className="mr-1.5" />
                                            {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                        </div>
                                        <button 
                                            onClick={() => handlePlayTTS(item)}
                                            disabled={playingId === item.id}
                                            className="flex items-center text-xs font-bold text-accent bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors ml-auto"
                                        >
                                            {playingId === item.id ? (
                                                <><Loader2 size={12} className="animate-spin mr-1.5"/> Playing...</>
                                            ) : (
                                                <><Play size={12} className="mr-1.5 fill-current"/> Listen</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors ml-4"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};