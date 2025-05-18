import Link from 'next/link';
import React from 'react';

import { IconProps, SocialLinkProps } from '@/types';

const InfoIcon: React.FC<IconProps> = ({ size = 32 }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 280 280" 
      width={size} 
      height={size} 
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M140 0C217.32 0 280 62.6801 280 140C280 217.32 217.32 280 140 280C62.6801 280 0 217.32 0 140C0 62.6801 62.6801 0 140 0ZM64 65V152.206C64 175.79 69.8832 197.534 82.7354 213.6C95.828 229.965 115.356 239.412 140.177 239.412C164.998 239.412 184.525 229.965 197.617 213.6C210.47 197.534 216.353 175.79 216.353 152.206C216.352 128.622 210.47 106.877 197.617 90.8115C184.525 74.4461 164.998 65.0001 140.177 65H64ZM140.177 126.839C143.832 126.839 146.794 129.801 146.794 133.456V202.941C146.794 206.596 143.832 209.56 140.177 209.56H131.354C127.699 209.56 124.735 206.596 124.735 202.941V133.456C124.735 129.801 127.699 126.839 131.354 126.839H140.177ZM135.765 93.75C141.856 93.75 146.794 98.6881 146.794 104.779C146.794 110.871 141.856 115.81 135.765 115.81C129.673 115.809 124.735 110.871 124.735 104.779C124.736 98.6882 129.674 93.7502 135.765 93.75Z"/>
    </svg>
  );
};

export const InfoLink: React.FC<SocialLinkProps> = ({ 
  href = '/info', 
  label = 'Learn more about openleaf', 
}) => {
  return (
    <Link 
      href={href}
      target="_blank" 
      rel="noopener"
      className={'nav-link social-link'}
      aria-label={label}
    >
      <InfoIcon />
    </Link>
  );
};