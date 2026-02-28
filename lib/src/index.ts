// Shared interfaces between back and front
// Import example in back:  import { ... } from '../../lib/src'
// Import example in front: import { ... } from '../../lib/src'

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}
