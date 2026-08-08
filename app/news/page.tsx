import Image from 'next/image';

export default function NewsPage() {
  return (
    <main>
      <header className="page-header">
        <div className="container">
          <h1>In The News</h1>
          <p>Articles and press about our journey across San Diego.</p>
        </div>
      </header>
      <section className="articles-section">
        <div className="container">
          <div className="articles-grid">
            <div className="article-card">
              <Image src="/news1.jpeg" alt="News Article 1" width={800} height={1000} style={{width:'100%', height:'auto'}} />
            </div>
            <div className="article-card">
              <Image src="/news2.jpeg" alt="News Article 2" width={800} height={1000} style={{width:'100%', height:'auto'}} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
