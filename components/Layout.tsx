import React from 'react';
import { auth, User } from '../services/firebase';
import { ViewType } from '../App';
import { MessageSquare, Bell, BookOpen, Upload, LogOut, User as UserIcon, Menu, X, Sparkles } from 'lucide-react';

interface LayoutProps {
    user: User | null;
    currentView: ViewType;
    onViewChange: (view: ViewType) => void;
    onLoginClick: () => void;
    isAdmin: boolean;
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, currentView, onViewChange, onLoginClick, isAdmin, children }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const handleSignOut = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const NavItem = ({ view, icon: Icon, label, highlight = false }: { view: ViewType; icon: any; label: string, highlight?: boolean }) => (
        <button
            onClick={() => {
                onViewChange(view);
                setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl mb-1.5 transition-all duration-200 group ${
                currentView === view 
                    ? (highlight ? 'bg-ai/10 text-ai font-semibold' : 'bg-slate-100 text-slate-900 font-semibold') 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
        >
            <div className="flex items-center">
                <Icon size={20} className={`mr-3 ${currentView === view ? (highlight ? 'text-ai' : 'text-primary') : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{label}</span>
            </div>
            {currentView === view && <div className={`w-1.5 h-1.5 rounded-full ${highlight ? 'bg-ai' : 'bg-primary'}`} />}
        </button>
    );

    return (
        <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <button 
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="p-2 rounded-xl text-slate-500 md:hidden hover:bg-slate-100 transition-colors focus:outline-none"
                            >
                                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </button>
                            <h1 className="ml-3 md:ml-0 text-xl font-bold text-slate-800 flex items-center tracking-tight">
                                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary mr-3 text-lg">🩺</span>
                                <span className="hidden sm:inline">Clinical Resource Hub</span>
                                <span className="sm:hidden">Clinical Hub</span>
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            {user ? (
                                <div className="flex items-center bg-slate-50 rounded-full pl-4 pr-1 py-1 border border-slate-100">
                                    <div className="hidden md:block mr-3">
                                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">User</span>
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 max-w-[120px] truncate mr-2 hidden sm:block">
                                        {user.email?.split('@')[0]}
                                    </span>
                                    <button 
                                        onClick={handleSignOut}
                                        className="w-8 h-8 flex items-center justify-center bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full shadow-sm transition-all"
                                        title="Sign Out"
                                    >
                                        <LogOut size={16} />
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={onLoginClick}
                                    className="flex items-center px-5 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-all shadow-sm font-medium text-sm"
                                >
                                    <UserIcon size={16} className="mr-2" />
                                    Login
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 gap-8 relative">
                {/* Sidebar - Desktop */}
                <aside className="hidden md:block w-72 h-fit sticky top-28">
                    <nav className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50">
                            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Assistant</p>
                            <NavItem view="chat" icon={Sparkles} label="AI Tutor" highlight={true} />
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50">
                            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Community</p>
                            <NavItem view="discussion" icon={MessageSquare} label="Discussions" />
                            <NavItem view="announcements" icon={Bell} label="Announcements" />
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-slate-100/50">
                            <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Learning</p>
                            <NavItem view="resources" icon={BookOpen} label="Unit Resources" />
                            {isAdmin && (
                                <div className="mt-2 pt-2 border-t border-slate-50">
                                    <NavItem view="admin" icon={Upload} label="Admin Upload" />
                                </div>
                            )}
                        </div>
                    </nav>
                </aside>

                {/* Mobile Menu Overlay */}
                {isMobileMenuOpen && (
                    <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="absolute top-0 left-0 w-3/4 max-w-xs h-full bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-lg font-bold text-slate-800">Menu</h2>
                                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                                    <X size={24} />
                                </button>
                            </div>
                            <nav className="space-y-2">
                                <NavItem view="chat" icon={Sparkles} label="AI Tutor" highlight={true} />
                                <div className="my-4 border-t border-slate-100"></div>
                                <NavItem view="discussion" icon={MessageSquare} label="Discussions" />
                                <NavItem view="announcements" icon={Bell} label="Announcements" />
                                <NavItem view="resources" icon={BookOpen} label="Unit Resources" />
                                {isAdmin && <NavItem view="admin" icon={Upload} label="Admin Upload" />}
                            </nav>
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    {children}
                </main>
            </div>
        </div>
    );
};