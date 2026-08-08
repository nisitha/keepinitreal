import React from 'react';
import Image from 'next/image';

const OurMission = () => {
  return (
    <section className="mission-section">
      <div className="mission-container">
        
        {/* Image Container */}
        <div className="mission-image-wrapper">
          <img 
            src="/newbikesinob.jpg"
            alt="Chris and Gary with their bicycles" 
            className="w-full h-auto rounded-3xl shadow-lg transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl cursor-pointer"
          />
        </div>

        {/* Text Content */}
        <div className="mission-content">
          <h2 className="mission-title">
            Our Mission
          </h2>
          
          <p className="mission-subtitle">
            Introducing Chris (age 49) and Gary (age 74). We believe everyone has a story waiting to be heard.
          </p>
          
          <p className="mission-text">
            The premise is simple: Your hosts will interview random folks along the streets, parks, beaches, shops, and major attractions of San Diego. We always ask permission first and treat everyone with respect and consideration.
          </p>
          
          <p className="mission-footer-note">
            We are a non-profit, non-commercial, non-political, grassroots venture posting fun, light-hearted, and spontaneous videos every week!
          </p>
        </div>

      </div>
    </section>
  );
};

export default OurMission;
