"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  MessageCircle,
  FileText,
  Pill,
  History,
  User,
  Moon,
  Sun,
  LogOut,
  Calendar,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, userProfile, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(isOpen);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setCollapsed(false);
      }
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const menuItems = [
    { icon: MessageCircle, label: "AI Chatbot", href: "/chat" },
    { icon: FileText, label: "Info Summarizer", href: "/summarizer" },
    { icon: Calendar, label: "Appointments", href: "/appointments" },
    { icon: Pill, label: "Medications", href: "/medications" },
    { icon: History, label: "Chat History", href: "/history" },
    { icon: User, label: "My Profile", href: "/profile" },
    { icon: MessageSquare, label: "Feedback", href: "/feedback" },
  ];

  const handleSignOut = async () => {
    try {
      await logout();
      setSidebarOpen(false);
      if (onClose) onClose();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const toggleCollapse = () => {
    setCollapsed((prev) => !prev);
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSidebarOpen(false);
    }
  };

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  return (
    <>
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleOverlayClick}
        />
      )}

      <div className="lg:flex lg:items-start">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg lg:hidden h-10 w-10"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card border-r border-border",
            "transition-all duration-300 ease-in-out",
            "flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0 lg:static lg:inset-0",
            isMobile ? "w-[280px]" : "w-[250px]",
            collapsed && "lg:w-[80px]"
          )}
          style={{
            height: '100vh',
            position: isMobile ? 'fixed' : 'sticky',
            top: 0,
          }}
        >
          <div className="flex flex-col h-full p-4">
            <div className="flex-shrink-0">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 relative">
                    <Image 
                      src="/logo.png" 
                      alt="MedBot Logo" 
                      width={32} 
                      height={32} 
                      className="rounded-full" 
                    />
                  </div>
                  {!collapsed && (
                    <span className="text-foreground font-semibold text-lg">Medibot</span>
                  )}
                </div>
                
                {isMobile ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <button
                    onClick={toggleCollapse}
                    className="hidden lg:flex items-center justify-center h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  >
                    {collapsed ? (
                      <span className="text-lg font-mono">››</span>
                    ) : (
                      <span className="text-lg font-mono">‹‹</span>
                    )}
                  </button>
                )}
              </div>

              {!collapsed && (
                <div className="bg-muted rounded-xl p-4 mb-6 border border-border">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={userProfile?.photoURL || user?.photoURL || ""} />
                      <AvatarFallback className="bg-purple-600 text-white font-semibold">
                        {userProfile?.displayName?.charAt(0).toUpperCase() ||
                          user?.displayName?.charAt(0).toUpperCase() ||
                          user?.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium truncate">
                        {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User"}
                      </p>
                      <p className="text-muted-foreground text-sm truncate">
                        {user?.email || "user@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              <nav className="space-y-2">
                {menuItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} legacyBehavior>
                      <a>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-left h-12 rounded-xl transition-all duration-200",
                            "flex items-center",
                            isActive
                              ? "bg-purple-600 text-white shadow"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                            collapsed ? "justify-center" : "px-4"
                          )}
                          title={collapsed ? item.label : undefined}
                        >
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          {!collapsed && (
                            <span className="ml-3">{item.label}</span>
                          )}
                        </Button>
                      </a>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="flex-shrink-0 space-y-3 pt-4">
              {mounted && (
                <Button
                  variant="ghost"
                  onClick={toggleTheme}
                  className={cn(
                    "w-full justify-start h-12 rounded-xl",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                    collapsed ? "justify-center" : "px-4"
                  )}
                  title={collapsed ? (theme === "dark" ? "Light Mode" : "Dark Mode") : undefined}
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                  {!collapsed && (
                    <span className="ml-3">
                      {theme === "dark" ? "Light Mode" : "Dark Mode"}
                    </span>
                  )}
                </Button>
              )}

              <Button
                onClick={handleSignOut}
                variant="outline"
                className={cn(
                  "w-full justify-start border-border h-12 rounded-xl",
                  "text-muted-foreground hover:text-red-400 hover:bg-muted",
                  collapsed ? "justify-center" : "px-4"
                )}
                title={collapsed ? "Sign Out" : undefined}
              >
                <LogOut className="h-5 w-5" />
                {!collapsed && <span className="ml-3">Sign Out</span>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}