import { NextResponse } from "next/server";
import { getMySqlApiClient } from "@/lib/mysql/api-client";
import { getSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  try {
    // Get session for authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const brandId = searchParams.get("brandId");
    const limit = searchParams.get("limit");
    const offset = searchParams.get("offset");
    const search = searchParams.get("search");

    // Get API client with session token
    const client = getMySqlApiClient(async () => session.access_token);

    const isPaginated = limit !== null || offset !== null;

    // Helper to fetch all pages from an API endpoint
    async function fetchAllPages(
      fetchFn: (params: any) => Promise<any>,
      params: { search?: string; brand_id?: string; include: string },
    ): Promise<any[]> {
      const allItems: any[] = [];
      let currentPage = 1;
      const pageSize = 500;
      let hasMore = true;

      while (hasMore) {
        const response = await fetchFn({
          ...params,
          page: currentPage,
          per_page: pageSize,
        });

        if (response?.error) break;

        const items = response?.data?.data || response?.data || [];
        allItems.push(...items);

        const meta = response?.data?.meta || response?.meta;
        const lastPage = meta?.last_page || 1;
        hasMore = currentPage < lastPage;
        currentPage++;
      }

      return allItems;
    }

    let campaignsData: any[];
    let pitchesData: any[];
    let hasMore: boolean;

    if (isPaginated) {
      // Paginated mode (infinite scroll) - fetch single page
      const perPage = limit ? parseInt(limit, 10) : 50;
      const page = offset ? Math.floor(parseInt(offset, 10) / perPage) + 1 : 1;

      const [campaignsResponse, pitchesResponse] = await Promise.all([
        client.getCampaigns({
          page,
          per_page: perPage,
          search: search || undefined,
          brand_id: brandId || undefined,
          include: 'channels',
        }),
        client.getPitches({
          page,
          per_page: perPage,
          search: search || undefined,
          brand_id: brandId || undefined,
          include: 'channels',
        }),
      ]);

      if (campaignsResponse?.error && pitchesResponse?.error) {
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to fetch campaigns and pitches',
            campaignsError: campaignsResponse.error.message,
            pitchesError: pitchesResponse.error.message,
            data: [],
          },
          { status: 500 }
        );
      }

      campaignsData = campaignsResponse?.data?.data || campaignsResponse?.data || [];
      pitchesData = pitchesResponse?.data?.data || pitchesResponse?.data || [];
      hasMore = (campaignsData.length + pitchesData.length) >= perPage;
    } else {
      // Non-paginated mode - fetch all pages internally
      const fetchParams = {
        search: search || undefined,
        brand_id: brandId || undefined,
        include: 'channels',
      };

      [campaignsData, pitchesData] = await Promise.all([
        fetchAllPages(client.getCampaigns.bind(client), fetchParams),
        fetchAllPages(client.getPitches.bind(client), fetchParams),
      ]);
      hasMore = false;
    }

    // Transform campaigns to projects
    const campaignProjects = campaignsData.map((campaign: any) => ({
      id: campaign.uuid,
      projectNumber: campaign.io_number,
      name: campaign.campaign_name,
      brandId: campaign.brand_id !== null && campaign.brand_id !== undefined ? String(campaign.brand_id) : null,
      companyId: String(campaign.company_id),
      currency: campaign.currency,
      budget: campaign.budget,
      asf: campaign.asf,
      grandTotal: campaign.grand_total,
      startDate: campaign.start_date,
      endDate: campaign.end_date,
      notes: campaign.notes,
      ioFile: campaign.io_file,
      state: campaign.state,
      status: campaign.flag === 'active' ? 'active' : campaign.flag === 'inactive' ? 'completed' : 'planning',
      quotationReference: campaign.quotation_reference,
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: 'campaign' as const,
      entity: null,
      description: null,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      createdById: null,
      // Pitch-specific fields (null for campaigns)
      region: null,
      submitDate: null,
      pitchStatus: null,
      valueTotalEstimate: null,
      hsDealId: null,
      brand: campaign.brand ? {
        id: String(campaign.brand_id),
        name: campaign.brand.brand_name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
      } : undefined,
      company: campaign.company,
      channels: campaign.channels,
    }));

    // Transform pitches to projects
    const pitchProjects = pitchesData.map((pitch: any) => ({
      id: pitch.uuid,
      projectNumber: pitch.pitch_number,
      name: pitch.pitch_name,
      brandId: pitch.brand_id !== null && pitch.brand_id !== undefined ? String(pitch.brand_id) : null,
      companyId: null,
      currency: pitch.currency,
      budget: pitch.budget,
      asf: null,
      grandTotal: pitch.value_total,
      startDate: null,
      endDate: null,
      notes: pitch.notes,
      ioFile: null,
      state: null,
      status: pitch.status === 'win' ? 'completed' : pitch.status === 'loss' ? 'cancelled' : 'planning',
      quotationReference: null,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at,
      businessUnitId: null,
      projectCategoryId: null,
      projectTypeId: null,
      projectType: 'pitch' as const,
      entity: null,
      description: null,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      createdById: pitch.author?.uuid || null,
      // Pitch-specific fields
      region: pitch.region || null,
      submitDate: pitch.date_submit || null,
      pitchStatus: pitch.status === 'on_going' ? 'proposal_development' : pitch.status === 'win' ? 'won' : pitch.status === 'loss' ? 'lost' : null,
      valueTotalEstimate: pitch.value_total ? String(pitch.value_total) : null,
      hsDealId: null,
      brand: pitch.brand ? {
        id: String(pitch.brand_id),
        name: pitch.brand.brand_name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16),
      } : undefined,
      company: null,
      channels: pitch.channels,
    }));

    // Combine both project types
    const data = [...campaignProjects, ...pitchProjects];

    // No client-side filtering needed - MySQL API handles it
    const filteredData = data;

    const total = filteredData.length;

    return NextResponse.json({
      success: true,
      data: filteredData,
      total,
      hasMore,
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
