import React from "react";
import AvatarWithFallback from "./AvatarWithFallback";

interface UserIdentityProps {
  avatarSrc?: string | null;
  avatarAlt: string;
  avatarClassName?: string;
  avatarFallbackClassName?: string;
  avatarIconSize?: number;
  name: React.ReactNode;
  subtitle?: React.ReactNode;
  containerClassName?: string;
  textContainerClassName?: string;
  nameClassName?: string;
  subtitleClassName?: string;
}

const UserIdentity: React.FC<UserIdentityProps> = ({
  avatarSrc,
  avatarAlt,
  avatarClassName = "w-8 h-8 rounded-full",
  avatarFallbackClassName,
  avatarIconSize = 14,
  name,
  subtitle,
  containerClassName = "flex items-center gap-3",
  textContainerClassName,
  nameClassName = "font-bold text-sm text-white",
  subtitleClassName = "text-xs text-slate-500",
}) => {
  return (
    <div className={containerClassName}>
      <AvatarWithFallback
        src={avatarSrc}
        alt={avatarAlt}
        className={avatarClassName}
        fallbackClassName={avatarFallbackClassName}
        iconSize={avatarIconSize}
      />
      <div className={textContainerClassName}>
        <div className={nameClassName}>{name}</div>
        {subtitle != null && (
          <div className={subtitleClassName}>{subtitle}</div>
        )}
      </div>
    </div>
  );
};

export default UserIdentity;
