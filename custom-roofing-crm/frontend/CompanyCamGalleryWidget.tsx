import React, { useState, useMemo } from 'react';

export interface CompanyCamPhotoItem {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  capturedAt: string;
  creatorName: string;
  tags: string[];
  hasAnnotations?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface CompanyCamGalleryWidgetProps {
  projectId?: string;
  projectUrl?: string;
  shareLink?: string;
  photoCount?: number;
  photos?: CompanyCamPhotoItem[];
  allowIframeToggle?: boolean;
}

const SAMPLE_ROOFING_PHOTOS: CompanyCamPhotoItem[] = [
  {
    id: 'cc-1',
    thumbnailUrl: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1632759145351-1d592919f522?w=1200&auto=format&fit=crop&q=90',
    capturedAt: 'Today at 9:42 AM',
    creatorName: 'Carlos M. (Lead Tech)',
    tags: ['Pre-Inspection', 'Hail Damage'],
    hasAnnotations: true,
    latitude: 32.7955,
    longitude: -117.2541,
  },
  {
    id: 'cc-2',
    thumbnailUrl: 'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?w=1200&auto=format&fit=crop&q=90',
    capturedAt: 'Today at 10:15 AM',
    creatorName: 'Carlos M. (Lead Tech)',
    tags: ['Tear-Off', 'Rotted Decking'],
    hasAnnotations: true,
    latitude: 32.7956,
    longitude: -117.2542,
  },
  {
    id: 'cc-3',
    thumbnailUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&auto=format&fit=crop&q=90',
    capturedAt: 'Today at 11:30 AM',
    creatorName: 'Jake R. (Sub Lead)',
    tags: ['Underlayment', 'Ice & Water'],
    hasAnnotations: false,
    latitude: 32.7955,
    longitude: -117.2541,
  },
  {
    id: 'cc-4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=1200&auto=format&fit=crop&q=90',
    capturedAt: 'Today at 2:05 PM',
    creatorName: 'Carlos M. (Lead Tech)',
    tags: ['Flashing', 'Drip Edge'],
    hasAnnotations: true,
    latitude: 32.7954,
    longitude: -117.254,
  },
  {
    id: 'cc-5',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&auto=format&fit=crop&q=80',
    previewUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=90',
    capturedAt: 'Today at 4:15 PM',
    creatorName: 'Jake R. (Sub Lead)',
    tags: ['Final Roof', 'Completed'],
    hasAnnotations: false,
    latitude: 32.7955,
    longitude: -117.2541,
  },
];

export const CompanyCamGalleryWidget: React.FC<CompanyCamGalleryWidgetProps> = ({
  projectId = 'proj_84920482',
  projectUrl,
  shareLink,
  photoCount,
  photos = SAMPLE_ROOFING_PHOTOS,
  allowIframeToggle = true,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [activePhoto, setActivePhoto] = useState<CompanyCamPhotoItem | null>(null);
  const [showIframe, setShowIframe] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  const effectiveWebUrl = projectUrl || `https://app.companycam.com/projects/${projectId}`;
  const effectiveShareLink = shareLink || effectiveWebUrl;
  const count = photoCount ?? photos.length;

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    photos.forEach((p) => p.tags.forEach((t) => tagSet.add(t)));
    return ['ALL', ...Array.from(tagSet)];
  }, [photos]);

  // Filtered photos
  const filteredPhotos = useMemo(() => {
    if (selectedTag === 'ALL') return photos;
    return photos.filter((p) => p.tags.includes(selectedTag));
  }, [photos, selectedTag]);

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(effectiveShareLink);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const handleOpenCompanyCam = () => {
    window.open(effectiveWebUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        color: '#1e293b',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* CompanyCam Icon / Logo Badge */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '16px',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
            }}
          >
            CC
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                CompanyCam Photo Stream
              </h3>
              <span
                style={{
                  background: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                {count} Photos Live
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              GPS &amp; Timestamp Verified • Real-Time Field Sync from Jobsite
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {allowIframeToggle && (
            <button
              type="button"
              onClick={() => setShowIframe(!showIframe)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: showIframe ? '#f1f5f9' : '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {showIframe ? 'Grid View' : 'Embedded App View'}
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyShareLink}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copiedShareLink ? 'Link Copied!' : 'Share Gallery'}
          </button>

          {/* Primary Direct Launch Button */}
          <button
            type="button"
            onClick={handleOpenCompanyCam}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
            }}
          >
            Open in CompanyCam &rarr;
          </button>
        </div>
      </div>

      {/* Main Content: Iframe vs Native Gallery */}
      {showIframe ? (
        <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
          <iframe
            src={effectiveShareLink}
            title="CompanyCam Embedded Project"
            style={{
              width: '100%',
              height: '560px',
              border: 'none',
            }}
          />
        </div>
      ) : (
        <>
          {/* Tag Filter Chips */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              marginBottom: '16px',
            }}
          >
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: selectedTag === tag ? '#0f172a' : '#f1f5f9',
                  color: selectedTag === tag ? '#ffffff' : '#475569',
                  transition: 'background 0.15s ease',
                }}
              >
                {tag === 'ALL' ? 'All Photos' : tag}
              </button>
            ))}
          </div>

          {/* Photos Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '12px',
            }}
          >
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  aspectRatio: '4 / 3',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt={photo.tags.join(', ')}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />

                {/* Annotation Badge */}
                {photo.hasAnnotations && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(239, 68, 68, 0.9)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    Marked / Arrows
                  </div>
                )}

                {/* GPS Badge */}
                {photo.latitude && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      color: '#ffffff',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backdropFilter: 'blur(2px)',
                    }}
                  >
                    GPS Verified
                  </div>
                )}

                {/* Bottom Overlay with details */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
                    padding: '16px 8px 6px',
                    color: '#ffffff',
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {photo.tags.join(' • ')}
                  </div>
                  <div style={{ fontSize: '10px', opacity: 0.85 }}>
                    {photo.capturedAt} • {photo.creatorName.split(' ')[0]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Lightbox / Fullscreen Modal */}
      {activePhoto && (
        <div
          onClick={() => setActivePhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0f172a',
              borderRadius: '12px',
              overflow: 'hidden',
              maxWidth: '900px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
              border: '1px solid #334155',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxHeight: '600px', background: '#000' }}>
              <img
                src={activePhoto.previewUrl}
                alt="Enlarged view"
                style={{ width: '100%', maxHeight: '600px', objectFit: 'contain' }}
              />
            </div>
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#1e293b',
                color: '#f8fafc',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>
                  {activePhoto.tags.join(', ')}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Taken by {activePhoto.creatorName} • {activePhoto.capturedAt}
                  {activePhoto.latitude && ` • Lat: ${activePhoto.latitude}, Lon: ${activePhoto.longitude}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleOpenCompanyCam}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#0284c7',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  View on CompanyCam
                </button>
                <button
                  type="button"
                  onClick={() => setActivePhoto(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: 'transparent',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyCamGalleryWidget;
