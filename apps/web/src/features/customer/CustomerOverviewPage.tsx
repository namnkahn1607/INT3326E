import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { getShipments } from '../../api/endpoints/shipments'
import type { ShipmentResponse } from '../../types/shipment-api'
import { useAuth } from '../auth/useAuth'
import { CustomerHomeIcon } from './CustomerHomeIcon'
import deliveryArtwork from '../../assets/delivery-parcels.webp'
import './customer-home.css'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { CustomerBackdrop } from './CustomerBackdrop'

interface OverviewOrders {
  shipments: ShipmentResponse[]
  loading: boolean
  error: boolean
}

export function CustomerOverviewPage() {
  const { user } = useAuth()
  const name = user?.displayName.split(/[\s@]+/)[0] || 'bạn'
  return <CustomerOverviewContent key={user?.id ?? 'signed-out'} name={name} />
}

function CustomerOverviewContent({ name }: { name: string }) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const navigate = useNavigate()
  const [orders, setOrders] = useState<OverviewOrders>({ shipments: [], loading: true, error: false })
  useEffect(() => {
    const controller = new AbortController()
    getShipments({ limit: 20 }, controller.signal).then(page => {
      if (!controller.signal.aborted) setOrders({ shipments: page.data, loading: false, error: false })
    }).catch(() => {
      if (!controller.signal.aborted) setOrders({ shipments: [], loading: false, error: true })
    })
    return () => controller.abort()
  }, [])

  function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = trackingNumber.trim()
    navigate('/customer/shipments' + (query ? '?' + new URLSearchParams({ trackingNumber: query }) : ''))
  }

  return <div className="pf-home pf-home-container">
    <div className="pf-home-heading">
      <section className="pf-welcome" aria-labelledby="pf-welcome-title">
        <h1 id="pf-welcome-title">Xin chào, {name}</h1>
      </section>

      <form className="pf-track-form" onSubmit={track} aria-label="Tra cứu đơn hàng">
        <div className="pf-track-input">
          <CustomerHomeIcon name="search" />
          <label htmlFor="pf-tracking-number" className="sr-only">Mã vận đơn</label>
          <input id="pf-tracking-number" name="trackingNumber" autoComplete="off"
            spellCheck={false} value={trackingNumber} onChange={event => setTrackingNumber(event.target.value)}
            placeholder="Nhập mã vận đơn…" />
        </div>
        <button type="submit" className="pf-primary-button">Tìm đơn</button>
      </form>
    </div>

    <div className="pf-home-feature-grid">
      <CustomerPromoBanner />
      <ActiveShipment orders={orders} />
    </div>

  </div>
}

const promoSlides = [
  { eyebrow: 'FAST. SAFE. RELIABLE.', title: ['Delivering', 'what matters.'],
    copy: 'To your door. Across the city. Or around the world.', cta: 'Send now', to: '/customer/create',
    image: { src: deliveryArtwork, alt: 'Cardboard delivery boxes with orange tape and a location pin' } },
  { eyebrow: 'YOUR PARCELS. ONE PLACE.', title: ['Your orders.', 'Simply organised.'],
    copy: 'Find your parcels and check the latest order status in one place.', cta: 'View your orders', to: '/customer/shipments', image: null },
  { eyebrow: 'EVERY DELIVERY HAS A STORY.', title: ['Every delivery.', 'Within reach.'],
    copy: 'Open your delivery history and keep the details within reach.', cta: 'Delivery history', to: '/customer/history', image: null },
]

