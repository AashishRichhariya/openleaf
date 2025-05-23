import Image from 'next/image';
import Link from 'next/link';

import { GitHubLink } from './icons/social-links/github';
import { InfoLink } from './icons/social-links/info';
import { RedditLink } from './icons/social-links/reddit';

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
          <InfoLink />
          <RedditLink />
          <GitHubLink />
        </div>
      </div>
    </nav>
  );
}
