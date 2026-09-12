import { AdminActivityRequestsList } from '@/features/admin'

/** Super Admin sees every draft. Regular admin sees their own as My requests. */
export function AdminRequestsPage() {
  return <AdminActivityRequestsList />
}