function CustomerPromoBanner() {
  const [active, setActive] = useState(0)
  const [animate, setAnimate] = useState(false)
  function select(index: number, pointer: boolean) {
    setAnimate(pointer)
    setActive((index + promoSlides.length) % promoSlides.length)
  }
  return <section className={'pf-promo' + (animate ? ' pf-promo--animated' : '')}
    aria-roledescription="carousel" aria-label="Giới thiệu ParcelFlow">
    <CustomerBackdrop variant="promo" />
    <div className="pf-promo-slides">
      {promoSlides.map((slide, index) => <div key={slide.to} className={'pf-promo-copy' + (index === active ? ' is-active' : '')}
        aria-hidden={index !== active} inert={index !== active} role="group" aria-roledescription="slide"
        aria-label={`${index + 1} / ${promoSlides.length}`}>
        <p className="pf-eyebrow">{slide.eyebrow}</p>
        <h2>{slide.title[0]}<br />{slide.title[1]}</h2>
        <p>{slide.copy}</p>
        <Link to={slide.to} className="pf-promo-cta">{slide.cta}<CustomerHomeIcon name="arrow" /></Link>
      </div>)}
    </div>
    <div className="pf-promo-visual">
      {promoSlides[active].image ? <img className="pf-promo-art" src={promoSlides[active].image.src} alt={promoSlides[active].image.alt}
        width="1536" height="1024" fetchPriority="high" />
      : <div className="pf-promo-placeholder" role="img" aria-label={`Vùng ảnh chờ bổ sung cho slide ${active + 1}`}>
        <CustomerHomeIcon name={active === 1 ? 'box' : 'clock'} /><span>Ảnh minh họa slide {active + 1}</span>
      </div>}
    </div>
    <div className="pf-promo-controls" role="group" aria-label="Chuyển nội dung giới thiệu">
      <button type="button" className="pf-promo-previous" aria-label="Nội dung trước" onClick={event => select(active - 1, event.detail > 0)}>
        <CustomerHomeIcon name="chevron" />
      </button>
      <div className="pf-promo-dots">{promoSlides.map((slide, index) => <button key={slide.to} type="button"
        aria-label={`Xem nội dung ${index + 1}: ${slide.title.join(' ')}`} aria-pressed={active === index}
        onClick={event => select(index, event.detail > 0)}><span /></button>)}</div>
      <button type="button" aria-label="Nội dung tiếp theo" onClick={event => select(active + 1, event.detail > 0)}>
        <CustomerHomeIcon name="chevron" />
      </button>
    </div>
    <p className="sr-only" role="status">Nội dung {active + 1} / {promoSlides.length}: {promoSlides[active].title.join(' ')}</p>
  </section>
}

function ActiveShipment({ orders }: { orders: OverviewOrders }) {
  const { loading, error } = orders
  const shipment = orders.shipments.find(item => ['CREATED', 'ASSIGNED', 'PICKED_UP'].includes(item.status)) ?? null
  const steps = [
    { status: 'CREATED', label: 'Đã tạo đơn' },
    { status: 'ASSIGNED', label: 'Đã phân công' },
    { status: 'PICKED_UP', label: 'Đang vận chuyển' },
    { status: 'DELIVERED', label: 'Đã giao hàng' },
  ]
  const currentStep = shipment ? steps.findIndex(step => step.status === shipment.status) : -1

  return <section className="pf-active-shipment" aria-labelledby="pf-active-title">
    <div className="pf-active-heading"><h2 id="pf-active-title">Đơn đang giao</h2>
      <Link to="/customer/shipments" aria-label="Xem tất cả đơn hàng"><CustomerHomeIcon name="arrow" /></Link></div>
    {loading ? <div className="pf-shipment-state" role="status"><span className="pf-empty-package"><CustomerHomeIcon name="box" /></span>
      <h3>Đang tải đơn hàng…</h3><p>Đang lấy trạng thái mới nhất.</p>
      <div className="pf-shipment-skeleton" aria-hidden="true"><span /><span /><span /></div></div>
    : shipment ? <>
      <div className="pf-shipment-package"><span className="pf-package-symbol"><CustomerHomeIcon name="box" /></span>
        <div><p className="pf-shipment-id" translate="no"># {shipment.trackingNumber}</p>
          <p className="pf-package-name">{shipment.packageDescription || 'Bưu kiện của bạn'}</p></div></div>
      <div className="pf-active-status"><StatusBadge status={shipment.status} /></div>
      <ol className="pf-shipment-progress" aria-label="Tiến trình giao hàng">
        {steps.map((step, index) => <li key={step.status} className={index <= currentStep ? 'is-complete' : ''}
          aria-current={index === currentStep ? 'step' : undefined}>
          <span className="pf-progress-dot">{index <= currentStep && <CustomerHomeIcon name="check" />}</span>
          <span>{step.label}{index === currentStep && <small>Hiện tại</small>}</span>
        </li>)}
      </ol>
      <Link className="pf-shipment-detail" to={'/customer/shipments/' + shipment.id}>Chi tiết đơn hàng<CustomerHomeIcon name="arrow" /></Link>
      <p className="pf-scope-note">Đơn đang giao trong 20 đơn vừa tải. Chưa hiển thị GPS trực tiếp.</p>
    </> : <div className="pf-shipment-state" role={error ? 'alert' : 'status'}>
      <span className="pf-empty-package"><CustomerHomeIcon name="box" /></span>
      <h3>{error ? 'Chưa tải được đơn hàng' : 'Chưa có đơn đang giao'}</h3>
      <p>{error ? 'Mở danh sách đơn để kiểm tra hoặc thử tải lại.' : 'Không có đơn đang giao trong các đơn vừa tải.'}</p>
      <Link className="pf-shipment-detail" to={error ? '/customer/shipments' : '/customer/create'}>
        {error ? 'Xem đơn hàng' : 'Gửi bưu kiện'}<CustomerHomeIcon name="arrow" /></Link>
    </div>}
  </section>
}
