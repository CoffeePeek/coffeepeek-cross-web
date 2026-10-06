import React from 'react';
import type { IconProps } from '@phosphor-icons/react';
import { MATERIAL_ICON_MAP, SHOP_TAG_ICONS, getBrewMethodImage, isMaterialIconName } from './iconMap';

export interface AppIconProps extends IconProps {
  name: string;
  filled?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  filled,
  weight,
  size = 20,
  className,
  style,
  color,
  ...rest
}) => {
  const brew = name.startsWith('brew:');
  const image = brew ? getBrewMethodImage(name.slice(5)) : undefined;
  if (image) return <span className={className} aria-label={rest['aria-label']} aria-hidden={rest['aria-label'] ? undefined : true} role={rest['aria-label'] ? 'img' : undefined}
    style={{ display: 'inline-block', flexShrink: 0, width: size, height: size, backgroundColor: color ?? 'currentColor', maskImage: `url("${image}")`, WebkitMaskImage: `url("${image}")`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center', ...style }} />;
  const tag = name.slice(4).trim().toLowerCase();
  const Icon = name.startsWith('tag:') ? Object.hasOwn(SHOP_TAG_ICONS, tag) ? SHOP_TAG_ICONS[tag] : MATERIAL_ICON_MAP['list-star'] : brew ? MATERIAL_ICON_MAP.coffee : isMaterialIconName(name) ? MATERIAL_ICON_MAP[name] : undefined;
  if (!Icon) {
    return null;
  }

  const resolvedWeight = weight ?? (filled ? 'fill' : 'regular');

  return (
    <Icon
      size={size}
      weight={resolvedWeight}
      className={className}
      style={style}
      color={color}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    />
  );
};

export default AppIcon;
