import { HeartPulse } from 'lucide-react'
import { useState } from 'react'

export function BrandLogo({ className = 'h-10 w-10' }: { className?: string }) {
  const [imageUnavailable, setImageUnavailable] = useState(false)

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-[#263238] shadow-sm ${className}`} aria-hidden="true">
      {imageUnavailable ? (
        <HeartPulse className="size-1/2" strokeWidth={2.2} />
      ) : (
        <img src="/mainlogo.jpg" alt="" className="h-full w-full object-contain" onError={() => setImageUnavailable(true)} />
      )}
    </span>
  )
}
