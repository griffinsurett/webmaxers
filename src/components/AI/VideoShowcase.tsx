// src/components/AI/VideoShowcase.tsx
import { useRef, useState, useEffect } from "react";
import { FaPlay, FaPause, FaVolumeXmark, FaVolumeHigh, FaExpand } from "react-icons/fa6";

interface Props {
  videoSrc?: string;
  posterSrc?: string;
}

export default function VideoShowcase({
  videoSrc = "https://res.cloudinary.com/dp8m0gh5n/video/upload/v1781925224/The_Ghost_Shift__Scaling_Beyond_the_Human_Ceiling_c1uefq.mp4",
  posterSrc = "" // no poster needed for direct Cloudinary stream
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // default muted for autoplay friendly / clean initial state
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => console.log("Playback failed: ", e));
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration;
    if (duration > 0) {
      setProgress((current / duration) * 100);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    setProgress(parseFloat(e.target.value));
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // Attempt to autoplay muted on load
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay blocked (normal browser behavior) - show play overlay
          setIsPlaying(false);
        });
    }
  }, []);

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto rounded-2xl md:rounded-3xl border border-white/10 bg-zinc-950 overflow-hidden shadow-[0_0_60px_rgba(94,118,246,0.12)] group"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        className="w-full aspect-video object-cover cursor-pointer block"
        loop
        autoPlay
        muted={isMuted}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Custom Center Play/Pause Indicator (Only visible when paused) */}
      {!isPlaying && (
        <div 
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 cursor-pointer"
        >
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white text-lg md:text-xl shadow-xl hover:scale-110 hover:bg-white/20 transition-all duration-300">
            <FaPlay className="ml-1" />
          </div>
        </div>
      )}

      {/* Floating Ambient Glowing Border Overlay */}
      <div className="absolute inset-0 border border-[#5e76f6]/20 pointer-events-none rounded-2xl md:rounded-3xl z-10" />

      {/* Custom Control Bar (Appears on Hover / Show Controls) */}
      <div 
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 flex flex-col gap-3 transition-opacity duration-300 z-20 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress Seek Bar */}
        <div className="flex items-center w-full gap-2">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#5e76f6] focus:outline-none"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button 
              onClick={togglePlay} 
              className="text-lg hover:text-[#5e76f6] hover:scale-105 transition-all focus:outline-none"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <FaPause /> : <FaPlay />}
            </button>

            {/* Mute/Unmute */}
            <button 
              onClick={toggleMute} 
              className="text-lg hover:text-[#5e76f6] hover:scale-105 transition-all focus:outline-none flex items-center gap-1.5"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <FaVolumeXmark /> : <FaVolumeHigh />}
              <span className="text-[10px] font-medium opacity-60">
                {isMuted ? "Muted" : "Active"}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Tag / Status label */}
            <span className="text-[10px] uppercase tracking-widest text-[#5e76f6] bg-[#5e76f6]/10 px-2 py-0.5 rounded border border-[#5e76f6]/20 font-semibold select-none">
              explainer video
            </span>

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen} 
              className="text-base hover:text-[#5e76f6] hover:scale-105 transition-all focus:outline-none"
              title="Fullscreen"
            >
              <FaExpand />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
