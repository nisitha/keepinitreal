'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface MerchItem {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  imageUrl: string;
  hasSizes?: boolean;
}

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const;
type Size = typeof SIZES[number];

export default function MerchSection() {
  const [items, setItems] = useState<MerchItem[]>([]);
  const [loading, setLoading] = useState(true);
  // Map of item.id → selected size (undefined = none chosen yet)
  const [selectedSizes, setSelectedSizes] = useState<Map<string, Size>>(new Map());

  useEffect(() => {
    fetch('/merch.json')
      .then(res => {
        if (!res.ok) throw new Error('No merch found');
        return res.json();
      })
      .then(data => setItems(data))
      .catch(err => console.error("Error loading merch:", err))
      .finally(() => setLoading(false));
  }, []);

  const selectSize = (itemId: string, size: Size) => {
    setSelectedSizes(prev => {
      const next = new Map(prev);
      // Clicking the already-selected size deselects it
      if (next.get(itemId) === size) {
        next.delete(itemId);
      } else {
        next.set(itemId, size);
      }
      return next;
    });
  };

  if (loading || items.length === 0) return null;

  return (
    <section className="merch-section" style={{ padding: '100px 20px', backgroundColor: '#FAFAFA' }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 className="section-title" style={{ fontSize: '3rem', color: '#111827', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 16px 0' }}>
            Exclusive Gear
          </h2>
          <p style={{ fontSize: '1.125rem', color: '#6B7280', maxWidth: '600px', margin: '0 auto' }}>
            Premium quality apparel for the journey ahead. Support the mission in style.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '40px'
        }}>
          {items.map(item => {
            const priceStr = String(item.price);
            const selectedSize = selectedSizes.get(item.id);
            const requiresSize = item.hasSizes === true;
            const hasSelectedSize = !!selectedSize;
            const canCheckout = !requiresSize || hasSelectedSize;

            // Size is appended to item_name so it appears on the PayPal invoice
            const itemNameWithSize = requiresSize 
              ? `${item.name} - Size: ${selectedSize}` 
              : `${item.name} - One Size`;

            const checkoutUrl = canCheckout
              ? `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=gary@lisaslight.com&item_name=${encodeURIComponent(itemNameWithSize)}&amount=${item.price}&currency_code=USD&notify_url=${encodeURIComponent('https://keepinitreal.us/ipn.php')}&custom=${encodeURIComponent(item.id)}`
              : '#';

            return (
              <div key={item.id} className="merch-card group" style={{
                backgroundColor: 'white',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
              }}>
                <Link href={`/merch/item?id=${item.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: '340px',
                    backgroundColor: '#F3F4F6',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 400px"
                      style={{
                        objectFit: 'contain',
                        padding: '40px',
                        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      className="merch-image"
                    />
                  </div>
                </Link>

                <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <Link href={`/merch/item?id=${item.id}`} style={{ textDecoration: 'none' }}>
                      <h3 style={{ margin: '0', fontSize: '1.25rem', color: '#111827', fontWeight: '700', lineHeight: '1.4' }}>{item.name}</h3>
                    </Link>
                    <span style={{ fontSize: '1.25rem', color: '#111827', fontWeight: '600' }}>
                      {priceStr.startsWith('$') ? priceStr : `$${priceStr}`}
                    </span>
                  </div>

                  {item.description && (
                    <p style={{ margin: '0 0 20px 0', fontSize: '0.95rem', color: '#6B7280', lineHeight: '1.5' }}>
                      {item.description}
                    </p>
                  )}

                  {/* ── Size Selector (only for items that require sizing) ──── */}
                  {requiresSize && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: hasSelectedSize ? '#111827' : '#9CA3AF',
                      marginBottom: '10px'
                    }}>
                      {hasSelectedSize ? `Size: ${selectedSize}` : 'Select a Size'}
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {SIZES.map(size => {
                        const isSelected = selectedSize === size;
                        return (
                          <button
                            key={size}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              selectSize(item.id, size);
                            }}
                            aria-pressed={isSelected}
                            aria-label={`Select size ${size}`}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '10px',
                              border: isSelected ? '2px solid #111827' : '2px solid #E5E7EB',
                              backgroundColor: isSelected ? '#111827' : 'white',
                              color: isSelected ? 'white' : '#374151',
                              fontSize: '0.85rem',
                              fontWeight: '700',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: isSelected ? '0 4px 10px rgba(17,24,39,0.2)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#9CA3AF';
                                e.currentTarget.style.backgroundColor = '#F9FAFB';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.borderColor = '#E5E7EB';
                                e.currentTarget.style.backgroundColor = 'white';
                              }
                            }}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  )}

                  {/* ── Buy Button ──────────────────────────────────────────── */}
                  <div style={{ marginTop: 'auto' }}>
                    {requiresSize && !hasSelectedSize && (
                      <p style={{
                        fontSize: '0.8rem',
                        color: '#F59E0B',
                        fontWeight: '600',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        Please select a size to continue
                      </p>
                    )}
                    <a
                      href={checkoutUrl}
                      target={canCheckout ? '_blank' : undefined}
                      rel={canCheckout ? 'noopener noreferrer' : undefined}
                      onClick={(e) => { if (!canCheckout) e.preventDefault(); }}
                      aria-disabled={!canCheckout}
                      className="buy-btn"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        backgroundColor: canCheckout ? '#111827' : '#E5E7EB',
                        color: canCheckout ? 'white' : '#9CA3AF',
                        padding: '14px 24px',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        boxSizing: 'border-box',
                        cursor: canCheckout ? 'pointer' : 'not-allowed',
                        pointerEvents: 'auto',
                      }}
                      onMouseEnter={(e) => {
                        if (canCheckout) {
                          e.currentTarget.style.backgroundColor = '#374151';
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (canCheckout) {
                          e.currentTarget.style.backgroundColor = '#111827';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {/* PayPal wordmark icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.99l-.276 1.suspension"/>
                      </svg>
                      {canCheckout ? 'Buy Now via PayPal' : 'Select Size First'}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .merch-card:hover .merch-image { transform: scale(1.1) !important; }
      `}} />
    </section>
  );
}
