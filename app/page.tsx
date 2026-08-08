'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import OurMission from '@/components/OurMission';

function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export default function Home() {
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    fetch('/videos.json?t=' + Date.now())
      .then(res => res.json())
      .then(data => setVideos(data.slice(0, 3)))
      .catch(err => console.error("Error loading videos:", err));
  }, []);

  return (
    <main>
      <header className="hero">
        <div className="hero-bg">
          <Image src="/bikesinob.jpg" alt="Bikes in Ocean Beach" fill style={{ objectFit: 'cover', objectPosition: 'center' }} priority />
        </div>
        <div className="hero-overlay"></div>
        <div className="container hero-content">
          <h1>Everyone is an <span>Open Book</span></h1>
          <p>Join Chris and Gary, a travelling father and son bicycle team, as they pedal around San Diego to interview folks who share their wisdom, humor, and incredible stories.</p>
          <Link href="/videos" className="btn btn-primary">Watch Episodes</Link>
        </div>
      </header>

      <OurMission />

      <section className="videos-section">
        <div className="container">
          <h2 className="section-title">Latest Episodes</h2>
          <div className="video-grid">
            {videos.map((video) => {
              const videoId = getYouTubeId(video.url);
              const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : video.url;
              
              return (
                <div key={video.id} className="video-card">
                  <div className="video-wrapper">
                    <iframe 
                      src={embedUrl} 
                      title={video.title} 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                    ></iframe>
                  </div>
                <div className="video-info">
                  <h3 className="line-clamp-2" title={video.title}>{video.title}</h3>
                </div>
              </div>
              );
            })}
          </div>
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link href="/videos" className="btn btn-primary">View All Videos</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

