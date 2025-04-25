import Image from 'next/image';
import Link from 'next/link';
import { RedditLink } from './social-links/reddit';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/" target="_blank" rel="noopener noreferrer">
            <Image
              src="/logo/animated-logo-minified.svg"
              alt="Openleaf Logo"
              width={150}
              height={60}
              priority
            />
          </Link>
        </div>
        <div className="navbar-links">
          <Link href="/info" target="_blank" rel="noopener noreferrer" className="nav-link">
            info
          </Link>
          <RedditLink size={24} />
        </div>
      </div>
    </nav>
  );
}
