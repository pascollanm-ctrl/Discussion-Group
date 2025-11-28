import React, { useState, useEffect } from 'react';
import { auth, ADMIN_EMAIL, User } from './services/firebase';
import { AuthModal } from './components/AuthModal';
import { Layout } from './components/Layout';
import { DiscussionView } from './components/DiscussionView';
import { AnnouncementView } from './components/AnnouncementView';
import { ResourceView } from './components/ResourceView';
import { AdminUploadView } from './components/AdminUploadView';
import { ChatView } from './components/ChatView';

export type ViewType = 'discussion' | 'announcements' | 'resources' | 'chat' | 'admin';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('discussion');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const renderView = () => {
    switch (currentView) {
      case 'discussion':
        return <DiscussionView user={user} />;
      case 'announcements':
        return <AnnouncementView user={user} isAdmin={isAdmin} />;
      case 'resources':
        return <ResourceView user={user} isAdmin={isAdmin} />;
      case 'chat':
        return <ChatView user={user} />;
      case 'admin':
        return isAdmin ? <AdminUploadView /> : <div className="p-8 text-center text-red-500">Access Denied</div>;
      default:
        return <DiscussionView user={user} />;
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-primary font-bold">Loading Hub...</div>;
  }

  return (
    <>
      <Layout
        user={user}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLoginClick={() => setIsAuthModalOpen(true)}
        isAdmin={isAdmin}
      >
        {renderView()}
      </Layout>

      {isAuthModalOpen && (
        <AuthModal onClose={() => setIsAuthModalOpen(false)} />
      )}
    </>
  );
};

export default App;