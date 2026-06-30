export enum JobStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  MATCHING = 'matching',
  ASSIGNED = 'assigned',
  WORKER_ENROUTE = 'worker_enroute',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
  // IT-specific diagnostic flow
  AWAITING_DIAGNOSIS = 'awaiting_diagnosis',
  DIAGNOSIS_SUBMITTED = 'diagnosis_submitted',
  AWAITING_PRICE_APPROVAL = 'awaiting_price_approval',
  PRICE_APPROVED = 'price_approved',
  PRICE_REJECTED = 'price_rejected',
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ServiceType {
  PHYSICAL = 'physical',
  IT = 'it',
}

export enum ServiceMode {
  ONSITE = 'onsite',
  REMOTE = 'remote',
  HYBRID = 'hybrid',
}

export enum ItUrgency {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}
