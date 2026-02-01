import React from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Protected from './components/Protected'
import AdminRoute from './components/AdminRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Upload from './pages/Upload'
import Documents from './pages/Documents'
import Search from './pages/Search'
import Analyze from './pages/Analyze'
import UsersAdmin from './pages/UsersAdmin'
import AdminDashboard from './pages/AdminDashboard'
import AdminActivity from './pages/AdminActivity'
import Reports from './pages/Reports'

function App() {
  return (
    <>
      {/* خلفية متدرجة مع تأثيرات - ثابتة لجميع الصفحات */}
      <div className="fixed inset-0 bg-gradient-to-br from-base-950 via-base-900 to-base-950 -z-10"></div>
      
      {/* تأثيرات دائرية متحركة */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDuration: '4s' }}></div>
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDelay: '1s', animationDuration: '4s' }}></div>
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDelay: '2s', animationDuration: '6s' }}></div>
      <div className="fixed top-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDelay: '0.5s', animationDuration: '5s' }}></div>
      <div className="fixed bottom-1/4 left-1/4 w-[450px] h-[450px] bg-teal-500/8 rounded-full blur-3xl animate-pulse -z-10" style={{ animationDelay: '1.5s', animationDuration: '5.5s' }}></div>
      
      {/* خطوط شبكية */}
      <div className="fixed inset-0 opacity-5 -z-10" style={{
        backgroundImage: 'linear-gradient(rgba(0,188,212,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,188,212,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px'
      }}></div>

      {/* طبقة توهج إضافية */}
      <div className="fixed inset-0 bg-gradient-to-t from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none -z-10"></div>

      <div className="min-h-screen relative z-0">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<Protected />}> 
            <Route path="/" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Home />
                </div>
              </>
            } />
            <Route path="/upload" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Upload />
                </div>
              </>
            } />
            <Route path="/documents" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Documents />
                </div>
              </>
            } />
            <Route path="/search" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Search />
                </div>
              </>
            } />
            <Route path="/analyze" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Analyze />
                </div>
              </>
            } />
            <Route path="/reports" element={
              <>
                <Navbar />
                <div className="max-w-7xl mx-auto p-4">
                  <Reports />
                </div>
              </>
            } />
            <Route element={<AdminRoute />}> 
              <Route path="/admin" element={
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto p-4">
                    <AdminDashboard />
                  </div>
                </>
              } />
              <Route path="/admin/users" element={
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto p-4">
                    <UsersAdmin />
                  </div>
                </>
              } />
              <Route path="/admin/activity" element={
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto p-4">
                    <AdminActivity />
                  </div>
                </>
              } />
              <Route path="/admin/reports" element={
                <>
                  <Navbar />
                  <div className="max-w-7xl mx-auto p-4">
                    <Reports />
                  </div>
                </>
              } />
            </Route>
          </Route>
          {/* توجيه أي مسار غير معروف إلى صفحة تسجيل الدخول */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </>
  )
}

export default App


