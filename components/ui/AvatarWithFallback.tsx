import React, { useEffect, useMemo, useState } from "react";
import { User as UserIcon } from "lucide-react";

interface AvatarWithFallbackProps {
  src?: string | null;
  alt: string;
  className: string;
  fallbackClassName?: string;
  iconSize?: number;
  title?: string;
}

const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({
  src,
  alt,
  className,
  fallbackClassName,
  iconSize = 14,
  title,
}) => {
  const [hasLoadError, setHasLoadError] = useState(false);

  const normalizedSrc = useMemo(() => (src || "").trim(), [src]);
  const hasValidSource = normalizedSrc.length > 0 && !hasLoadError;

  useEffect(() => {
    setHasLoadError(false);
  }, [normalizedSrc]);

  if (hasValidSource) {
    return (
      <img
        src={normalizedSrc}
        alt={alt}
        title={title}
        className={className}
        onError={() => setHasLoadError(true)}
      />
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center ${fallbackClassName || "bg-slate-700 text-slate-300"}`}
      aria-label={alt}
      title={title}
    >
      <UserIcon size={iconSize} />
    </div>
  );
};

export default AvatarWithFallback;
