import type { ReactNode } from 'react'

export function DemoNotice({ children }: { children?: ReactNode }) {
  return <div className="ui-demo-notice"><strong>Dữ liệu minh họa</strong>
    <span>{children ?? 'Chưa kết nối nguồn dữ liệu thật. Nội dung này không phải kết quả vận hành thực tế.'}</span>
  </div>
}
