import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  FileText,
  Search,
  CheckSquare,
  BarChart3,
  Download,
  Database,
  Menu,
  X,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Upload PDFs', href: '/pdfs/upload', icon: Upload },
  { name: 'PDFs', href: '/pdfs', icon: FileText },
  { name: 'Questions', href: '/questions', icon: Search },
  { name: 'Review Queue', href: '/review', icon: CheckSquare },
  { name: 'Corrected Bank', href: '/corrected', icon: Database },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'Export', href: '/export', icon: Download },
];

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const location = useLocation();

  const currentPath = location.pathname;

  const getPageTitle = () => {
    const path = currentPath.split('/')[1];
    const navItem = navigation.find(n => n.href === currentPath) ||
      { name: path ? path.charAt(0).toUpperCase() + path.slice(1) : 'Dashboard' };
    return navItem.name;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <h1 className="text-xl font-bold text-primary-700">Question Analyzer</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="mt-4 space-y-1">
          {navigation.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-2 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon size={18} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen">
        <header className="bg-white shadow-sm border-b px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-xl font-semibold text-gray-800">{getPageTitle()}</h2>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">AI-Powered Exam Analyzer</div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
