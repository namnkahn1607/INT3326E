export interface MapContainerProps {
  className?: string
  center?: [number, number]
  zoom?: number
  children?: React.ReactNode
}

/**
 * Placeholder component for Leaflet + OpenStreetMap integration (scheduled for Week 5).
 */
export function MapContainer({
  className = '',
  center = [21.0285, 105.8542], // Default Hanoi coordinates
  zoom = 13,
  children,
}: MapContainerProps) {
  return (
    <div
      className={`map-container-placeholder ${className}`}
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      style={{
        width: '100%',
        minHeight: '260px',
        backgroundColor: '#0f172a',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94a3b8',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
          Bản đồ Leaflet + OpenStreetMap
        </p>
        <span style={{ fontSize: '13px' }}>
          Tọa độ trung tâm: {center[0]}, {center[1]} (Zoom: {zoom})
        </span>
        {children}
      </div>
    </div>
  )
}
