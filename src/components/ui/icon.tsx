import React from "react";

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  title?: string;
};

export function Icon({ name, size = 16, className, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : "presentation"}
    >
      {title ? <title>{title}</title> : null}
      <use href={`/icons/airtable-icons.svg#${name}`} fill="currentColor" />
    </svg>
  );
}
