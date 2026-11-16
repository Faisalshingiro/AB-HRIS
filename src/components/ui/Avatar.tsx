interface AvatarProps {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ firstName, lastName, photoUrl, size = 'md' }: AvatarProps) {
  const sizeClass = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg',
  }[size];

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className={`${sizeClass} rounded-full object-cover ring-2 ring-white`}
      />
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 font-semibold text-white ring-2 ring-white`}>
      {initials}
    </div>
  );
}
