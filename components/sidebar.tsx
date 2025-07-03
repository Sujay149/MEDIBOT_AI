"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
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
  X,
  Menu,
  MessageSquare,
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
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if mobile view
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizerRef.current || !sidebarRef.current) return;
      
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth > 100 && newWidth < 400) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (resizerRef.current?.contains(e.target as Node)) {
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isResizing]);

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

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSidebarOpen(false);
    }
  };

  const isIconOnly = sidebarWidth <= 150 && !isMobile;

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [pathname, isMobile]);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleOverlayClick}
        />
      )}

      <div className="lg:flex lg:items-start">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg lg:hidden h-10 w-10"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card border-r border-border",
            "transition-all duration-300 ease-in-out",
            "flex flex-col",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0 lg:static lg:inset-0",
            isMobile ? "w-[280px]" : ""
          )}
          style={{
            width: !isMobile ? `${sidebarWidth}px` : undefined,
          }}
        >
          <div className="flex flex-col h-full p-4 overflow-y-auto">
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
                {(!isIconOnly || isMobile) && (
                  <span className="text-foreground font-semibold text-lg">Medibot</span>
                )}
              </div>
              
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* User profile */}
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
                {(!isIconOnly || isMobile) && (
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">
                      {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User"}
                    </p>
                    <p className="text-muted-foreground text-sm truncate">
                      {user?.email || "user@example.com"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
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
                          isIconOnly && !isMobile ? "justify-center" : "px-4"
                        )}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {(!isIconOnly || isMobile) && (
                          <span className="ml-3">{item.label}</span>
                        )}
                      </Button>
                    </a>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom actions */}
            <div className="mt-auto space-y-3 pt-10">
              {mounted && (
                <Button
                  variant="ghost"
                  onClick={toggleTheme}
                  className={cn(
                    "w-full justify-start h-12 rounded-xl",
                    "text-muted-foreground hover:text-foreground hover:bg-muted",
                    isIconOnly && !isMobile ? "justify-center" : "px-4"
                  )}
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                  {(!isIconOnly || isMobile) && (
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
                  isIconOnly && !isMobile ? "justify-center" : "px-4"
                )}
              >
                <LogOut className="h-5 w-5" />
                {(!isIconOnly || isMobile) && <span className="ml-3">Sign Out</span>}
              </Button>
            </div>
          </div>
          
          {/* Resizer (desktop only) */}
          {!isMobile && (
            <div
              ref={resizerRef}
              className="absolute right-0 top-0 w-1.5 h-full bg-border cursor-col-resize hover:bg-purple-600 active:bg-purple-600 transition-colors z-10"
              style={{ left: `${sidebarWidth - 2}px` }}
              onMouseDown={(e) => e.preventDefault()}
            />
          )}
        </div>
      </div>
    </>
  );
}