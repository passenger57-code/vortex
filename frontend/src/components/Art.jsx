import { useEffect, useState } from "react";

function hueOf(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 190 + (h % 90); // stays in the blue / violet / teal range of the brand
}

/** Artwork with a generated fallback (an orbit ring echoing the Vortex logo) when there is no image. */
export default function Art({ title, src, className = "" }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);

  if (!failed) {
    return <img src={src} alt="" loading="lazy" draggable="false" onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className}`} />;
  }
  const h = hueOf(title);
  return (
    <div aria-hidden="true" className={`relative h-full w-full overflow-hidden ${className}`}
      style={{ background: `linear-gradient(150deg, hsl(${h} 70% 17%), hsl(${(h + 50) % 360} 65% 5%))` }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(70% 90% at 85% 15%, hsl(${h} 95% 50% / .45), transparent 65%)` }} />
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <ellipse cx="120" cy="52" rx="86" ry="32" transform="rotate(-18 120 52)" fill="none" stroke={`hsl(${h} 100% 70%)`} strokeOpacity=".55" strokeWidth="2.2" />
        <ellipse cx="120" cy="52" rx="70" ry="24" transform="rotate(-18 120 52)" fill="none" stroke={`hsl(${h} 100% 80%)`} strokeOpacity=".25" strokeWidth="1" />
      </svg>
      <span className="absolute -bottom-6 left-3 select-none font-display text-[7rem] font-extrabold italic leading-none text-white/10">
        {(title || "V").trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
