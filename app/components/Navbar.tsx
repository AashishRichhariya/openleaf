import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/" target="_blank">
            <Image
              src="/logo/animated-logo.svg"
              alt="Openleaf Logo"
              width={150}
              height={60}
              priority
            />
          </Link>
        </div>
        <div className="navbar-links"><Link href="/info" target="_blank" className="nav-link">
            info
        </Link></div>
      </div>
    </nav>
  );
}
