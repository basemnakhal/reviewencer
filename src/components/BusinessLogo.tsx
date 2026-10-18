import { cn } from '@/lib/utils';

interface Props {
  /** Image URL (businesses.logo_url) or an emoji. */
  logo?: string | null;
  fallback?: string;
  className?: string;
}

/** Business logo: renders the image when we have a URL, otherwise an emoji. */
export function BusinessLogo({ logo, fallback = '🏢', className }: Props) {
  if (logo?.startsWith('http')) {
    // eslint-disable-next-line @next/next/no-img-element -- remote favicons from many hosts
    return <img src={logo} alt="" className={cn('h-full w-full rounded-[inherit] bg-white object-contain', className)} />;
  }
  return <span aria-hidden className={className}>{logo || fallback}</span>;
}
