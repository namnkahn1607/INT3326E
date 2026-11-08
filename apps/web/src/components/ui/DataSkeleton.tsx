export function DataSkeleton({ label, detail = false }: { label: string; detail?: boolean }) {
  return <div className={'ui-data-skeleton' + (detail ? ' ui-data-skeleton--detail' : '')} role="status" aria-busy="true">
    <span className="ui-visually-hidden">{label}</span>
    <div aria-hidden="true">{Array.from({ length: detail ? 12 : 4 }, (_, index) =>
      <div className="ui-skeleton-row" key={index}><span /><span /><span /></div>)}</div>
  </div>
}
