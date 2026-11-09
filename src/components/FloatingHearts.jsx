export default function FloatingHearts() {
  const hearts = ['❤️', '💕', '💖', '💗', '💓', '💞']

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="absolute text-red-500 opacity-20 animate-float-heart"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: `${16 + Math.random() * 24}px`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${6 + Math.random() * 6}s`,
          }}
        >
          {hearts[i % hearts.length]}
        </span>
      ))}
    </div>
  )
}
