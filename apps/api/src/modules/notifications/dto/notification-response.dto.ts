export type NotificationKind = 'CREATED' | 'ASSIGNED' | 'REASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'DELIVERY_FAILED';

// SC07: no readAt, unread count or read receipt in the MVP.
export interface NotificationResponse {
  id: string;
  shipmentId: string;
  trackingNumber: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
}

export interface NotificationPage {
  data: NotificationResponse[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}
