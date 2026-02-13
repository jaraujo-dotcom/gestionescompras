import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

// Pages

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RequestsList from "./pages/requests/RequestsList";
import NewRequest from "./pages/requests/NewRequest";
import RequestDetail from "./pages/requests/RequestDetail";
import EditRequest from "./pages/requests/EditRequest";
import ReviewList from "./pages/review/ReviewList";
import ReviewDetail from "./pages/review/ReviewDetail";
import ExecutionList from "./pages/execution/ExecutionList";
import ExecutionDetail from "./pages/execution/ExecutionDetail";
import UsersList from "./pages/admin/UsersList";
import TemplatesList from "./pages/admin/TemplatesList";
import TemplateEditor from "./pages/admin/TemplateEditor";
import NotFound from "./pages/NotFound";
import NotificationsList from "./pages/notifications/NotificationsList";
import NotificationSettings from "./pages/admin/NotificationSettings";
import GroupsList from "./pages/admin/GroupsList";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/notifications" element={<NotificationsList />} />
              
              {/* Requests */}
              <Route path="/requests" element={<RequestsList />} />
              <Route path="/requests/new" element={<NewRequest />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
              <Route path="/requests/:id/edit" element={<EditRequest />} />
              
              {/* Review */}
              <Route path="/review" element={<ReviewList />} />
              <Route path="/review/:id" element={<ReviewDetail />} />
              
              {/* Execution */}
              <Route path="/execution" element={<ExecutionList />} />
              <Route path="/execution/:id" element={<ExecutionDetail />} />
              
              {/* Admin */}
              <Route path="/admin/users" element={<UsersList />} />
              <Route path="/admin/templates" element={<TemplatesList />} />
              <Route path="/admin/templates/:id" element={<TemplateEditor />} />
              <Route path="/admin/notifications" element={<NotificationSettings />} />
              <Route path="/admin/groups" element={<GroupsList />} />
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
