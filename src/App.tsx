import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';
import { QueueNotificationProvider } from './contexts/QueueNotificationContext';
import Layout from './components/layout/Layout';
import NameCollectionModal from './components/NameCollectionModal';
import { Role, hasRole, isStaffLevel } from './utils/roles';
import {
  SignInForm,
  SignUpForm,
  ForgotPasswordForm,
  ResendVerificationForm,
  ChangePasswordForm
} from './components/auth/AuthForms';
import { API_ENDPOINT } from './aws-config';

// Import pages
import HomePage from './pages/HomePage';
import LabsPage from './pages/LabsPage';
import LabDetailPage from './pages/LabDetailPage';
import LabContentEditorPage from './pages/LabContentEditorPage';
import GuidesPage from './pages/GuidesPage';
import GuideDetailPage from './pages/GuideDetailPage';
import GuideContentEditorPage from './pages/GuideContentEditorPage';
import PeoplePage from './pages/PeoplePage';
import StudentDetailPage from './pages/StudentDetailPage';
import CheckoffQueuePage from './pages/CheckoffQueuePage';
import LabQueuePage from './pages/LabQueuePage';
import GradesPage from './pages/GradesPage';
import MyGradesPage from './pages/MyGradesPage';
import StaffManagementPage from './pages/StaffManagementPage';
import TermsPage from './pages/TermsPage';
import PurgePage from './pages/PurgePage';
import AuditLogViewer from './pages/AuditLogViewer';
import DataInspectorPage from './pages/DataInspectorPage';

// Protected route component.
//
// Two modes:
//   • minRole — hierarchical: "user's rank must be >= minRole". Use this for
//     most admin/staff pages (ta also counts).
//   • studentOnly — the inverse: a page only students should see (e.g.
//     /my-grades, which staff can't meaningfully use).
interface ProtectedRouteProps {
  element: React.ReactNode;
  minRole?: Role;        // defaults to 'student' (i.e. any authenticated user)
  studentOnly?: boolean; // if true, non-students are redirected home
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  element,
  minRole = 'student',
  studentOnly = false,
}) => {
  const { authState } = useAuth();
  const { isAuthenticated, user, isLoading } = authState;

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" />;
  }

  if (studentOnly) {
    if (user && user.role !== 'student') return <Navigate to="/" />;
  } else if (!hasRole(user, minRole)) {
    return <Navigate to="/" />;
  }

  return <>{element}</>;
};

// Temporary placeholder components for pages
const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <div className="text-center py-12">
    <h1 className="text-3xl font-bold mb-4">{title}</h1>
    <p className="text-gray-600">This page is under construction.</p>
  </div>
);

// Create placeholder pages
const CourseMaterialsPage = () => <PlaceholderPage title="Course Materials" />;
const NotFoundPage = () => <PlaceholderPage title="404 - Page Not Found" />;

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signin" element={<SignInForm />} />
      <Route path="/signup" element={<SignUpForm />} />
      <Route path="/forgot-password" element={<ForgotPasswordForm />} />
      <Route path="/resend-verification" element={<ResendVerificationForm />} />
      <Route 
        path="/change-password" 
        element={<ProtectedRoute element={<ChangePasswordForm />} />} 
      />
      <Route 
        path="/course" 
        element={<ProtectedRoute element={<CourseMaterialsPage />} />} 
      />
      <Route 
        path="/labs" 
        element={<ProtectedRoute element={<LabsPage />} />} 
      />
      <Route
        path="/labs/:labId"
        element={<ProtectedRoute element={<LabAccessCheck />} />}
      />
      <Route
        path="/labs/:labId/edit"
        element={<ProtectedRoute element={<LabContentEditorPage />} minRole="ta" />}
      />
      <Route 
        path="/guides" 
        element={<ProtectedRoute element={<GuidesPage />} />} 
      />
      <Route
        path="/guides/new"
        element={<ProtectedRoute element={<GuideContentEditorPage />} minRole="ta" />}
      />
      <Route
        path="/guides/:guideId"
        element={<ProtectedRoute element={<GuideDetailPage />} />}
      />
      <Route
        path="/guides/:guideId/edit"
        element={<ProtectedRoute element={<GuideContentEditorPage />} minRole="ta" />}
      />
      <Route
        path="/people"
        element={<ProtectedRoute element={<PeoplePage />} minRole="ta" />}
      />
      <Route
        path="/grades"
        element={<ProtectedRoute element={<GradesPage />} minRole="ta" />}
      />
      <Route
        path="/people/:studentName"
        element={<ProtectedRoute element={<StudentDetailPage />} minRole="ta" />}
      />
      <Route
        path="/checkoffs"
        element={<ProtectedRoute element={<CheckoffQueuePage />} minRole="ta" />}
      />
      <Route
        path="/queue"
        element={<ProtectedRoute element={<LabQueuePage />} />}
      />
      <Route
        path="/my-grades"
        element={<ProtectedRoute element={<MyGradesPage />} studentOnly />}
      />
      <Route
        path="/admin/staff"
        element={<ProtectedRoute element={<StaffManagementPage />} minRole="admin" />}
      />
      <Route
        path="/admin/terms"
        element={<ProtectedRoute element={<TermsPage />} minRole="admin" />}
      />
      <Route
        path="/admin/purge"
        element={<ProtectedRoute element={<PurgePage />} minRole="admin" />}
      />
      <Route
        path="/admin/audit"
        element={<ProtectedRoute element={<AuditLogViewer />} minRole="ta" />}
      />
      <Route
        path="/admin/data"
        element={<ProtectedRoute element={<DataInspectorPage />} minRole="ta" />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// Component to check if a student can access a lab
const LabAccessCheck: React.FC = () => {
  const { labId } = useParams<{ labId: string }>();
  const { authState } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  
  useEffect(() => {
    // Only check access for students — staff-level users always see labs.
    if (isStaffLevel(authState.user)) {
      setIsChecking(false);
      return;
    }
    
    const checkLabAccess = async () => {
      try {
        const idToken = localStorage.getItem('idToken');
        if (!idToken) {
          throw new Error('No authentication token found');
        }
        
        // Make a HEAD request to check if the lab is accessible
        const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
        const response = await fetch(`${baseUrl}labs/${labId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok && response.status === 403) {
          // Lab is locked, store error message and redirect
          sessionStorage.setItem('labAccessError',
            'This lab is currently locked. Please wait for your instructor to unlock it.');
          navigate('/labs', { replace: true });
          return;
        }
        
        setIsChecking(false);
      } catch (error) {
        console.error('Error checking lab access:', error);
        setIsChecking(false);
      }
    };
    
    checkLabAccess();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, authState.user?.role, navigate]);
  
  if (isChecking) {
    return <div className="p-8 text-center">Checking lab access...</div>;
  }
  
  return <LabDetailPage />;
};

const AppContent: React.FC = () => {
  const { authState, hideNameCollectionModal } = useAuth();

  return (
    <>
      <Router>
        <QueueNotificationProvider>
          <Layout>
            <AppRoutes />
          </Layout>
        </QueueNotificationProvider>
      </Router>
      <NameCollectionModal
        isOpen={authState.showNameCollectionModal}
        onClose={hideNameCollectionModal}
      />
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
