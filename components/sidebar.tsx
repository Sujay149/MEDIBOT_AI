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
  const [sidebarWidth, setSidebarWidth] = useState(250); // Default width in pixels
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && resizerRef.current && sidebarRef.current) {
        const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
        if (newWidth > 100 && newWidth < 400) { // Min 100px for icon-only, max 400px
          setSidebarWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (resizerRef.current && resizerRef.current.contains(e.target as Node)) {
        setIsResizing(true);
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
    { icon: User, label: "Feedback", href: "/feedback" },
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

  const isIconOnly = sidebarWidth <= 150; // Threshold for icon-only mode

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleOverlayClick}
          onTouchStart={(e) => {
            if (e.target === e.currentTarget) {
              setSidebarOpen(false);
            }
          }}
        />
      )}

      <div className="lg:flex lg:items-start">
        {/* Hamburger Menu Button - Visible only on small screens */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg lg:hidden h-10 w-10 transition-transform hover:scale-105"
          aria-label="Toggle sidebar"
        >
          <svg
            className="h-6 w-6 text-purple-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </Button>

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card transition-transform duration-300 ease-in-out border-r border-border",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            "lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:h-screen lg:flex-col"
          )}
          style={{ width: sidebarOpen || window.innerWidth >= 1024 ? `${sidebarWidth}px` : "80px" }}
        >
          <div className="flex flex-col h-full p-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 relative">
                  <Image src="/logo.png" alt="MedBot Logo" width={32} height={32} className="rounded-full" />
                </div>
                {!isIconOnly && <span className="text-foreground font-semibold text-lg">Medibot</span>}
              </div>
              {/* No ">>>" button */}
            </div>

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
                {!isIconOnly && (
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">
                      {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "User"}
                    </p>
                    <p className="text-muted-foreground text-sm truncate">{user?.email || "user@example.com"}</p>
                  </div>
                )}
              </div>
            </div>

            <nav className="flex-1 space-y-2">
              {menuItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} legacyBehavior>
                    <a>
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-center lg:justify-start text-left h-12 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-purple-600 text-white shadow"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        <item.icon
                          className={cn("mr-0 lg:mr-3 h-5 w-5", isIconOnly ? "mx-auto" : "")}
                        />
                        {!isIconOnly && <span className="ml-2">{item.label}</span>}
                      </Button>
                    </a>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto space-y-3">
              {mounted && (
                <Button
                  variant="ghost"
                  onClick={toggleTheme}
                  className="w-full justify-center lg:justify-start text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl h-12 transition-all duration-200"
                >
                  <Sun className="mr-0 lg:mr-3 h-5 w-5" />
                  {!isIconOnly && (theme === "dark" ? "Theme: Light" : "Theme: Dark")}
                </Button>
              )}

              <Button
                onClick={handleSignOut}
                variant="outline"
                className="w-full justify-center lg:justify-start border-border text-muted-foreground hover:text-red-400 hover:bg-muted rounded-xl h-12 transition-all duration-200"
              >
                <LogOut className="mr-0 lg:mr-3 h-5 w-5" />
                {!isIconOnly && "Sign Out"}
              </Button>
            </div>
          </div>
          {/* Resizer Handle */}
          <div
            ref={resizerRef}
            className="absolute right-0 top-0 w-2 h-full bg-gray-400 cursor-col-resize hover:bg-purple-600 transition-colors z-10"
            style={{ left: `${sidebarWidth - 2}px` }}
            onMouseDown={(e) => e.preventDefault()} // Prevent text selection
          ></div>
        </div>
      </div>
    </>
  );
}