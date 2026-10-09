import { Link } from 'react-router'
import { StatusBadge } from '../../components/ui/StatusBadge'
import heroArtwork from '../../assets/hero.png'

export function CustomerOverviewPage() {
  return (
    <div className="customer-home">
      <section className="customer-hero">
        <div className="customer-shell customer-hero-grid">
          <div className="customer-hero-copy">
            <span className="hero-eyebrow">GIAO HÀNG CHỦ ĐỘNG</span>
            <h1>Nhanh từng chặng,<br /><span>trọn vẹn niềm tin.</span></h1>
            <p>
              Tạo đơn trong vài phút, quản lý tập trung và theo dõi hành trình
              minh bạch trên một nền tảng duy nhất.
            </p>
            <div className="hero-actions">
              <Link to="/customer/create" className="btn btn-white btn-lg">
                Tạo đơn ngay <span aria-hidden="true">→</span>
              </Link>
              <Link to="/customer/shipments" className="hero-secondary-link">
                Xem đơn của tôi
              </Link>
            </div>
            <div className="hero-trust-row">
              <span>✓ Theo dõi trực tuyến</span>
              <span>✓ Phủ sóng toàn quốc</span>
              <span>✓ Hỗ trợ 24/7</span>
            </div>
          </div>
          <div className="customer-hero-art" aria-label="Khu vực hình ảnh giới thiệu">
            <span className="hero-orbit hero-orbit-one" />
            <span className="hero-orbit hero-orbit-two" />
            <img src={heroArtwork} alt="Minh họa nền tảng ParcelFlow" />
            <div className="hero-floating-card hero-floating-top">
              <span className="floating-icon">✓</span>
              <div><strong>Giao thành công</strong><small>Đơn #PF-89018</small></div>
            </div>
            <div className="hero-floating-card hero-floating-bottom">
              <span className="floating-dot" />
              <div><strong>Đang trên đường</strong><small>Còn khoảng 18 phút</small></div>
            </div>
          </div>
        </div>
      </section>

      <section className="quick-lookup-wrap">
        <div className="customer-shell">
          <div className="quick-lookup-card">
            <div className="quick-lookup-heading">
              <span className="quick-icon" aria-hidden="true">⌕</span>
              <div><strong>Tra cứu nhanh</strong><span>Kiểm tra trạng thái đơn hàng của bạn</span></div>
            </div>
            <form className="quick-lookup-form" onSubmit={(event) => event.preventDefault()}>
              <label className="sr-only" htmlFor="tracking-code">Mã vận đơn</label>
              <input id="tracking-code" placeholder="Nhập mã vận đơn, ví dụ PF-89021" />
              <Link to="/customer/shipments" className="btn btn-primary">Tra cứu đơn</Link>
            </form>
          </div>
        </div>
      </section>

      <section className="customer-shell customer-dashboard-section">
        <div className="customer-section-heading">
          <div>
            <span className="section-kicker">TỔNG QUAN HÔM NAY</span>
            <h2>Mọi đơn hàng trong tầm tay</h2>
          </div>
          <Link to="/customer/shipments" className="text-link">Quản lý tất cả đơn →</Link>
        </div>

        <div className="customer-metric-grid">
          <article className="customer-metric-card metric-purple">
            <span className="metric-icon">↗</span>
            <div><strong>2</strong><span>Đơn đang xử lý</span><small>Chờ tài xế hoặc điều phối</small></div>
          </article>
          <article className="customer-metric-card metric-violet">
            <span className="metric-icon">⌖</span>
            <div><strong>1</strong><span>Đang vận chuyển</span><small>Cập nhật hành trình trực tuyến</small></div>
          </article>
          <article className="customer-metric-card metric-green">
            <span className="metric-icon">✓</span>
            <div><strong>14</strong><span>Giao thành công</span><small>+3 đơn hoàn tất tuần này</small></div>
          </article>
        </div>

        <div className="customer-content-grid">
          <div className="customer-orders-panel">
            <div className="panel-heading">
              <div><span className="section-kicker">ĐƠN GẦN ĐÂY</span><h3>Theo dõi đơn hàng</h3></div>
              <Link to="/customer/shipments" className="text-link">Xem tất cả</Link>
            </div>
            <div className="customer-order-list">
              <article className="customer-order-row">
                <div className="order-symbol">📦</div>
                <div className="order-main"><strong>#PF-89021</strong><span>Xuân Thủy → Tôn Thất Thuyết</span></div>
                <StatusBadge status="PICKED_UP" />
                <span className="order-time">10:15</span>
                <Link to="/customer/shipments" className="order-arrow" aria-label="Xem đơn PF-89021">›</Link>
              </article>
              <article className="customer-order-row">
                <div className="order-symbol">📦</div>
                <div className="order-main"><strong>#PF-89022</strong><span>ĐH Công nghệ → Keangnam</span></div>
                <StatusBadge status="ASSIGNED" />
                <span className="order-time">11:00</span>
                <Link to="/customer/shipments" className="order-arrow" aria-label="Xem đơn PF-89022">›</Link>
              </article>
            </div>
          </div>

          <aside className="customer-cta-card">
            <span className="cta-label">BẮT ĐẦU GIAO HÀNG</span>
            <h3>Bạn có đơn hàng mới?</h3>
            <p>Nhập thông tin lấy và giao hàng, ParcelFlow sẽ giúp bạn xử lý phần còn lại.</p>
            <Link to="/customer/create" className="btn btn-white">+ Tạo đơn mới</Link>
            <span className="cta-decoration" aria-hidden="true">PF</span>
          </aside>
        </div>
      </section>

      <section className="customer-benefits">
        <div className="customer-shell">
          <div className="customer-section-heading benefits-heading">
            <div>
              <span className="section-kicker">VÌ SAO CHỌN PARCELFLOW?</span>
              <h2>Trải nghiệm giao nhận đơn giản hơn</h2>
            </div>
          </div>
          <div className="benefit-grid">
            <article><span className="benefit-number">01</span><div className="benefit-icon">⚡</div><h3>Tạo đơn siêu nhanh</h3><p>Quy trình gọn gàng, thông tin rõ ràng và thao tác trong vài phút.</p></article>
            <article><span className="benefit-number">02</span><div className="benefit-icon">◎</div><h3>Theo dõi minh bạch</h3><p>Nắm bắt trạng thái và vị trí đơn hàng xuyên suốt hành trình.</p></article>
            <article><span className="benefit-number">03</span><div className="benefit-icon">♢</div><h3>Quản lý tập trung</h3><p>Lịch sử, thông báo và mọi đơn giao nhận ở cùng một nơi.</p></article>
            <article><span className="benefit-number">04</span><div className="benefit-icon">♡</div><h3>Hỗ trợ tận tâm</h3><p>Đội ngũ luôn sẵn sàng đồng hành khi bạn cần hỗ trợ.</p></article>
          </div>
        </div>
      </section>

      <section className="customer-process">
        <div className="customer-shell process-inner">
          <div className="process-copy">
            <span className="section-kicker">QUY TRÌNH GIAO NHẬN</span>
            <h2>Giao hàng chỉ với 4 bước</h2>
            <p>Từ lúc tạo đơn đến khi người nhận cầm hàng, mọi bước đều được cập nhật rõ ràng.</p>
          </div>
          <div className="process-steps">
            <div><span>1</span><strong>Tạo đơn</strong><small>Nhập thông tin giao nhận</small></div>
            <i>→</i>
            <div><span>2</span><strong>Gán tài xế</strong><small>Điều phối người giao phù hợp</small></div>
            <i>→</i>
            <div><span>3</span><strong>Đang giao</strong><small>Theo dõi hành trình</small></div>
            <i>→</i>
            <div><span>4</span><strong>Hoàn tất</strong><small>Giao đến người nhận</small></div>
          </div>
        </div>
      </section>
    </div>
  )
}
