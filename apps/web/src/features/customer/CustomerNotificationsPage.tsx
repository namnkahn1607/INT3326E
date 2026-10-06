export function CustomerNotificationsPage() {
  const notifications = [
    {
      id: 1,
      title: 'Tài xế đã nhận hàng',
      message: 'Đơn hàng #PF-89021 đã được tài xế Lê Văn Tài lấy từ điểm xuất phát và đang di chuyển.',
      time: '15 phút trước',
      unread: true,
    },
    {
      id: 2,
      title: 'Đã phân công tài xế',
      message: 'Đơn hàng #PF-89022 đã được gán cho tài xế Trần Văn Nam.',
      time: '1 giờ trước',
      unread: true,
    },
    {
      id: 3,
      title: 'Tạo đơn thành công',
      message: 'Đơn hàng #PF-89021 của bạn đã được ghi nhận trên hệ thống ParcelFlow.',
      time: '2 giờ trước',
      unread: false,
    },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Thông báo khách hàng</h1>
          <p className="page-subtitle">
            Cập nhật tức thời về biến động trạng thái đơn hàng của bạn.
          </p>
        </div>
      </div>

      <div className="notifications-list">
        {notifications.map((item) => (
          <div
            key={item.id}
            className={`notification-item ${item.unread ? 'unread' : ''}`}
          >
            <div className="notification-icon">
              {item.unread ? '🔔' : '✓'}
            </div>
            <div className="notification-body">
              <div className="notification-top">
                <h4>{item.title}</h4>
                <span className="notification-time">{item.time}</span>
              </div>
              <p>{item.message}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="data-note">
        * Chức năng Polling thông báo thời gian thực sẽ được kết nối ở Tuần 6.
      </p>
    </div>
  )
}
