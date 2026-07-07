'use client';

import { useState, useRef, useEffect } from 'react';
import ManaPipBar from './ManaPipBar';

const menuLinks = [
  { href: '/', label: 'HOME' },
  { href: '/faq', label: 'FAQ' },
  { href: '/stuff', label: 'STUFF' },
  { href: '/contact', label: 'CONTACT' },
];

export default function HeaderMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="mt-3 inline-flex items-center gap-3 relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <span style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
          MENU
        </span>
        <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {menuLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="block px-4 py-2 text-sm text-center text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      <ManaPipBar />
    </div>
  );
}
