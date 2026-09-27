'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

interface MerchItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  price: string | number;
  imageUrl: string;
  businessEmail?: string;
}

function ProductDetails() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [item, setItem] = useState<MerchItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    async function loadItem() {
      try {
        const docSnap = await getDoc(doc(db, 'site_merch', id!));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setItem({
            id: docSnap.id,
            name: data.title || data.name || 'Merch Item',
            description: data.description || "Official Keepin' It Real Gear. Shipping included.",
            price: data.price,
            imageUrl: data.imageUrl || '/merch-polo.jpg',
            businessEmail: data.businessEmail || 'gary@lisaslight.com',
          });
          setLoading(false);
          return;
        }

        const allSnap = await getDocs(collection(db, 'site_merch'));
        const foundDoc = allSnap.docs.find(d => d.id === id || (d.data() as any).id === id);
        if (foundDoc) {
          const data = foundDoc.data();
          setItem({
            id: foundDoc.id,
            name: data.title || data.name || 'Merch Item',
            description: data.description || "Official Keepin' It Real Gear. Shipping included.",
            price: data.price,
            imageUrl: data.imageUrl || '/merch-polo.jpg',
            businessEmail: data.businessEmail || 'gary@lisaslight.com',
          });
          setLoading(false);
          return;
        }

        const res = await fetch('/merch.json');
        if (res.ok) {
          const data: MerchItem[] = await res.json();
          const found = data.find(m => m.id === id);
          setItem(found || null);
        }
      } catch (err) {
        console.error('Error loading product from Firestore:', err);
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading product details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '2rem', color: '#111827', marginBottom: '16px' }}>Product Not Found</h2>
        <Link href="/merch" style={{ color: '#0D9488', textDecoration: 'none', fontWeight: '600' }}>
          &larr; Back to Merch
        </Link>
      </div>
    );
  }

  const priceStr = String(item.price);
  const displayPrice = priceStr.startsWith('$') ? priceStr : `$${priceStr}`;
  
  // Bugfix: Sanitize price for PayPal (remove $ or letters)
  const sanitizePrice = (p: string | number) => String(p).replace(/[^0-9.]/g, '');
  const cleanPrice = sanitizePrice(item.price);
  
  // Bugfix: Fallback business email
  const businessEmail = (item as any).businessEmail || 'gary@lisaslight.com';

  const checkoutUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(businessEmail)}&item_name=${encodeURIComponent(item.name)}&amount=${cleanPrice}&currency_code=USD&notify_url=${encodeURIComponent('https://keepinitreal.us/ipn.php')}&custom=${encodeURIComponent(item.id)}`;

  return (
    <div style={{ padding: '60px 20px', backgroundColor: '#FAFAFA', minHeight: '80vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <Link href="/merch" style={{ color: '#6B7280', textDecoration: 'none', fontWeight: '500', fontSize: '1.1rem' }}>
            &larr; Back to Merch
          </Link>
        </div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
          gap: '60px',
          backgroundColor: 'white',
          borderRadius: '32px',
          padding: '40px',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Left Column - Image */}
          <div style={{ 
            position: 'relative', 
            width: '100%', 
            height: '500px', 
            backgroundColor: '#F3F4F6',
            borderRadius: '24px',
            overflow: 'hidden'
          }}>
            <Image 
              src={item.imageUrl} 
              alt={item.name} 
              fill 
              sizes="(max-width: 768px) 100vw, 600px"
              style={{ objectFit: 'contain', padding: '40px' }}
              priority
            />
          </div>

          {/* Right Column - Details */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h1 style={{ fontSize: '3rem', color: '#111827', fontWeight: '800', lineHeight: '1.2', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
              {item.name}
            </h1>
            <p style={{ fontSize: '2rem', color: '#0D9488', fontWeight: '700', margin: '0 0 32px 0' }}>
              {displayPrice}
            </p>
            
            {item.description && (
              <div style={{ marginBottom: '40px' }}>
                <h3 style={{ fontSize: '1.25rem', color: '#111827', fontWeight: '600', marginBottom: '12px' }}>Description</h3>
                <p style={{ fontSize: '1.1rem', color: '#4B5563', lineHeight: '1.6', margin: 0 }}>
                  {item.description}
                </p>
              </div>
            )}
            
            <a 
              href={checkoutUrl}
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#111827',
                color: 'white',
                padding: '20px 40px',
                borderRadius: '16px',
                fontSize: '1.25rem',
                fontWeight: '700',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                width: '100%',
                boxSizing: 'border-box',
                boxShadow: '0 10px 15px -3px rgba(17, 24, 39, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#374151';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#111827';
                e.currentTarget.style.transform = 'none';
              }}
            >
              Buy Now via PayPal
            </a>
            
            <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', fontSize: '0.95rem' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Secure checkout with PayPal
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ItemPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.25rem', color: '#6B7280' }}>Loading...</p>
      </div>
    }>
      <ProductDetails />
    </Suspense>
  );
}
