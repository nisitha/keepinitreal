"use client";
import React, { useRef, useState } from 'react';

export default function ModernAppPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const skipTime = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const clickPos = e.clientX - bar.getBoundingClientRect().left;
    const percentage = clickPos / bar.offsetWidth;
    if (audioRef.current) {
      audioRef.current.currentTime = percentage * duration;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <section className="map-section">
      
      {/* Mobile App Container */}
      <div className="map-device">
        
        <audio 
          ref={audioRef} 
          src="/theme-song.mp3" 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          preload="metadata"
        />

        {/* Top Header */}
        <div className="map-header">
          <h1 className="map-header-title">
            <svg className="map-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5l-10 14M22 12H2M19 17L5 7"/></svg>
            keepinitreal.us
          </h1>
        </div>

        {/* Search/Mood Bar */}
        <div className="map-mood-bar">
          <span className="map-mood-text">Groovy mood</span>
          <svg className="map-mood-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>

        {/* Vinyl Record Area */}
        <div className="map-vinyl-area">
          {/* Share Icon */}
          <button className="map-share-btn">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
          </button>

          {/* The White Vinyl */}
          <div className={`map-vinyl ${isPlaying ? 'map-vinyl-spinning' : ''}`}>
            {/* Grooves */}
            <div className="map-groove map-groove-1"></div>
            <div className="map-groove map-groove-2"></div>
            <div className="map-groove map-groove-3"></div>
            
            {/* Red Center Label */}
            <div className="map-vinyl-center">
              <span className="map-vinyl-label-top">Pedal Power</span>
              <div className="map-vinyl-spindle"></div>
              <span className="map-vinyl-label-bottom">✦</span>
            </div>
          </div>
        </div>

        {/* Track Info & Controls */}
        <div className="map-controls-area">
          
          <div className="map-track-info">
            <div>
              <h2 className="map-track-title">Pedal Power</h2>
              <p className="map-track-artist">Chris &amp; Gary (AI)</p>
            </div>
            <button className="map-heart-btn">
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
            </button>
          </div>

          {/* Progress Bar */}
          <div className="map-progress-wrapper">
            <div 
              className="map-progress-track"
              onClick={handleProgressClick}
            >
              <div 
                className="map-progress-fill"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="map-progress-knob"></div>
              </div>
            </div>
            <div className="map-time-labels">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="map-main-controls">
            <button onClick={() => skipTime(-10)} className="map-skip-btn">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
            </button>
            
            <button onClick={togglePlay} className="map-play-btn">
              {isPlaying ? (
                <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button onClick={() => skipTime(10)} className="map-skip-btn">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
            </button>
          </div>

          {/* Bottom Utility Icons */}
          <div className="map-utility-icons">
             <svg className="map-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
             <svg className="map-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
             <svg className="map-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"></path></svg>
             <svg className="map-util-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
          </div>

        </div>
      </div>
    </section>
  );
}
