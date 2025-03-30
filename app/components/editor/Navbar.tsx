import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/">
            <Image
              src="/logo/animated-logo.svg"
              alt="Openleaf Logo"
              width={150}
              height={60}
              priority
            />
          </Link>
        </div>
        <div className="navbar-links">{/* Placeholder for future links */}</div>
      </div>
    </nav>
  );
}
