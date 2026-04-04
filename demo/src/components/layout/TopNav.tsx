import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  FlaskConical,
  LayoutGrid,
  BookOpen,
  Info,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navLinks = [
  { to: '/', label: 'Pipeline', icon: FlaskConical },
  { to: '/demos', label: 'Demos', icon: LayoutGrid },
  { to: '/docs', label: 'Docs', icon: BookOpen },
  { to: '/about', label: 'About', icon: Info },
] as const;

export default function TopNav() {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  function isLinkActive(to: string) {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  if (isMobile) {
    return (
      <nav className="sticky top-0 z-40 flex h-12 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <Link to="/" className="text-lg font-bold tracking-tight">
          jsfeat
        </Link>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-1 px-4">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setSheetOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted',
                    isLinkActive(to)
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground'
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-40 flex h-12 items-center gap-6 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link to="/" className="text-lg font-bold tracking-tight">
        jsfeat
      </Link>
      <div className="flex items-center gap-1">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
              isLinkActive(to)
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground'
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
