'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useNavigationStore } from '@/stores/navigationStore';

export default function Breadcrumbs() {
  const breadcrumbs = useNavigationStore((state) => state.breadcrumbs);

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      {breadcrumbs.map((crumb, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1" />}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors hover:underline"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{crumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}