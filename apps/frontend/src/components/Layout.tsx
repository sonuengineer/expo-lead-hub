import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  QrCode,
  FileText,
  ScanLine,
  RefreshCw,
  ScrollText,
  UserCog,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import clsx from "clsx";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/scan", label: "Scan Card", icon: ScanLine },
  { to: "/qr-codes", label: "QR Codes", icon: QrCode },
  { to: "/forms", label: "Form Builder", icon: FileText },
  { to: "/sync", label: "Sync", icon: RefreshCw },
  { to: "/audit", label: "Audit Log", icon: ScrollText },
  { to: "/users", label: "Users", icon: UserCog, roles: ["SUPER_ADMIN"] },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200 lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            E
          </div>
          <span className="text-lg font-bold text-gray-900">ELC</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems
            .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
            .map((item) => {
            const isActive =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user?.name?.charAt(0) ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{user?.name ?? "Admin"}</p>
              <p className="truncate text-xs text-gray-500">{user?.role ?? "SUPER_ADMIN"}</p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Exhibition Lead Capture</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
