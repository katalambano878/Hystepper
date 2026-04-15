'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Module Filtering State
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  // Staff permissions (null = super admin, has full access)
  const [staffPermissions, setStaffPermissions] = useState<Record<string, boolean> | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);

  // Maintenance mode
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceToggling, setMaintenanceToggling] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();

      if (pathname === '/admin/login') {
        setIsLoading(false);
        return;
      }

      if (!session) {
        router.push('/admin/login');
      } else {
        setUser(session.user);
        setIsAuthenticated(true);
        document.cookie = 'admin_session=1; path=/; max-age=86400; SameSite=Lax';

        // Check profile role — 'admin' = super admin with full access
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileRow?.role === 'admin') {
          setIsSuperAdmin(true);
          setStaffPermissions(null); // full access
        } else {
          // Check staff table for granular permissions
          const { data: staffRow } = await supabase
            .from('staff')
            .select('permissions, is_active, role')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (staffRow) {
            if (!staffRow.is_active) {
              await supabase.auth.signOut();
              router.push('/admin/login');
              return;
            }
            setStaffRole(staffRow.role);
            if (staffRow.role === 'admin') {
              setIsSuperAdmin(true);
              setStaffPermissions(null);
            } else {
              setStaffPermissions(staffRow.permissions || {});
              // Role-based landing pages on first load
              if (staffRow.role === 'rider' && (pathname === '/admin' || pathname === '/admin/orders')) {
                router.push('/admin/rider');
              }
            }
          }
          // If no staff record found, they still see the dashboard (existing behaviour)
        }
      }
      setIsLoading(false);
    }

    checkAuth();
  }, [pathname, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showUserMenu && !target.closest('.user-menu-container')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Fetch Modules Effect
  useEffect(() => {
    async function fetchModules() {
      try {
        const { data, error } = await supabase.from('store_modules').select('id, enabled');
        if (error) {
          console.warn('Error fetching modules:', error);
          return;
        }
        if (data) {
          setEnabledModules(data.filter((m: any) => m.enabled).map((m: any) => m.id));
        }
      } catch (err) {
        console.warn('Fetch modules failed:', err);
      }
    }
    fetchModules();

    supabase.from('store_settings').select('key, value').eq('key', 'maintenance_mode').then(({ data }) => {
      data?.forEach((row: { key: string; value: unknown }) => {
        if (row.key === 'maintenance_mode') setMaintenanceEnabled(String(row.value) === 'true');
      });
    });
  }, []);

  // Screen size check for initial state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        // Only set to false if it's currently true? 
        // Actually, let's just default to open on desktop, closed on mobile on mount only
      }
    };

    // Set initial state based on width
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }

    // Optional: Auto-close on resize to mobile? For now, leave as is.
  }, []);

  const handleLogout = async () => {
    document.cookie = 'admin_session=; path=/; max-age=0';
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  const handleToggleMaintenance = async () => {
    const next = !maintenanceEnabled;
    setMaintenanceToggling(true);
    try {
      await supabase.from('store_settings').upsert(
        { key: 'maintenance_mode', value: next ? 'true' : 'false', updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      setMaintenanceEnabled(next);
    } catch (err) {
      console.error('Failed to toggle maintenance:', err);
      alert('Failed to update. Please try again.');
    } finally {
      setMaintenanceToggling(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-500">Loading Admin...</div>;
  }

  const menuItems = [
    { title: 'Dashboard',        icon: 'ri-dashboard-line',      path: '/admin',                  exact: true,  permKey: 'dashboard' },
    { title: 'Orders',           icon: 'ri-shopping-bag-line',   path: '/admin/orders',            badge: '',    permKey: 'orders' },
    { title: 'Delivery',         icon: 'ri-truck-line',          path: '/admin/delivery',                        permKey: 'delivery' },
    { title: 'My Deliveries',    icon: 'ri-e-bike-line',         path: '/admin/rider',                           permKey: 'order_status' },
    { title: 'POS System',       icon: 'ri-store-3-line',        path: '/admin/pos',                             permKey: 'pos' },
    { title: 'Products',         icon: 'ri-box-3-line',          path: '/admin/products',                        permKey: 'products' },
    { title: 'Categories',       icon: 'ri-folder-line',         path: '/admin/categories',                      permKey: 'categories' },
    { title: 'Customers',        icon: 'ri-group-line',          path: '/admin/customers',                       permKey: 'customers' },
    { title: 'Reviews',          icon: 'ri-chat-smile-2-line',   path: '/admin/reviews',                         permKey: 'reviews' },
    { title: 'Inventory',        icon: 'ri-stack-line',          path: '/admin/inventory',                       permKey: 'inventory' },
    { title: 'Analytics',        icon: 'ri-bar-chart-line',      path: '/admin/analytics',                       permKey: 'analytics' },
    { title: 'Coupons',          icon: 'ri-coupon-2-line',       path: '/admin/coupons',                         permKey: 'coupons' },
    { title: 'Customer Insights',icon: 'ri-user-search-line',    path: '/admin/customer-insights', moduleId: 'customer-insights' },
    { title: 'Notifications',    icon: 'ri-notification-3-line', path: '/admin/notifications',     moduleId: 'notifications', permKey: 'notifications' },
    { title: 'SMS Debugger',     icon: 'ri-message-2-line',      path: '/admin/test-sms' },
    { title: 'Blog',             icon: 'ri-article-line',        path: '/admin/blog',              moduleId: 'blog', permKey: 'blog' },
    { title: 'Modules',          icon: 'ri-puzzle-line',         path: '/admin/modules',                         permKey: 'modules' },
    { title: 'Staff',            icon: 'ri-user-settings-line',  path: '/admin/staff',                           permKey: 'staff' },
    { title: 'Settings',         icon: 'ri-settings-3-line',     path: '/admin/settings',                        permKey: 'settings' },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    // Filter by module toggle first
    if ((item as any).moduleId && !enabledModules.includes((item as any).moduleId)) return false;
    // Super admins see everything
    if (isSuperAdmin || staffPermissions === null) return true;
    // Riders only ever see their personal delivery queue
    if (staffRole === 'rider') return (item as any).permKey === 'order_status';
    // Non-riders never see the "My Deliveries" rider-only item
    if ((item as any).path === '/admin/rider') return false;
    // If no permKey, always show (e.g. SMS Debugger — utility item)
    if (!(item as any).permKey) return true;
    return !!staffPermissions[(item as any).permKey];
  });

  // Special layout for Login Page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden glass-overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Transform / Desktop: Width transition */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen bg-white border-r border-gray-200 transition-all duration-300
          w-64
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          ${isSidebarOpen ? 'lg:w-64' : 'lg:w-0 lg:overflow-hidden'}
          lg:translate-x-0
        `}
      >
        <div className="h-full px-4 py-6 overflow-y-auto">
          <Link href="/admin" className="flex items-center mb-8 px-2 cursor-pointer gap-2">
            <img src="/logo-new.png" alt="Hy_stepper" className="h-8 w-auto object-contain" />
            <span className="ml-1 text-sm font-semibold text-gray-500">ADMIN</span>
          </Link>

          <nav className="space-y-1">
            {visibleMenuItems.map((item) => {
              const isActive = item.exact ? pathname === item.path : pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)} // Close on mobile click
                  className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors cursor-pointer ${isActive
                    ? 'bg-emerald-50 text-emerald-700 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`${item.icon} text-xl w-5 h-5 flex items-center justify-center`}></i>
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 pt-8 border-t border-gray-200 space-y-1">
            {/* Maintenance Mode Toggle */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg ${maintenanceEnabled ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <i className={`text-lg shrink-0 ${maintenanceEnabled ? 'ri-tools-fill text-amber-600' : 'ri-store-2-line text-gray-600'}`}></i>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">Maintenance</p>
                  <p className="text-xs text-gray-500 truncate">{maintenanceEnabled ? 'Store offline' : 'Store live'}</p>
                </div>
              </div>
              <button
                onClick={handleToggleMaintenance}
                disabled={maintenanceToggling}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${maintenanceEnabled ? 'bg-amber-500 focus:ring-amber-400' : 'bg-gray-300 focus:ring-gray-400'} ${maintenanceToggling ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                title={maintenanceEnabled ? 'Bring store back online' : 'Enable maintenance mode'}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${maintenanceEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
            <Link
              href="/"
              target="_blank"
              onClick={() => window.innerWidth < 1024 && setIsSidebarOpen(false)}
              className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              <i className="ri-external-link-line text-xl w-5 h-5 flex items-center justify-center"></i>
              <span>View Store</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`transition-all duration-300 ml-0 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'}`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 py-4 lg:px-6 flex items-center justify-between">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <i className={`${isSidebarOpen ? 'ri-menu-fold-line' : 'ri-menu-unfold-line'} text-xl`}></i>
            </button>

            <div className="flex items-center space-x-2 lg:space-x-4">
              <button className="relative w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                <i className="ri-notification-3-line text-xl"></i>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="relative user-menu-container">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 lg:space-x-3 px-2 lg:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-semibold text-gray-900">
                      {isSuperAdmin ? 'Super Admin' : 'Staff'}
                    </p>
                    <p className="text-xs text-gray-500 max-w-[100px] truncate">{user?.email}</p>
                  </div>
                  <i className="ri-arrow-down-s-line text-gray-600"></i>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-20">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-4 py-3 hover:bg-gray-50 transition-colors border-t border-gray-200 text-left cursor-pointer"
                    >
                      <i className="ri-logout-box-line text-red-600 w-5 h-5 flex items-center justify-center"></i>
                      <span className="text-red-600">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
