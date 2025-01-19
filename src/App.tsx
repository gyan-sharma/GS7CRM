import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { ContractList } from './pages/contract/ContractList';
import { ContractDetail } from './pages/contract/ContractDetail';
import { ContractFormEdit } from './pages/contract/ContractFormEdit';
import { ProjectList } from './pages/project/ProjectList';
import { ProjectForm } from './pages/project/ProjectForm';
import { ProjectDetail } from './pages/project/ProjectDetail';
import { TeamManagement } from './pages/project/TeamManagement';
import { TaskManagement } from './pages/project/TaskManagement';
import { PaymentMilestones } from './pages/project/PaymentMilestones';
import { EnvironmentList } from './pages/environment/EnvironmentList';
import { EnvironmentDetail } from './pages/environment/EnvironmentDetail';
import { UserList } from './pages/user/UserList';
import { UserForm } from './pages/user/UserForm';
import { ServiceList } from './pages/service/ServiceList';
import { ServiceForm } from './pages/service/ServiceForm';
import { CustomerList } from './pages/customer/CustomerList';
import { CustomerForm } from './pages/customer/CustomerForm';
import { CustomerDetail } from './pages/customer/CustomerDetail';
import { DealReviewPage } from './pages/review/DealReviewPage';
import { OpportunityList } from './pages/opportunity/OpportunityList';
import { OpportunityForm } from './pages/opportunity/OpportunityForm';
import { OpportunityDetail } from './pages/opportunity/OpportunityDetail';
import { PartnerList } from './pages/partner/PartnerList';
import { PartnerForm } from './pages/partner/PartnerForm';
import { PartnerDetail } from './pages/partner/PartnerDetail';
import { OfferList } from './pages/offer/OfferList';
import { OfferForm } from './pages/offer/OfferForm';
import { OfferDetail } from './pages/offer/OfferDetail';
import { ProfilePage } from './pages/profile/ProfilePage';
import { PricingList } from './pages/pricing/PricingList';
import { PricingForm } from './pages/pricing/PricingForm';
import { AuthProvider, useAuth } from './contexts/AuthContext';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return user && user.role === 'admin' ? (
    <>{children}</>
  ) : (
    <Navigate to="/login" replace />
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route
              path="/"
              element={
                <AdminRoute>
                  <Navigate to="/users" replace />
                </AdminRoute>
              }
            />
            <Route
              path="contracts"
              element={
                <AdminRoute>
                  <ContractList />
                </AdminRoute>
              }
            />
            <Route
              path="contracts/:id/details"
              element={
                <AdminRoute>
                  <ContractDetail />
                </AdminRoute>
              }
            />
            <Route
              path="contracts/:id"
              element={
                <AdminRoute>
                  <ContractFormEdit />
                </AdminRoute>
              }
            />
            <Route
              path="projects"
              element={
                <AdminRoute>
                  <ProjectList />
                </AdminRoute>
              }
            />
            <Route
              path="projects/:id"
              element={
                <AdminRoute>
                  <ProjectForm />
                </AdminRoute>
              }
            />
            <Route
              path="projects/:id/details"
              element={
                <AdminRoute>
                  <ProjectDetail />
                </AdminRoute>
              }
            />
            <Route
              path="projects/:id/team"
              element={
                <AdminRoute>
                  <TeamManagement />
                </AdminRoute>
              }
            />
            <Route
              path="projects/:id/tasks"
              element={
                <AdminRoute>
                  <TaskManagement />
                </AdminRoute>
              }
            />
            <Route
              path="projects/:id/milestones"
              element={
                <AdminRoute>
                  <PaymentMilestones />
                </AdminRoute>
              }
            />
            <Route
              path="environments"
              element={
                <AdminRoute>
                  <EnvironmentList />
                </AdminRoute>
              }
            />
            <Route
              path="environments/:id/details"
              element={
                <AdminRoute>
                  <EnvironmentDetail />
                </AdminRoute>
              }
            />
            <Route
              path="users"
              element={
                <AdminRoute>
                  <UserList />
                </AdminRoute>
              }
            />
            <Route
              path="users/:id"
              element={
                <AdminRoute>
                  <UserForm />
                </AdminRoute>
              }
            />
            <Route
              path="services"
              element={
                <AdminRoute>
                  <ServiceList />
                </AdminRoute>
              }
            />
            <Route
              path="services/:id"
              element={
                <AdminRoute>
                  <ServiceForm />
                </AdminRoute>
              }
            />
            <Route
              path="reviews"
              element={
                <AdminRoute>
                  <DealReviewPage />
                </AdminRoute>
              }
            />
            <Route
              path="customers"
              element={
                <AdminRoute>
                  <CustomerList />
                </AdminRoute>
              }
            />
            <Route
              path="customers/:id/details"
              element={
                <AdminRoute>
                  <CustomerDetail />
                </AdminRoute>
              }
            />
            <Route
              path="customers/:id"
              element={
                <AdminRoute>
                  <CustomerForm />
                </AdminRoute>
              }
            />
            <Route
              path="opportunities"
              element={
                <AdminRoute>
                  <OpportunityList />
                </AdminRoute>
              }
            />
            <Route
              path="opportunities/:id"
              element={
                <AdminRoute>
                  <OpportunityForm />
                </AdminRoute>
              }
            />
            <Route
              path="opportunities/:id/details"
              element={
                <AdminRoute>
                  <OpportunityDetail />
                </AdminRoute>
              }
            />
            <Route
              path="offers"
              element={
                <AdminRoute>
                  <OfferList />
                </AdminRoute>
              }
            />
            <Route
              path="offers/new"
              element={
                <AdminRoute>
                  <OfferForm />
                </AdminRoute>
              }
            />
            <Route
              path="offers/:id"
              element={
                <AdminRoute>
                  <OfferForm />
                </AdminRoute>
              }
            />
            <Route
              path="offers/:id/details"
              element={
                <AdminRoute>
                  <OfferDetail />
                </AdminRoute>
              }
            />
            <Route
              path="partners"
              element={
                <AdminRoute>
                  <PartnerList />
                </AdminRoute>
              }
            />
            <Route
              path="partners/:id"
              element={
                <AdminRoute>
                  <PartnerForm />
                </AdminRoute>
              }
            />
            <Route
              path="partners/:id/details"
              element={
                <AdminRoute>
                  <PartnerDetail />
                </AdminRoute>
              }
            />
            <Route
              path="pricing"
              element={
                <AdminRoute>
                  <PricingList />
                </AdminRoute>
              }
            />
            <Route
              path="pricing/:id"
              element={
                <AdminRoute>
                  <PricingForm />
                </AdminRoute>
              }
            />
            <Route
              path="profile"
              element={
                <AdminRoute>
                  <ProfilePage />
                </AdminRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;