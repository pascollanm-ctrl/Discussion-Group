import React, { useState, useEffect } from 'react';
import { db, COLLECTIONS, User, serverTimestamp } from '../services/firebase';
import { Discussion } from '../types';
import { Trash2, MessageCircle, Send, User as UserIcon } from 'lucide-react';

interface DiscussionViewProps {
    user: User | null;
}

export const DiscussionView: React.FC<DiscussionViewProps> = ({ user }) => {
    const [discussions, setDiscussions] = useState<Discussion[]>([]);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = db.collection(COLLECTIONS.discussions)
            .orderBy('timestamp', 'desc')
            .onSnapshot((snapshot) => {
                const items: Discussion[] = [];
                snapshot.forEach((doc) => {
                    items.push({ id: doc.id, ...doc.data() } as Discussion);
                });
                setDiscussions(items);
            });
        return () => unsubscribe();
    }, []);

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || user.isAnonymous) {
            setError('Please login to post.');
            return;
        }
        setIsPosting(true);
        setError('');

        try {
            await db.collection(COLLECTIONS.discussions).add({
                title,
                content,
                userId: user.uid,
                userName: user.email?.split('@')[0] || 'User',
                timestamp: serverTimestamp()
            });
            setTitle('');
            setContent('');
        } catch (err: any) {
            setError('Failed to post topic.');
            console.error(err);
        } finally {
            setIsPosting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this topic?')) return;
        try {
            await db.collection(COLLECTIONS.discussions).doc(id).delete();
        } catch (err) { console.error("Error deleting", err); }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h2 className="text-3xl font-bold text-slate-800 mb-2">Discussion Forum</h2>
                <p className="text-slate-500">Connect with peers, share insights, and ask questions.</p>
            </div>

            {/* New Topic Form */}
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] border border-slate-100 mb-10">
                <div className="flex items-center mb-4 text-slate-800 font-bold">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3 text-primary">
                        <MessageCircle size={18} />
                    </div>
                    Start a New Topic
                </div>
                <form onSubmit={handlePost} className="space-y-4">
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What is the topic title?"
                        className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-medium"
                        required
                    />
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Elaborate on your question or thought..."
                        rows={3}
                        className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-y"
                        required
                    />
                    {error && <p className="text-red-500 text-sm px-1">{error}</p>}
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isPosting}
                            className="bg-primary hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 flex items-center"
                        >
                            {isPosting ? 'Posting...' : <><Send size={16} className="mr-2" /> Post Topic</>}
                        </button>
                    </div>
                </form>
            </div>

            {/* Discussions List */}
            <div className="space-y-5">
                {discussions.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="text-slate-300 mb-3 mx-auto w-12 h-12 flex items-center justify-center rounded-full bg-slate-50">
                            <MessageCircle size={24} />
                        </div>
                        <p className="text-slate-500 font-medium">No discussions yet. Start the conversation!</p>
                    </div>
                ) : (
                    discussions.map((item) => (
                        <div key={item.id} className="bg-white p-6 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="bg-slate-100 p-1.5 rounded-full text-slate-500">
                                            <UserIcon size={12} />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{item.userName}</span>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-xs text-slate-400">
                                            {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}
                                        </span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-primary transition-colors">{item.title}</h4>
                                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{item.content}</p>
                                </div>
                                {user && user.uid === item.userId && (
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Topic"
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