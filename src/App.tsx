/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ParentForm from './components/ParentForm';
import TeacherDashboard from './components/TeacherDashboard';
import { BookOpen } from 'lucide-react';

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-blue-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <BookOpen className="text-yellow-400" size={28} />
              <span className="font-bold text-lg tracking-wide hidden sm:block">SPBT SK TUDAN</span>
            </div>
            <nav className="flex space-x-4">
              <Link 
                to="/" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${location.pathname === '/' ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`}
              >
                Borang Ibu Bapa
              </Link>
              <Link 
                to="/guru" 
                className={`px-3 py-2 rounded-md text-sm font-medium transition ${location.pathname === '/guru' ? 'bg-blue-800 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`}
              >
                Portal Guru
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<ParentForm />} />
          <Route path="/guru" element={<TeacherDashboard />} />
        </Routes>
      </main>
      
      <footer className="bg-gray-100 border-t border-gray-200 py-4 text-center text-gray-500 text-sm">
        <p>&copy; 2026 Sekolah Kebangsaan Tudan, Miri. Sistem Perekodan SPBT.</p>
      </footer>
    </div>
  );
}
