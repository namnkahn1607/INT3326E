import { useEffect, useState } from 'react'
import { loadAdministrativeAreas, type AdministrativeArea } from './administrative-areas'

interface Props {
  level: 'province' | 'district' | 'ward'
  parent: number | null
  value: AdministrativeArea | null
  onChange: (value: AdministrativeArea | null) => void
}

export function AdministrativeAreaSelect({ level, parent, value, onChange }: Props) {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ key: string; options: AdministrativeArea[]; error: string | null } | null>(null)
  const key = `${level}/${parent}/${retry}`
  const enabled = level === 'province' || parent !== null
  const current = result?.key === key ? result : null
  const loading = enabled && !current
  const label = level === 'province' ? 'Tỉnh / Thành phố' : level === 'district' ? 'Quận / Huyện' : 'Phường / Xã'
  const id = 'address-' + level
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    loadAdministrativeAreas(level, parent, controller.signal).then(options => {
      if (!controller.signal.aborted) setResult({ key, options, error: null })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, options: [], error: error instanceof Error ? error.message : 'Chưa tải được danh mục khu vực.' })
    })
    return () => controller.abort()
  }, [enabled, key, level, parent])
  const options = current?.options ?? []
  return <div className="form-group">
    <label htmlFor={id}>{label}<span className="shipment-required"> *</span></label>
    <select id={id} required value={value?.code ?? ''} disabled={!enabled || loading || !!current?.error}
      aria-busy={loading} aria-describedby={current?.error ? id + '-error' : undefined}
      onChange={event => onChange(options.find(option => option.code === Number(event.target.value)) ?? null)}>
      <option value="">{loading ? 'Đang tải…' : enabled ? 'Chọn ' + label.toLocaleLowerCase('vi') : 'Chọn khu vực cấp trên trước'}</option>
      {value && !options.some(option => option.code === value.code) && <option value={value.code}>{value.name}</option>}
      {options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
    </select>
    {current?.error && <div id={id + '-error'} className="customer-field-error" role="status">
      <p>{current.error}</p><button type="button" className="btn btn-outline" onClick={() => setRetry(value => value + 1)}>Thử tải lại danh mục</button>
    </div>}
  </div>
}
