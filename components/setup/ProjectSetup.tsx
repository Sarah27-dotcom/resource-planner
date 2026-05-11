"use client";

import { useIsStuck } from "@/hooks/use-is-stuck";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { startOfMonth, endOfMonth, startOfDay, format, isSameMonth, eachMonthOfInterval } from "date-fns";
import { type DateRange } from "react-day-picker";
import { useProjects, useInfiniteProjects, type Project } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useProjectCategories } from "@/lib/query/hooks/useProjectCategories";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
import { useAssignments, useAssignmentsByProject, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { AssignEmployeesDialog } from "@/components/projects/AssignEmployeesDialog";
import { useAuth } from "@/context/AuthContext";

const PROJECT_COLORS = [
  "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const CURRENCIES = [
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
];

// Generate project number from project name
const generateProjectNumber = (projectName: string, existingNumbers: string[] = []): string => {
  if (!projectName) return "";

  const year = new Date().getFullYear();

  // Get all project numbers for current year
  const yearPrefix = `PROJ-${year}-`;
  const currentYearNumbers = existingNumbers
    .filter((num) => num.startsWith(yearPrefix))
    .map((num) => parseInt(num.replace(yearPrefix, ""), 10))
    .filter((num) => !isNaN(num));

  // Find next available number
  const nextNumber = currentYearNumbers.length > 0 ? Math.max(...currentYearNumbers) + 1 : 1;

  return `${yearPrefix}${String(nextNumber).padStart(4, "0")}`;
};

export const ProjectSetup = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProjects(debouncedSearch || undefined);
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: projectCategories = [] } = useProjectCategories();
  const { data: channels = [] } = useChannelClassifications();
  const { data: allDeliverables = [] } = useDeliverables();

  // Flatten all pages into a single array of projects
  const projects = useMemo(() => {
    if (!projectsData?.pages) return [];
    return projectsData.pages.flatMap((page) => page.data);
  }, [projectsData]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [isAssignEmployeesOpen, setIsAssignEmployeesOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedDeliverablesByEmployee, setSelectedDeliverablesByEmployee] = useState<Record<string, string[]>>({});
  const [pendingAssignments, setPendingAssignments] = useState<Array<{
    employeeId: string;
    deliverableIds?: string[];
  }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  // Track initial deliverable selections to detect changes
  const [initialDeliverablesByEmployee, setInitialDeliverablesByEmployee] = useState<Record<string, string[]>>({});
  // Track initial date range for change detection
  const [initialDateRange, setInitialDateRange] = useState<DateRange | undefined>(undefined);

  const { data: projectAssignments = [] } = useAssignmentsByProject(viewingProject?.id ?? "");
  const { data: allAssignments = [] } = useAssignments();
  const { data: employees = [] } = useEmployees();
  const deleteAssignment = useDeleteAssignment();

  const employeeMap = useMemo(() => {
    const map = new Map<string, { fullName: string; position: string; department: { name: string } | null; allAssignments: any[] }>();
    for (const emp of employees) {
      map.set(emp.id, {
        fullName: emp.fullName,
        position: emp.position,
        department: emp.department ?? null,
        allAssignments: [],
      });
    }

    // Populate allAssignments
    for (const assignment of allAssignments) {
      const empData = map.get(assignment.employeeId);
      if (empData) {
        empData.allAssignments.push(assignment);
      }
    }

    return map;
  }, [employees, allAssignments]);


  // Form State - Project Type
  const [projectType, setProjectType] = useState<"pitch" | "campaign">("campaign");

  // Form State - Basic Information
  const [name, setName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [brandId, setBrandId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [projectCategoryId, setProjectCategoryId] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<"planning" | "active" | "on_hold" | "completed" | "cancelled">("active");

  // Form State - Budget & Financial
  const [currency, setCurrency] = useState("USD");
  const [budget, setBudget] = useState("");
  const [asf, setAsf] = useState("");
  const [grandTotal, setGrandTotal] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [ioFile, setIoFile] = useState("");

  // Form State - Timeline
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Form State - Additional Information
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [flag, setFlag] = useState("");

  // Form State - Pitch-specific fields
  const [region, setRegion] = useState("Indonesia");
  const [submitDate, setSubmitDate] = useState("");
  const [pitchStatus, setPitchStatus] = useState<string>("introduction");
  const [valueTotalEstimate, setValueTotalEstimate] = useState("");
  const [hsDealId, setHsDealId] = useState("");

  // Form State - Project Channels (for pitches)
  const [projectChannels, setProjectChannels] = useState<Array<{
    channelId: string;
    deliverableId: string;
    quantity: string;
    channelBudget: string;
    manHours: string;
  }>>([]);

  const projectDeliverables = useMemo(() => {
    const deliverableIds = new Set(
      projectChannels
        .map(pc => pc.deliverableId ? String(pc.deliverableId) : "")
        .filter(Boolean)
    );
    return allDeliverables.filter(d => deliverableIds.has(String(d.id)));
  }, [allDeliverables, projectChannels]);

  const teamMembers = useMemo(() => {
    // Find which employees are assigned to this project
    const employeeIdsInProject = new Set<string>();

    // Add existing assignments from database
    for (const a of projectAssignments) {
      if (a.employeeId) employeeIdsInProject.add(a.employeeId);
    }

    // Add pending assignments
    for (const p of pendingAssignments) {
      employeeIdsInProject.add(p.employeeId);
    }

    return Array.from(employeeIdsInProject).map((employeeId) => {
      const emp = employeeMap.get(employeeId);
      const allAssignments = emp?.allAssignments || [];

      // Calculate monthly percentages
      const monthlyPcts: Record<string, number> = {};

      for (const assignment of allAssignments) {
        if (assignment.isTimeOff) continue;
        const assignStart = startOfDay(new Date(assignment.startDate));
        const assignEnd = startOfDay(new Date(assignment.endDate));
        const hoursPerDay = parseFloat(assignment.hoursPerDay) || 0;

        let currentDay = new Date(assignStart);
        while (currentDay <= assignEnd) {
          const dayOfWeek = currentDay.getDay();
          // sum hours only on weekdays
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            const monthKey = format(currentDay, "MMM yyyy");
            if (!monthlyPcts[monthKey]) monthlyPcts[monthKey] = 0;
            monthlyPcts[monthKey] += hoursPerDay;
          }
          currentDay = new Date(currentDay);
          currentDay.setDate(currentDay.getDate() + 1);
        }
      }

      // Convert monthly hours to percentage
      const isInDateRange = (monthKey: string) => {
        if (!dateRange?.from || !dateRange?.to) return true;
        const monthDate = startOfMonth(new Date(monthKey));
        const rangeStart = startOfMonth(dateRange.from);
        const rangeEnd = startOfMonth(dateRange.to);
        return monthDate >= rangeStart && monthDate <= rangeEnd;
      };

      const hasDateRange = dateRange?.from && dateRange?.to;
      const isSingleMonth = hasDateRange && isSameMonth(dateRange.from!, dateRange.to!);

      const monthlyPercentages = Object.entries(monthlyPcts)
        .filter(([monthKey]) => isInDateRange(monthKey))
        .map(([monthKey, totalHours]) => {
          const monthDate = new Date(monthKey); // e.g. "Apr 2026"
          const mStart = startOfMonth(monthDate);
          const mEnd = endOfMonth(mStart);

          let workDays = 0;
          let currentDay = new Date(mStart);
          while (currentDay <= mEnd) {
            const dayOfWeek = currentDay.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) workDays++;
            currentDay.setDate(currentDay.getDate() + 1);
          }

          const maxHours = workDays * 8;
          const pct = maxHours > 0 ? (totalHours / maxHours) * 100 : 0;

          return `${format(monthDate, "MMM")}: ${Math.round(pct)}%`;
        });

      // If no monthly percentages but date range is selected, show 0% for each month
      let finalMonthlyPercentages = monthlyPercentages;
      if (monthlyPercentages.length === 0 && dateRange?.from && dateRange?.to) {
        const monthsInRange = eachMonthOfInterval({
          start: startOfMonth(dateRange.from),
          end: startOfMonth(dateRange.to),
        });
        finalMonthlyPercentages = monthsInRange.map(m => `${format(m, "MMM")}: 0%`);
      }

      return {
        id: employeeId,
        fullName: emp?.fullName ?? "Unknown",
        position: emp?.position ?? "",
        department: emp?.department ?? null,
        allocationPercentage: finalMonthlyPercentages.length > 0 ? finalMonthlyPercentages : "-",
      };
    });
  }, [projectAssignments, pendingAssignments, employeeMap, dateRange]);

  // Detect unsaved deliverable changes for existing team members
  const unsavedDeliverableChanges = useMemo(() => {
    const changes: Array<{ employeeId: string; deliverableIds: string[] }> = [];

    // Check for deliverable changes in existing assignments
    for (const member of teamMembers) {
      const currentDeliverables = selectedDeliverablesByEmployee[member.id] || [];
      const isPending = pendingAssignments.some(p => p.employeeId === member.id);

      // Only track existing team members (not pending)
      if (!isPending) {
        const currentDeliverables = selectedDeliverablesByEmployee[member.id] || [];
        const initialDeliverables = initialDeliverablesByEmployee[member.id] || [];

        // Compare arrays
        const isSame = currentDeliverables.length === initialDeliverables.length &&
          currentDeliverables.every(id => initialDeliverables.includes(id)) &&
          initialDeliverables.every(id => currentDeliverables.includes(id));

        // If deliverables are changed from initial (including removal)
        if (!isSame) {
          changes.push({ employeeId: member.id, deliverableIds: currentDeliverables });
        }
      }
    }

    return changes;
  }, [teamMembers, selectedDeliverablesByEmployee, pendingAssignments, initialDeliverablesByEmployee]);

  // Check if date range has changed from initial
  const hasDateRangeChanged = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false;
    if (!initialDateRange?.from || !initialDateRange?.to) return true;
    return dateRange.from.getTime() !== initialDateRange.from.getTime()
      || dateRange.to.getTime() !== initialDateRange.to.getTime();
  }, [dateRange, initialDateRange]);

  // Check if there are any unsaved changes (pending assignments, deliverable changes, or date range)
  const hasUnsavedChanges = useMemo(() => {
    return pendingAssignments.length > 0 || unsavedDeliverableChanges.length > 0 || hasDateRangeChanged;
  }, [pendingAssignments, unsavedDeliverableChanges, hasDateRangeChanged]);

  // Check if all pending/changed employees have deliverables selected
  const allHaveDeliverables = useMemo(() => {
    // Check pending assignments
    for (const pending of pendingAssignments) {
      const selected = selectedDeliverablesByEmployee[pending.employeeId];
      if (!selected || selected.length === 0) return false;
    }
    // Check unsaved deliverable changes already have deliverables by definition
    return true;
  }, [pendingAssignments, selectedDeliverablesByEmployee]);

  // Auto-calculate grand total when budget or asf changes
  useEffect(() => {
    const budgetNum = parseFloat(budget) || 0;
    const asfNum = parseFloat(asf) || 0;
    const total = budgetNum + asfNum;
    setGrandTotal(total > 0 ? total.toFixed(2) : "");
  }, [budget, asf]);

  const getDeliverablesForChannel = (channelId: string) => {
    return allDeliverables.filter(d => d.channelId === channelId);
  };

  const handleOpenView = (project: Project) => {
    setViewingProject(project);
    setProjectType(project.projectType);
    setName(project.name);
    setProjectNumber(project.projectNumber || "");
    setBrandId(project.brandId);
    setBusinessUnitId(project.businessUnitId || "");
    setProjectCategoryId(project.projectCategoryId || "");
    setColor(project.color);
    setStatus(project.status);
    setCurrency(project.currency);
    setBudget(project.budget || "");
    setAsf(project.asf || "");
    setGrandTotal(project.grandTotal || "");
    setQuotationReference(project.quotationReference || "");
    setIoFile(project.ioFile || "");
    setStartDate(project.startDate || "");
    setEndDate(project.endDate || "");
    setDescription(project.description || "");
    setNotes(project.notes || "");
    setFlag(project.flag || "");
    setRegion(project.region || "Indonesia");
    setSubmitDate(project.submitDate || "");
    setPitchStatus(project.pitchStatus || "introduction");
    setValueTotalEstimate(project.valueTotalEstimate || "");
    setHsDealId(project.hsDealId || "");
    const channelsData = (project as any).channels || project.projectChannels || [];
    setProjectChannels(channelsData.map((pc: any) => ({
      channelId: pc.channelId || pc.channel_id || "",
      deliverableId: pc.deliverableId || pc.deliverable_id || "",
      quantity: pc.quantity || "",
      channelBudget: pc.channelBudget || pc.channel_budget || "",
      manHours: pc.manHours || pc.man_hours || "",
    })));
    if (project.startDate && project.endDate) {
      const range = {
        from: startOfDay(new Date(project.startDate)),
        to: startOfDay(new Date(project.endDate)),
      };
      setDateRange(range);
      setInitialDateRange(range);
    } else {
      setDateRange(undefined);
      setInitialDateRange(undefined);
    }
    setPendingAssignments([]);
    // Don't reset deliverables here - let the useEffect handle loading from existing assignments
    // Only reset if not already tracking this project
    if (viewingProject?.id !== project.id) {
      setSelectedDeliverablesByEmployee({});
      setInitialDeliverablesByEmployee({});
    }
    setIsDialogOpen(true);
  };

  // Load deliverables from existing assignments when project assignments are loaded
  useEffect(() => {
    if (!isDialogOpen || !viewingProject || projectAssignments.length === 0) {
      return;
    }

    // Only populate once (when initial is empty)
    if (Object.keys(initialDeliverablesByEmployee).length > 0) {
      return;
    }

    const deliverablesByEmployee: Record<string, string[]> = {};

    for (const assignment of projectAssignments) {
      if (!assignment.employeeId) continue;

      // Parse deliverables from note
      // Note format: "Assigned to project - Deliverable(s): {deliverable names separated by comma}. Set dates and hours as needed."
      const note = assignment.note;
      if (note) {
        // Extract deliverable names from note
        const deliverableMatch = note.match(/Deliverable[s]?:\s*([^.\n]+)/);
        if (deliverableMatch) {
          const deliverableNamesText = deliverableMatch[1].trim();
          const deliverableNames = deliverableNamesText.split(',').map(n => n.trim());

          // Find matching deliverables by name
          const matchingIds = allDeliverables
            .filter(d => deliverableNames.includes(d.deliverableNameNew || d.deliverableName))
            .map(d => String(d.id));

          if (matchingIds.length > 0) {
            deliverablesByEmployee[assignment.employeeId] = matchingIds;
          }
        }
      }
    }

    // Only update if we found deliverables
    if (Object.keys(deliverablesByEmployee).length > 0) {
      setSelectedDeliverablesByEmployee(deliverablesByEmployee);
      setInitialDeliverablesByEmployee(deliverablesByEmployee);
    }
  }, [isDialogOpen, viewingProject?.id, projectAssignments, allDeliverables, initialDeliverablesByEmployee]);

  // Initialize dateRange from projectAssignments when project has no saved dates
  useEffect(() => {
    if (!isDialogOpen || !viewingProject || projectAssignments.length === 0) return;
    // Only run if dateRange hasn't been initialized yet (from project dates)
    if (initialDateRange !== undefined) return;

    const startDates = projectAssignments.map(a => new Date(a.startDate).getTime()).filter(Boolean);
    const endDates = projectAssignments.map(a => new Date(a.endDate).getTime()).filter(Boolean);

    if (startDates.length > 0 && endDates.length > 0) {
      const range = {
        from: startOfDay(new Date(Math.min(...startDates))),
        to: startOfDay(new Date(Math.max(...endDates))),
      };
      setDateRange(range);
      setInitialDateRange(range);
    }
  }, [isDialogOpen, viewingProject?.id, projectAssignments, initialDateRange]);

  // Group projects by brand
  // In default state: show all brands even if they have no projects
  // In search state: show brands that match the search OR have matching projects
  const projectsByBrand = brands
    .map((brand) => ({
      brand,
      projects: projects.filter((p) => p.brandId === brand.id),
    }))
    .filter(({ brand, projects: brandProjects }) => {
      // If there's no search, show all brands
      if (!debouncedSearch) return true;

      // If searching, show brands that match the search or have matching projects
      const brandNameMatches = brand.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const hasMatchingProjects = brandProjects.length > 0;

      return brandNameMatches || hasMatchingProjects;
    });

  // Get currency symbol
  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  // Handler for saving team assignments
  const handleSaveTeamAssignments = async () => {
    setIsSaving(true);
    try {
      const assignmentStartDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const assignmentEndDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : assignmentStartDate;

      // 1. Create new assignments for pending employees
      const createPromises = pendingAssignments.map((pending) => {
        const deliverableIds = selectedDeliverablesByEmployee[pending.employeeId] || [];
        const deliverables = allDeliverables.filter(d => deliverableIds.includes(String(d.id)));
        const deliverableNames = deliverables.map(d => d.deliverableNameNew || d.deliverableName).join(", ");

        const note = deliverableNames
          ? `Assigned to project - Deliverables: ${deliverableNames}. Set dates and hours as needed.`
          : "Assigned to project - set dates and hours as needed.";

        return fetch('/api/assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId: pending.employeeId,
            projectId: viewingProject!.id,
            taskId: null,
            startDate: assignmentStartDate,
            endDate: assignmentEndDate,
            hoursPerDay: "0",
            allocationPercentage: null,
            isTimeOff: false,
            timeOffTypeId: null,
            category: null,
            isBillable: true,
            status: "draft",
            note,
            createdById: null,
          }),
        });
      });

      // 2. Update existing assignments with changed deliverables
      const updatePromises = unsavedDeliverableChanges.map((change) => {
        // Find the assignment for this employee on this project
        const assignment = projectAssignments.find(a => a.employeeId === change.employeeId);
        if (!assignment) return Promise.resolve();

        const deliverableIds = change.deliverableIds;
        const deliverables = allDeliverables.filter(d => deliverableIds.includes(String(d.id)));
        const deliverableNames = deliverables.map(d => d.deliverableNameNew || d.deliverableName).join(", ");

        const note = deliverableNames
          ? `Assigned to project - Deliverables: ${deliverableNames}. ${assignment.note ? `(Original: ${assignment.note})` : ''}`
          : assignment.note || "Assigned to project";

        return fetch(`/api/assignments/${assignment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note,
          }),
        });
      });

      // 3. Update existing assignments with new date range
      const dateRangeUpdatePromises = hasDateRangeChanged
        ? projectAssignments.map((a) =>
            fetch(`/api/assignments/${a.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ startDate: assignmentStartDate, endDate: assignmentEndDate }),
            })
          )
        : [];

      await Promise.all([...createPromises, ...updatePromises, ...dateRangeUpdatePromises]);

      // Update initial deliverables to match current selections (mark as saved)
      const newInitialDeliverables: Record<string, string[]> = { ...initialDeliverablesByEmployee };

      // Add newly created assignments to initial state
      for (const pending of pendingAssignments) {
        const deliverableIds = selectedDeliverablesByEmployee[pending.employeeId];
        if (deliverableIds) {
          newInitialDeliverables[pending.employeeId] = deliverableIds;
        }
      }

      // Add changed deliverables to initial state
      for (const change of unsavedDeliverableChanges) {
        newInitialDeliverables[change.employeeId] = change.deliverableIds;
      }

      setInitialDeliverablesByEmployee(newInitialDeliverables);

      // Reset initial date range after save
      if (hasDateRangeChanged && dateRange?.from && dateRange?.to) {
        setInitialDateRange({ from: dateRange.from, to: dateRange.to });
      }

      // Clear pending assignments after successful save
      setPendingAssignments([]);

      // Invalidate queries to refetch data
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["assignmentsByProject", viewingProject!.id] });
    } catch (error) {
      console.error("Failed to save assignments:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for removing a pending assignment
  const handleRemovePending = (employeeId: string) => {
    setPendingAssignments(prev => prev.filter(p => p.employeeId !== employeeId));
    // Also clear selected deliverable for this employee
    setSelectedDeliverablesByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  // Handler for deleting a saved assignment
  const handleDeleteSavedAssignment = (employeeId: string) => {
    const assignment = projectAssignments.find(a => a.employeeId === employeeId);
    if (!assignment?.id) return;

    // Clean up local state
    setSelectedDeliverablesByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
    setInitialDeliverablesByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });

    deleteAssignment.mutate(assignment.id, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["assignmentsByProject", viewingProject!.id] });
      },
    });
  };

  const { sentinelRef, isStuck } = useIsStuck(40);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div ref={sentinelRef} className="h-px -mt-px invisible" />
        <div className={cn("sticky top-10 z-10 bg-background py-3 px-2 flex items-center justify-between transition-shadow duration-200", isStuck && "shadow-sm")}>
          <div>
            <h3 className="text-lg font-semibold">Projects</h3>
            <p className="text-sm text-muted-foreground">
              Manage projects within your brands
            </p>
          </div>
          <div className="relative">
            <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="project-search-input"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>

        {/* Projects List grouped by Brand */}
        <div className="space-y-6">
          {projectsByBrand.length === 0 && !projectsLoading && debouncedSearch ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:search-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects or brands found matching &quot;{debouncedSearch}&quot;</p>
            </div>
          ) : projectsByBrand.length === 0 && !projectsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:folder-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No brands yet. Create one in the Brands tab first.</p>
            </div>
          ) : (
            projectsByBrand.map(({ brand, projects: brandProjects }) => (
              <div key={brand.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <h4 className="font-medium text-sm">{brand.name}</h4>
                  <span className="text-xs text-muted-foreground">
                    ({brandProjects.length} projects)
                  </span>
                </div>

                {brandProjects.length === 0 ? (
                  projectsLoading ? (
                    <div className="grid gap-2 pl-5">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pl-5">
                      No projects yet
                    </div>
                  )
                ) : (
                  <div className="grid gap-2 pl-5">
                    {brandProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => handleOpenView(project)}
                        className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: project.color }}
                          >
                            <Icon icon="lucide:folder" className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{project.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {project.projectNumber || "No project number"} • {project.assignments?.length || 0} assignments
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Infinite scroll trigger */}
          <InfiniteScrollTrigger
            onLoadMore={handleLoadMore}
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            skeletonCount={3}
          >
            <div className="grid gap-2 pl-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </InfiniteScrollTrigger>
        </div>

        {/* View Project/Pitch Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setPendingAssignments([]);
            setSelectedDeliverablesByEmployee({});
          }
          setIsDialogOpen(open);
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {projectType === 'pitch' ? 'Pitch Details' : 'Project Details'}
              </DialogTitle>
              <DialogDescription>
                View {projectType} information
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6 py-4">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      {projectType === 'pitch' ? 'Pitch Name' : 'Project Name'} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="name"
                      value={name}
                      disabled
                      placeholder={projectType === 'pitch' ? "e.g., Nike Q1 2026 Pitch" : "e.g., Website Redesign"}
                    />
                  </div>

                  {projectType === 'campaign' && (
                    <div className="space-y-2">
                      <label htmlFor="projectNumber" className="text-sm font-medium">
                        Project Number <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                      </label>
                      <Input
                        id="projectNumber"
                        value={projectNumber}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        placeholder="Auto-generated from project name"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="brand" className="text-sm font-medium">
                      Brand <span className="text-red-500">*</span>
                    </label>
                    <Select value={brandId} disabled>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.id}>
                            {brand.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {projectType === 'pitch' ? (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="region" className="text-sm font-medium">
                          Region <span className="text-red-500">*</span>
                        </label>
                        <Select value={region} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Indonesia">Indonesia</SelectItem>
                            <SelectItem value="Singapore">Singapore</SelectItem>
                            <SelectItem value="Malaysia">Malaysia</SelectItem>
                            <SelectItem value="Thailand">Thailand</SelectItem>
                            <SelectItem value="Vietnam">Vietnam</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="pitchStatus" className="text-sm font-medium">
                          Status <span className="text-red-500">*</span>
                        </label>
                        <Select value={pitchStatus} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="introduction">Introduction</SelectItem>
                            <SelectItem value="waiting_for_brief">Waiting for brief</SelectItem>
                            <SelectItem value="proposal_development">Proposal development</SelectItem>
                            <SelectItem value="submit_or_presentation">Submit or Presentation</SelectItem>
                            <SelectItem value="waiting_for_feedback">Waiting for feedback</SelectItem>
                            <SelectItem value="negotiation">Negotiation</SelectItem>
                            <SelectItem value="won">Won</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                            <SelectItem value="missing">Missing</SelectItem>
                            <SelectItem value="withdraw">Withdraw</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="businessUnit" className="text-sm font-medium">
                          Business Unit
                        </label>
                        <Select value={businessUnitId} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select business unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {businessUnits.map((bu) => (
                              <SelectItem key={bu.id} value={bu.id}>
                                {bu.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="projectCategory" className="text-sm font-medium">
                          Project Category
                        </label>
                        <Select value={projectCategoryId} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {projectCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="status" className="text-sm font-medium">
                          Status
                        </label>
                        <Select value={status} disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="planning">Planning</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Color</label>
                        <div className="flex gap-2 flex-wrap">
                          {PROJECT_COLORS.map((c) => (
                            <div
                              key={c}
                              className={cn(
                                "w-8 h-8 rounded-full",
                                color === c && "ring-2 ring-offset-2 ring-primary"
                              )}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Budget & Financial Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Budget & Financial</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="currency" className="text-sm font-medium">
                      Currency <span className="text-red-500">*</span>
                    </label>
                    <Select value={currency} disabled>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((curr) => (
                          <SelectItem key={curr.code} value={curr.code}>
                            {curr.symbol} {curr.code} - {curr.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="budget" className="text-sm font-medium">
                      {projectType === 'pitch' ? 'Est. Budget (excl VAT)' : 'Budget'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {getCurrencySymbol(currency)}
                      </span>
                      <Input
                        id="budget"
                        type="number"
                        step="0.01"
                        value={budget}
                        disabled
                        placeholder="0.00"
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {projectType === 'campaign' && (
                    <>
                      <div className="space-y-2">
                        <label htmlFor="asf" className="text-sm font-medium">
                          ASF (Administrative Service Fee)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {getCurrencySymbol(currency)}
                          </span>
                          <Input
                            id="asf"
                            type="number"
                            step="0.01"
                            value={asf}
                            disabled
                            placeholder="0.00"
                            className="pl-8"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="grandTotal" className="text-sm font-medium">
                          Grand Total <span className="text-xs text-muted-foreground">(Auto-calculated)</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {getCurrencySymbol(currency)}
                          </span>
                          <Input
                            id="grandTotal"
                            value={grandTotal}
                            readOnly
                            disabled
                            className="bg-muted cursor-not-allowed pl-8 font-semibold"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="quotationReference" className="text-sm font-medium">
                          Quotation Reference
                        </label>
                        <Input
                          id="quotationReference"
                          value={quotationReference}
                          disabled
                          placeholder="e.g., QT-2026-0001"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="ioFile" className="text-sm font-medium">
                          IO File (URL)
                        </label>
                        <Input
                          id="ioFile"
                          value={ioFile}
                          disabled
                          placeholder="https://example.com/io-file.pdf"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Notes
                    </label>
                    <Textarea
                      id="notes"
                      value={notes}
                      disabled
                      placeholder="Additional notes"
                      rows={3}
                    />
                  </div>
                </div>
              </div>



              {/* Channels & Deliverables Section (PITCH ONLY) */}
              {projectType === 'pitch' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="text-sm font-semibold text-foreground">Channels & Deliverables</h3>
                  </div>

                  {projectChannels.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                      No channels added yet. Click "Add Channel" to get started.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {projectChannels.map((channel, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Channel <span className="text-red-500">*</span>
                              </label>
                              <Select
                                value={channel.channelId}
                                disabled
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select channel" />
                                </SelectTrigger>
                                <SelectContent>
                                  {channels.map((ch) => (
                                    <SelectItem key={ch.id} value={ch.id}>
                                      {ch.channelName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">
                                Deliverable <span className="text-red-500">*</span>
                              </label>
                              <Select
                                value={channel.deliverableId}
                                disabled
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select deliverable" />
                                </SelectTrigger>
                                <SelectContent>
                                  {getDeliverablesForChannel(channel.channelId).map((del) => (
                                    <SelectItem key={del.id} value={del.id}>
                                      {del.deliverableName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Quantity</label>
                              <Input
                                value={channel.quantity}
                                disabled
                                placeholder="e.g., 5 posts"
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-sm font-medium">Budget</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  {getCurrencySymbol(currency)}
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={channel.channelBudget}
                                  disabled
                                  placeholder="0.00"
                                  className="pl-8"
                                />
                              </div>
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <label className="text-sm font-medium">Man Hours</label>
                              <Input
                                value={channel.manHours}
                                disabled
                                placeholder="e.g., 40 hours"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Manage Team Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Project Periode</label>
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
                          <Icon icon="lucide:calendar" className="h-3.5 w-3.5" />
                          {dateRange?.from && dateRange?.to
                            ? `${format(dateRange.from, "MMM yyyy")} - ${format(dateRange.to, "MMM yyyy")}`
                            : "Select date range"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={setDateRange}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    {dateRange?.from && dateRange?.to && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setDateRange(undefined)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="border-b pb-2">
                  <h3 className="text-sm font-semibold text-foreground">Manage Team</h3>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left text-sm font-medium p-3 w-[30%]">Name</th>
                        <th className="text-left text-sm font-medium p-3 w-[35%]">Deliverables</th>
                        <th className="text-left text-sm font-medium p-3 w-[25%]">Total % Allocated</th>
                        <th className="text-left text-sm font-medium p-3 w-[10%]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((member) => {
                        const isPending = pendingAssignments.some(p => p.employeeId === member.id);
                        const hasChangedDeliverable = unsavedDeliverableChanges.some(c => c.employeeId === member.id);

                        return (
                          <tr key={member.id} className="border-b last:border-b-0">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="font-medium text-sm">{member.fullName}</div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {member.position}{member.department ? ` • ${member.department.name}` : ""}
                                  </div>
                                </div>
                                {isPending && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemovePending(member.id)}
                                    title="Remove pending assignment"
                                  >
                                    <Icon icon="lucide:x" className="h-3 w-3" />
                                  </Button>
                                )}
                                {hasChangedDeliverable && !isPending && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="shrink-0 h-6 w-6 text-gray-600 hover:text-gray-700 hover:bg-gray-50"
                                    onClick={() => {
                                      setSelectedDeliverablesByEmployee(prev => ({
                                        ...prev,
                                        [member.id]: initialDeliverablesByEmployee[member.id] || [],
                                      }));
                                    }}
                                    title="Undo deliverable change"
                                  >
                                    <Icon icon="lucide:undo" className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start text-left font-normal min-h-[32px] h-auto py-1"
                                  >
                                    {selectedDeliverablesByEmployee[member.id]?.length > 0 ? (
                                      <div className="flex flex-col gap-1 w-full">
                                        {selectedDeliverablesByEmployee[member.id].map(id => {
                                          const del = allDeliverables.find(d => String(d.id) === String(id));
                                          return (
                                            <Badge key={id} variant="secondary" className="text-sm font-normal px-2 py-0.5 w-fit">
                                              {del?.deliverableNameNew || del?.deliverableName || "Unknown"}
                                            </Badge>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">Select deliverables</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-2" align="start">
                                  <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                    {projectDeliverables.length > 0 ? (
                                      projectDeliverables.map((del) => {
                                        const isSelected = selectedDeliverablesByEmployee[member.id]?.includes(String(del.id)) ?? false;
                                        return (
                                          <div
                                            key={del.id}
                                            className="flex items-center space-x-2 p-1.5 hover:bg-accent rounded-md cursor-pointer transition-colors"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              setSelectedDeliverablesByEmployee(prev => {
                                                const current = prev[member.id] || [];
                                                const next = isSelected
                                                  ? current.filter(id => id !== String(del.id))
                                                  : [...current, String(del.id)];
                                                return { ...prev, [member.id]: next };
                                              });
                                            }}
                                          >
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={() => { }} // Handled by div onClick
                                            />
                                            <span className="text-sm select-none">{del.deliverableNameNew || del.deliverableName}</span>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="p-2 text-sm text-muted-foreground text-center">
                                        No deliverables available
                                      </div>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground whitespace-pre-line">
                              {Array.isArray(member.allocationPercentage) && member.allocationPercentage.length > 0 ? (
                                <div className="flex flex-col">
                                  {member.allocationPercentage.map((line, idx) => (
                                    <div key={idx}>{line}</div>
                                  ))}
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-3">
                              {!isPending && !hasChangedDeliverable && (
                                <Popover>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="shrink-0 h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          disabled={deleteAssignment.isPending}
                                        >
                                          <Icon icon="lucide:trash-2" className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remove from project</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <PopoverContent className="w-auto p-3" align="start">
                                    <div className="space-y-3">
                                      <p className="text-sm font-medium">Remove {member.fullName} from this project?</p>
                                      <div className="flex items-center gap-2 justify-end">
                                        <PopoverClose asChild>
                                          <Button variant="outline" size="sm">Cancel</Button>
                                        </PopoverClose>
                                        <Button
                                          variant="destructive"
                                          size="sm"
                                          onClick={() => handleDeleteSavedAssignment(member.id)}
                                          disabled={deleteAssignment.isPending}
                                        >
                                          {deleteAssignment.isPending ? (
                                            <Icon icon="lucide:loader-2" className="h-3.5 w-3.5 animate-spin" />
                                          ) : "Remove"}
                                        </Button>
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-b last:border-b-0">
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsAssignEmployeesOpen(true)}
                            disabled={!session?.access.can_view_all}
                          >
                            <Icon icon="lucide:plus" className="h-4 w-4 mr-1" />
                            Assign Team
                          </Button>
                        </td>
                        <td className="p-3">
                          <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground font-normal" disabled>
                            Select deliverable
                          </Button>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">-</td>
                        <td className="p-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Save button for pending/changed assignments */}
                {hasUnsavedChanges && (
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex justify-end pt-4 border-t w-full">
                      <Button
                        onClick={handleSaveTeamAssignments}
                        disabled={isSaving || !allHaveDeliverables || !dateRange?.from || !dateRange?.to}
                      >
                        {isSaving ? (
                          <>
                            <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:save" className="h-4 w-4 mr-1" />
                            Save Team Assignments
                          </>
                        )}
                      </Button>
                    </div>
                    {!allHaveDeliverables && (
                      <p className="text-xs text-amber-600">
                        Please select deliverables for all pending employees
                      </p>
                    )}
                    {(!dateRange?.from || !dateRange?.to) && (
                      <p className="text-xs text-amber-600">
                        Please select a project periode date range
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Employees Dialog */}
        {viewingProject && (
          <AssignEmployeesDialog
            open={isAssignEmployeesOpen}
            onOpenChange={setIsAssignEmployeesOpen}
            projectId={viewingProject.id}
            projectName={viewingProject.name}
            projectColor={viewingProject.color}
            onAssignPending={(employeeIds) => {
              // Add to pending list instead of saving immediately
              setPendingAssignments(prev => [
                ...prev,
                ...employeeIds.map(empId => ({ employeeId: empId }))
              ]);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
