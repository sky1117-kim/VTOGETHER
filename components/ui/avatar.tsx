import * as React from 'react'

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className = '', ...props }, ref) => (
  <span
    ref={ref}
    className={`relative flex shrink-0 overflow-hidden rounded-full ${className}`}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className = '', ...props }, ref) => (
  <img
    ref={ref}
    className={`aspect-square size-full object-cover ${className}`}
    {...props}
  />
))
AvatarImage.displayName = 'AvatarImage'

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className = '', ...props }, ref) => (
  <span
    ref={ref}
    className={`flex size-full items-center justify-center rounded-full ${className}`}
    {...props}
  />
))
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
