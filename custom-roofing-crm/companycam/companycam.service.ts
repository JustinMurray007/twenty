/**
 * CompanyCam REST API Client (API v2)
 * Handles automated project provisioning, photo queries, and share links
 */

export interface CompanyCamAddress {
  street_address_1: string;
  street_address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
}

export interface CompanyCamCoordinates {
  lat: number;
  lon: number;
}

export interface CreateProjectPayload {
  name: string;
  address?: CompanyCamAddress;
  coordinates?: CompanyCamCoordinates;
  featured_image_url?: string;
  geofence?: Array<{ lat: number; lon: number }>;
}

export interface CompanyCamProjectResponse {
  id: string;
  company_id: string;
  creator_id: string;
  name: string;
  status: string;
  address: CompanyCamAddress;
  coordinates?: CompanyCamCoordinates;
  created_at: number;
  updated_at: number;
  public_url: string;
}

export interface CompanyCamPhoto {
  id: string;
  project_id: string;
  creator_name: string;
  captured_at: number;
  created_at: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  has_annotations: boolean;
  uris: Array<{
    type: 'thumbnail' | 'medium' | 'large' | 'original';
    url: string;
  }>;
  tags?: Array<{ id: string; display_value: string }>;
}

export class CompanyCamService {
  private readonly baseUrl = 'https://api.companycam.com/v2';
  private readonly apiToken: string;

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.COMPANYCAM_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn(
        '[CompanyCamService] WARNING: COMPANYCAM_API_TOKEN is not set. API calls will fail until configured.',
      );
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  /**
   * Provisions a new project in CompanyCam matching the Twenty Opportunity/Job
   */
  async createProject(
    payload: CreateProjectPayload,
  ): Promise<CompanyCamProjectResponse> {
    const url = `${this.baseUrl}/projects`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[CompanyCamService] Failed to create project: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as CompanyCamProjectResponse;
    return data;
  }

  /**
   * Retrieves an existing project by ID
   */
  async getProject(projectId: string): Promise<CompanyCamProjectResponse> {
    const url = `${this.baseUrl}/projects/${projectId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[CompanyCamService] Failed to get project ${projectId}: ${response.status} - ${errorText}`,
      );
    }

    return (await response.json()) as CompanyCamProjectResponse;
  }

  /**
   * Fetches photos associated with a CompanyCam project
   */
  async listProjectPhotos(
    projectId: string,
    limit = 50,
  ): Promise<CompanyCamPhoto[]> {
    const url = `${this.baseUrl}/projects/${projectId}/photos?per_page=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `[CompanyCamService] Failed to fetch photos for project ${projectId}: ${response.status} - ${errorText}`,
      );
    }

    return (await response.json()) as CompanyCamPhoto[];
  }

  /**
   * Creates or retrieves a public share link for homeowners / insurance adjusters
   */
  async createProjectShareLink(projectId: string): Promise<string> {
    const url = `${this.baseUrl}/projects/${projectId}/share_links`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        type: 'project',
      }),
    });

    if (!response.ok) {
      // Fallback to standard web app project link if share link fails
      return `https://app.companycam.com/projects/${projectId}`;
    }

    const data = (await response.json()) as { url?: string; key?: string };
    return data.url || `https://app.companycam.com/projects/${projectId}`;
  }

  /**
   * Helper to format human-friendly project launch URL
   */
  getProjectWebUrl(projectId: string): string {
    return `https://app.companycam.com/projects/${projectId}`;
  }
}
