'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="container nav-content">
        <Link href="/" className="nav-logo" onClick={() => setMenuOpen(false)}>
          <Image src="/logotransparent.png" alt="Keepin It Real Logo" width={50} height={50} style={{ objectFit: 'contain' }} />
          Keepin' It Real
        </Link>
        <ul className={`nav-links ${menuOpen ? 'active' : ''}`}>
          <li><Link href="/" className={pathname === '/' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Home</Link></li>
          <li><Link href="/videos" className={pathname === '/videos' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Videos</Link></li>
          <li><Link href="/theme-song" className={pathname === '/theme-song' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Theme Song</Link></li>
          <li><Link href="/news" className={pathname === '/news' ? 'active' : ''} onClick={() => setMenuOpen(false)}>News</Link></li>
          <li><Link href="/merch" className={pathname === '/merch' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Merch</Link></li>
          <li><Link href="/comments" className={pathname === '/comments' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Comments</Link></li>
          <li><Link href="/contact" className={pathname === '/contact' ? 'active' : ''} onClick={() => setMenuOpen(false)}>Contact</Link></li>
        </ul>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
      </div>
    </nav>
  );
}
