interface StatCardProps {
  title: string
  value: string | number
  description?: string
  trend?: string
  color?: string
}

export function StatCard({
  title,
  value,
  description,
  trend,
  color = '#2563eb',
}: StatCardProps) {
  return (
    <div
      className="stat-card"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '12px',
        }}
      >
        <span
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color,
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#16a34a',
              backgroundColor: '#dcfce7',
              padding: '2px 8px',
              borderRadius: '9999px',
            }}
          >
            {trend}
          </span>
        )}
      </div>
      {description && (
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{description}</span>
      )}
    </div>
  )
}
