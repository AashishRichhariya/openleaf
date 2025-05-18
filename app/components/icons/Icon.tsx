import React from 'react';

import HorizontalRule from '@/app/assets/icons/horizontal-rule.svg';
import Justify from '@/app/assets/icons/justify.svg';
import Number from '@/app/assets/icons/list-ol.svg';
import Bullet from '@/app/assets/icons/list-ul.svg';
import Check from '@/app/assets/icons/square-check.svg';
import Table from '@/app/assets/icons/table.svg';
import CenterAlign from '@/app/assets/icons/text-center.svg';
import LeftAlign from '@/app/assets/icons/text-left.svg';
import Paragraph from '@/app/assets/icons/text-paragraph.svg';
import RightAlign from '@/app/assets/icons/text-right.svg';
import H1 from '@/app/assets/icons/type-h1.svg';
import H2 from '@/app/assets/icons/type-h2.svg';
import H3 from '@/app/assets/icons/type-h3.svg';

// Icon map for lookup
const iconMap: Record<string, any> = {
  'table': Table,
  'h1': H1,
  'h2': H2,
  'h3': H3,
  'paragraph': Paragraph,
  'bullet': Bullet, 
  'number': Number,
  'check': Check,
  'horizontal-rule': HorizontalRule,
  'left-align': LeftAlign,
  'center-align': CenterAlign,
  'right-align': RightAlign,
  'justify': Justify,
};

interface IconProps {
  name: string;
  color?: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  color = "currentColor", 
  className = "" 
}) => {
  const SvgComponent = iconMap[name];
  
  if (!SvgComponent) {
    console.warn(`Icon "${name}" not found!`);
    return <span className={`icon ${className}`}></span>;
  }
  
  return <SvgComponent fill={color} className={`icon ${className}`} />;
};
