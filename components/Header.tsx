'use client';

import { Bell, User, Menu, LogOut, Settings } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return;
      }
      
      router.push('/auth/signin');
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
    }
  };

  return (
    <header className="border-b border-gray-700 px-6 h-16 flex items-center justify-between" style={{backgroundColor: '#10332b'}}>
      {/* Left section */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuClick}
          className="lg:hidden text-white hover:bg-gray-700"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center justify-center w-64">
          <img 
            src="/Artboard 8.png" 
            alt="Los Pinos" 
            className="h-14 w-auto object-contain"
          />
        </div>
      </div>


      {/* Right section */}
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="sm" className="relative text-white hover:bg-gray-700">
          <Bell className="h-5 w-5" />
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            3
          </Badge>
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-white hover:bg-gray-700">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} variant="destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}