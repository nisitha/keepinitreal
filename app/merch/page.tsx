'use client';
import MerchSection from '@/components/MerchSection';

export default function MerchPage() {
  return (
    <main>
      <header className="page-header" style={{ padding: '100px 20px', backgroundColor: '#0F172A', color: 'white', textAlign: 'center' }}>
        <div className="container">
          <h1 style={{ fontSize: '3rem', margin: '0 0 15px 0', fontWeight: '800' }}>Official Merchandise</h1>
          <p style={{ fontSize: '1.2rem', color: '#94A3B8', maxWidth: '600px', margin: '0 auto', lineHeight: '1.6' }}>
            Support Keepin' It Real by grabbing some of our exclusive gear. Every purchase helps us keep pedaling and sharing stories.
          </p>
        </div>
      </header>
      <MerchSection />
    </main>
  );
}
