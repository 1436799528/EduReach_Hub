import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { 
  InstitutionId, 
  StudyMaterial, 
  UserProfile, 
  FeedPost
} from './types';
import { 
  getStoredUserProfile, 
  saveUserProfile, 
  getStoredMaterials, 
  saveMaterials
} from './services/storage';
import { FEED_POSTS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CampusFeedPage } from './components/CampusFeedPage';
import { MySchoolPage } from './components/MySchoolPage';
import { MyServicesPage } from './components/MyServicesPage';
import { ProfilePage } from './components/ProfilePage';
import { MaterialReaderModal } from './components/MaterialReaderModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';

export default function App() {
  // Global User State
  const [user, setUser] = useState<UserProfile>(getStoredUserProfile);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('edureach_is_logged_in');
    return saved !== null ? saved === 'true' : true;
  });

  const [materials, setMaterials] = useState<StudyMaterial[]>(getStoredMaterials);
  const [feedPosts] = useState<FeedPost[]>(FEED_POSTS);

  // App Navigation: 'landing' vs Dashboard views ('feed' | 'my_school' | 'services' | 'profile')
  const [currentView, setCurrentView] = useState<'landing' | 'feed' | 'my_school' | 'services' | 'profile'>('landing');
  
  // Active Filter Institution (defaults to user's school)
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionId>(user.institutionId || 'UNICAL');

  // Modals
  const [readingMaterial, setReadingMaterial] = useState<StudyMaterial | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth Modal State
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
    message?: string;
  }>({
    isOpen: false,
    mode: 'login'
  });

  // Local Storage Persistence
  useEffect(() => {
    saveUserProfile(user);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('edureach_is_logged_in', String(isLoggedIn));
  }, [isLoggedIn]);

  useEffect(() => {
    saveMaterials(materials);
  }, [materials]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Open Auth Modal
  const handleOpenAuth = (mode: 'login' | 'register' = 'login', message?: string) => {
    setAuthModalConfig({
      isOpen: true,
      mode,
      message
    });
  };

  // Handle Login / Registration Success
  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsLoggedIn(true);
    if (authenticatedUser.institutionId) {
      setSelectedInstitution(authenticatedUser.institutionId);
    }
    setCurrentView('my_school');
    showToast(`Welcome back, ${authenticatedUser.name.split(' ')[0]}!`);
  };

  // Update user profile details
  const handleUpdateUser = (updatedFields: Partial<UserProfile>) => {
    setUser(prev => ({
      ...prev,
      ...updatedFields
    }));
    if (updatedFields.institutionId) {
      setSelectedInstitution(updatedFields.institutionId);
    }
    showToast('Profile details updated & saved successfully!');
  };

  // Logout action
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('landing');
    showToast('Logged out of student session.');
  };

  // Navigate to core tab with auth check
  const handleNavigateToTab = (tab: 'feed' | 'my_school' | 'services' | 'profile') => {
    if (!isLoggedIn && tab === 'profile') {
      handleOpenAuth('login', 'Please sign in to access your student profile.');
      return;
    }
    
    // If not logged in but clicking other tabs, open auth modal or allow preview
    if (!isLoggedIn) {
      handleOpenAuth('register', `Create a free scholar account or sign in to access full ${tab === 'my_school' ? 'My School materials' : tab === 'feed' ? 'Campus Student Feed' : 'Campus Services'}.`);
      return;
    }

    setCurrentView(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Unlock Material Action (Instant access)
  const handleUnlockMaterial = (material: StudyMaterial) => {
    setUser(prev => ({
      ...prev,
      unlockedMaterialIds: [...new Set([...prev.unlockedMaterialIds, material.id])],
      viewHistory: [...new Set([...(prev.viewHistory || []), material.id])]
    }));
    setReadingMaterial(material);
    showToast(`Opened ${material.courseCode} study package!`);
  };

  // Toggle Offline Storage
  const handleToggleOffline = (materialId: string) => {
    const isSaved = user.savedOfflineMaterialIds.includes(materialId);
    if (isSaved) {
      setUser(prev => ({
        ...prev,
        savedOfflineMaterialIds: prev.savedOfflineMaterialIds.filter(id => id !== materialId)
      }));
      showToast('Study pack removed from offline cache.');
    } else {
      setUser(prev => ({
        ...prev,
        savedOfflineMaterialIds: [...prev.savedOfflineMaterialIds, materialId]
      }));
      showToast('Study pack saved offline for zero-data access!');
    }
  };

  const handleReadFeedMaterial = (materialTitle: string) => {
    const found = materials.find(m => m.title.toLowerCase().includes(materialTitle.toLowerCase()) || materialTitle.toLowerCase().includes(m.courseCode.toLowerCase()));
    if (found) {
      setReadingMaterial(found);
    } else {
      setReadingMaterial(materials[0]);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      
      {/* Toast Notification Alert */}
      {toastMessage && (
        <div 
          onClick={() => setToastMessage(null)}
          className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 cursor-pointer hover:bg-slate-800 transition-colors"
          title="Click to dismiss alert"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <span className="flex-1 pr-1">{toastMessage}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setToastMessage(null);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-1"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Top Header Navbar */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={isLoggedIn ? user : null}
        isLoggedIn={isLoggedIn}
        selectedInstitution={selectedInstitution}
        setSelectedInstitution={setSelectedInstitution}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {/* Primary Page Router */}
      {currentView === 'landing' && (
        <LandingPage
          isLoggedIn={isLoggedIn}
          onNavigateToTab={handleNavigateToTab}
          onOpenAuth={handleOpenAuth}
          onPreviewMaterial={(mat) => setReadingMaterial(mat)}
        />
      )}

      {currentView !== 'landing' && (
        <main className="flex-1 w-full pb-16">
          
          {/* Tab 1: Campus Feed */}
          {currentView === 'feed' && (
            <CampusFeedPage
              posts={feedPosts}
              currentInstitution={selectedInstitution}
              userProfile={user}
              onSelectMaterialToRead={handleReadFeedMaterial}
              onOpenAuth={handleOpenAuth}
              isLoggedIn={isLoggedIn}
            />
          )}

          {/* Tab 2: My School */}
          {currentView === 'my_school' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <MySchoolPage
                user={user}
                materials={materials}
                selectedInstitution={selectedInstitution}
                setSelectedInstitution={setSelectedInstitution}
                onUnlockMaterial={handleUnlockMaterial}
                onReadMaterial={(mat) => setReadingMaterial(mat)}
                onToggleOffline={handleToggleOffline}
                onOpenCBT={(mat) => setReadingMaterial(mat)}
              />
            </div>
          )}

          {/* Tab 3: My Services */}
          {currentView === 'services' && (
            <MyServicesPage
              user={user}
            />
          )}

          {/* Tab 4: Profile */}
          {currentView === 'profile' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <ProfilePage
                user={user}
                onUpdateUser={handleUpdateUser}
                onLogout={handleLogout}
              />
            </div>
          )}

        </main>
      )}

      {/* Global Application Footer with FAQ & Moderator Contact Desks */}
      <Footer
        onNavigateToTab={handleNavigateToTab}
        onOpenAuth={handleOpenAuth}
      />

      {/* Student Authentication Modal */}
      <AuthModal
        isOpen={authModalConfig.isOpen}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
        onLoginSuccess={handleAuthSuccess}
        initialMode={authModalConfig.mode}
        redirectMessage={authModalConfig.message}
        onContinueAsGuest={() => {
          setIsLoggedIn(true);
          setCurrentView('my_school');
          showToast('Browsing in Scholar Guest Mode');
        }}
      />

      {/* Reader Modal */}
      {readingMaterial && (
        <MaterialReaderModal
          material={readingMaterial}
          user={user}
          isSavedOffline={user.savedOfflineMaterialIds.includes(readingMaterial.id)}
          onToggleOffline={handleToggleOffline}
          onClose={() => setReadingMaterial(null)}
          onUnlock={() => handleUnlockMaterial(readingMaterial)}
        />
      )}

    </div>
  );
}
