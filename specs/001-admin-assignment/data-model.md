# Frontend data and state

- ShipmentResponse/ShipmentDetail: tái sử dụng apps/web/src/types/shipment-api.ts,
  không map trackingNumber thành code mẫu. CREATED driverId=null; trạng thái khác
  driverId là ID user; statusHistory ở Detail.
- DriverResponse: SC06 gồm id, name, activeShipmentCount nguyên không âm,
  currentLocation, lastLocationUpdatedAt, locationClientTimestamp, isLocationStale.
  Các field GPS cùng null nếu không có điểm; activeShipmentCount=0 bắt buộc GPS null.
  Không suy online; 0,0 hợp lệ.
- Page<T>: data và pagination limit/hasMore/nextCursor, không total. Limit 20/max100.
- Cursor history: trang hiện hành + stack cursor trước; lựa chọn giới hạn trong trang.
- Assignment selection: detail + driver đích + review boolean. Token không lưu ở đây.
- Mutation: idle → reviewing → submitting → confirmed hoặc reconciling → idle/locked.
  Ref chặn double-submit đồng bộ; abort đọc + generation guard chặn stale response.
  Sau recovery xóa driver/review; Detail lỗi giữ locked, chỉ GET retry.
