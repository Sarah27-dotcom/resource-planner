import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../queryKeys";

// Types
export interface ProjectChannel {
  id: string;
  projectId: string;
  channelId: string;
  deliverableId: string | null;
  quantity: string | null;
  channelBudget: string | null;
  manHours: string | null;
  createdAt: string;
  updatedAt: string;
  channel?: {
    id: string;
    channelName: string;
  };
  deliverable?: {
    id: string;
    deliverableName: string;
  };
}

export interface Project {
  id: string;
  brandId: string;
  businessUnitId: string | null;
  projectCategoryId: string | null;
  projectTypeId: string | null;
  projectType: 'pitch' | 'campaign';
  entity: string | null;
  name: string;
  projectNumber: string | null;
  description: string | null;
  color: string;
  budget: string | null;
  asf: string | null;
  grandTotal: string | null;
  currency: string;
  ioFile: string | null;
  flag: string | null;
  quotationReference: string | null;
  startDate: string | null;
  endDate: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  createdById: string | null;
  notes: string | null;
  // Pitch-specific fields (nullable)
  region: string | null;
  submitDate: string | null;
  pitchStatus: 'introduction' | 'waiting_for_brief' | 'proposal_development' | 'submit_or_presentation' | 'waiting_for_feedback' | 'negotiation' | 'won' | 'lost' | 'cancelled' | 'missing' | 'withdraw' | null;
  valueTotalEstimate: string | null;
  hsDealId: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    color: string;
  };
  businessUnit?: {
    id: string;
    name: string;
    color: string;
  };
  projectCategory?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    fullName: string;
  };
  assignments?: {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
    hoursPerDay: string;
    employee?: {
      id: string;
      fullName: string;
      position: string;
    };
  }[];
  projectChannels?: ProjectChannel[];
}

export type NewProject = {
  name: string;
  brandId: string;
  projectType?: 'pitch' | 'campaign';
  entity?: string | null;
  color?: string;
  status?: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  businessUnitId?: string | null;
  projectCategoryId?: string | null;
  projectTypeId?: string | null;
  projectNumber?: string | null;
  description?: string | null;
  budget?: string | null;
  asf?: string | null;
  grandTotal?: string | null;
  currency?: string;
  ioFile?: string | null;
  flag?: string | null;
  quotationReference?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdById?: string | null;
  notes?: string | null;
  // Pitch-specific fields
  region?: string | null;
  submitDate?: string | null;
  pitchStatus?: 'introduction' | 'waiting_for_brief' | 'proposal_development' | 'submit_or_presentation' | 'waiting_for_feedback' | 'negotiation' | 'won' | 'lost' | 'cancelled' | 'missing' | 'withdraw' | null;
  valueTotalEstimate?: string | null;
  hsDealId?: string | null;
  // Project channels (for pitches and campaigns)
  projectChannels?: Array<{
    channelId: string;
    deliverableId: string | null;
    quantity?: string | null;
    channelBudget?: string | null;
    manHours?: string | null;
  }>;
};

// API Functions
async function fetchProjects(): Promise<Project[]> {
  const response = await fetch("/api/projects");
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  const data = await response.json();
  return data.data;
}

async function fetchProject(id: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }
  const data = await response.json();
  return data.data;
}

async function fetchProjectsByBrand(brandId: string): Promise<Project[]> {
  const response = await fetch(`/api/projects?brandId=${brandId}`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects by brand");
  }
  const data = await response.json();
  return data.data;
}

// Hooks
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: fetchProjects,
  });
}

const PAGE_SIZE = 100;

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

async function fetchProjectsPaginated({ pageParam = 0, search }: { pageParam?: number; search?: string }): Promise<PaginatedResponse<Project>> {
  const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
  const response = await fetch(`/api/projects?limit=${PAGE_SIZE}&offset=${pageParam}${searchParam}`);
  if (!response.ok) {
    throw new Error("Failed to fetch projects");
  }
  const result = await response.json();
  return {
    data: result.data,
    total: result.total,
    hasMore: result.hasMore,
  };
}

export function useInfiniteProjects(search?: string) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.projectsInfinite, search],
    queryFn: ({ pageParam }) => fetchProjectsPaginated({ pageParam, search }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore || lastPage.data.length === 0) return undefined;
      return allPages.length * PAGE_SIZE;
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: queryKeys.project(id),
    queryFn: () => fetchProject(id),
    enabled: !!id,
  });
}

export function useProjectsByBrand(brandId: string) {
  return useQuery({
    queryKey: queryKeys.projectsByBrand(brandId),
    queryFn: () => fetchProjectsByBrand(brandId),
    enabled: !!brandId,
  });
}
