import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth'; 
import { auth } from './firebase';
import { UserRole } from './types';

import Layout from './components/Layout';
import LoadingSpinner from './components/LoadingSpinner';

import Login from './pages/Login'; 
import RoleSelection from './pages/RoleSelection';
import AdminDashboard from './pages/AdminDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<UserRole>(UserRole.UNKNOWN);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setCurrentView(UserRole.UNKNOWN);
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleRoleSelection = (roleIdentifier: UserRole) => { 

    setCurrentView(roleIdentifier);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
        <Layout>
            <Login />
        </Layout>
    ); 
  }

  if (currentView === UserRole.UNKNOWN) {
    return (
      <Layout>
        <RoleSelection onSelectRole={handleRoleSelection} />
      </Layout>
    );
  }

  return (
    <Layout userRole={currentView}>
      {currentView === UserRole.ADMIN ? (
        <AdminDashboard />
      ) : (
        <VolunteerDashboard />
      )}
    </Layout>
  );
};

export default App;