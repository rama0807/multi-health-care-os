import type {
  AdmissionQuery,
  AdmissionWithDetails,
  AllocateBedDto,
  BedAllocation,
  BedQuery,
  BedTransferWithDetails,
  BedWithDetails,
  CancelAdmissionDto,
  CreateAdmissionDto,
  CreateBedDto,
  CreateRoomDto,
  CreateWardDto,
  IpdDashboardStats,
  PaginatedResponse,
  ReserveBedDto,
  Room,
  RoomQuery,
  RoomWithCounts,
  TransferBedDto,
  UpdateAdmissionDto,
  UpdateBedDto,
  UpdateRoomDto,
  UpdateWardDto,
  VacateBedDto,
  Ward,
  WardQuery,
  WardWithCounts,
} from '@medicore/types'

import { apiClient } from './client'

// ─── Dashboard ─────────────────────────────────────────────────────────────

export async function getIpdDashboardStats(): Promise<IpdDashboardStats> {
  const { data } = await apiClient.get<{ data: IpdDashboardStats }>('/ipd/dashboard')
  return data.data
}

// ─── Wards ─────────────────────────────────────────────────────────────────

export async function listWards(query: WardQuery = {}): Promise<PaginatedResponse<WardWithCounts>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<WardWithCounts> }>('/ipd/wards', { params: query })
  return data.data
}

export async function getWard(id: string): Promise<WardWithCounts> {
  const { data } = await apiClient.get<{ data: WardWithCounts }>(`/ipd/wards/${id}`)
  return data.data
}

export async function createWard(dto: CreateWardDto): Promise<Ward> {
  const { data } = await apiClient.post<{ data: Ward }>('/ipd/wards', dto)
  return data.data
}

export async function updateWard(id: string, dto: UpdateWardDto): Promise<Ward> {
  const { data } = await apiClient.patch<{ data: Ward }>(`/ipd/wards/${id}`, dto)
  return data.data
}

export async function deactivateWard(id: string): Promise<Ward> {
  const { data } = await apiClient.delete<{ data: Ward }>(`/ipd/wards/${id}`)
  return data.data
}

// ─── Rooms ─────────────────────────────────────────────────────────────────

export async function listRooms(query: RoomQuery = {}): Promise<PaginatedResponse<RoomWithCounts>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<RoomWithCounts> }>('/ipd/rooms', { params: query })
  return data.data
}

export async function getRoom(id: string): Promise<RoomWithCounts> {
  const { data } = await apiClient.get<{ data: RoomWithCounts }>(`/ipd/rooms/${id}`)
  return data.data
}

export async function createRoom(dto: CreateRoomDto): Promise<Room> {
  const { data } = await apiClient.post<{ data: Room }>('/ipd/rooms', dto)
  return data.data
}

export async function updateRoom(id: string, dto: UpdateRoomDto): Promise<Room> {
  const { data } = await apiClient.patch<{ data: Room }>(`/ipd/rooms/${id}`, dto)
  return data.data
}

export async function deactivateRoom(id: string): Promise<Room> {
  const { data } = await apiClient.delete<{ data: Room }>(`/ipd/rooms/${id}`)
  return data.data
}

// ─── Beds ──────────────────────────────────────────────────────────────────

export async function listBeds(query: BedQuery = {}): Promise<PaginatedResponse<BedWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<BedWithDetails> }>('/ipd/beds', { params: query })
  return data.data
}

export async function getBed(id: string): Promise<BedWithDetails> {
  const { data } = await apiClient.get<{ data: BedWithDetails }>(`/ipd/beds/${id}`)
  return data.data
}

export async function createBed(dto: CreateBedDto): Promise<BedWithDetails> {
  const { data } = await apiClient.post<{ data: BedWithDetails }>('/ipd/beds', dto)
  return data.data
}

export async function updateBed(id: string, dto: UpdateBedDto): Promise<BedWithDetails> {
  const { data } = await apiClient.patch<{ data: BedWithDetails }>(`/ipd/beds/${id}`, dto)
  return data.data
}

export async function deactivateBed(id: string): Promise<BedWithDetails> {
  const { data } = await apiClient.delete<{ data: BedWithDetails }>(`/ipd/beds/${id}`)
  return data.data
}

// ─── Admissions ────────────────────────────────────────────────────────────

export async function listAdmissions(query: AdmissionQuery = {}): Promise<PaginatedResponse<AdmissionWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<AdmissionWithDetails> }>('/ipd/admissions', {
    params: query,
  })
  return data.data
}

export async function getAdmission(id: string): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.get<{ data: AdmissionWithDetails }>(`/ipd/admissions/${id}`)
  return data.data
}

export async function createAdmission(dto: CreateAdmissionDto): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.post<{ data: AdmissionWithDetails }>('/ipd/admissions', dto)
  return data.data
}

export async function updateAdmission(id: string, dto: UpdateAdmissionDto): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.patch<{ data: AdmissionWithDetails }>(`/ipd/admissions/${id}`, dto)
  return data.data
}

export async function cancelAdmission(id: string, dto: CancelAdmissionDto): Promise<AdmissionWithDetails> {
  const { data } = await apiClient.patch<{ data: AdmissionWithDetails }>(`/ipd/admissions/${id}/cancel`, dto)
  return data.data
}

// ─── Bed allocation / transfer ─────────────────────────────────────────────

export async function allocateBed(admissionId: string, dto: AllocateBedDto): Promise<BedAllocation> {
  const { data } = await apiClient.post<{ data: BedAllocation }>(`/ipd/admissions/${admissionId}/allocate`, dto)
  return data.data
}

export async function reserveBed(admissionId: string, dto: ReserveBedDto): Promise<BedAllocation> {
  const { data } = await apiClient.post<{ data: BedAllocation }>(`/ipd/admissions/${admissionId}/reserve`, dto)
  return data.data
}

export async function cancelBedReservation(admissionId: string): Promise<BedAllocation> {
  const { data } = await apiClient.post<{ data: BedAllocation }>(`/ipd/admissions/${admissionId}/cancel-reservation`, {})
  return data.data
}

export async function vacateBed(admissionId: string, dto: VacateBedDto): Promise<BedAllocation> {
  const { data } = await apiClient.post<{ data: BedAllocation }>(`/ipd/admissions/${admissionId}/vacate`, dto)
  return data.data
}

export async function transferBed(admissionId: string, dto: TransferBedDto): Promise<BedTransferWithDetails> {
  const { data } = await apiClient.post<{ data: BedTransferWithDetails }>(`/ipd/admissions/${admissionId}/transfer`, dto)
  return data.data
}

export async function listBedAllocationHistory(admissionId: string): Promise<BedAllocation[]> {
  const { data } = await apiClient.get<{ data: BedAllocation[] }>(`/ipd/admissions/${admissionId}/allocations`)
  return data.data
}

export async function listBedTransferHistory(admissionId: string): Promise<BedTransferWithDetails[]> {
  const { data } = await apiClient.get<{ data: BedTransferWithDetails[] }>(`/ipd/admissions/${admissionId}/transfers`)
  return data.data
}
